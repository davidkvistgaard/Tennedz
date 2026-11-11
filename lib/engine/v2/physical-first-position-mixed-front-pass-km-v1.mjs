// A paid front pass in a peloton with already detached rear roads.
// The passing peloton uses the established rotation physics. Rear wheels
// continue on the same clock and must retain measured contact topology;
// a new contact or drop needs its own contract and fails closed here.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION} from
  './physical-first-position-rotation-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION} from
  './physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from './tuning.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';

export const PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION=
  'physical-first-position-mixed-front-pass-km-1';
const STEP_SECONDS=.25;
const EPS=1e-6;

const componentsFor=(positions,thresholdM)=>{
  const sorted=[...positions].sort((a,b)=>
    b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  const groups=[];
  for(const row of sorted){
    if(!groups.length||groups.at(-1).at(-1).distanceM-
      row.distanceM>thresholdM+EPS)groups.push([]);
    groups.at(-1).push(row);
  }
  return groups.map(group=>group.map(row=>
    row.riderId).sort());
};

const speedFor=(source,segment,energy,role)=>{
  const order=orderAt(source.team.orders,
    segment.km-1);
  const ability=riderKilometreEffect(source.rider,
    segment,{phase:role==='sheltered'?'cruise':'solo',
      energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (role==='sheltered'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0);
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Mixed pass lacks a rear-road speed.');
  return 1000/seconds;
};

export function advancePhysicalFirstPositionMixedFrontPassKmV1({
  prior,segment,input}){
  const km=prior?.sourceKm+1;
  if(prior?.version!==
      PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION||
    !Number.isInteger(km)||km<2||
    segment?.km!==km||
    !isDeepStrictEqual(segment,
      input?.kilometres?.[km-1])||
    Math.abs(prior.positions?.[0]?.distanceM-
      (km-1)*1000)>EPS||
    !prior.positions.some(row=>
      row.roadId!=='peloton'))
    throw new Error('Mixed pass needs existing paid rear roads.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:prior.grid});
  if(prior.inputHash!==start.inputHash)
    throw new Error('Mixed pass changed committed inputs.');
  const pelotonBefore=prior.positions.filter(row=>
    row.roadId==='peloton');
  const rearBefore=prior.positions.filter(row=>
    row.roadId!=='peloton');
  const legacyInput={...input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_VERSION};
  const legacyStart=createPhysicalFirstPositionStartV1({
    input:legacyInput,grid:prior.grid});
  const paidPeloton=advancePhysicalFirstPositionRotationKmV1({
    prior:{...prior,
      version:
        PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
      inputHash:legacyStart.inputHash,
      positions:pelotonBefore,
      separateRoadRiderIds:rearBefore.map(row=>
        row.riderId)},
    segment,input:legacyInput});
  if(paidPeloton.event?.type!==
      'paid_front_pass'||
    !Number.isFinite(paidPeloton.secondSpeedMps))
    throw new Error('Mixed pass lacks a payable overtake.');
  const pass=paidPeloton.event;
  const firstSeconds=paidPeloton.firstSeconds;
  const secondSeconds=paidPeloton.secondSeconds;
  const totalSeconds=firstSeconds+secondSeconds;
  const oldSpeed=paidPeloton.firstSpeedMps;
  const newSpeed=paidPeloton.secondSpeedMps;
  const surgeSpeed=pass.surgeDistanceM/
    firstSeconds;
  const pelotonAt=elapsed=>pelotonBefore.map(row=>({
    riderId:row.riderId,lane:row.lane,
    distanceM:row.distanceM+
      (elapsed<=firstSeconds?
        (row.riderId===pass.toRiderId?
          surgeSpeed:oldSpeed)*elapsed:
        (row.riderId===pass.toRiderId?
          pass.surgeDistanceM:
          paidPeloton.firstSpeedMps*
            firstSeconds)+
          newSpeed*(elapsed-firstSeconds))}));
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const rear=rearBefore.map(row=>({...row,
    startDistanceM:row.distanceM,
    legs:[]}));
  if(sources.size!==prior.positions.length||
    rear.some(row=>sources.get(row.riderId)
      ?.team.id!==row.teamId))
    throw new Error('Mixed pass lacks committed rear riders.');
  const contactThresholdM=prior.grid.wheelSpacingM*2;
  const startingComponents=componentsFor(
    prior.positions,contactThresholdM);
  if(!isDeepStrictEqual(startingComponents,
    prior.contactComponents))
    throw new Error('Mixed pass changed its existing contact.');
  const crossings=[];
  let elapsedSeconds=0;
  for(const phaseEnd of [firstSeconds,totalSeconds]){
    while(elapsedSeconds<phaseEnd-EPS){
      const stepSeconds=Math.min(STEP_SECONDS,
        phaseEnd-elapsedSeconds);
      const startPeloton=pelotonAt(elapsedSeconds);
      const ranked=[...startPeloton,...rear]
        .sort((a,b)=>b.distanceM-a.distanceM||
          a.riderId.localeCompare(b.riderId));
      const sheltered=new Set();
      for(let index=1;index<ranked.length;index++){
        if(ranked[index-1].distanceM-
          ranked[index].distanceM<=contactThresholdM+EPS)
          sheltered.add(ranked[index].riderId);
      }
      const endPeloton=pelotonAt(
        elapsedSeconds+stepSeconds);
      const laneAhead=new Map();
      for(const row of endPeloton.sort((a,b)=>
        b.distanceM-a.distanceM))
        laneAhead.set(row.lane,row);
      const rearRanked=[...rear].sort((a,b)=>
        b.distanceM-a.distanceM||
        a.riderId.localeCompare(b.riderId));
      for(const row of rearRanked){
        const oldDistanceM=row.distanceM;
        const role=sheltered.has(row.riderId)?
          'sheltered':'leader';
        const ahead=laneAhead.get(row.lane);
        const cap=ahead?
          ahead.distanceM-prior.grid.wheelSpacingM:
          Number.POSITIVE_INFINITY;
        const speed=speedFor(sources.get(row.riderId),
          segment,row.energy,role);
        const travelM=Math.max(0,
          Math.min(speed*stepSeconds,
            cap-row.distanceM));
        row.distanceM+=travelM;
        laneAhead.set(row.lane,row);
        if(travelM>EPS){
          const leg=row.legs.at(-1);
          if(leg?.role===role)
            leg.distanceM+=travelM;
          else row.legs.push({role,
            distanceM:travelM});
        }
        for(let markerKm=1;markerKm<=km;
          markerKm++){
          const lineDistanceM=markerKm*1000;
          if(oldDistanceM>=lineDistanceM-EPS||
            row.distanceM<lineDistanceM-EPS)
            continue;
          if(travelM<=EPS)
            throw new Error('Mixed pass has an unpaid crossing.');
          crossings.push({riderId:row.riderId,
            km:markerKm,lineDistanceM,
            clockSeconds:prior.clockSeconds+
              elapsedSeconds+stepSeconds*
                (lineDistanceM-oldDistanceM)/
                travelM});
        }
      }
      elapsedSeconds+=stepSeconds;
      const current=componentsFor([
        ...pelotonAt(elapsedSeconds),...rear],
      contactThresholdM);
      if(!isDeepStrictEqual(current,
        startingComponents))
        throw new Error('Mixed pass needs a paid contact transition.');
    }
  }
  const byPaidId=new Map(paidPeloton.positions
    .map(row=>[row.riderId,row]));
  if(pelotonAt(totalSeconds).some(row=>
    Math.abs(row.distanceM-
      byPaidId.get(row.riderId).distanceM)>EPS))
    throw new Error('Mixed pass lost the priced peloton.');
  const rearDecisions=[];
  const rearPositions=rear.map(row=>{
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,
      km-1);
    let energy=row.energy;
    let paidFromReserve=0;
    for(const leg of row.legs){
      let distanceM=leg.distanceM;
      while(distanceM>EPS){
        const part=Math.min(1000,distanceM);
        const paid=priceRearEnergyDemandV1({
          rider:source.rider,segment,
          energyBefore:energy,
          effort:order.effort,
          role:leg.role,distanceM:part});
        energy=paid.energyAfter;
        paidFromReserve+=paid.energyDemand;
        distanceM-=part;
      }
    }
    const recovery=recoveryForKilometre({
      rider:source.rider,segment,
      effort:order.effort,
      group:row.roadId,
      working:row.legs.some(leg=>
        leg.role==='leader'),
      quietKm:row.quietKm});
    const cap=replayRearEnergyCapV1({
      rider:source.rider,
      kilometres:input.kilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      energy+recovery.recovery).toFixed(3);
    const travelledM=row.distanceM-
      row.startDistanceM;
    if(Math.abs(row.legs.reduce((sum,leg)=>
      sum+leg.distanceM,0)-travelledM)>EPS)
      throw new Error('Mixed rear rider has unpaid distance.');
    rearDecisions.push({
      riderId:row.riderId,
      role:'rear_road_movement',
      energyBefore:row.energy,
      paidDistanceM:travelledM,
      paidFromReserve,
      recoveryAward:recovery.recovery,
      energyAfter,legs:row.legs});
    const {startDistanceM,legs,...position}=row;
    return {...position,
      paidDistanceM:row.paidDistanceM+
        travelledM,
      energy:energyAfter,
      quietKm:recovery.quietKm};
  });
  const positions=[...paidPeloton.positions,
    ...rearPositions].sort((a,b)=>
    b.distanceM-a.distanceM||
      a.riderId.localeCompare(b.riderId));
  const endComponents=componentsFor(positions,
    contactThresholdM);
  if(!isDeepStrictEqual(endComponents,
    startingComponents)||
    positions[0].riderId!==pass.toRiderId||
    positions.length!==prior.positions.length)
    throw new Error('Mixed pass changed unpriced road membership.');
  return {version:
    PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION,
  sourceStartVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  basePhysicsVersion:
    PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
  inputHash:prior.inputHash,
  raceSeed:prior.raceSeed,
  grid:{...prior.grid},
  sourceKm:km,
  clockSeconds:paidPeloton.clockSeconds,
  frontDistanceM:km*1000,
  leaderRiderId:pass.toRiderId,
  proposedLeaderRiderId:
    paidPeloton.proposedLeaderRiderId,
  leaderPlan:paidPeloton.leaderPlan,
  firstSeconds,secondSeconds,
  firstSpeedMps:oldSpeed,
  secondSpeedMps:newSpeed,
  event:pass,
  contactEvents:[],
  contactComponents:endComponents,
  decisions:[...paidPeloton.decisions,
    ...rearDecisions],
  checkpointCrossings:[
    ...paidPeloton.checkpointCrossings,
    ...crossings].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId)),
  positions,
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionMixedFrontPassKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionMixedFrontPassKmV1(input)))
    throw new Error('Mixed pass differs from paid movement.');
  return recorded;
}
