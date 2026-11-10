// Settles a fixed-lane trace at the real finish. Riders already over the
// line stop; remaining riders keep paying on the route they still occupy.
// The resulting crossing order is not an official competitive sprint.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV2} from
  './physical-first-position-start-v2.mjs';
import {PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION} from
  './physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  './physical-first-position-rotation-km-v2.mjs';
import {PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION} from
  './physical-first-position-mixed-front-pass-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION} from
  './physical-first-position-pass-contact-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION} from
  './physical-first-position-shared-road-km-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from './tuning.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_VERSION=
  'physical-first-position-fixed-lane-finish-1';
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
    throw new Error('Fixed-lane finish lacks payable speed.');
  return 1000/seconds;
};

const componentsFor=(active,thresholdM)=>{
  const sorted=[...active].sort((a,b)=>
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

export function settlePhysicalFirstPositionFixedLaneFinishV1({
  prior,input}){
  const route=input?.kilometres;
  const finishDistanceM=route?.length*1000;
  if(![PHYSICAL_FIRST_POSITION_FIXED_LANE_CONVOY_VERSION,
    PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION,
    PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V2_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V3_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V4_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V5_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V6_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V7_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V8_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION]
    .includes(prior?.version)||
    !Array.isArray(route)||!route.length||
    prior.sourceKm!==route.length||
    !Number.isFinite(prior.clockSeconds)||
    Math.abs(prior.positions?.[0]?.distanceM-
      finishDistanceM)>EPS||
    prior.inputHash!==
      createPhysicalFirstPositionStartV2({
        input,grid:prior.grid}).inputHash)
    throw new Error('Fixed-lane finish needs a complete paid trace.');
  const sources=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  if(sources.size!==prior.positions.length||
    prior.positions.some(row=>
      sources.get(row.riderId)?.team.id!==row.teamId||
      !Number.isFinite(row.energy)||row.energy<0||
      row.distanceM>finishDistanceM+EPS))
    throw new Error('Fixed-lane finish lacks committed riders.');
  const motion=prior.positions.map(row=>({
    ...row,energyBefore:row.energy,
    paidTailDistanceM:0,
    paidTailEnergy:0,legs:[]}));
  const finishCrossings=[];
  const checkpointCrossings=[];
  for(const row of motion){
    if(row.distanceM>=finishDistanceM-EPS){
      row.distanceM=finishDistanceM;
      finishCrossings.push({riderId:row.riderId,
        lineDistanceM:finishDistanceM,
        clockSeconds:prior.clockSeconds,
        paidTailDistanceM:0});
    }
  }
  const contactThresholdM=prior.grid.wheelSpacingM*2;
  let active=motion.filter(row=>
    row.distanceM<finishDistanceM-EPS);
  let clockSeconds=prior.clockSeconds;
  let previous=componentsFor(active,
    contactThresholdM);
  const contactEvents=[];
  while(active.length){
    const ranked=[...active].sort((a,b)=>
      b.distanceM-a.distanceM||
      a.riderId.localeCompare(b.riderId));
    const sheltered=new Set();
    for(let index=1;index<ranked.length;index++){
      if(ranked[index-1].distanceM-
        ranked[index].distanceM<=contactThresholdM+EPS)
        sheltered.add(ranked[index].riderId);
    }
    const laneAhead=new Map();
    let stepTravelM=0;
    const finished=[];
    for(const row of ranked){
      const source=sources.get(row.riderId);
      const role=sheltered.has(row.riderId)?
        'sheltered':'leader';
      const ahead=laneAhead.get(row.lane);
      const cap=ahead?
        Math.min(finishDistanceM,
          ahead.distanceM-prior.grid.wheelSpacingM):
        finishDistanceM;
      laneAhead.set(row.lane,row);
      let remainingSeconds=STEP_SECONDS;
      let elapsedWithinStep=0;
      while(remainingSeconds>EPS&&
        row.distanceM<finishDistanceM-EPS){
        const segmentIndex=Math.min(route.length-1,
          Math.floor((row.distanceM+EPS)/1000));
        const segment=route[segmentIndex];
        const speedMps=speedFor(source,segment,
          row.energy,role);
        const nextLineM=Math.min(finishDistanceM,
          (segmentIndex+1)*1000);
        const travelM=Math.min(
          speedMps*remainingSeconds,
          cap-row.distanceM,
          nextLineM-row.distanceM,
          finishDistanceM-row.distanceM);
        if(travelM<=EPS)break;
        const order=orderAt(source.team.orders,
          segment.km-1);
        let paid;
        try{paid=priceRearEnergyDemandV1({
          rider:source.rider,segment,
          energyBefore:row.energy,
          effort:order.effort,role,
          distanceM:travelM});}
        catch(error){
          throw new Error(`Fixed-lane finish cannot pay ${row.riderId} at km ${segment.km}: ${error.message}`);
        }
        row.energy=paid.energyAfter;
        row.distanceM+=travelM;
        row.paidTailDistanceM+=travelM;
        row.paidTailEnergy+=paid.energyDemand;
        stepTravelM+=travelM;
        const spentSeconds=travelM/speedMps;
        elapsedWithinStep+=spentSeconds;
        remainingSeconds-=spentSeconds;
        if(row.distanceM>=nextLineM-EPS&&
          nextLineM<finishDistanceM-EPS)
          checkpointCrossings.push({
            riderId:row.riderId,
            km:segment.km,
            lineDistanceM:nextLineM,
            clockSeconds:clockSeconds+
              elapsedWithinStep});
        const last=row.legs.at(-1);
        if(last?.sourceKm===segment.km&&
          last.role===role){
          last.distanceM+=travelM;
          last.paidFromReserve+=
            paid.energyDemand;
        }else row.legs.push({
          sourceKm:segment.km,role,
          distanceM:travelM,
          paidFromReserve:
            paid.energyDemand});
        if(row.distanceM>=finishDistanceM-EPS){
          row.distanceM=finishDistanceM;
          finished.push(row.riderId);
          finishCrossings.push({
            riderId:row.riderId,
            lineDistanceM:finishDistanceM,
            clockSeconds:clockSeconds+
              elapsedWithinStep,
            paidTailDistanceM:
              row.paidTailDistanceM});
          break;
        }
      }
    }
    if(stepTravelM<=EPS)
      throw new Error('Fixed-lane finish has no paid progress.');
    clockSeconds+=STEP_SECONDS;
    active=active.filter(row=>
      row.distanceM<finishDistanceM-EPS);
    const current=componentsFor(active,
      contactThresholdM);
    if(JSON.stringify(current)!==
      JSON.stringify(previous)){
      contactEvents.push({
        version:
          PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_VERSION,
        type:finished.length?
          'finish_withdrawal_topology_observation':
          'paid_contact_topology_observation',
        observedAtClockSeconds:clockSeconds,
        finishedRiderIds:finished.sort(),
        components:current});
      previous=current;
    }
  }
  const sortedCrossings=finishCrossings.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  if(sortedCrossings.length!==motion.length||
    new Set(sortedCrossings.map(row=>
      row.riderId)).size!==motion.length)
    throw new Error('Fixed-lane finish lacks a rider crossing.');
  return {version:
    PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_VERSION,
  sourcePositionVersion:prior.version,
  inputHash:prior.inputHash,
  raceSeed:prior.raceSeed,
  sourceKm:route.length,
  finishDistanceM,
  frontClockSeconds:prior.clockSeconds,
  lastClockSeconds:sortedCrossings.at(-1)
    .clockSeconds,
  finishCrossings:sortedCrossings,
  checkpointCrossings:checkpointCrossings.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId)),
  contactEvents,
  decisions:motion.map(row=>({
    riderId:row.riderId,
    energyBefore:row.energyBefore,
    paidTailDistanceM:row.paidTailDistanceM,
    paidFromReserve:row.paidTailEnergy,
    energyAfter:+row.energy.toFixed(3),
    legs:row.legs})),
  positionCount:motion.length,
  officialResults:false};
}

export function replayPhysicalFirstPositionFixedLaneFinishV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFixedLaneFinishV1(input)))
    throw new Error('Fixed-lane finish differs from paid movement.');
  return recorded;
}
