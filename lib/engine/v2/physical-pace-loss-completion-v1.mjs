// Pay the remaining fraction of the kilometre after a recorded bunch
// pace loss. The rider finishes that kilometre at their own road time.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchToPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PACE_LOSS_COMPLETION_VERSION=
  'v2-physical-pace-loss-completion-1';

export function completePhysicalPaceLossKmV1({startInput,start,
  lossKm,loss,riderId}){
  if(!isDeepStrictEqual(loss,runPhysicalBunchToPaceLossV1({
    startInput,start,lossKm})))
    throw new Error('Solo completion needs replayed physical loss.');
  const split=loss.step.splits.find(row=>row.riderId===riderId);
  const partial=loss.step.riders.find(row=>row.riderId===riderId);
  const decision=loss.step.riderDecisions.find(row=>
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
  return {version:PHYSICAL_PACE_LOSS_COMPLETION_VERSION,
    sourceKm:lossKm,riderId,
    decision:structuredClone(decision),
    physicalGroup:{id:`solo-${riderId}`,
      riderIds:[riderId],atDistanceM:lossKm*1000},
    startDistanceM:split.atDistanceM,
    endDistanceM:lossKm*1000,
    elapsedSeconds:loss.elapsedSeconds+additionalSeconds,
    gapSecondsToBunch:additionalSeconds,
    energyBefore:partial.energyAfter,
    energySpent:paid.energyDemand,
    totalKmEnergySpent:partial.energySpent+paid.energyDemand,
    recoveryAward:recovery.recovery,cap,energyAfter,
    quietKm:recovery.quietKm,officialResults:false};
}

export function validatePhysicalPaceLossCompletionV1(input,recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalPaceLossKmV1(input)))
    throw new Error('Solo completion differs from physical source.');
  return true;
}
