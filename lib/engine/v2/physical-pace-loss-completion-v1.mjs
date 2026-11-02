// Pay the remaining fraction of the kilometre after a recorded bunch
// pace loss. The rider finishes that kilometre at their own road time.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchToPaceLossV1,
  runPhysicalStaggeredBunchLossV1,
  advancePhysicalBunchAfterCaughtSlideLossKmV1,
  advancePhysicalBunchAfterReturnLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PACE_LOSS_COMPLETION_VERSION=
  'v2-physical-pace-loss-completion-1';
export const PHYSICAL_STAGGERED_LOSS_COMPLETION_VERSION=
  'v2-physical-staggered-loss-completion-1';
export const PHYSICAL_POST_CATCH_LOSS_COMPLETION_VERSION=
  'v2-physical-post-catch-loss-completion-1';
export const PHYSICAL_RETURN_LOSS_COMPLETION_VERSION=
  'v2-physical-return-loss-completion-1';

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
