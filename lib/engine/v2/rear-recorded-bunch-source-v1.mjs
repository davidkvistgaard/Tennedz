// Extract a paid bunch road from a fully replayed v94 race. This supplies an
// opposing pace to an isolated rear-road counterfactual, not rear positions.
import {replayRaceDynamicsRecording} from
  './replay-race-dynamics-v94.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';

export const REAR_RECORDED_BUNCH_SOURCE_VERSION=
  'v2-rear-recorded-bunch-source-1';

export function rearRecordedBunchSourceV1({recording,km,
  rearRiderIds=[]}){
  if(!Number.isInteger(km)||km<1||
    !Array.isArray(rearRiderIds)||
    new Set(rearRiderIds).size!==rearRiderIds.length)
    throw new Error('Rear road needs a named source kilometre.');
  replayRaceDynamicsRecording(recording);
  const frame=recording.frames[km-1];
  const plan=frame?.pelotonFrontTurnPlan;
  if(frame?.km!==km||!plan||
    plan.status!=='worked'||
    plan.turns.some(turn=>rearRiderIds.includes(
      turn.leaderRiderId)))
    throw new Error('Rear road needs distinct paid bunch leaders.');
  bunchAbilityFromPaidTurnsV1(plan);
  return {version:REAR_RECORDED_BUNCH_SOURCE_VERSION,
    raceSeed:recording.raceSeed,sourceKm:km,
    turnPlan:structuredClone(plan),
    segment:structuredClone(recording.route.kilometres[km-1])};
}
