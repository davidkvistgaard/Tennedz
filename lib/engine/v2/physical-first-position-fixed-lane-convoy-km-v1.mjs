// Experimental fixed-lane convoy. Each rider moves on a paid road;
// a rider cannot pass another wheel in the same lane in this version.
// Contact components come only from the measured positions after motion.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
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
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION} from
  './physical-first-position-rotation-km-v1.mjs';

export const PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION=
  'physical-first-position-fixed-lane-convoy-km-1';
const STEP_SECONDS=.25;
const EPS=1e-6;

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
    throw new Error('Fixed-lane convoy lacks payable speed.');
  return 1000/seconds;
};

const componentsFor=(motion,thresholdM)=>{
  const sorted=[...motion].sort((a,b)=>
    b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  const groups=[];
  for(const row of sorted){
    if(!groups.length||groups.at(-1).at(-1).distanceM-
      row.distanceM>thresholdM+EPS)groups.push([]);
    groups.at(-1).push(row);
  }
  return groups.map(group=>group.map(row=>row.riderId).sort());
};

const topology=(components)=>JSON.stringify(components);

export function advancePhysicalFirstPositionFixedLaneConvoyKmV1({
  prior,segment,input}){
  const km=prior?.sourceKm+1;
  if(![PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION]
    .includes(prior?.version)||
    !Number.isInteger(km)||km<1||
    segment?.km!==km||
    !isDeepStrictEqual(segment,
      input?.kilometres?.[km-1])||
    !Number.isFinite(prior?.clockSeconds)||
    !Number.isFinite(prior?.positions?.[0]
      ?.distanceM)||
    Math.abs(prior.positions[0].distanceM-
      (km-1)*1000)>EPS)
    throw new Error('Fixed-lane convoy needs a committed road.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:prior.grid});
  if(prior.inputHash!==start.inputHash||
    prior.version===PHYSICAL_FIRST_POSITION_START_V2_VERSION&&
      !isDeepStrictEqual(prior,start))
    throw new Error('Fixed-lane convoy changed its committed start.');
  if(prior.positions.length<2||
    input.teams.some(team=>{
      const order=orderAt(team.orders,km-1);
      return order.attack!=='none';
    }))
    throw new Error('Fixed-lane convoy cannot include an attack.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const motion=prior.positions.map(row=>({
    ...row,legs:[],startDistanceM:row.distanceM}));
  const front=motion[0];
  const frontSource=sources.get(front.riderId);
  if(!frontSource||sources.size!==motion.length)
    throw new Error('Fixed-lane convoy lacks a rider source.');
  const pelotonIds=prior.positions.filter(row=>
    row.roadId==='peloton').map(row=>row.riderId);
  const leaderPlan=planPhysicalFirstPelotonLeaderV1({
    prior:{sourceKm:km-1,
      roads:[{roadId:'peloton',riderIds:pelotonIds,
        clockSeconds:prior.clockSeconds}],
      riders:prior.positions.filter(row=>
        row.roadId==='peloton').map(row=>({
        riderId:row.riderId,teamId:row.teamId,
        roadId:'peloton',distanceM:(km-1)*1000,
        clockSeconds:prior.clockSeconds,
        reserve:row.energy,quietKm:row.quietKm}))},
    segment,teams:input.teams,stakes:input.stakes,
    emergencyFrontWorkers:
      input.emergencyFrontWorkers??[]});
  let frontPassRefusal=null;
  if(leaderPlan.leaderRiderId!==front.riderId){
    const legacyInput={...input,
      positionModelVersion:
        PHYSICAL_FIRST_POSITION_START_VERSION};
    const legacyStart=createPhysicalFirstPositionStartV1({
      input:legacyInput,grid:prior.grid});
    const legacyPrior={...prior,
      version:km===1?
        PHYSICAL_FIRST_POSITION_START_VERSION:
        PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
      inputHash:legacyStart.inputHash,
      positions:prior.positions.filter(row=>
        row.roadId==='peloton'),
      separateRoadRiderIds:prior.positions
        .filter(row=>row.roadId!=='peloton')
        .map(row=>row.riderId)};
    const attempt=advancePhysicalFirstPositionRotationKmV1({
      prior:legacyPrior,segment,
      input:legacyInput});
    if(attempt.event?.type!==
        'front_pass_refused'||
      attempt.leaderRiderId!==front.riderId)
      throw new Error('Fixed-lane convoy needs a paid front pass.');
    frontPassRefusal=attempt.event;
  }
  const frontSpeedMps=speedFor(frontSource,segment,
    front.energy,'leader');
  const durationSeconds=1000/frontSpeedMps;
  const contactThresholdM=prior.grid.wheelSpacingM*2;
  const speeds=new Map(motion.map(row=>{
    const source=sources.get(row.riderId);
    if(!source||source.team.id!==row.teamId)
      throw new Error('Fixed-lane convoy changed its roster.');
    return [row.riderId,{
      sheltered:speedFor(source,segment,
        row.energy,'sheltered'),
      leader:speedFor(source,segment,
        row.energy,'leader')}];
  }));
  const laneAhead=new Map();
  const predecessor=new Map();
  for(const row of motion){
    predecessor.set(row.riderId,
      laneAhead.get(row.lane)??null);
    laneAhead.set(row.lane,row);
  }
  let previous=componentsFor(motion,contactThresholdM);
  const contactEvents=[];
  const checkpointCrossings=[];
  let elapsedSeconds=0;
  while(elapsedSeconds<durationSeconds-EPS){
    const stepSeconds=Math.min(STEP_SECONDS,
      durationSeconds-elapsedSeconds);
    const ranked=[...motion].sort((a,b)=>
      b.distanceM-a.distanceM||
      a.riderId.localeCompare(b.riderId));
    const sheltered=new Set();
    for(let index=1;index<ranked.length;index++){
      if(ranked[index-1].distanceM-
        ranked[index].distanceM<=contactThresholdM+EPS)
        sheltered.add(ranked[index].riderId);
    }
    const before=motion.map(row=>row.distanceM);
    front.distanceM+=frontSpeedMps*stepSeconds;
    for(let index=1;index<motion.length;index++){
      const row=motion[index];
      const role=sheltered.has(row.riderId)?
        'sheltered':'leader';
      const ahead=predecessor.get(row.riderId);
      const cap=ahead?
        ahead.distanceM-prior.grid.wheelSpacingM:
        front.distanceM-row.lane*
          prior.grid.laneStaggerM;
      const desired=Math.min(frontSpeedMps,
        speeds.get(row.riderId)[role])*stepSeconds;
      const actual=Math.max(0,Math.min(desired,
        cap-row.distanceM));
      row.distanceM+=actual;
      if(actual>EPS){
        const last=row.legs.at(-1);
        if(last?.role===role)last.distanceM+=actual;
        else row.legs.push({role,distanceM:actual});
      }
    }
    const frontLeg=front.legs.at(-1);
    if(frontLeg)frontLeg.distanceM+=
      front.distanceM-before[0];
    else front.legs.push({role:'leader',
      distanceM:front.distanceM-before[0]});
    for(let index=0;index<motion.length;index++){
      const row=motion[index];
      for(let markerKm=1;markerKm<=km;
        markerKm++){
        const lineDistanceM=markerKm*1000;
        if(before[index]>=lineDistanceM-EPS||
          row.distanceM<lineDistanceM-EPS)
          continue;
        const travelM=row.distanceM-before[index];
        if(travelM<=EPS)
          throw new Error('Fixed-lane crossing lacks paid motion.');
        checkpointCrossings.push({
          riderId:row.riderId,km:markerKm,
          lineDistanceM,
          clockSeconds:prior.clockSeconds+
            elapsedSeconds+stepSeconds*
              (lineDistanceM-before[index])/
              travelM});
      }
    }
    elapsedSeconds+=stepSeconds;
    const current=componentsFor(motion,
      contactThresholdM);
    if(topology(current)!==topology(previous)){
      contactEvents.push({version:
        PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION,
      type:'paid_contact_topology_observation',
      sourceKm:km,
      observedAtClockSeconds:
        prior.clockSeconds+elapsedSeconds,
      observedAfterPaidStepSeconds:stepSeconds,
      components:current});
      previous=current;
    }
  }
  if(Math.abs(front.distanceM-km*1000)>EPS)
    throw new Error('Fixed-lane convoy lost its front line.');
  front.distanceM=km*1000;
  const endComponents=componentsFor(motion,
    contactThresholdM);
  const roadByRider=new Map(endComponents.flatMap(
    (component,index)=>component.map(riderId=>[
      riderId,index===0?'peloton':
        `rear:${index}`])));
  const decisions=[];
  const positions=motion.map(row=>{
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,
      km-1);
    let energy=row.energy;
    let paidFromReserve=0;
    for(const leg of row.legs){
      if(leg.distanceM>1000&&
        leg.distanceM<=1000+EPS)
        leg.distanceM=1000;
      let priced;
      try{priced=priceRearEnergyDemandV1({
        rider:source.rider,segment,
        energyBefore:energy,
        effort:order.effort,role:leg.role,
        distanceM:leg.distanceM});}
      catch(error){
        throw new Error(`Fixed-lane payment ${row.riderId} km ${km} ${leg.role} ${leg.distanceM}: ${error.message}`);
      }
      energy=priced.energyAfter;
      paidFromReserve+=priced.energyDemand;
    }
    const roadId=roadByRider.get(row.riderId);
    const recovery=recoveryForKilometre({
      rider:source.rider,segment,
      effort:order.effort,group:roadId,
      working:row.legs.some(leg=>
        leg.role==='leader'),
      quietKm:row.quietKm});
    const cap=replayRearEnergyCapV1({
      rider:source.rider,
      kilometres:input.kilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      energy+recovery.recovery).toFixed(3);
    const paidDistanceM=row.distanceM-
      row.startDistanceM;
    decisions.push({riderId:row.riderId,
      role:row.riderId===front.riderId?
        'leader':'fixed_lane_follower',
      legs:row.legs,
      energyBefore:row.energy,
      paidDistanceM,
      paidFromReserve,
      recoveryAward:recovery.recovery,
      energyAfter});
    const {legs,startDistanceM,...position}=row;
    return {...position,roadId,
      paidDistanceM:row.paidDistanceM+
        paidDistanceM,
      energy:energyAfter,
      quietKm:recovery.quietKm};
  }).sort((a,b)=>b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  if(decisions.some(row=>
    row.paidDistanceM<=0||
    Math.abs(row.legs.reduce((sum,leg)=>
      sum+leg.distanceM,0)-
      row.paidDistanceM)>EPS))
    throw new Error('Fixed-lane convoy has unpaid movement.');
  return {version:
    PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION,
  inputHash:prior.inputHash,
  raceSeed:prior.raceSeed,sourceKm:km,
  grid:{...prior.grid},
  clockSeconds:prior.clockSeconds+
    durationSeconds,
  frontDistanceM:km*1000,
  leaderRiderId:front.riderId,
  proposedLeaderRiderId:
    leaderPlan.leaderRiderId,
  leaderPlan,
  event:frontPassRefusal,
  frontSpeedMps,stepSeconds:STEP_SECONDS,
  contactThresholdM,contactEvents,
  contactComponents:endComponents,
  decisions,positions,
  checkpointCrossings:
    checkpointCrossings.sort((a,b)=>
      a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId)),
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionFixedLaneConvoyKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionFixedLaneConvoyKmV1(input)))
    throw new Error('Fixed-lane convoy differs from paid movement.');
  return recorded;
}
