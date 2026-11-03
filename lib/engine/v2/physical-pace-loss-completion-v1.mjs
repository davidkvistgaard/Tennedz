// Pay the remaining fraction of the kilometre after a recorded bunch
// pace loss. The rider finishes that kilometre at their own road time.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchToPaceLossV1,
  runPhysicalStaggeredBunchLossV1,
  advancePhysicalBunchAfterCaughtSlideLossKmV1,
  advancePhysicalBunchAfterReturnLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {advancePhysicalOrderedRearBunchFromStateV1} from
  './physical-ordered-rear-next-bunch-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PACE_LOSS_COMPLETION_VERSION=
  'v2-physical-pace-loss-completion-1';
export const PHYSICAL_STAGGERED_LOSS_COMPLETION_VERSION=
  'v2-physical-staggered-loss-completion-1';
export const PHYSICAL_STAGGERED_LOSS_ARRIVALS_VERSION=
  'v2-physical-staggered-loss-arrivals-2';
export const PHYSICAL_POST_CATCH_LOSS_COMPLETION_VERSION=
  'v2-physical-post-catch-loss-completion-1';
export const PHYSICAL_RETURN_LOSS_COMPLETION_VERSION=
  'v2-physical-return-loss-completion-1';
export const PHYSICAL_ORDERED_REAR_LOSS_COMPLETION_VERSION=
  'v2-physical-ordered-rear-loss-completion-1';

function completeFromPaidStep({startInput,lossKm,step,
  bunchElapsedSeconds,riderId,version}){
  const split=step.splits.find(row=>row.riderId===riderId);
  const partial=step.riders.find(row=>row.riderId===riderId);
  const decision=step.riderDecisions.find(row=>
    row.riderId===riderId);
  const rider=startInput.teams.flatMap(team=>team.riders)
    .find(row=>row.id===riderId);
  if(!split||!partial||!decision||!rider)
    throw new Error('Solo completion needs a detached source rider.');
  const segment=startInput.routeKilometres[lossKm-1];
  const remainingM=lossKm*1000-split.atDistanceM;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:partial.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[decision.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0||
    remainingM<=0||remainingM>=1000)
    throw new Error('Solo completion needs payable remaining road.');
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:partial.energyAfter,effort:decision.effort,
    role:'solo',distanceM:remainingM});
  const recovery=recoveryForKilometre({rider,segment,
    effort:decision.effort,group:'solo',working:true,
    quietKm:partial.quietKm});
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,throughKm:lossKm}).cap;
  const energyAfter=+Math.min(cap,paid.energyAfter+
    recovery.recovery).toFixed(3);
  const additionalSeconds=secondsPerKm*remainingM/1000;
  return {version,
    sourceKm:lossKm,riderId,
    decision:structuredClone(decision),
    physicalGroup:{id:`solo-${riderId}`,
      riderIds:[riderId],atDistanceM:lossKm*1000},
    startDistanceM:split.atDistanceM,
    endDistanceM:lossKm*1000,
    elapsedSeconds:bunchElapsedSeconds+additionalSeconds,
    gapSecondsToBunch:additionalSeconds,
    energyBefore:partial.energyAfter,
    energySpent:paid.energyDemand,
    totalKmEnergySpent:partial.energySpent+paid.energyDemand,
    recoveryAward:recovery.recovery,cap,energyAfter,
    quietKm:recovery.quietKm,officialResults:false};
}

export function completePhysicalPaceLossKmV1({startInput,start,
  lossKm,loss,riderId}){
  if(!isDeepStrictEqual(loss,runPhysicalBunchToPaceLossV1({
    startInput,start,lossKm})))
    throw new Error('Solo completion needs replayed physical loss.');
  return completeFromPaidStep({startInput,lossKm,
    step:loss.step,bunchElapsedSeconds:loss.elapsedSeconds,
    riderId,version:PHYSICAL_PACE_LOSS_COMPLETION_VERSION});
}

export function completePhysicalStaggeredLossKmV1({startInput,
  start,staggered,riderId}){
  if(!isDeepStrictEqual(staggered,
    runPhysicalStaggeredBunchLossV1({startInput,start,
      throughKm:staggered?.throughKm})))
    throw new Error('Staggered solo needs replayed bunch source.');
  const loss=staggered.losses.find(row=>row.riderId===riderId);
  if(!loss)throw new Error('Staggered solo needs measured loss.');
  const step=staggered.road[loss.sourceKm-1];
  const bunchElapsedSeconds=staggered.road.slice(0,
    loss.sourceKm).reduce((sum,row)=>sum+row.elapsedSeconds,0);
  return completeFromPaidStep({startInput,lossKm:loss.sourceKm,
    step,bunchElapsedSeconds,riderId,
    version:PHYSICAL_STAGGERED_LOSS_COMPLETION_VERSION});
}

