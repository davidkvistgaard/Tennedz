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
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION,
  PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION} from
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
export const PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_V2_VERSION=
  'physical-first-position-fixed-lane-finish-2';
export const PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_V3_VERSION=
  'physical-first-position-fixed-lane-finish-3';
const STEP_SECONDS=.25;
const EPS=1e-6;
const SPRINT_DISTANCE_M=300;
const SPRINT_WORK_PER_KM=28;

const speedFor=(source,segment,energy,role)=>{
  const order=orderAt(source.team.orders,
    segment.km-1);
  const ability=riderKilometreEffect(source.rider,
    segment,{phase:role==='sheltered'?'cruise':
      role==='sprint'?'finale':'solo',
      energy,exposed:segment.exposed}).ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    (role==='sheltered'?
      MOTOR_DRAFT_SHELTER[segment.terrain]:0)+
    (role==='sprint'?
      TUNING.finish.finaleEffortAbilityPoints.hard*
        Math.min(1,energy/
          TUNING.finish.fullEffortEnergy):0);
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

function settleFinish({prior,input,
  earlyFinishCrossings=[]},sprintEnabled,
sampledPositions=false){
  const finishVersion=sampledPositions?
    PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_V3_VERSION:
    sprintEnabled?
      PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_V2_VERSION:
      PHYSICAL_FIRST_POSITION_FIXED_LANE_FINISH_VERSION;
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
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V9_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V10_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION,
    PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION]
    .includes(prior?.version)||
    !Array.isArray(route)||!route.length||
    prior.sourceKm!==route.length||
    !Number.isFinite(prior.clockSeconds)||
    (sprintEnabled?
      ![PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION,
          PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION]
          .includes(prior.version)||
        Math.abs(prior.frontDistanceM-
          (finishDistanceM-SPRINT_DISTANCE_M))>EPS:
      Math.abs(prior.positions?.[0]?.distanceM-
        finishDistanceM)>EPS)||
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
  if(sprintEnabled&&input.stakes.some(stake=>
    stake.sportingGoal==='sprint_finish'&&
    !input.teams.some(team=>team.id===stake.teamId&&
      team.riders.some(rider=>rider.id===
        stake.sportingCaptainId))))
    throw new Error(
      'Sprint captain is not on the committed team.');
  const motion=prior.positions.map(row=>({
    ...row,energyBefore:row.energy,
    paidTailDistanceM:0,
    paidTailEnergy:0,legs:[]}));
  const sprintStartM=finishDistanceM-
    SPRINT_DISTANCE_M;
  const sprintCaptainIds=new Set(sprintEnabled?
    input.stakes.filter(stake=>
      stake.sportingGoal==='sprint_finish')
      .map(stake=>stake.sportingCaptainId):[]);
  const sprintDecisions=[];
  const sprintLaneEvents=[];
  const sprintPassEvents=[];
  const decidedSprintIds=new Set();
  const positionFrames=[];
  const finishCrossings=[];
  const checkpointCrossings=[];
  const earlyById=new Map(earlyFinishCrossings.map(row=>
    [row.riderId,row]));
  if(earlyById.size!==earlyFinishCrossings.length||
    earlyFinishCrossings.length&&![
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V11_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V12_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V13_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V14_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V15_VERSION,
      PHYSICAL_FIRST_POSITION_SHARED_ROAD_KM_V16_VERSION]
      .includes(prior.version)||
    earlyFinishCrossings.some(crossing=>{
      const row=motion.find(item=>item.riderId===
        crossing.riderId);
      return !row||row.roadId!=='finished'||
        row.distanceM!==finishDistanceM||
        crossing.lineDistanceM!==finishDistanceM||
        crossing.clockSeconds!==
          row.finishedAtClockSeconds||
        crossing.clockSeconds>prior.clockSeconds;
    })||
    motion.some(row=>row.roadId==='finished'&&
      !earlyById.has(row.riderId)))
    throw new Error('Fixed-lane finish lacks paid early crossings.');
  for(const row of motion){
    if(row.distanceM>=finishDistanceM-EPS){
      if(sprintEnabled){
        sprintDecisions.push({
          version:finishVersion,
          sourceKm:route.length,
          riderId:row.riderId,
          choice:'already_finished',
          reason:'paid_early_finish',
          atDistanceM:finishDistanceM,
          atClockSeconds:row.finishedAtClockSeconds});
        decidedSprintIds.add(row.riderId);
      }
      row.distanceM=finishDistanceM;
      finishCrossings.push({riderId:row.riderId,
        lineDistanceM:finishDistanceM,
        clockSeconds:earlyById.get(row.riderId)
          ?.clockSeconds??prior.clockSeconds,
        paidTailDistanceM:0});
    }
  }
  const contactThresholdM=prior.grid.wheelSpacingM*2;
  let active=motion.filter(row=>
    row.distanceM<finishDistanceM-EPS);
  let clockSeconds=prior.clockSeconds;
  const recordFrame=()=>positionFrames.push({
    version:finishVersion,
    clockSeconds,
    positions:motion.map(row=>({
      riderId:row.riderId,
      roadId:row.distanceM>=finishDistanceM-EPS?
        'finished':row.roadId,
      distanceM:row.distanceM,
      lane:row.lane,
      energy:row.energy})).sort((a,b)=>
      a.riderId.localeCompare(b.riderId))});
  if(sampledPositions)recordFrame();
  let previous=componentsFor(active,
    contactThresholdM);
  const contactEvents=[];
  while(active.length){
    if(sprintEnabled){
      for(const row of active){
        if(row.distanceM<sprintStartM-EPS||
          decidedSprintIds.has(row.riderId))
          continue;
        const source=sources.get(row.riderId);
        const segment=route.at(-1);
        const effect=riderKilometreEffect(
          source.rider,segment,{phase:'finale',
            energy:row.energy,
            exposed:segment.exposed});
        const needed=SPRINT_WORK_PER_KM*
          effect.energyCostMultiplier*
          (finishDistanceM-row.distanceM)/1000;
        const selected=sprintCaptainIds.has(
          row.riderId);
        const canPay=selected&&
          needed<=row.energy+EPS;
        row.sprintActive=canPay;
        sprintDecisions.push({
          version:finishVersion,
          sourceKm:route.length,
          riderId:row.riderId,
          choice:canPay?'attempt_paid_sprint':
            'hold_sprint',
          reason:!selected?'no_committed_sprint_stake':
            canPay?'committed_sprint_captain':
              'insufficient_reserve',
          atDistanceM:row.distanceM,
          atClockSeconds:clockSeconds,
          energyAtChoice:row.energy,
          quotedSprintWork:canPay?needed:0});
        decidedSprintIds.add(row.riderId);
      }
      const changing=[...active].filter(row=>
        row.sprintActive&&
        row.lane<prior.grid.laneCount)
        .sort((a,b)=>b.distanceM-a.distanceM||
          a.riderId.localeCompare(b.riderId));
      for(const row of changing){
        const toLane=row.lane+1;
        if(active.some(other=>other!==row&&
          other.lane===toLane&&
          Math.abs(other.distanceM-row.distanceM)<
            prior.grid.wheelSpacingM-EPS))
          continue;
        sprintLaneEvents.push({
          version:finishVersion,
          type:'sprint_lane_entry_observation',
          sourceKm:route.length,
          riderId:row.riderId,
          fromLane:row.lane,toLane,
          atDistanceM:row.distanceM,
          observedAtClockSeconds:clockSeconds});
        row.lane=toLane;
      }
    }
    const beforeDistance=sprintEnabled?
      new Map(active.map(row=>[
        row.riderId,row.distanceM])):null;
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
      const role=row.sprintActive?'sprint':
        sheltered.has(row.riderId)?
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
          (segmentIndex+1)*1000,
          sprintEnabled&&row.distanceM<
            sprintStartM-EPS?
            sprintStartM:finishDistanceM);
        const travelM=Math.min(
          speedMps*remainingSeconds,
          cap-row.distanceM,
          nextLineM-row.distanceM,
          finishDistanceM-row.distanceM);
        if(travelM<=EPS)break;
        const order=orderAt(source.team.orders,
          segment.km-1);
        let paid;
        try{paid=role==='sprint'?(()=>{
          const effect=riderKilometreEffect(
            source.rider,segment,{
              phase:'finale',energy:row.energy,
              exposed:segment.exposed});
          const energyDemand=
            SPRINT_WORK_PER_KM*
            effect.energyCostMultiplier*
            travelM/1000;
          if(energyDemand>row.energy+EPS)
            throw new Error(
              'Sprint rider cannot pay exposed work.');
          return {energyDemand,
            energyAfter:Math.max(0,
              row.energy-energyDemand)};
        })():priceRearEnergyDemandV1({
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
          Math.abs(nextLineM-
            (segmentIndex+1)*1000)<=EPS&&
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
    if(sprintEnabled){
      for(const rider of active.filter(row=>
        row.sprintActive))
        for(const other of active){
          if(other===rider||
            beforeDistance.get(rider.riderId)>=
              beforeDistance.get(other.riderId)-EPS||
            rider.distanceM<=other.distanceM+EPS)
            continue;
          sprintPassEvents.push({
            version:finishVersion,
            type:'paid_sprint_pass_observation',
            sourceKm:route.length,
            riderId:rider.riderId,
            passedRiderId:other.riderId,
            observedAtClockSeconds:
              clockSeconds+STEP_SECONDS,
            riderDistanceM:rider.distanceM,
            passedDistanceM:other.distanceM,
            cumulativeSprintDistanceM:
              rider.legs.filter(leg=>
                leg.role==='sprint').reduce(
                (sum,leg)=>sum+
                  leg.distanceM,0),
            cumulativeSprintPaidFromReserve:
              rider.legs.filter(leg=>
                leg.role==='sprint').reduce(
                (sum,leg)=>sum+
                  leg.paidFromReserve,0)});
        }
    }
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
    if(sampledPositions)recordFrame();
  }
  const sortedCrossings=finishCrossings.sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  if(sampledPositions&&positionFrames.length>1)
    positionFrames.at(-1).clockSeconds=
      sortedCrossings.at(-1).clockSeconds;
  const finishTieObservations=[];
  if(sprintEnabled){
    for(let index=0;index<sortedCrossings.length;){
      let end=index+1;
      while(end<sortedCrossings.length&&
        sortedCrossings[end].clockSeconds-
          sortedCrossings[index].clockSeconds<=EPS)
        end++;
      if(end-index>1)
        finishTieObservations.push({
          version:finishVersion,
          type:'unresolved_model_clock_tie',
          clockSeconds:sortedCrossings[index]
            .clockSeconds,
          riderIds:sortedCrossings.slice(index,end)
            .map(row=>row.riderId).sort()});
      index=end;
    }
  }
  if(sortedCrossings.length!==motion.length||
    new Set(sortedCrossings.map(row=>
      row.riderId)).size!==motion.length||
    sprintEnabled&&sprintDecisions.length!==
      motion.length)
    throw new Error('Fixed-lane finish lacks a rider crossing.');
  if(sprintEnabled&&sprintLaneEvents.some(event=>
    !motion.find(row=>row.riderId===
      event.riderId)?.legs.some(leg=>
      leg.role==='sprint'&&
        leg.distanceM>EPS)))
    throw new Error(
      'Sprint lane change lacks paid exposed movement.');
  if(sprintEnabled&&sprintPassEvents.some(event=>
    event.cumulativeSprintDistanceM<=EPS||
    event.cumulativeSprintPaidFromReserve<=EPS))
    throw new Error(
      'Sprint pass lacks paid exposed movement.');
  if(sampledPositions&&(
    positionFrames[0]?.clockSeconds!==
      prior.clockSeconds||
    positionFrames.at(-1).clockSeconds+
      EPS<sortedCrossings.at(-1)
        .clockSeconds||
    positionFrames.some((frame,index)=>
      frame.positions.length!==motion.length||
      index>0&&frame.positions.some((row,riderIndex)=>{
        const previousRow=positionFrames[index-1]
          .positions[riderIndex];
        return row.riderId!==previousRow.riderId||
          row.distanceM+EPS<previousRow.distanceM||
          row.energy>previousRow.energy+EPS;
      }))||
    positionFrames.at(-1).positions.some(row=>
      row.distanceM!==finishDistanceM||
      row.roadId!=='finished')))
    throw new Error(
      'Sampled sprint frames differ from paid movement.');
  return {version:finishVersion,
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
  ...(sprintEnabled?{
    sprintDecisions,sprintLaneEvents,
    sprintPassEvents,finishTieObservations}:{}),
  ...(sampledPositions?{
    positionFrames,
    positionFrameStepSeconds:STEP_SECONDS}:{}),
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

export function settlePhysicalFirstPositionFixedLaneFinishV1(input){
  return settleFinish(input,false);
}

export function settlePhysicalFirstPositionFixedLaneFinishV2(input){
  return settleFinish(input,true);
}

export function settlePhysicalFirstPositionFixedLaneFinishV3(input){
  return settleFinish(input,true,true);
}

export function replayPhysicalFirstPositionFixedLaneFinishV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFixedLaneFinishV1(input)))
    throw new Error('Fixed-lane finish differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionFixedLaneFinishV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFixedLaneFinishV2(input)))
    throw new Error(
      'Sprint finish differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionFixedLaneFinishV3(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    settlePhysicalFirstPositionFixedLaneFinishV3(input)))
    throw new Error(
      'Sampled sprint finish differs from paid movement.');
  return recorded;
}
