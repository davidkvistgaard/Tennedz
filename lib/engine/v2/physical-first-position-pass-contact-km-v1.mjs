// A payable front pass can coincide with measured shelter loss. All
// wheels move on one clock; road membership follows paid contact only.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV2} from
  './physical-first-position-start-v2.mjs';
import {PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION} from
  './physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {quotePhysicalFirstPositionFrontPassV1} from
  './physical-first-position-front-pass-quote-v1.mjs';
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

export const PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION=
  'physical-first-position-pass-contact-km-1';
const STEP_SECONDS=.25;
const EPS=1e-6;

const componentsFor=(rows,thresholdM)=>{
  const ranked=[...rows].sort((a,b)=>
    b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  const components=[];
  for(const row of ranked){
    if(!components.length||
      components.at(-1).at(-1).distanceM-
        row.distanceM>thresholdM+EPS)
      components.push([]);
    components.at(-1).push(row);
  }
  return components.map(rows=>rows.map(row=>
    row.riderId).sort());
};

const speedFor=(source,segment,energy,role)=>{
  const order=orderAt(source.team.orders,segment.km-1);
  const ability=riderKilometreEffect(source.rider,
    segment,{phase:role==='sheltered'?
      'cruise':role==='solo'?'attack':'solo',
      energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (role==='sheltered'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0);
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Pass-contact movement lacks payable speed.');
  return 1000/seconds;
};

export function advancePhysicalFirstPositionPassContactKmV1({
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
    throw new Error('Pass-contact needs existing paid roads.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid:prior.grid});
  if(prior.inputHash!==start.inputHash)
    throw new Error('Pass-contact changed committed inputs.');
  if(input.teams.some(team=>
    orderAt(team.orders,km-1).attack!=='none'))
    throw new Error('Pass-contact cannot include an attack.');
  const quote=quotePhysicalFirstPositionFrontPassV1({
    prior,segment,input});
  if(!quote)
    throw new Error('Pass-contact lacks a payable overtake.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const motion=prior.positions.map(row=>({...row,
    startDistanceM:row.distanceM,legs:[]}));
  if(sources.size!==motion.length||
    motion.some(row=>sources.get(row.riderId)
      ?.team.id!==row.teamId))
    throw new Error('Pass-contact changed committed riders.');
  const byId=new Map(motion.map(row=>[row.riderId,row]));
  const oldFront=byId.get(quote.fromRiderId);
  const candidate=byId.get(quote.toRiderId);
  const initialFrontDistanceM=oldFront.distanceM;
  const thresholdM=prior.grid.wheelSpacingM*2;
  const starting=componentsFor(motion,thresholdM);
  if(!isDeepStrictEqual(starting,
    prior.contactComponents))
    throw new Error('Pass-contact changed recorded contact.');
  const predecessors=new Map();
  const laneAhead=new Map();
  for(const row of motion){
    predecessors.set(row.riderId,
      laneAhead.get(row.lane)??null);
    laneAhead.set(row.lane,row);
  }
  if(predecessors.get(candidate.riderId))
    throw new Error('Pass-contact lacks a clear passing lane.');
  const contactEvents=[];
  const checkpointCrossings=[];
  let previous=starting;
  let elapsedSeconds=0;
  const firstEnd=quote.firstSeconds;
  const totalSeconds=firstEnd+quote.secondSeconds;
  for(const phaseEnd of [firstEnd,totalSeconds]){
    const passing=phaseEnd===firstEnd;
    while(elapsedSeconds<phaseEnd-EPS){
      const stepSeconds=Math.min(STEP_SECONDS,
        phaseEnd-elapsedSeconds);
      const nextElapsed=elapsedSeconds+stepSeconds;
      const before=new Map(motion.map(row=>[
        row.riderId,row.distanceM]));
      const ranked=[...motion].sort((a,b)=>
        b.distanceM-a.distanceM||
        a.riderId.localeCompare(b.riderId));
      const sheltered=new Set();
      for(let index=1;index<ranked.length;index++)
        if(ranked[index-1].distanceM-
          ranked[index].distanceM<=thresholdM+EPS)
          sheltered.add(ranked[index].riderId);
      if(passing){
        oldFront.distanceM=initialFrontDistanceM+
          quote.oldSpeedMps*nextElapsed;
        candidate.distanceM=candidate.startDistanceM+
          quote.surgeSpeedMps*nextElapsed;
      }else{
        candidate.distanceM=initialFrontDistanceM+
          quote.firstDistanceM+
          prior.grid.wheelSpacingM+
          quote.newSpeedMps*(nextElapsed-firstEnd);
      }
      const front=passing?oldFront:candidate;
      for(const row of motion){
        if(row===candidate||passing&&row===oldFront)
          continue;
        const role=sheltered.has(row.riderId)?
          'sheltered':'leader';
        const ahead=predecessors.get(row.riderId);
        const cap=Math.min(ahead?
          ahead.distanceM-prior.grid.wheelSpacingM:
          Number.POSITIVE_INFINITY,
        front.distanceM-(row===oldFront?0:
          row.lane*prior.grid.laneStaggerM));
        const speed=speedFor(sources.get(row.riderId),
          segment,row.energy,role);
        const travelM=Math.max(0,Math.min(
          speed*stepSeconds,cap-row.distanceM));
        row.distanceM+=travelM;
      }
      for(const row of motion){
        const travelledM=row.distanceM-
          before.get(row.riderId);
        if(travelledM<-EPS)
          throw new Error('Pass-contact moved a wheel backward.');
        const role=row===candidate?
          passing?'solo':'leader':
          passing&&row===oldFront?'leader':
            sheltered.has(row.riderId)?
              'sheltered':'leader';
        if(travelledM>EPS){
          const leg=row.legs.at(-1);
          if(leg?.role===role)
            leg.distanceM+=travelledM;
          else row.legs.push({role,
            distanceM:travelledM});
        }
        for(let markerKm=1;markerKm<=km;
          markerKm++){
          const lineDistanceM=markerKm*1000;
          if(before.get(row.riderId)>=
              lineDistanceM-EPS||
            row.distanceM<lineDistanceM-EPS)
            continue;
          if(travelledM<=EPS)
            throw new Error('Pass-contact has an unpaid crossing.');
          checkpointCrossings.push({
            riderId:row.riderId,km:markerKm,
            lineDistanceM,
            clockSeconds:prior.clockSeconds+
              elapsedSeconds+stepSeconds*
                (lineDistanceM-
                  before.get(row.riderId))/
                  travelledM});
        }
      }
      elapsedSeconds=nextElapsed;
      const current=componentsFor(motion,thresholdM);
      if(!isDeepStrictEqual(current,previous)){
        contactEvents.push({version:
          PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION,
        type:'paid_contact_topology_observation',
        sourceKm:km,
        observedAtClockSeconds:
          prior.clockSeconds+elapsedSeconds,
        observedAfterPaidStepSeconds:stepSeconds,
        components:current});
        previous=current;
      }
    }
  }
  if(Math.abs(candidate.distanceM-km*1000)>EPS||
    motion.some(row=>row.distanceM>
      candidate.distanceM+EPS))
    throw new Error('Pass-contact lost its physical front.');
  candidate.distanceM=km*1000;
  const endComponents=componentsFor(motion,thresholdM);
  if(!endComponents[0].includes(candidate.riderId))
    throw new Error('Pass-contact lost the passing worker.');
  const roadByRider=new Map(endComponents.flatMap(
    (group,index)=>group.map(id=>[id,
      index===0?'peloton':`rear:${index}`])));
  const decisions=[];
  const positions=motion.map(row=>{
    const source=sources.get(row.riderId);
    const order=orderAt(source.team.orders,km-1);
    let energy=row.energy;
    let paidFromReserve=0;
    for(const leg of row.legs){
      let remaining=leg.distanceM;
      while(remaining>EPS){
        const distanceM=Math.min(1000,remaining);
        const paid=priceRearEnergyDemandV1({
          rider:source.rider,segment,
          energyBefore:energy,
          effort:order.effort,
          role:leg.role,distanceM});
        energy=paid.energyAfter;
        paidFromReserve+=paid.energyDemand;
        remaining-=distanceM;
      }
    }
    const roadId=roadByRider.get(row.riderId);
    const recovery=recoveryForKilometre({
      rider:source.rider,segment,
      effort:order.effort,group:roadId,
      working:row.legs.some(leg=>
        leg.role!=='sheltered'),
      quietKm:row.quietKm});
    const cap=replayRearEnergyCapV1({
      rider:source.rider,
      kilometres:input.kilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      energy+recovery.recovery).toFixed(3);
    const paidDistanceM=row.distanceM-
      row.startDistanceM;
    if(paidDistanceM<=EPS||
      Math.abs(row.legs.reduce((sum,leg)=>
        sum+leg.distanceM,0)-
        paidDistanceM)>EPS)
      throw new Error('Pass-contact has unpaid wheel movement.');
    decisions.push({riderId:row.riderId,
      role:row===candidate?'paid_front_pass':
        row===oldFront?'former_front':
          'fixed_lane_follower',
      legs:row.legs,energyBefore:row.energy,
      paidDistanceM,paidFromReserve,
      recoveryAward:recovery.recovery,
      energyAfter});
    const {startDistanceM,legs,...position}=row;
    return {...position,roadId,
      paidDistanceM:row.paidDistanceM+
        paidDistanceM,
      energy:energyAfter,
      quietKm:recovery.quietKm};
  }).sort((a,b)=>b.distanceM-a.distanceM||
    a.riderId.localeCompare(b.riderId));
  const event={version:
    PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION,
  type:'paid_front_pass',sourceKm:km,
  fromRiderId:oldFront.riderId,
  toRiderId:candidate.riderId,
  passingLane:candidate.lane,
  atClockSeconds:prior.clockSeconds+firstEnd,
  atDistanceM:initialFrontDistanceM+
    quote.firstDistanceM,
  requiredGainM:quote.requiredGainM,
  surgeDistanceM:quote.surgeDistanceM,
  surgePaidFromReserve:
    quote.surgePaidFromReserve};
  return {version:
    PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION,
  inputHash:prior.inputHash,
  raceSeed:prior.raceSeed,sourceKm:km,
  grid:{...prior.grid},
  clockSeconds:prior.clockSeconds+
    totalSeconds,
  frontDistanceM:km*1000,
  leaderRiderId:candidate.riderId,
  proposedLeaderRiderId:
    quote.leaderPlan.leaderRiderId,
  leaderPlan:quote.leaderPlan,
  passQuote:quote,event,
  firstSeconds:quote.firstSeconds,
  secondSeconds:quote.secondSeconds,
  firstSpeedMps:quote.oldSpeedMps,
  secondSpeedMps:quote.newSpeedMps,
  stepSeconds:STEP_SECONDS,
  contactThresholdM:thresholdM,
  contactEvents,
  contactComponents:endComponents,
  decisions,positions,
  checkpointCrossings:
    checkpointCrossings.sort((a,b)=>
      a.clockSeconds-b.clockSeconds||
      a.riderId.localeCompare(b.riderId)),
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionPassContactKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionPassContactKmV1(input)))
    throw new Error('Pass-contact differs from paid movement.');
  return recorded;
}
