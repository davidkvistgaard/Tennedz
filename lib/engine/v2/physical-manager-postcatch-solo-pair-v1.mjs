// Pay the next kilometre for a caught break rider and a newly
// detached bunch rider only while their physical roads stay apart.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerPostcatchLossV1,
  advancePhysicalManagerPostcatchBunchKmV1} from
  './physical-manager-postcatch-loss-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_POSTCATCH_SOLO_PAIR_VERSION=
  'v2-physical-manager-postcatch-solo-pair-1';
export const PHYSICAL_MANAGER_SEPARATED_ROAD_VERSION=
  'v2-physical-manager-separated-road-1';
const effortRank={conserve:0,steady:1,hard:2};

export function advancePhysicalManagerPostcatchSoloPairV1({
  input,partial,bunch,segment}){
  if(!isDeepStrictEqual(partial,
    replayPhysicalManagerPostcatchLossV1(input))||
    !isDeepStrictEqual(bunch,
      advancePhysicalManagerPostcatchBunchKmV1({
        input,partial,segment})))
    throw new Error('Post-catch solos need replayed bunch road.');
  const priorStates=partial.kilometres.at(-1).riderStates;
  return paySeparatedPair({input,partial,bunch,segment,
    priorStates});
}

function paySeparatedPair({input,partial,bunch,segment,
  priorStates}){
  const soloIds=[partial.caughtRiderId,
    ...partial.source.loss.splits.map(row=>row.riderId)];
  if(soloIds.length!==2||new Set(soloIds).size!==2)
    throw new Error('Post-catch solo pair needs two paid riders.');
  const solos=soloIds.map(riderId=>{
    const previous=priorStates.find(row=>row.riderId===
      riderId);
    const team=input.startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    const rider=team.riders.find(row=>row.id===riderId);
    const plan=input.startInput.soloCommitments?.find(row=>
      row.riderId===riderId);
    const intent=plan?rearSoloPlanAtKmV1({
      commitment:plan,km:segment.km}):{
      action:'finish_safely',effort:'conserve'};
    const order=orderAt(team.orders,segment.km-1);
    if(effortRank[intent.effort]===undefined||
      effortRank[intent.effort]>effortRank[order.effort])
      throw new Error('Post-catch solo exceeds team effort order.');
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:previous.energyAfter,
      exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[intent.effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS
        .secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Post-catch solo needs paid pace.');
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:previous.energyAfter,
      effort:intent.effort,role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort:intent.effort,group:'solo',working:true,
      quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Post-catch solo cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:input.startInput.routeKilometres,
      throughKm:segment.km}).cap;
    const energyAfter=+Math.min(cap,paid.energyAfter)
      .toFixed(3);
    if(intent.action==='save_for_stage'&&
      energyAfter<intent.committedStagePlan.reserveEnergy)
      throw new Error('Post-catch solo breaks future-stage reserve.');
    const elapsedSeconds=previous.elapsedSeconds+seconds;
    if(elapsedSeconds<=bunch.elapsedSeconds)
      throw new Error('Post-catch solo needs paid bunch return.');
    const decision={riderId,goal:intent.action,
      teamOrderEffort:order.effort,
      effort:intent.effort,choice:'ride_solo',
      reason:plan?'committed_detached_solo_plan':
        riderId===partial.caughtRiderId?
          'cannot_hold_paid_bunch_pace':
          'cannot_hold_paid_front_pace'};
    return {riderId,decision,sourceKm:segment.km,
      previousElapsedSeconds:previous.elapsedSeconds,
      seconds,elapsedSeconds,
      energyBefore:previous.energyAfter,
      energySpent:paid.energyDemand,
      recoveryAward:0,cap,energyAfter,
      physicalGroupId:`solo-${riderId}`};
  });
  const priorDifference=solos[1].previousElapsedSeconds-
    solos[0].previousElapsedSeconds;
  const nextDifference=solos[1].elapsedSeconds-
    solos[0].elapsedSeconds;
  if(priorDifference===0||nextDifference===0||
    Math.sign(priorDifference)!==
      Math.sign(nextDifference))
    throw new Error('Post-catch solos need paid contact.');
  const decisions=new Map(bunch.step.riderDecisions.map(row=>
    [row.riderId,row]));
  const states=bunch.step.physicalGroup.riderIds.map(riderId=>{
    const row=bunch.step.riders.find(item=>
      item.riderId===riderId);
    return {riderId,sourceKm:segment.km,
      physicalGroupId:'peloton',
      atDistanceM:segment.km*1000,
      elapsedSeconds:bunch.elapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
  for(const solo of solos)
    states.push({riderId:solo.riderId,
      sourceKm:segment.km,
      physicalGroupId:solo.physicalGroupId,
      atDistanceM:segment.km*1000,
      elapsedSeconds:solo.elapsedSeconds,
      energyAfter:solo.energyAfter,
      decisions:[solo.decision]});
  if(states.length!==input.start.riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      states.length||states.some(row=>
      row.energyAfter<0||!row.decisions[0]))
    throw new Error('Post-catch solo pair lacks rider road.');
  return {version:PHYSICAL_MANAGER_POSTCATCH_SOLO_PAIR_VERSION,
    sourceKm:segment.km,
    riderStates:states.sort((a,b)=>
      input.start.riderIds.indexOf(a.riderId)-
      input.start.riderIds.indexOf(b.riderId)),
    sources:{bunch,solos},
    contact:false,movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalManagerPostcatchSoloPairV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalManagerPostcatchSoloPairV1(input)))
    throw new Error('Post-catch solo pair differs from paid road.');
  return true;
}

export function replayPhysicalManagerSeparatedRoadV1(input){
  const partial=replayPhysicalManagerPostcatchLossV1(input);
  const {startInput,throughKm}=input;
  if(!Number.isInteger(throughKm)||
    throughKm<=partial.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Separated road needs later sourced km.');
  const detachedRiderIds=partial.source.loss.splits.map(
    row=>row.riderId);
  let previousStates=partial.kilometres.at(-1)
    .riderStates;
  let priorBunch=partial.source.loss;
  let bunchClock=previousStates.find(row=>
    row.physicalGroupId==='peloton').elapsedSeconds;
  const later=[];
  for(let km=partial.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    let bunch;
    if(km===partial.sourceKm+1){
      bunch=advancePhysicalManagerPostcatchBunchKmV1({
        input,partial,segment});
    }else{
      const prior={riderIds:priorBunch.physicalGroup.riderIds,
        energyByRider:priorBunch.energyByRider,
        quietKmByRider:priorBunch.quietKmByRider};
      const step=advancePhysicalBunchAfterPostcatchLossKmV1({
        startInput,prior,segment,
        caughtRiderId:partial.caughtRiderId,
        detachedRiderIds});
      bunch={sourceKm:km,step,
        elapsedSeconds:bunchClock+step.elapsedSeconds};
    }
    const pair=paySeparatedPair({input,partial,bunch,
      segment,priorStates:previousStates});
    later.push(pair);
    previousStates=pair.riderStates;
    priorBunch=bunch.step;
    bunchClock=bunch.elapsedSeconds;
  }
  const kilometres=[...partial.kilometres,
    ...later.map(row=>({sourceKm:row.sourceKm,
      riderStates:row.riderStates}))];
  if(kilometres.length!==throughKm||
    kilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==input.start.riderIds.length))
    throw new Error('Separated road lacks paid rider km.');
  return {version:PHYSICAL_MANAGER_SEPARATED_ROAD_VERSION,
    throughKm,lossKm:partial.sourceKm,
    riderIds:[...input.start.riderIds],
    kilometres,sources:{partial,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerSeparatedRoadV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerSeparatedRoadV1(input)))
    throw new Error('Separated road differs from paid source.');
  return true;
}
