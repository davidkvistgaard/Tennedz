// Price fresh individual attacks beside an older, uncontacted source
// break claim. This is not a paid road for the older riders or a group.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalFreshAttackSolosV1} from
  './v94-physical-fresh-attack-solo-v1.mjs';

export const V94_PHYSICAL_MIXED_FRESH_ATTACK_SOLO_VERSION=
  'v94-physical-mixed-fresh-attack-solo-1';

export function replayV94PhysicalMixedFreshAttackSolosV1(
  recording,prior){
  if(!Number.isInteger(prior?.sourceKm)||prior.sourceKm<7||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error(
      'Mixed fresh attack needs paid prior break solos.');
  const solos=replayV94PhysicalFreshAttackSolosV1(
    recording,prior,{existingSourceBreakRiderIds:
      prior.sourceBreakRiderIds});
  if(!solos.mixedSourceRoadClaims.length||
    solos.sourceCheckpointComparisons.length)
    throw new Error(
      'Mixed fresh source group needs separate paid roads.');
  return {...solos,
    version:V94_PHYSICAL_MIXED_FRESH_ATTACK_SOLO_VERSION,
    priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    oldBreakRoadMotionUnresolved:true,
    officialResults:false};
}

export function validateV94PhysicalMixedFreshAttackSolosV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalMixedFreshAttackSolosV1(recording,prior)))
    throw new Error('Mixed fresh solos differ from paid source.');
  return true;
}
