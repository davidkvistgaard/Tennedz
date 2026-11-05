// Pay a preset launch only for the rider actually at the bunch.
// A source co-break rider already on a paid rear road stays there.
import {decideV94PhysicalMixedOriginPresetV1} from
  './v94-physical-mixed-origin-preset-choice-v1.mjs';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFreshAttackSolosV1} from
  './v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_MIXED_ORIGIN_PRESET_KM_VERSION=
  'v94-physical-mixed-origin-preset-km-1';
const FRONT_VERSION='v94-physical-mixed-origin-preset-front-1';
const FRONT_DECISION_VERSION=
  'v94-physical-mixed-origin-preset-front-decision-1';
const REAR_DECISION_VERSION=
  'v94-physical-mixed-origin-preset-rear-decision-1';
const BOUNDARY_VERSION=
  'v94-physical-mixed-origin-preset-boundary-1';

export function replayV94PhysicalMixedOriginPresetKmV1(
  recording,prior){
  const choice=decideV94PhysicalMixedOriginPresetV1(
    recording,prior);
  const km=choice.sourceKm;
  const solos=replayV94PhysicalFreshAttackSolosV1(
    recording,prior,{
      existingSourceBreakRiderIds:
        choice.declinedSourceFrontLaunchRiderIds,
      selectedRiderIds:
        choice.pendingPelotonLaunchRiderIds});
  const boundary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,version:BOUNDARY_VERSION});
  const frontInput={km,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:FRONT_VERSION,
    decisionVersion:FRONT_DECISION_VERSION,
    priorField:null,
    excludedFreshAttackRiderIds:
      choice.pendingPelotonLaunchRiderIds,
    unattachedSourceRoadRiderIds:
      choice.declinedSourceFrontLaunchRiderIds,
    sourceRearAttackRiderIds:
      choice.declinedSourceFrontLaunchRiderIds,
    allowNamedChaseTurns:true};
  let namedFront,orderedEffortRefusal=null;
  try{namedFront=replayV94PhysicalFrontKmFromPriorV1(
    recording,frontInput);}
  catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km||
      !recording.frames[km-1].pelotonRestTeamIds?.length)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    namedFront=replayV94PhysicalFrontKmFromPriorV1(
      recording,{...frontInput,recordedRestMode:true});
  }
  if(Math.abs(namedFront.frontClockSeconds-
    solos.frontClockSeconds)>1e-7)
    throw new Error('Mixed preset attack/front clocks differ.');
  const front={...namedFront,freshAttackSolos:solos,
    sourceBreakRoadNotPhysical:true,
    officialResults:false};
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_MIXED_ORIGIN_PRESET_KM_VERSION,
    decisionVersion:REAR_DECISION_VERSION});
  return {...settled,
    priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    mixedOriginPresetChoiceVersion:choice.version,
    mixedOriginPresetDecisions:choice.decisions,
    sourcePresetFrontLaunchDeclinedRiderIds:
      choice.declinedSourceFrontLaunchRiderIds,
    sourceBreakRiderIds:[...recording.frames[km-1]
      .breakawayRiderIds],
    formerSourceBreakRiderIds:
      [...prior.formerSourceBreakRiderIds],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...recording.frames[km-1]
        .pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}