export function completePhysicalOrderedRearLossesKmV1({
  startInput,prior}){
  const next=advancePhysicalOrderedRearBunchFromStateV1({
    startInput,prior});
  const {step}=next;
  if(!step.splits.length||step.attack)
    throw new Error(
      'Ordered rear loss needs physical bunch splits.');
  const bunchEndClock=next.bunchStartClock+
    step.elapsedSeconds;
  const completions=step.splits.map(split=>
    completeFromPaidStep({
      startInput,lossKm:step.sourceKm,
      step,bunchElapsedSeconds:bunchEndClock,
      riderId:split.riderId,
      version:
        PHYSICAL_ORDERED_REAR_LOSS_COMPLETION_VERSION}));
  if(completions.length!==step.splits.length||
    new Set(completions.map(row=>
      row.riderId)).size!==
      completions.length||
    completions.some(row=>
      row.elapsedSeconds<=bunchEndClock||
      row.energyAfter<0))
    throw new Error(
      'Ordered rear loss lacks paid solo completion.');
  return {version:
    PHYSICAL_ORDERED_REAR_LOSS_COMPLETION_VERSION,
  sourceKm:step.sourceKm,
  sources:{next},
  bunchEndClock,completions,
  rearRoadsUnsettled:true,
  fieldKilometreIncomplete:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearLossesKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalOrderedRearLossesKmV1(input)))
    throw new Error(
      'Ordered rear loss differs from paid source.');
  return true;
}

// Replay the bunch once, then pay every detached rider's remaining
// road in the kilometre of loss. Near-equal end clocks are an
// observation; contact requires continuous road geometry.
export function partitionPhysicalStaggeredLossArrivalsV1({
  startInput,start,staggered}){
  if(!isDeepStrictEqual(staggered,
    runPhysicalStaggeredBunchLossV1({startInput,start,
      throughKm:staggered?.throughKm})))
    throw new Error('Staggered arrivals need replayed bunch source.');
  let bunchElapsedSeconds=0;
  const completions=[];
  for(const step of staggered.road){
    bunchElapsedSeconds+=step.elapsedSeconds;
    for(const split of step.splits){
      const completion=completeFromPaidStep({startInput,
        lossKm:step.sourceKm,step,bunchElapsedSeconds,
        riderId:split.riderId,
        version:PHYSICAL_STAGGERED_LOSS_COMPLETION_VERSION});
      if(completion.energyAfter<0||
        completion.elapsedSeconds<=bunchElapsedSeconds)
        throw new Error('Staggered arrival lacks paid road.');
      completions.push(completion);
    }
  }
  if(completions.length!==staggered.losses.length||
    new Set(completions.map(row=>row.riderId)).size!==
      completions.length)
    throw new Error('Staggered arrivals lost a paid rider.');
  const arrivals=[];
  for(const row of completions){
    let arrival=arrivals.find(item=>
      item.sourceKm===row.sourceKm&&
      Math.abs(item.clockSeconds-row.elapsedSeconds)<=1e-7);
    if(!arrival){
      arrival={sourceKm:row.sourceKm,
        atDistanceM:row.endDistanceM,
        clockSeconds:row.elapsedSeconds,riderIds:[]};
      arrivals.push(arrival);
    }
    arrival.riderIds.push(row.riderId);
  }
  return {version:PHYSICAL_STAGGERED_LOSS_ARRIVALS_VERSION,
    bunchSourceVersion:staggered.version,
    throughKm:staggered.throughKm,completions,arrivals,
    nearCoincidentArrivals:arrivals.filter(row=>
      row.riderIds.length>1),
    separateSoloRiderIds:arrivals.filter(row=>
      row.riderIds.length===1).map(row=>row.riderIds[0]),
    contactGeometryRequired:true,laterRoadUnsettled:true,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalStaggeredLossArrivalsV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    partitionPhysicalStaggeredLossArrivalsV1(input)))
    throw new Error('Staggered arrivals differ from paid source.');
  return true;
}

export function completePhysicalPostCatchLossKmV1({startInput,
  prior,segment,caughtRiderId,priorBunchElapsedSeconds,
  loss,riderId}){
  if(!isDeepStrictEqual(loss,
    advancePhysicalBunchAfterCaughtSlideLossKmV1({
      startInput,prior,segment,caughtRiderId}))||
    !Number.isFinite(priorBunchElapsedSeconds)||
    priorBunchElapsedSeconds<=0)
    throw new Error('Post-catch loss needs replayed partial road.');
  return completeFromPaidStep({startInput,
    lossKm:segment.km,step:loss,
    bunchElapsedSeconds:priorBunchElapsedSeconds+
      loss.elapsedSeconds,riderId,
    version:PHYSICAL_POST_CATCH_LOSS_COMPLETION_VERSION});
}

export function validatePhysicalPostCatchLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalPostCatchLossKmV1(input)))
    throw new Error('Post-catch loss completion differs from source.');
  return true;
}

export function completePhysicalReturnLossKmV1({startInput,
  prior,segment,returnContact,
  priorBunchElapsedSeconds,loss,riderId}){
  if(!isDeepStrictEqual(loss,
    advancePhysicalBunchAfterReturnLossKmV1({
      startInput,prior,segment,returnContact}))||
    !Number.isFinite(priorBunchElapsedSeconds)||
    priorBunchElapsedSeconds<=0)
    throw new Error('Return loss needs replayed partial road.');
  return completeFromPaidStep({startInput,
    lossKm:segment.km,step:loss,
    bunchElapsedSeconds:priorBunchElapsedSeconds+
      loss.elapsedSeconds,riderId,
    version:PHYSICAL_RETURN_LOSS_COMPLETION_VERSION});
}

export function validatePhysicalReturnLossKmV1(input,
recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalReturnLossKmV1(input)))
    throw new Error('Return loss completion differs from source.');
  return true;
}

export function validatePhysicalPaceLossCompletionV1(input,recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalPaceLossKmV1(input)))
    throw new Error('Solo completion differs from physical source.');
  return true;
}
