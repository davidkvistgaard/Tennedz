import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {validateRequestedFinalePlans} from './playtest-finale-trial.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {recordFinaleBunchOnlyLastKmClock,
  validateFinaleBunchOnlyLastKmClock} from
  './finale-bunch-only-last-km.mjs';
import {recordFinaleBunchOnlyIndividualLine,
  validateFinaleBunchOnlyIndividualLine} from
  './finale-bunch-only-individual-line.mjs';
import {recordFinaleCoastDroppedLastKmClock,
  recordFinaleCoastNoFrontDroppedLastKmClock,
  recordFinaleCoastDynamicNoFrontLastKmClock,
  recordFinaleCoastDynamicFrontLastKmClock,
  recordFinaleCoastDissolvedLeadingLastKmClock,
  recordFinaleCoastDissolvedSurvivorPassClock,
  recordFinaleCoastDissolvedThreeFrontClock,
  recordFinaleCoastMixedFrontClearClock,
  recordFinaleCoastMixedFrontLatePassClock,
  recordFinaleCoastMixedThreeFrontClearClock,
  recordFinaleCoastMixedThreeFrontDroppedClock,
  recordFinaleCoastMixedThreeFrontPre500PassClock,
  recordFinaleCoastMixedFrontParallelPassClock,
  recordFinaleCoastDissolvedLeadingDroppedLastKmClock,
  recordFinaleCoastDissolvedAllFrontsLastKmClock,
  recordFinaleCoastDissolvedSingleLastKmClock,
  recordFinaleCoastDynamicActiveLastKmClock,
  recordFinaleCoastDynamicSingleLastKmClock,
  recordFinaleCoastFrontCatchLastKmClock,
  recordFinaleSeparatedLastKmClock,
  recordFinaleSingleGroupLastKmClock,
  validateFinaleSeparatedLastKmClock,
  validateFinaleSingleGroupLastKmClock,
  validateFinaleCoastDroppedLastKmClock,
  validateFinaleCoastNoFrontDroppedLastKmClock,
  validateFinaleCoastDynamicNoFrontLastKmClock,
  validateFinaleCoastDynamicFrontLastKmClock,
  validateFinaleCoastDissolvedLeadingLastKmClock,
  validateFinaleCoastDissolvedSurvivorPassClock,
  validateFinaleCoastDissolvedThreeFrontClock,
  validateFinaleCoastMixedFrontClearClock,
  validateFinaleCoastMixedFrontLatePassClock,
  validateFinaleCoastMixedThreeFrontClearClock,
  validateFinaleCoastMixedThreeFrontDroppedClock,
  validateFinaleCoastMixedThreeFrontPre500PassClock,
  validateFinaleCoastMixedFrontParallelPassClock,
  validateFinaleCoastDissolvedLeadingDroppedLastKmClock,
  validateFinaleCoastDissolvedAllFrontsLastKmClock,
  validateFinaleCoastDissolvedSingleLastKmClock,
  validateFinaleCoastDynamicActiveLastKmClock,
  validateFinaleCoastDynamicSingleLastKmClock,
  validateFinaleCoastFrontCatchLastKmClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine,
  recordFinaleCoastedIsolatedPassIndividualLine,
  recordFinaleCoastedIsolatedParallelIndividualLine,
  recordFinaleCoastedFullKmIsolatedLanesLine,
  recordFinaleCoastedFrontExitIndividualLine,
  validateFinaleDepletedIndividualLine,
  FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION,
  FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION,
  FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';
import {projectV93ProvisionalCoastedPointPreview,
  projectV93ProvisionalIsolatedPassPointPreview,
  projectV93ProvisionalIsolatedParallelPointPreview,
  projectV93ProvisionalFullKmIsolatedLanesPointPreview,
  projectV93ProvisionalFrontExitPointPreview,
  projectV93ProvisionalSeparatedPointPreview,
  projectV93ProvisionalSingleGroupPointPreview,
  projectV93ProvisionalBunchOnlyPointPreview,
  projectV93ProvisionalCoastNoFrontPointPreview} from
  './playtest-point-preview.mjs';
import {recordFinaleSeparatedIndividualLine,
  validateFinaleSeparatedIndividualLine,
  recordFinaleSingleGroupIndividualLine,
  validateFinaleSingleGroupIndividualLine} from
  './finale-separated-individual-line.mjs';
import {projectFinaleDynamicSingleRoadBounds} from
  './finale-dynamic-single-road-bounds.mjs';
import {projectFinaleDynamicActiveRoadBounds} from
  './finale-dynamic-active-road-bounds.mjs';
import {projectFinaleDynamicFrontRoadBounds} from
  './finale-dynamic-front-road-bounds.mjs';
import {FINALE_SEPARATED_SINGLETON_BAND_VERSION} from
  './finale-separated-singleton-band.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  './finale-multi-run.mjs';
import {auditDissolvedFrontPaidContact} from
  './finale-dissolved-front-paid-contact.mjs';
import {recordFinaleLateCatchIndividualAudit} from
  './finale-late-catch-individual-audit.mjs';
import {recordFinaleCoastedWheelContactLine,
  validateFinaleCoastedWheelContactLine} from
  './finale-coasted-wheel-contact-line.mjs';
import {summarizeV93WheelContactPlaytest} from
  './playtest-v93-wheel-contact-summary.mjs';
import {recordFinaleLateActiveContactLine,
  validateFinaleLateActiveContactLine,
  FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION} from
  './finale-late-active-contact-line.mjs';
import {summarizeV93LateActiveContactPlaytest} from
  './playtest-v93-late-active-contact-summary.mjs';
import {recordFinaleDissolvedFrontPreviewResult,
  validateFinaleDissolvedFrontPreviewResult} from
  './finale-dissolved-front-preview-result.mjs';
import {summarizeV93DissolvedFrontPlaytest} from
  './playtest-v93-dissolved-front-summary.mjs';
import {recordFinaleMixedPost500OutsideLaneResult,
  validateFinaleMixedPost500OutsideLaneResult} from
  './finale-mixed-post500-outside-lane-result.mjs';
import {summarizeV93MixedPost500Playtest} from
  './playtest-v93-mixed-post500-summary.mjs';
import {recordFinaleMixedStraddlingOutsideLaneResult,
  validateFinaleMixedStraddlingOutsideLaneResult} from
  './finale-mixed-straddling-outside-lane-result.mjs';
import {recordFinaleMixedTwoFrontDroppedResult,
  validateFinaleMixedTwoFrontDroppedResult} from
  './finale-mixed-two-front-dropped-result.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshResult,
  validateFinaleMixedTwoFrontDroppedFreshResult} from
  './finale-mixed-two-front-dropped-fresh-result.mjs';
import {recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result,
  validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result} from
  './finale-mixed-two-front-dropped-clean-pre500-fresh-final500-result.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result,
  validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result} from
  './finale-mixed-two-front-dropped-fresh-pre500-clean-final500-result.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Result,
  validateFinaleMixedTwoFrontDroppedManyPre500Result,
  recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult,
  validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult,
  recordFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult,
  validateFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult,
  recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult,
  validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult,
  recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult,
  validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult,
  recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult,
  validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult} from
  './finale-mixed-two-front-dropped-many-pre500-result.mjs';
import {recordFinaleLateBunchExitShoulder,
  validateFinaleLateBunchExitShoulder} from
  './finale-late-bunch-exit-shoulder.mjs';
import {recordFinaleEarlyFrontCatchLaneLine,
  validateFinaleEarlyFrontCatchLaneLine,
  FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION,
  FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION} from
  './finale-early-front-catch-lane-line.mjs';

export const V93_COASTED_PLAYTEST_VERSION='v93-coasted-playtest-1';
export const V93_COAST_ISOLATED_PASS_PLAYTEST_VERSION=
  'v93-coast-isolated-pass-playtest-1';
export const V93_COAST_ISOLATED_PARALLEL_PLAYTEST_VERSION=
  'v93-coast-isolated-parallel-playtest-1';
export const V93_COAST_FULL_KM_ISOLATED_LANES_PLAYTEST_VERSION=
  'v93-coast-full-km-isolated-lanes-playtest-1';
export const V93_COAST_FRONT_EXIT_PLAYTEST_VERSION=
  'v93-coast-front-exit-playtest-1';
export const V93_SEPARATED_PLAYTEST_VERSION='v93-separated-playtest-1';
export const V93_SINGLE_GROUP_PLAYTEST_VERSION='v93-single-group-playtest-1';
export const V93_BUNCH_ONLY_PLAYTEST_VERSION='v93-bunch-only-playtest-1';
export const V93_COAST_NO_FRONT_PLAYTEST_VERSION=
  'v93-coast-no-front-playtest-1';
export const V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION=
  'v93-dynamic-no-front-playtest-1';
export const V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION=
  'v93-late-bunch-exit-playtest-1';
export const V93_LATE_BUNCH_EXIT_SHOULDER_PLAYTEST_VERSION=
  'v93-late-bunch-exit-shoulder-playtest-1';
export const V93_FRONT_CATCH_PLAYTEST_VERSION=
  'v93-front-catch-playtest-1';
export const V93_EARLY_FRONT_CATCH_LANE_PLAYTEST_VERSION=
  'v93-early-front-catch-lane-playtest-1';
export const V93_EARLY_FRONT_CATCH_ISOLATED_LANES_PLAYTEST_VERSION=
  'v93-early-front-catch-isolated-lanes-playtest-2';
export const V93_COAST_TAIL_PLAYTEST_VERSION=
  'v93-coast-tail-playtest-1';
export const V93_DYNAMIC_FRONT_PLAYTEST_VERSION=
  'v93-dynamic-front-playtest-1';
export const V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION=
  'v93-dynamic-active-playtest-1';
export const V93_COAST_SINGLETON_PLAYTEST_VERSION=
  'v93-coast-singleton-playtest-1';
export const V93_DYNAMIC_SINGLE_PLAYTEST_VERSION=
  'v93-dynamic-single-playtest-1';
export const V93_UNSUPPORTED_ROAD_PREVIEW_VERSION=
  'v93-unsupported-road-preview-1';
export const V93_UNSUPPORTED_CATCH_PREVIEW_VERSION=
  'v93-unsupported-catch-preview-1';
export const V93_PAID_LATE_CATCH_ROAD_PREVIEW_VERSION=
  'v93-paid-late-catch-road-preview-2';
export const V93_WHEEL_CONTACT_PLAYTEST_VERSION=
  'v93-wheel-contact-playtest-1';
export const V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION=
  'v93-no-drops-wheel-contact-playtest-1';
export const V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION=
  'v93-late-active-contact-playtest-1';
export const V93_DISSOLVED_FRONT_PLAYTEST_VERSION=
  'v93-dissolved-front-playtest-1';
export const V93_DISSOLVED_LEADING_PLAYTEST_VERSION=
  'v93-dissolved-leading-playtest-1';
export const V93_DISSOLVED_SURVIVOR_PASS_PLAYTEST_VERSION=
  'v93-dissolved-survivor-pass-playtest-1';
export const V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION=
  'v93-dissolved-three-front-playtest-1';
export const V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION=
  'v93-mixed-front-clear-playtest-1';
export const V93_MIXED_FRONT_LATE_PASS_PLAYTEST_VERSION=
  'v93-mixed-front-late-pass-playtest-1';
export const V93_MIXED_THREE_FRONT_CLEAR_PLAYTEST_VERSION=
  'v93-mixed-three-front-clear-playtest-1';
export const V93_MIXED_THREE_FRONT_DROPPED_PLAYTEST_VERSION=
  'v93-mixed-three-front-dropped-playtest-1';
export const V93_MIXED_THREE_FRONT_PRE500_PASS_PLAYTEST_VERSION=
  'v93-mixed-three-front-pre500-pass-playtest-1';
export const V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION=
  'v93-mixed-three-front-post500-lanes-playtest-1';
export const V93_MIXED_THREE_FRONT_STRADDLING_LANES_PLAYTEST_VERSION=
  'v93-mixed-three-front-straddling-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-older-drops-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-fresh-older-drops-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-final-fresh-older-drops-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_EARLY_FRESH_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-early-fresh-older-drops-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-many-pre500-older-drops-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-many-pre500-clean-final-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-five-pre500-clean-final-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-multifront-clean-final-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION=
  'v93-mixed-two-front-crowded-multifront-lanes-playtest-1';
export const V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION=
  'v93-mixed-two-front-multifront-parallel-final-playtest-1';
export const V93_MIXED_FRONT_PARALLEL_PASS_PLAYTEST_VERSION=
  'v93-mixed-front-parallel-pass-playtest-1';
export const V93_DISSOLVED_LEADING_DROPPED_PLAYTEST_VERSION=
  'v93-dissolved-leading-dropped-playtest-1';
export const V93_DISSOLVED_ALL_FRONTS_PLAYTEST_VERSION=
  'v93-dissolved-all-fronts-playtest-1';
export const V93_DISSOLVED_SINGLE_PLAYTEST_VERSION=
  'v93-dissolved-single-playtest-1';
const V93_PRIOR_PAID_LATE_CATCH_ROAD_PREVIEW_VERSION=
  'v93-paid-late-catch-road-preview-1';
export const V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION=
  'v93-unsupported-handoff-preview-1';
export const V93_UNRESOLVED_FRONT_MARKER_PREVIEW_VERSION=
  'v93-unresolved-front-marker-preview-2';

function recordedKilometrePreview(recording){
  return recording.frames.slice(0,-1).map(frame=>({
    km:frame.km,roadGroups:frame.roadGroups.map(group=>({
      id:group.id,gapSeconds:group.gapSeconds,
      riderIds:group.riderIds})),
    droppedRiders:frame.riderGroups.filter(row=>
      row.group==='dropped').map(row=>({riderId:row.id,
      energy:row.energy})),
    ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
      .map(row=>({riderId:row.id,roadGroup:row.group,
        energy:row.energy}))}));
}

// The calculated contact stops the short-road probe before it can pay a
// merge. Keep the validated kilometre history and name that boundary;
// do not present a fabricated last-kilometre passage or individual line.
function summarizeV93UnsupportedCatch(settings,recording,cause){
  const finishM=recording.route.distanceKm*1000;
  const source=recording.frames.at(-2);
  const {groupId,calculatedCatchDistanceM,
    sliceStartDistanceM}=cause;
  if(!source.roadGroups.some(group=>group.id===groupId)||
    !Number.isFinite(calculatedCatchDistanceM)||
    !Number.isFinite(sliceStartDistanceM)||
    sliceStartDistanceM<finishM-1000||
    calculatedCatchDistanceM<sliceStartDistanceM||
    calculatedCatchDistanceM>finishM)
    throw new Error('The unsupported catch has no matching source road.');
  return {version:V93_UNSUPPORTED_CATCH_PREVIEW_VERSION,settings,
    handoffKm:recording.route.distanceKm-1,
    kilometreFrames:recordedKilometrePreview(recording),
    lastKmRoad:[],exits:[],unsupportedReason:'unpaid_front_catch',
    catch:{groupId,calculatedCatchDistanceM,sliceStartDistanceM,
      metresToGo:finishM-calculatedCatchDistanceM},
    lineTimes:null,bandReplays:null,classifiedResults:null,
    pointPreview:{status:'unavailable',pointsStatus:'withheld',
      canCommitAwards:false},pointsStatus:'withheld',
    canCommitAwards:false};
}

// The final-slice catch can be paid on the road without pretending that the
// merged riders have an individual sprint order. Preserve the earlier refusal
// shape for every other unsupported catch.
function summarizeV93PaidLateCatchRoad(settings,recording,cause,plans){
  const finishM=recording.route.distanceKm*1000;
  if(cause.calculatedCatchDistanceM<=finishM-100||
    cause.calculatedCatchDistanceM>=finishM)
    throw new Error('The paid late catch must be inside the final slice.');
  const source=recording.frames.at(-2);
  const group=source.roadGroups.find(row=>row.id===cause.groupId);
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
  const contactFrame=trace.frames.at(-1);
  const contact=contactFrame?.contact;
  const sourceEnergy=new Map(source.riderGroups.map(row=>[row.id,row.energy]));
  const ownIds=new Set(source.riderGroups.filter(row=>
    row.teamId==='you').map(row=>row.id));
  const sourceDeficit=new Map(source.riderGroups.filter(row=>
    row.group==='dropped').map(row=>[row.id,row.deficitSeconds]));
  const roster=recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(source.roadGroups.length!==1||!group||!sourceDeficit.size||
    trace.frames.length!==7||contact?.kind!=='front_catch'||
    contact.groupId!==cause.groupId||
    Math.abs(contact.atDistanceM-cause.calculatedCatchDistanceM)>1e-7||
    contactFrame.endDistanceM!==finishM||
    trace.frames.slice(0,-1).some(frame=>frame.contact||
      frame.roadGroups.length!==1||
      frame.roadGroups[0].id!==group.id)||
    trace.frames.some(frame=>frame.exhaustionDrops.length||
      frame.droppedTravel?.riders.length!==sourceDeficit.size)||
    contactFrame.roadGroups.length||
    contactFrame.pelotonRiderIds.length!==
      roster.length-sourceDeficit.size||
    contact.caughtRiderIds.length!==group.riderIds.length||
    contact.caughtRiderIds.some(id=>!group.riderIds.includes(id))||
    sourceEnergy.size!==roster.length||
    trace.finalRiderEnergy.length!==roster.length)
    throw new Error('The late catch has no complete paid road.');
  let bunchTime=0;
  let frontTime=-group.gapSeconds;
  const droppedTimes=new Map(sourceDeficit);
  const energies=new Map(sourceEnergy);
  const lastKmRoad=trace.frames.map(frame=>{
    const beforeBunchTime=bunchTime;
    bunchTime+=frame.bunchElapsedSeconds;
    const groupPassages=frame.roadGroups.map(row=>{
      frontTime+=row.elapsedSeconds;
      if(Math.abs(bunchTime-frontTime-row.gapSeconds)>1e-7)
        throw new Error('The late catch front passage lost its paid gap.');
      return {id:row.id,riderIds:[...row.riderIds],
        gapSeconds:row.gapSeconds,
        passageSecondsFromBunchMarker:frontTime};
    });
    const droppedPassages=frame.droppedTravel.riders.map(row=>{
      const previous=droppedTimes.get(row.riderId);
      const time=previous+row.elapsedSeconds;
      if(!Number.isFinite(previous)||!Number.isFinite(time)||
        Math.abs(time-bunchTime-row.deficitSecondsAfter)>1e-7||
        time<=bunchTime)
        throw new Error('The late catch lost an isolated passage.');
      droppedTimes.set(row.riderId,time);
      return {riderId:row.riderId,
        passageSecondsFromBunchMarker:time,
        deficitSeconds:row.deficitSecondsAfter,
        energySpent:row.energySpent,
        curtailedEnergyDemand:row.curtailedEnergyDemand};
    });
    if(frame.riders.length!==roster.length||
      new Set(frame.riders.map(row=>row.riderId)).size!==roster.length)
      throw new Error('The late catch lost a rider on the road.');
    for(const row of frame.riders){
      const before=energies.get(row.riderId);
      if(!Number.isFinite(before)||!Number.isFinite(row.energy)||
        !Number.isFinite(row.energySpent)||row.energy<0||
        Math.abs(before-row.energySpent-row.energy)>1e-7)
        throw new Error('The late catch lost paid rider energy.');
      energies.set(row.riderId,row.energy);
    }
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:bunchTime,
      groups:groupPassages,droppedPassages,
      ownRiderEnergy:frame.riders.filter(row=>ownIds.has(row.riderId))
        .map(row=>({riderId:row.riderId,energy:row.energy,
          roadBandId:frame.roadGroups.some(group=>
            group.riderIds.includes(row.riderId))?group.id:
            frame.pelotonRiderIds.includes(row.riderId)?'peloton':
              `isolated:${row.riderId}`})),
      ...(frame.contact?{contact:{...frame.contact,
        elapsedSecondsFromLastKmStart:beforeBunchTime+
          frame.contact.preContactBunchSeconds}}:{})};
  });
  if(trace.finalRiderEnergy.some(row=>
    Math.abs(energies.get(row.riderId)-row.energy)>1e-7))
    throw new Error('The late catch line energy differs from its road.');
  let individualContactAudit=null;
  try{individualContactAudit=recordFinaleLateCatchIndividualAudit(
    recording,trace,{plans});}
  catch{/* Keep the fully paid group road when an individual audit cannot run. */}
  return {version:individualContactAudit?
    V93_PAID_LATE_CATCH_ROAD_PREVIEW_VERSION:
    V93_PRIOR_PAID_LATE_CATCH_ROAD_PREVIEW_VERSION,settings,
    handoffKm:source.km,
    kilometreFrames:recordedKilometrePreview(recording),
    lastKmRoad,exits:[],unsupportedReason:'individual_late_catch',
    paidRoadVersion:trace.version,
    catch:{groupId:group.id,
      calculatedCatchDistanceM:contact.atDistanceM,
      sliceStartDistanceM:cause.sliceStartDistanceM,
      metresToGo:finishM-contact.atDistanceM,
      elapsedSecondsFromLastKmStart:
        lastKmRoad.at(-1).contact.elapsedSecondsFromLastKmStart,
      caughtRiderIds:[...contact.caughtRiderIds]},
    finalRiderEnergy:trace.finalRiderEnergy,
    ...(individualContactAudit?{individualContactAudit}:{}),
    lineTimes:null,bandReplays:null,classifiedResults:null,
    pointPreview:{status:'unavailable',pointsStatus:'withheld',
      canCommitAwards:false},pointsStatus:'withheld',
    canCommitAwards:false};
}

function summarizeV93CatchRoad(settings,recording,cause,plans){
  const source=recording.frames.at(-2);
  if(source.roadGroups.length===1&&
    source.riderGroups.some(row=>row.group==='dropped')&&
    cause.calculatedCatchDistanceM>
      recording.route.distanceKm*1000-100){
    try{return summarizeV93PaidLateCatchRoad(settings,recording,cause,plans);}
    catch{/* Preserve the prior explicit refusal if this road cannot be paid. */}
  }
  return summarizeV93UnsupportedCatch(settings,recording,cause);
}

// Keep only the validated kilometre history when the last-kilometre
// continuation cannot pay an active rider or reconcile intersecting bands.
// Neither error licenses a final-kilometre passage or individual result.
function unresolvedFrontMarkerAudit(recording){
  const source=recording.frames.at(-2);
  if(source?.roadGroups.length!==3||
    !source.riderGroups.some(row=>row.group==='dropped'))return null;
  try{
    const trace=probeFinaleSeparatedGroupsFromTour(recording,{
      version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
    const first=source.roadGroups[0],second=source.roadGroups[1];
    const leavers=trace.frames.flatMap(frame=>
      frame.frontExhaustionDrops.filter(row=>
        row.fromRoadGroupId===first.id).map(row=>row.riderId));
    const audit=auditDissolvedFrontPaidContact(trace);
    const encounters=audit.encounters.filter(row=>
      row.activeBandId===second.id&&leavers.includes(row.riderId));
    if(!leavers.length||encounters.length!==leavers.length||
      new Set(encounters.map(row=>row.riderId)).size!==leavers.length||
      !encounters.some(row=>row.distanceM>=
        recording.route.distanceKm*1000-500))return null;
    return {version:audit.version,status:'paid_marker_overlap_wheels_unresolved',
      sourceTraceVersion:trace.version,
      encounters:encounters.map(row=>({riderId:row.riderId,
        activeBandId:row.activeBandId,distanceM:row.distanceM,
        elapsedSecondsFromLastKmStart:
          row.elapsedSecondsFromLastKmStart,
        energyAtMarker:row.split.solo.energyAtContact})),
      contactResolved:false,pointsStatus:'withheld',
      canCommitAwards:false};
  }catch{return null;}
}

function summarizeV93UnsupportedHandoff(settings,recording,reason,
  riderId=null){
  const source=recording.frames.at(-2);
  if(!['unpayable_front_handoff','unresolved_band_contact',
    'depleted_front_dissolution'].includes(reason)||
    source?.km!==recording.route.distanceKm-1||
    reason==='unpayable_front_handoff'&&
      !source.roadGroups.some(group=>group.riderIds.includes(riderId)))
    throw new Error('The unsupported handoff has no matching source road.');
  const dissolved=reason==='depleted_front_dissolution'?
    source.roadGroups.find(group=>group.id===riderId):null;
  if(reason==='depleted_front_dissolution'&&
    (!dissolved||!dissolved.riderIds.length||
      dissolved.riderIds.some(id=>source.riderGroups.find(row=>
        row.id===id)?.energy!==0)))
    throw new Error('The depleted front has no matching source road.');
  const markerAudit=reason==='unresolved_band_contact'?
    unresolvedFrontMarkerAudit(recording):null;
  return {version:markerAudit?
    V93_UNRESOLVED_FRONT_MARKER_PREVIEW_VERSION:
    V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION,settings,
    handoffKm:source.km,
    kilometreFrames:recordedKilometrePreview(recording),
    lastKmRoad:[],exits:[],unsupportedReason:reason,
    ...(markerAudit?{markerAudit}:{}),
    handoff:reason==='depleted_front_dissolution'?{
      groupId:dissolved.id,riderIds:[...dissolved.riderIds]}:
      {riderId},lineTimes:null,bandReplays:null,
    classifiedResults:null,
    pointPreview:{status:'unavailable',pointsStatus:'withheld',
      canCommitAwards:false},pointsStatus:'withheld',
    canCommitAwards:false};
}

// The paid tour and last-kilometre clock are still useful when an individual
// finish has no supported bunch-exit continuation. This read-only projection
// deliberately has no rider line, replay or point result.
function summarizeV93UnsupportedRoad(settings,recording,clock,cause){
  const finishM=recording.route.distanceKm*1000;
  const exits=clock.trace.frames.flatMap(frame=>
    frame.exhaustionDrops.map(row=>({riderId:row.riderId,
      atDistanceM:row.atDistanceM})));
  const late=exits.filter(row=>row.atDistanceM>finishM-500);
  if(!late.length||late[0].atDistanceM!==
    finishM-cause.metresToGo||
    late.length!==cause.riderIds.length||
    late.some(row=>!cause.riderIds.includes(row.riderId))||
    clock.passageFrames.at(-1)?.distanceM!==finishM||
    clock.trace.frames.length!==clock.passageFrames.length||
    clock.trace.frames.some(frame=>late.some(exit=>
      !Number.isFinite(frame.riders.find(row=>
        row.riderId===exit.riderId)?.energy))))
    throw new Error('The unsupported road has no matching paid exit.');
  return {version:V93_UNSUPPORTED_ROAD_PREVIEW_VERSION,settings,
    handoffKm:recording.route.distanceKm-1,
    kilometreFrames:recordedKilometrePreview(recording),
    lastKmRoad:clock.passageFrames.map((frame,index)=>({
      ...frame,droppedPassages:frame.droppedPassages??[],
      sourceKm:clock.sourceKm,
      exitRiderEnergy:late.map(exit=>({riderId:exit.riderId,
        energy:clock.trace.frames[index].riders.find(row=>
          row.riderId===exit.riderId)?.energy}))})),
    exits:late,unsupportedReason:'late_bunch_exit',
    lineTimes:null,bandReplays:null,classifiedResults:null,
    pointPreview:{status:'unavailable',pointsStatus:'withheld',
      canCommitAwards:false},pointsStatus:'withheld',
    canCommitAwards:false};
}

// A bounded full-race preview: the selected route and all manager tactics
// generate one locked road, followed by a paid kilometre, nominated
// individual crossings and a read-only policy illustration.
export function createV93PlayableTest(settings,{plans=null,
  pointContext=null}={}, {resolveIsolatedPasses=true,
  resolveFrontExits=true,resolveWheelContact=true,
  resolveLateActiveContact=true,resolveDissolvedFront=true,
  resolveDissolvedSurvivorPass=true,
  resolveDissolvedThreeFront=true,
  resolveMixedFrontClear=true,
  resolveMixedFrontLatePass=true,
  resolveMixedThreeFrontClear=true,
  resolveMixedThreeFrontDropped=true,
  resolveMixedThreeFrontPre500Pass=true,
  resolveMixedThreeFrontPost500Pass=true,
  resolveMixedThreeFrontStraddlingPass=true,
  resolveMixedTwoFrontDroppedLanes=true,
  resolveMixedTwoFrontFreshLanes=true,
  resolveMixedTwoFrontFinalFreshLanes=true,
  resolveMixedTwoFrontEarlyFreshLanes=true,
  resolveMixedTwoFrontManyPre500Lanes=true,
  resolveMixedTwoFrontManyPre500CleanFinalLanes=true,
  resolveMixedTwoFrontFivePre500CleanFinalLanes=true,
  resolveMixedTwoFrontMultifrontCleanFinalLanes=true,
  resolveMixedTwoFrontCrowdedMultifrontLanes=true,
  resolveMixedTwoFrontMultifrontParallelFinal=true,
  resolveMixedFrontParallelPass=true,
  resolveLateBunchExitShoulder=true,
  resolveEarlyFrontCatchLanes=true,
  resolveEarlyIsolatedLanes=true}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  if(plans!==null)validateRequestedFinalePlans(plans,teams);
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  const source=recording.frames.at(-2);
  const dropped=source.riderGroups.filter(row=>row.group==='dropped');
  const separated=source.roadGroups.length>=2&&dropped.length===0;
  const singleGroup=source.roadGroups.length===1&&dropped.length===0;
  const bunchOnly=source.roadGroups.length===0&&dropped.length===0;
  const coastNoFront=source.roadGroups.length===0&&dropped.length>0;
  const coasted=source.roadGroups.length>=1&&dropped.length>0;
  if(!separated&&!singleGroup&&!bunchOnly&&!coastNoFront&&!coasted)
    throw new Error('The v93 preview cannot pay this final-kilometre road.');
  let dynamicNoFront=false;
  let dynamicFront=false;
  let dissolvedLeading=false;
  let dissolvedSurvivorPass=false;
  let dissolvedThreeFront=false;
  let mixedFrontClear=false;
  let mixedFrontLatePass=false;
  let mixedThreeFrontClear=false;
  let mixedThreeFrontDropped=false;
  let mixedThreeFrontPre500Pass=false;
  let post500OutsideLaneResult=null;
  let straddlingOutsideLaneResult=null;
  let mixedTwoFrontResult=null;
  let mixedTwoFrontFresh=false;
  let mixedTwoFrontFinalFresh=false;
  let mixedTwoFrontEarlyFresh=false;
  let mixedTwoFrontManyPre500=false;
  let mixedTwoFrontManyPre500CleanFinal=false;
  let mixedTwoFrontFivePre500CleanFinal=false;
  let mixedTwoFrontMultifrontCleanFinal=false;
  let mixedTwoFrontCrowdedMultifront=false;
  let mixedTwoFrontMultifrontParallelFinal=false;
  let mixedFrontParallelPass=false;
  let dissolvedLeadingDropped=false;
  let dissolvedAllFronts=false;
  let dissolvedSingle=false;
  let dynamicActive=false;
  let dynamicSingle=false;
  let frontCatch=false;
  const separatedClock=()=>{
    try{return recordFinaleSeparatedLastKmClock(recording);}
    catch(error){
      if(!error.message.startsWith(
        'A separated-group rider cannot pay for travel:'))
        throw error;
      dynamicFront=true;
      try{return recordFinaleCoastDynamicFrontLastKmClock(recording);}
      catch(dissolutionError){
        if(resolveMixedFrontClear&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedFrontClearClock(recording);
          mixedFrontClear=true;
          return next;
        }catch{/* Preserve the earlier explicit refusal. */}
        if(resolveMixedFrontLatePass&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedFrontLatePassClock(recording);
          mixedFrontLatePass=true;
          return next;
        }catch{/* Preserve the earlier explicit refusal. */}
        if(resolveMixedThreeFrontClear&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedThreeFrontClearClock(recording);
          mixedThreeFrontClear=true;
          return next;
        }catch{/* Preserve the earlier explicit refusal. */}
        if(resolveMixedThreeFrontDropped&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedThreeFrontDroppedClock(recording);
          mixedThreeFrontDropped=true;
          return next;
        }catch{/* Preserve the earlier explicit refusal. */}
        if(resolveMixedFrontParallelPass&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedFrontParallelPassClock(recording);
          mixedFrontParallelPass=true;
          return next;
        }catch{/* Preserve the earlier explicit refusal. */}
        if(resolveDissolvedFront&&dissolutionError.message===
          'A depleted front group needs recorded group dissolution.'){
          try{
            const next=recordFinaleCoastDissolvedLeadingLastKmClock(recording);
            dissolvedLeading=true;
            return next;
          }catch{
            try{
              if(!resolveDissolvedSurvivorPass)
                throw new Error('The survivor-pass continuation is disabled.');
              const next=recordFinaleCoastDissolvedSurvivorPassClock(
                recording);
              dissolvedSurvivorPass=true;
              return next;
            }catch{
              try{
                if(!resolveDissolvedThreeFront)
                  throw new Error('The three-front continuation is disabled.');
                const next=recordFinaleCoastDissolvedThreeFrontClock(
                  recording);
                dissolvedThreeFront=true;
                return next;
              }catch{
                try{
                  const next=recordFinaleCoastDissolvedAllFrontsLastKmClock(
                    recording);
                  dissolvedAllFronts=true;
                  return next;
                }catch{/* Preserve the older explicit refusal. */}
              }
            }
          }
        }
        throw dissolutionError;
      }
    }
  };
  const singleClock=()=>{
    try{return recordFinaleSingleGroupLastKmClock(recording);}
    catch(error){
      if(!error.message.startsWith(
        'A separated-group rider cannot pay for travel:'))
        throw error;
      dynamicSingle=true;
      try{return recordFinaleCoastDynamicSingleLastKmClock(recording);}
      catch(dissolutionError){
        if(resolveDissolvedFront&&dissolutionError.message===
          'A depleted front group needs recorded group dissolution.'){
          const next=recordFinaleCoastDissolvedSingleLastKmClock(
            recording);
          dynamicSingle=false;
          dissolvedSingle=true;
          return next;
        }
        throw dissolutionError;
      }
    }
  };
  const noFrontClock=()=>{
    try{return recordFinaleCoastNoFrontDroppedLastKmClock(recording);}
    catch(error){
      if(error.message!==
        'Newly exhausted finale riders need recorded drop travel.')
        throw error;
      dynamicNoFront=true;
      return recordFinaleCoastDynamicNoFrontLastKmClock(recording);
    }
  };
  const frontClock=()=>{
    try{return recordFinaleCoastDroppedLastKmClock(recording);}
    catch(error){
      if(source.roadGroups.length===1&&
        error.message.startsWith(
          'The separated finale needs a recorded catch for ')&&
        error.cause?.calculatedCatchDistanceM<
          recording.route.distanceKm*1000-500){
        try{
          const caught=recordFinaleCoastFrontCatchLastKmClock(recording);
          frontCatch=true;
          return caught;
        }catch{throw error;}
      }
      if(error.message===
        'Newly exhausted finale riders need recorded drop travel.'){
        dynamicActive=true;
        return recordFinaleCoastDynamicActiveLastKmClock(recording);
      }
      if(!error.message.startsWith(
        'A separated-group rider cannot pay for travel:'))
        throw error;
      dynamicFront=true;
      try{return recordFinaleCoastDynamicFrontLastKmClock(recording);}
      catch(dissolutionError){
        if(resolveMixedThreeFrontDropped&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedThreeFrontDroppedClock(recording);
          mixedThreeFrontDropped=true;
          return next;
        }catch{/* Preserve the older explicit refusal. */}
        if(resolveMixedTwoFrontDroppedLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedTwoFrontDroppedResult(recording,
            {plans,pointContext});
          validateFinaleMixedTwoFrontDroppedResult(recording,
            {plans,pointContext},next);
          mixedTwoFrontResult=next;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontFreshLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedTwoFrontDroppedFreshResult(recording,
            {plans,pointContext});
          validateFinaleMixedTwoFrontDroppedFreshResult(recording,
            {plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontFresh=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontFinalFreshLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontFinalFresh=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontEarlyFreshLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontEarlyFresh=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontManyPre500Lanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedTwoFrontDroppedManyPre500Result(
            recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedManyPre500Result(recording,
            {plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontManyPre500=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontManyPre500CleanFinalLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontManyPre500CleanFinal=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontFivePre500CleanFinalLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontFivePre500CleanFinal=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontMultifrontCleanFinalLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontMultifrontCleanFinal=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontCrowdedMultifrontLanes&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
            recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontCrowdedMultifront=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedTwoFrontMultifrontParallelFinal&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=
            recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
              recording,{plans,pointContext});
          validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
            recording,{plans,pointContext},next);
          mixedTwoFrontResult=next;
          mixedTwoFrontMultifrontParallelFinal=true;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedThreeFrontPre500Pass&&dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleCoastMixedThreeFrontPre500PassClock(
            recording);
          mixedThreeFrontPre500Pass=true;
          return next;
        }catch{/* Preserve the older explicit refusal. */}
        if(resolveMixedThreeFrontPost500Pass&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedPost500OutsideLaneResult(
            recording,{plans,pointContext});
          validateFinaleMixedPost500OutsideLaneResult(recording,
            {plans,pointContext},next);
          post500OutsideLaneResult=next;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveMixedThreeFrontStraddlingPass&&
          dissolutionError.message===
          'The depleted line bands crossed without contact.')try{
          const next=recordFinaleMixedStraddlingOutsideLaneResult(
            recording,{plans,pointContext});
          validateFinaleMixedStraddlingOutsideLaneResult(recording,
            {plans,pointContext},next);
          straddlingOutsideLaneResult=next;
          return next.clock;
        }catch{/* Preserve the explicit refusal for other geometry. */}
        if(resolveDissolvedFront&&dissolutionError.message===
          'A depleted front group needs recorded group dissolution.'){
          try{
            const next=recordFinaleCoastDissolvedLeadingDroppedLastKmClock(
              recording);
            dissolvedLeadingDropped=true;
            return next;
          }catch{/* Preserve the older explicit refusal. */}
          if(resolveDissolvedThreeFront)try{
            const next=recordFinaleCoastDissolvedThreeFrontClock(recording);
            dissolvedThreeFront=true;
            return next;
          }catch{/* Preserve the older explicit refusal. */}
        }
        throw dissolutionError;
      }
    }
  };
  let clock;
  try{clock=separated?separatedClock():
    singleGroup?singleClock():
      bunchOnly?recordFinaleBunchOnlyLastKmClock(recording):
        coastNoFront?noFrontClock():frontClock();}
  catch(error){
    if(source.roadGroups.length>0&&error.message.startsWith(
      'The separated finale needs a recorded catch for ')&&
      Number.isFinite(error.cause?.calculatedCatchDistanceM)){
      if(resolveWheelContact&&coasted&&source.roadGroups.length===1&&
        error.cause.calculatedCatchDistanceM>
          recording.route.distanceKm*1000-500){
        try{
          const individualLine=recordFinaleCoastedWheelContactLine(
            recording,{plans});
          return {version:V93_WHEEL_CONTACT_PLAYTEST_VERSION,
            settings:prepared.settings,recording,individualLine,
            appliedPlans:individualLine.sprintPlan.decisions.map(row=>({
              teamId:row.teamId,finisherId:row.finisherId,
              leadOutRiderId:row.leadOutRiderId})),
            pointPreview:pointContext?{status:'unavailable',
              reason:individualLine.resultStatus===
                'photo_finish_unresolved'?
                'Photo finishes leave tied provisional places.':
                'The shared-road order remains experimental.',
              pointsStatus:'withheld',canCommitAwards:false}:null,
            roadStatus:'conditional_paid_shared_contact_photo_ranges',
            classifiedResults:null,pointsStatus:'withheld',
            canCommitAwards:false};
        }catch{/* Keep the earlier paid road if shared wheels cannot finish. */}
      }
      if(resolveWheelContact&&singleGroup&&
        source.roadGroups.length===1&&
        error.cause.calculatedCatchDistanceM>
          recording.route.distanceKm*1000-500){
        try{
          const individualLine=recordFinaleCoastedWheelContactLine(
            recording,{plans,allowNoDropped:true});
          return {version:V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION,
            settings:prepared.settings,recording,individualLine,
            appliedPlans:individualLine.sprintPlan.decisions.map(row=>({
              teamId:row.teamId,finisherId:row.finisherId,
              leadOutRiderId:row.leadOutRiderId})),
            pointPreview:pointContext?{status:'unavailable',
              reason:'The shared-road order remains experimental.',
              pointsStatus:'withheld',canCommitAwards:false}:null,
            roadStatus:'conditional_paid_no_drops_shared_contact',
            classifiedResults:null,pointsStatus:'withheld',
            canCommitAwards:false};
        }catch{/* Keep the explicit refusal if shared wheels cannot finish. */}
      }
      error.roadPreview=summarizeV93CatchRoad(settings,recording,
        error.cause,plans);
    }
    else if(separated){
      const unpaid=/^A separated-group rider cannot pay for travel: (.+) at (\d+) m\.$/
        .exec(error.message);
      if(unpaid&&Number(unpaid[2])===recording.route.distanceKm*1000-1000)
        error.roadPreview=summarizeV93UnsupportedHandoff(settings,
          recording,'unpayable_front_handoff',unpaid[1]);
      else if(dynamicFront&&error.message===
        'The depleted line bands crossed without contact.')
        error.roadPreview=summarizeV93UnsupportedHandoff(settings,
          recording,'unresolved_band_contact');
    }else if(coasted&&dynamicFront&&error.message===
      'The depleted line bands crossed without contact.')
      error.roadPreview=summarizeV93UnsupportedHandoff(settings,
        recording,'unresolved_band_contact');
    if(dynamicFront&&error.message===
      'A depleted front group needs recorded group dissolution.'){
      const depleted=source.roadGroups.find(group=>
        group.riderIds.every(id=>source.riderGroups.find(row=>
          row.id===id)?.energy===0));
      if(depleted&&resolveDissolvedFront){
        try{
          const dissolvedFrontResult=
            recordFinaleDissolvedFrontPreviewResult(recording,
              {plans,pointContext});
          validateFinaleDissolvedFrontPreviewResult(recording,
            {plans,pointContext},dissolvedFrontResult);
          return {version:V93_DISSOLVED_FRONT_PLAYTEST_VERSION,
            settings:prepared.settings,recording,dissolvedFrontResult,
            appliedPlans:dissolvedFrontResult.line.sprintPlan.decisions
              .map(row=>({teamId:row.teamId,
                finisherId:row.finisherId,
                leadOutRiderId:row.leadOutRiderId})),
            pointPreview:dissolvedFrontResult.pointPreview,
            roadStatus:dissolvedFrontResult.roadStatus,
            classifiedResults:null,pointsStatus:'withheld',
            canCommitAwards:false};
        }catch{/* Keep the explicit refusal for unsupported contact. */}
      }
      if(depleted)error.roadPreview=summarizeV93UnsupportedHandoff(
        settings,recording,'depleted_front_dissolution',depleted.id);
    }
    throw error;
  }
  if(post500OutsideLaneResult){
    const post500Result=post500OutsideLaneResult;
    return {version:
      V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION,
    settings:prepared.settings,recording,post500Result,
    appliedPlans:post500Result.line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId})),
    pointPreview:post500Result.pointPreview,
    roadStatus:post500Result.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
  }
  if(straddlingOutsideLaneResult){
    const straddlingResult=straddlingOutsideLaneResult;
    return {version:
      V93_MIXED_THREE_FRONT_STRADDLING_LANES_PLAYTEST_VERSION,
    settings:prepared.settings,recording,straddlingResult,
    appliedPlans:straddlingResult.line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId})),
    pointPreview:straddlingResult.pointPreview,
    roadStatus:straddlingResult.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
  }
  if(mixedTwoFrontResult)return {version:
    mixedTwoFrontMultifrontParallelFinal?
      V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION:
    mixedTwoFrontCrowdedMultifront?
      V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION:
    mixedTwoFrontMultifrontCleanFinal?
      V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION:
    mixedTwoFrontManyPre500CleanFinal?
      V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION:
    mixedTwoFrontFivePre500CleanFinal?
      V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION:
    mixedTwoFrontManyPre500?
      V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION:
    mixedTwoFrontFresh?V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION:
    mixedTwoFrontFinalFresh?
      V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION:
    mixedTwoFrontEarlyFresh?
      V93_MIXED_TWO_FRONT_EARLY_FRESH_LANES_PLAYTEST_VERSION:
      V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION,
    settings:prepared.settings,recording,mixedTwoFrontResult,
    appliedPlans:mixedTwoFrontResult.line.sprintPlan.decisions.map(row=>({
      teamId:row.teamId,finisherId:row.finisherId,
      leadOutRiderId:row.leadOutRiderId})),
    pointPreview:mixedTwoFrontResult.pointPreview,
    roadStatus:mixedTwoFrontResult.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
  if(frontCatch)validateFinaleCoastFrontCatchLastKmClock(recording,clock);
  else if(dissolvedLeading)
    validateFinaleCoastDissolvedLeadingLastKmClock(recording,clock);
  else if(dissolvedSurvivorPass)
    validateFinaleCoastDissolvedSurvivorPassClock(recording,clock);
  else if(dissolvedThreeFront)
    validateFinaleCoastDissolvedThreeFrontClock(recording,clock);
  else if(mixedFrontClear)
    validateFinaleCoastMixedFrontClearClock(recording,clock);
  else if(mixedFrontLatePass)
    validateFinaleCoastMixedFrontLatePassClock(recording,clock);
  else if(mixedThreeFrontClear)
    validateFinaleCoastMixedThreeFrontClearClock(recording,clock);
  else if(mixedThreeFrontDropped)
    validateFinaleCoastMixedThreeFrontDroppedClock(recording,clock);
  else if(mixedThreeFrontPre500Pass)
    validateFinaleCoastMixedThreeFrontPre500PassClock(recording,clock);
  else if(mixedFrontParallelPass)
    validateFinaleCoastMixedFrontParallelPassClock(recording,clock);
  else if(dissolvedLeadingDropped)
    validateFinaleCoastDissolvedLeadingDroppedLastKmClock(recording,clock);
  else if(dissolvedAllFronts)
    validateFinaleCoastDissolvedAllFrontsLastKmClock(recording,clock);
  else if(dissolvedSingle)
    validateFinaleCoastDissolvedSingleLastKmClock(recording,clock);
  else if(separated&&!dynamicFront)validateFinaleSeparatedLastKmClock(recording,clock);
  else if(dynamicSingle)validateFinaleCoastDynamicSingleLastKmClock(
    recording,clock);
  else if(singleGroup)validateFinaleSingleGroupLastKmClock(recording,clock);
  else if(bunchOnly)validateFinaleBunchOnlyLastKmClock(recording,clock);
  else if(dynamicNoFront)validateFinaleCoastDynamicNoFrontLastKmClock(
    recording,clock);
  else if(coastNoFront)validateFinaleCoastNoFrontDroppedLastKmClock(
    recording,clock);
  else if(dynamicActive)validateFinaleCoastDynamicActiveLastKmClock(
    recording,clock);
  else if(dynamicFront)validateFinaleCoastDynamicFrontLastKmClock(
    recording,clock);
  else validateFinaleCoastDroppedLastKmClock(recording,clock);
  let baseLine;
  try{
    baseLine=separated&&!dynamicFront?
      recordFinaleSeparatedIndividualLine(recording,clock,{plans}):
      singleGroup&&!dynamicSingle&&!dissolvedSingle?
        recordFinaleSingleGroupIndividualLine(recording,clock,
        {plans}):bunchOnly?recordFinaleBunchOnlyIndividualLine(recording,
        clock,{plans}):recordFinaleCoastedIndividualLine(recording,clock,
        {plans});
  }catch(error){
    if(error.message===
      'The v93 preview cannot continue riders leaving the bunch after 500 m.'&&
      Number.isFinite(error.cause?.metresToGo))
      error.roadPreview=summarizeV93UnsupportedRoad(settings,recording,clock,
        error.cause);
    throw error;
  }
  let coastedLine=resolveIsolatedPasses&&baseLine.version===
    FINALE_COASTED_INDIVIDUAL_LINE_VERSION&&
    baseLine.pre500Audit.firstPotentialOverlap&&
    !baseLine.overlapAudit.firstPotentialOverlap?
    recordFinaleCoastedIsolatedPassIndividualLine(recording,clock,
      {plans})??baseLine:baseLine;
  if(resolveIsolatedPasses&&coastedLine===baseLine&&
    [FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
      FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION]
      .includes(baseLine.version)&&
    baseLine.pre500Audit.firstPotentialOverlap&&
    !baseLine.overlapAudit.firstPotentialOverlap)
    coastedLine=recordFinaleCoastedIsolatedParallelIndividualLine(
      recording,clock,{plans})??baseLine;
  if(resolveIsolatedPasses&&coastedLine===baseLine&&
    [FINALE_COASTED_INDIVIDUAL_LINE_VERSION,
      FINALE_COAST_NO_FRONT_INDIVIDUAL_LINE_VERSION]
      .includes(baseLine.version)&&
    (baseLine.pre500Audit.firstPotentialOverlap||
      baseLine.overlapAudit.firstPotentialOverlap))
    coastedLine=recordFinaleCoastedFullKmIsolatedLanesLine(
      recording,clock,{plans})??baseLine;
  let individualLine=resolveFrontExits&&dynamicSingle?
    recordFinaleCoastedFrontExitIndividualLine(recording,clock,
      {plans})??coastedLine:coastedLine;
  if(frontCatch&&resolveEarlyFrontCatchLanes)try{
    individualLine=recordFinaleEarlyFrontCatchLaneLine(recording,clock,
      {plans,resolveIsolatedLanes:resolveEarlyIsolatedLanes});
  }catch{/* Keep the older conditional line when lanes cannot join. */}
  if(resolveLateActiveContact&&individualLine.version===
    FINALE_COASTED_INDIVIDUAL_LINE_VERSION&&
    individualLine.provisionalLineOrder===null){
    try{individualLine=recordFinaleLateActiveContactLine(
      recording,clock,individualLine)??individualLine;}
    catch{/* Preserve the earlier conditional line if merging cannot pay. */}
  }
  if(dissolvedSurvivorPass||dissolvedThreeFront){
    const crossings=new Map(individualLine.conditionalCrossings.map(row=>
      [row.riderId,row.elapsedSecondsFromLastKmStart]));
    const survivor=clock.trace.frames.at(-1).roadGroups[0]?.riderIds[0];
    const survivorTime=crossings.get(survivor);
    const leaderIds=clock.trace.frames[0].frontExhaustionDrops.map(row=>
      row.riderId);
    const leaderTimes=leaderIds.map(id=>crossings.get(id));
    if(!Number.isFinite(survivorTime)||
      leaderTimes.some(time=>!Number.isFinite(time))||
      clock.survivorPasses?.some(row=>
        crossings.get(row.riderId)<=survivorTime+1e-7)||
      dissolvedThreeFront&&!clock.survivorPasses&&
        leaderTimes.some(time=>time>=survivorTime-1e-7))
      throw new Error('The survivor pass did not persist through the paid line.');
    if(dissolvedThreeFront){
      const rear=clock.trace.frames.at(-1).roadGroups[1]?.riderIds[0];
      const rearTime=crossings.get(rear);
      if(!Number.isFinite(rearTime)||
        leaderTimes.some(time=>time>=rearTime-1e-7))
        throw new Error('The third front lost its separate paid line.');
    }
  }
  if(mixedFrontClear||mixedThreeFrontClear||mixedThreeFrontDropped||
    mixedThreeFrontPre500Pass){
    const crossingById=new Map(individualLine.conditionalCrossings.map(row=>
      [row.riderId,row.elapsedSecondsFromLastKmStart]));
    for(let index=1;index<clock.line.bands.length;index++){
      const ahead=clock.line.bands[index-1].riderIds.map(id=>
        crossingById.get(id));
      const behind=clock.line.bands[index].riderIds.map(id=>
        crossingById.get(id));
      if([...ahead,...behind].some(time=>!Number.isFinite(time))||
        Math.max(...ahead)>=Math.min(...behind)-1e-7)
        throw new Error('The mixed front finish crosses an unpaid road band.');
    }
  }
  if(mixedFrontLatePass||mixedFrontParallelPass){
    const crossingById=new Map(individualLine.conditionalCrossings.map(row=>
      [row.riderId,row.elapsedSecondsFromLastKmStart]));
    for(let index=1;index<clock.line.bands.length;index++){
      const ahead=clock.line.bands[index-1].riderIds.map(id=>
        crossingById.get(id));
      const behind=clock.line.bands[index].riderIds.map(id=>
        crossingById.get(id));
      if([...ahead,...behind].some(time=>!Number.isFinite(time))||
        Math.max(...ahead)>=Math.min(...behind)-1e-7)
        throw new Error('The late mixed-front finish crosses an unpaid road band.');
    }
  }
  const appliedPlans=individualLine.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId}));
  if(separated&&!dynamicFront)validateFinaleSeparatedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(singleGroup&&!dynamicSingle&&!dissolvedSingle)
    validateFinaleSingleGroupIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(bunchOnly)validateFinaleBunchOnlyIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  else if(individualLine.version===
    FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION)
    validateFinaleLateActiveContactLine(recording,clock,
      coastedLine,individualLine);
  else if(individualLine.version===
    FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION||
    individualLine.version===
      FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION)
    validateFinaleEarlyFrontCatchLaneLine(recording,clock,
      {plans:appliedPlans},individualLine);
  else validateFinaleDepletedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  let lateExitShoulder=null;
  if(resolveLateBunchExitShoulder&&individualLine.version===
    FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION){
    try{
      lateExitShoulder=recordFinaleLateBunchExitShoulder(recording,
        clock,individualLine);
      validateFinaleLateBunchExitShoulder(recording,clock,individualLine,
        lateExitShoulder);
    }catch{/* Keep the older conditional road when this lane rule cannot pay. */}
  }
  const coastedSingleton=individualLine.version===
    FINALE_COAST_SINGLETON_INDIVIDUAL_LINE_VERSION;
  let pointPreview=null;
  if(pointContext&&individualLine.version===
    FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION)
    pointPreview={status:'unavailable',
      reason:individualLine.provisionalLineOrder===null?
        'Tied conditional crossings have no unique point placing.':
        'The merged late sprint has no policy point illustration.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&frontCatch)
    pointPreview={status:'unavailable',
      reason:individualLine.version===
        FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION?
        'The front-catch lane order is conditional; policy points remain withheld.':
        individualLine.version===
        FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION?
        'Inferred front-catch lanes and isolated riders leave no unique point order.':
        'The caught front has no recorded wheel order in the merged bunch.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&individualLine.version===
    FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION)
    pointPreview={status:'unavailable',
      reason:'The exhausted individual tail has only a conditional point order.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicSingle&&individualLine.version!==
    FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION)
    pointPreview={status:'unavailable',
      reason:'New front drops remain ahead without a resolved road contact order.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicActive)
    pointPreview={status:'unavailable',
      reason:'Newly isolated bunch riders have unresolved pre-500 m road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&coastedSingleton)
    pointPreview={status:'unavailable',
      reason:'Singleton fronts and isolated riders have unresolved road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&(dynamicFront||dissolvedSingle))
    pointPreview={status:'unavailable',
      reason:dissolvedLeading||dissolvedSurvivorPass||dissolvedThreeFront||
        dissolvedLeadingDropped||
        dissolvedAllFronts||dissolvedSingle?
        'Dissolved front riders have conditional lanes, so policy points remain withheld.':
        mixedThreeFrontPre500Pass?
        'Paid front passes use inferred outside lanes; wheel order and policy points remain unresolved.':
        mixedFrontClear||mixedThreeFrontClear||mixedThreeFrontDropped?
        'Front leavers stayed in separate paid bands; their wheel order remains unresolved.':
        mixedFrontLatePass||mixedFrontParallelPass?
        'The late bunch pass is paid; front wheel order remains unresolved.':
        clock.line.outcome===
        'front_leavers_ahead_of_bunch_contact_unresolved'?
        'Front leavers and their former groups have no recorded wheel order.':
        'A front rider passed through the bunch without a resolved contact order.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext&&dynamicNoFront)
    pointPreview={status:'unavailable',
      reason:individualLine.version===
        FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION?
        'Late bunch exits have no recorded wheel order at the split.':
        'Newly isolated riders have unresolved pre-500 m road contact.',
      pointsStatus:'withheld',canCommitAwards:false};
  else if(pointContext)try{
    pointPreview=(individualLine.version===
      FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION?
      projectV93ProvisionalFrontExitPointPreview:
      separated&&!dynamicFront?
      projectV93ProvisionalSeparatedPointPreview:
      singleGroup?projectV93ProvisionalSingleGroupPointPreview:
        bunchOnly?projectV93ProvisionalBunchOnlyPointPreview:
          individualLine.version===
            FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION?
            projectV93ProvisionalIsolatedParallelPointPreview:
          individualLine.version===
            FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION?
            projectV93ProvisionalFullKmIsolatedLanesPointPreview:
          coastNoFront?projectV93ProvisionalCoastNoFrontPointPreview:
          individualLine.version===
            FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
            projectV93ProvisionalIsolatedPassPointPreview:
          projectV93ProvisionalCoastedPointPreview)(recording,clock,
      individualLine,pointContext);
  }catch(error){
    const contact=error.message===
      'Preview points need separate paid individual bands.'&&
      (individualLine.pre500Audit?.firstPotentialOverlap||
        individualLine.overlapAudit?.firstPotentialOverlap);
    if(!contact&&error.message!==
      'Preview points need an unambiguous multiband order.')
      throw error;
    pointPreview={status:'unavailable',
      reason:contact?
        'Potential road-band contact leaves no defensible point order.':
        'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  return {version:individualLine.version===
    FINALE_LATE_ACTIVE_CONTACT_LINE_VERSION?
    V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION?
      V93_EARLY_FRONT_CATCH_ISOLATED_LANES_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION?
      V93_EARLY_FRONT_CATCH_LANE_PLAYTEST_VERSION:
    frontCatch?V93_FRONT_CATCH_PLAYTEST_VERSION:
    individualLine.version===FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION?
      V93_COAST_TAIL_PLAYTEST_VERSION:
    dissolvedAllFronts?V93_DISSOLVED_ALL_FRONTS_PLAYTEST_VERSION:
    dissolvedSingle?V93_DISSOLVED_SINGLE_PLAYTEST_VERSION:
    dissolvedSurvivorPass?V93_DISSOLVED_SURVIVOR_PASS_PLAYTEST_VERSION:
    dissolvedThreeFront?V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION:
    mixedFrontClear?V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION:
    mixedFrontLatePass?V93_MIXED_FRONT_LATE_PASS_PLAYTEST_VERSION:
    mixedThreeFrontClear?V93_MIXED_THREE_FRONT_CLEAR_PLAYTEST_VERSION:
    mixedThreeFrontDropped?V93_MIXED_THREE_FRONT_DROPPED_PLAYTEST_VERSION:
    mixedThreeFrontPre500Pass?
      V93_MIXED_THREE_FRONT_PRE500_PASS_PLAYTEST_VERSION:
    mixedFrontParallelPass?V93_MIXED_FRONT_PARALLEL_PASS_PLAYTEST_VERSION:
    dissolvedLeadingDropped?V93_DISSOLVED_LEADING_DROPPED_PLAYTEST_VERSION:
    dissolvedLeading?V93_DISSOLVED_LEADING_PLAYTEST_VERSION:
    separated?V93_SEPARATED_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION?
      V93_COAST_FRONT_EXIT_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
      V93_COAST_ISOLATED_PASS_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION?
      V93_COAST_ISOLATED_PARALLEL_PLAYTEST_VERSION:
    individualLine.version===
      FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION?
      V93_COAST_FULL_KM_ISOLATED_LANES_PLAYTEST_VERSION:
    dynamicSingle?V93_DYNAMIC_SINGLE_PLAYTEST_VERSION:
      singleGroup?V93_SINGLE_GROUP_PLAYTEST_VERSION:
      bunchOnly?V93_BUNCH_ONLY_PLAYTEST_VERSION:
        dynamicActive?V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION:
        dynamicFront?V93_DYNAMIC_FRONT_PLAYTEST_VERSION:
        lateExitShoulder?V93_LATE_BUNCH_EXIT_SHOULDER_PLAYTEST_VERSION:
        individualLine.version===
          FINALE_COAST_LATE_BUNCH_EXIT_INDIVIDUAL_LINE_VERSION?
          V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION:
        dynamicNoFront?V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION:
        coastNoFront?V93_COAST_NO_FRONT_PLAYTEST_VERSION:
        coastedSingleton?V93_COAST_SINGLETON_PLAYTEST_VERSION:
        V93_COASTED_PLAYTEST_VERSION,
    settings:prepared.settings,recording,clock,individualLine,
    ...(lateExitShoulder?{lateExitShoulder}:{}),
    appliedPlans,pointPreview,
    roadStatus:individualLine.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function createV93CoastedPlaytest(settings,input={}){
  return createV93PlayableTest(settings,input);
}

export function validateV93CoastedPlaytest(settings,input,recorded){
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedManyPre500Result(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_EARLY_FRESH_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
      recorded.recording,input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedFreshResult(recorded.recording,
      input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION)
    validateFinaleMixedTwoFrontDroppedResult(recorded.recording,
      input,recorded.mixedTwoFrontResult);
  if(recorded?.version===
    V93_MIXED_THREE_FRONT_STRADDLING_LANES_PLAYTEST_VERSION)
    validateFinaleMixedStraddlingOutsideLaneResult(recorded.recording,
      input,recorded.straddlingResult);
  if(recorded?.version===
    V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION)
    validateFinaleMixedPost500OutsideLaneResult(recorded.recording,
      input,recorded.post500Result);
  if(recorded?.version===V93_DISSOLVED_FRONT_PLAYTEST_VERSION)
    validateFinaleDissolvedFrontPreviewResult(recorded.recording,
      input,recorded.dissolvedFrontResult);
  if([V93_WHEEL_CONTACT_PLAYTEST_VERSION,
    V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION]
    .includes(recorded?.version))
    validateFinaleCoastedWheelContactLine(recorded.recording,
      {plans:recorded.appliedPlans},recorded.individualLine);
  if(recorded?.version===V93_LATE_BUNCH_EXIT_SHOULDER_PLAYTEST_VERSION)
    validateFinaleLateBunchExitShoulder(recorded.recording,recorded.clock,
      recorded.individualLine,recorded.lateExitShoulder);
  if(!isDeepStrictEqual(recorded,
    createV93PlayableTest(settings,input,{
      resolveIsolatedPasses:recorded?.version!==
        V93_COASTED_PLAYTEST_VERSION&&recorded?.version!==
        V93_COAST_NO_FRONT_PLAYTEST_VERSION,
      resolveFrontExits:recorded?.version!==
        V93_DYNAMIC_SINGLE_PLAYTEST_VERSION,
      resolveDissolvedSurvivorPass:recorded?.version===
        V93_DISSOLVED_SURVIVOR_PASS_PLAYTEST_VERSION,
      resolveDissolvedThreeFront:recorded?.version===
        V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION,
      resolveMixedFrontClear:recorded?.version===
        V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION,
      resolveMixedFrontLatePass:recorded?.version===
        V93_MIXED_FRONT_LATE_PASS_PLAYTEST_VERSION,
      resolveMixedThreeFrontClear:recorded?.version===
        V93_MIXED_THREE_FRONT_CLEAR_PLAYTEST_VERSION,
      resolveMixedThreeFrontDropped:recorded?.version===
        V93_MIXED_THREE_FRONT_DROPPED_PLAYTEST_VERSION,
      resolveMixedThreeFrontPre500Pass:recorded?.version===
        V93_MIXED_THREE_FRONT_PRE500_PASS_PLAYTEST_VERSION,
      resolveMixedThreeFrontPost500Pass:recorded?.version===
        V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION,
      resolveMixedThreeFrontStraddlingPass:recorded?.version===
        V93_MIXED_THREE_FRONT_STRADDLING_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontDroppedLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontFreshLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontFinalFreshLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontEarlyFreshLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_EARLY_FRESH_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontManyPre500Lanes:recorded?.version===
        V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontManyPre500CleanFinalLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontFivePre500CleanFinalLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontMultifrontCleanFinalLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontCrowdedMultifrontLanes:recorded?.version===
        V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION,
      resolveMixedTwoFrontMultifrontParallelFinal:recorded?.version===
        V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION,
      resolveMixedFrontParallelPass:recorded?.version===
        V93_MIXED_FRONT_PARALLEL_PASS_PLAYTEST_VERSION,
      resolveLateActiveContact:recorded?.version===
        V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION,
      resolveLateBunchExitShoulder:recorded?.version!==
        V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION,
      resolveEarlyFrontCatchLanes:recorded?.version!==
        V93_FRONT_CATCH_PLAYTEST_VERSION,
      resolveEarlyIsolatedLanes:recorded?.version===
        V93_EARLY_FRONT_CATCH_ISOLATED_LANES_PLAYTEST_VERSION})))
    throw new Error('The v93 road-to-line playtest does not replay.');
  return true;
}

export function summarizeV93CoastedPlaytest(race){
  if(race.version===
    V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_EARLY_FRESH_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_THREE_FRONT_STRADDLING_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===
    V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION)
    return summarizeV93MixedPost500Playtest(race);
  if(race.version===V93_DISSOLVED_FRONT_PLAYTEST_VERSION)
    return summarizeV93DissolvedFrontPlaytest(race);
  if([V93_WHEEL_CONTACT_PLAYTEST_VERSION,
    V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION]
    .includes(race.version))
    return summarizeV93WheelContactPlaytest(race);
  if(race.version===V93_LATE_ACTIVE_CONTACT_PLAYTEST_VERSION)
    return summarizeV93LateActiveContactPlaytest(race);
  const {settings,recording,clock,individualLine}=race;
  const source=recording.frames.at(-2);
  const crossingById=new Map(individualLine.conditionalCrossings.map(row=>
    [row.riderId,row]));
  if(source.km!==recording.route.distanceKm-1||
    crossingById.size!==recording.committedInputs.teams.length*8)
    throw new Error('The v93 workbench lost its locked field.');
  const frontCatch=[V93_FRONT_CATCH_PLAYTEST_VERSION,
    V93_EARLY_FRONT_CATCH_LANE_PLAYTEST_VERSION,
    V93_EARLY_FRONT_CATCH_ISOLATED_LANES_PLAYTEST_VERSION]
    .includes(race.version)?(()=>{
    const contact=clock.contact;
    const group=source.roadGroups.find(row=>row.id===contact?.groupId);
    const merged=clock.trace.frames[0]?.pelotonRiderIds;
    if(contact?.kind!=='front_catch'||!group||
      contact.atDistanceM<=source.km*1000||
      contact.atDistanceM>=recording.route.distanceKm*1000-500||
      !Number.isFinite(contact.preContactBunchSeconds)||
      contact.caughtRiderIds?.length!==group.riderIds.length||
      contact.caughtRiderIds.some(id=>
        !group.riderIds.includes(id)||!merged?.includes(id))||
      clock.passageFrames.some(frame=>frame.groups.some(row=>
        row.id===contact.groupId)))
      throw new Error('The front catch has no matching paid road.');
    return {roadGroupId:contact.groupId,
      atDistanceM:contact.atDistanceM,
      elapsedSecondsFromLastKmStart:contact.preContactBunchSeconds,
      caughtRiderIds:[...contact.caughtRiderIds],
      ...([V93_EARLY_FRONT_CATCH_LANE_PLAYTEST_VERSION,
        V93_EARLY_FRONT_CATCH_ISOLATED_LANES_PLAYTEST_VERSION]
        .includes(race.version)?{
        inferredLaneQueue:true,
        isolatedContactResolved:individualLine.pre500Audit
          .isolatedContactResolved}:{})};
  })():null;
  const exhaustedTail=individualLine.version===
    FINALE_COAST_TAIL_INDIVIDUAL_LINE_VERSION?
    individualLine.bandRunners.flatMap(band=>{
      const tail=band.runner.frames.at(-1);
      return tail.riders.filter(row=>row.role==='exhausted_coast')
        .map(row=>({riderId:row.riderId,roadBandId:band.roadBandId,
          fromDistanceM:row.positionBeforeM,
          energySpent:row.energySpent,
          curtailedEnergyDemand:row.curtailedEnergyDemand,
          sustainableFraction:row.sustainableFraction,
          elapsedSecondsFromLastKmStart:row.elapsedToLineSeconds}));
    }):null;
  if(exhaustedTail&&(!exhaustedTail.length||
    exhaustedTail.some(row=>
      row.curtailedEnergyDemand<=0||
      row.sustainableFraction<=0||row.sustainableFraction>=1||
      crossingById.get(row.riderId)?.roadBandId!==row.roadBandId||
      crossingById.get(row.riderId)?.energyAtLine!==0||
      crossingById.get(row.riderId)?.elapsedSecondsFromLastKmStart!==
        row.elapsedSecondsFromLastKmStart)))
    throw new Error('The exhausted tail has no matching paid replay.');
  const contactCandidates=[
    ['paid_first_500m',individualLine.pre500Audit?.firstPotentialOverlap],
    ['paid_final_500m',individualLine.overlapAudit?.firstPotentialOverlap]]
    .filter(([,contact])=>contact)
    .map(([sourcePhase,contact])=>({sourcePhase,
      distanceM:contact.distanceM,
      elapsedSecondsFromLastKmStart:
        contact.elapsedSecondsFromLastKmStart,
      riderIds:[contact.firstRiderId??contact.aheadRiderId??
        contact.frontRiderId,
      contact.secondRiderId??contact.behindRiderId??
        contact.bunchRiderId],
      roadBandIds:[contact.firstRoadBandId??contact.aheadRoadBandId,
        contact.secondRoadBandId??contact.behindRoadBandId]}))
    .sort((a,b)=>a.elapsedSecondsFromLastKmStart-
      b.elapsedSecondsFromLastKmStart);
  const needsContactWitness=contactCandidates.length>0&&
    individualLine.provisionalLineOrder===null;
  if(race.pointPreview?.reason===
    'Potential road-band contact leaves no defensible point order.'&&
    !needsContactWitness)
    throw new Error('Withheld contact points need a paid contact witness.');
  const potentialRoadContact=needsContactWitness?
    contactCandidates[0]:null;
  if(needsContactWitness&&(!potentialRoadContact||
    potentialRoadContact.riderIds.some(id=>!crossingById.has(id))||
    potentialRoadContact.riderIds.some((id,index)=>
      crossingById.get(id).roadBandId!==
        potentialRoadContact.roadBandIds[index])||
    !Number.isFinite(potentialRoadContact.distanceM)||
    !Number.isFinite(
      potentialRoadContact.elapsedSecondsFromLastKmStart)))
    throw new Error('The potential contact has no matching paid replay.');
  const isolatedPassEvents=individualLine.version===
    FINALE_COAST_ISOLATED_PASS_INDIVIDUAL_LINE_VERSION?
    individualLine.pre500Audit.passes.map(event=>({
      ...event,passingRoadBandId:`isolated:${event.passingRiderId}`,
      passedRoadBandId:`isolated:${event.passedRiderId}`})):[];
  if(isolatedPassEvents.some(event=>
    crossingById.get(event.passingRiderId)?.roadBandId!==
      event.passingRoadBandId||
    crossingById.get(event.passedRiderId)?.roadBandId!==
      event.passedRoadBandId||
    event.distanceM<=recording.route.distanceKm*1000-1000||
    event.distanceM>=recording.route.distanceKm*1000-500))
    throw new Error('An isolated pass has no matching paid rider path.');
  const isolatedParallelStarts=individualLine.version===
    FINALE_COAST_ISOLATED_PARALLEL_INDIVIDUAL_LINE_VERSION?
    individualLine.pre500Audit.parallelStarts:[];
  if(isolatedParallelStarts.some(event=>
    event.riderIds.length!==2||
    event.riderIds.some(id=>
      crossingById.get(id)?.roadBandId!==`isolated:${id}`)||
    event.distanceM!==recording.route.distanceKm*1000-1000||
    !Number.isFinite(event.elapsedSecondsFromLastKmStart)))
    throw new Error('Parallel isolated lanes have no paid source paths.');
  const isolatedLaneEncounters=individualLine.version===
    FINALE_COAST_FULL_KM_ISOLATED_LANES_LINE_VERSION?
    individualLine.pre500Audit.encounters:
    individualLine.version===
      FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION?
      individualLine.pre500Audit.isolatedLanes.encounters:[];
  if(isolatedLaneEncounters.some(event=>
    event.riderIds.length!==2||
    event.riderIds.some(id=>
      crossingById.get(id)?.roadBandId!==`isolated:${id}`)||
    event.distanceM<recording.route.distanceKm*1000-1000||
    event.distanceM>=recording.route.distanceKm*1000||
    !Number.isFinite(event.elapsedSecondsFromLastKmStart)))
    throw new Error('Full-kilometre lanes have no paid isolated paths.');
  const frontExit=individualLine.version===
    FINALE_COAST_FRONT_EXIT_INDIVIDUAL_LINE_VERSION?
    individualLine.pre500Audit:null;
  if(frontExit&&(frontExit.exitRiderIds.some(id=>
    crossingById.get(id)?.roadBandId!==`isolated:${id}`)||
    frontExit.fromRoadGroupId!==
      individualLine.positionedSource.roadBands[0].id||
    frontExit.clearance.some(row=>
      !frontExit.exitRiderIds.includes(row.riderId)||
      row.frontClearanceSecondsAt250<=0||
      row.frontClearanceSecondsAt500<=0)))
    throw new Error('A front exit has no matching paid rider path.');
  const unlaunchedSoloSprints=individualLine.bandRunners.flatMap(band=>{
    const runner=band.runner;
    const riderId=runner.finishers?.[0]?.riderId;
    return runner.version===FINALE_SEPARATED_SINGLETON_BAND_VERSION&&
      individualLine.sprintPlan.decisions.some(row=>
        row.finisherId===riderId)&&
      runner.frames.every(frame=>frame.riders[0].role==='solo_front')?
      [{riderId,roadBandId:band.roadBandId,
        reason:'insufficient_energy'}]:[];
  });
  const unresolvedBunchExits=[V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION,
    V93_DYNAMIC_NO_FRONT_PLAYTEST_VERSION,
    V93_LATE_BUNCH_EXIT_PLAYTEST_VERSION,
    V93_LATE_BUNCH_EXIT_SHOULDER_PLAYTEST_VERSION].includes(race.version)?(()=>{
      const original=new Set(clock.trace.sourceDroppedRiderIds);
      const newIds=new Set(clock.trace.finalDroppedRiderIds.filter(id=>
        !original.has(id)));
      const exits=clock.trace.frames.flatMap(frame=>
        frame.exhaustionDrops.map(row=>({riderId:row.riderId,
          atDistanceM:row.atDistanceM})));
      if(!exits.length||exits.length!==newIds.size||
        exits.some(row=>!newIds.has(row.riderId)||
          !Number.isFinite(row.atDistanceM)||
          crossingById.get(row.riderId)?.roadBandId!==
            `isolated:${row.riderId}`)||
        new Set(exits.map(row=>row.riderId)).size!==exits.length)
        throw new Error('Unresolved bunch exits lack paid rider paths.');
      const byDistance=new Map();
      for(const row of exits){
        if(!byDistance.has(row.atDistanceM))
          byDistance.set(row.atDistanceM,[]);
        byDistance.get(row.atDistanceM).push(row.riderId);
      }
      return [...byDistance.entries()].sort(([a],[b])=>a-b)
        .map(([atDistanceM,riderIds])=>({atDistanceM,
          riderIds:riderIds.sort(),
          distinctLineTimes:new Set(riderIds.map(id=>
            crossingById.get(id).elapsedSecondsFromLastKmStart)).size}));
    })():null;
  const mixedFrontLeavers=[
    'mixed_front_leavers_ahead_and_behind_bunch',
    'mixed_front_leavers_clear_of_bunch',
    'mixed_three_front_leavers_clear',
    'mixed_three_front_leavers_with_older_drops_clear',
    'mixed_three_front_pre500_unassisted_pass_with_older_drops',
    'mixed_front_rear_leaver_passed_late',
    'mixed_front_parallel_rear_bunch_pass']
    .includes(clock.line.outcome)?(()=>{
      const rearStayedAhead=clock.line.outcome===
        'mixed_front_leavers_clear_of_bunch'||clock.line.outcome===
        'mixed_three_front_leavers_clear'||clock.line.outcome===
        'mixed_three_front_leavers_with_older_drops_clear'||
        clock.line.outcome===
        'mixed_three_front_pre500_unassisted_pass_with_older_drops';
      const groups=source.roadGroups;
      const exits=clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops??[]);
      const leading=exits.filter(row=>
        row.fromRoadGroupId===groups[0]?.id);
      const rear=exits.filter(row=>
        row.fromRoadGroupId===groups[1]?.id);
      const passes=clock.passageFrames.flatMap(frame=>
        frame.droppedPassages.filter(row=>
          rear.some(exit=>exit.riderId===row.riderId)&&
          row.contactDistanceM!==null).map(row=>({
            riderId:row.riderId,distanceM:row.contactDistanceM,
            status:row.contactStatus})));
      if(groups.length!==(clock.line.outcome===
        'mixed_three_front_leavers_clear'||clock.line.outcome===
        'mixed_three_front_leavers_with_older_drops_clear'||
        clock.line.outcome===
        'mixed_three_front_pre500_unassisted_pass_with_older_drops'?3:2)||
        !leading.length||
        !rear.length||
        passes.length!==(rearStayedAhead?0:rear.length)||
        [...leading,...rear].some(row=>
          crossingById.get(row.riderId)?.roadBandId!==
            `isolated:${row.riderId}`)||
        passes.some(row=>row.status!=='bunch_passed_unassisted'))
        throw new Error('Mixed front leavers lack paid rider paths.');
      return {sourceDistanceM:source.km*1000,rearStayedAhead,
        leadingGroupId:groups[0].id,
        leadingRiderIds:leading.map(row=>row.riderId),
        rearGroupId:groups[1].id,
        rearRiderIds:rear.map(row=>row.riderId),
        ...(clock.line.outcome===
          'mixed_three_front_leavers_with_older_drops_clear'||
          clock.line.outcome===
          'mixed_three_front_pre500_unassisted_pass_with_older_drops'?{
          olderDroppedRiderIds:source.riderGroups.filter(row=>
            row.group==='dropped').map(row=>row.id)}:{}),
        ...(groups[2]?{thirdGroupId:groups[2].id}:{}),
        ...(clock.frontPasses?{frontPasses:clock.frontPasses}:{}),
        bunchPasses:passes};
    })():null;
  const dissolvedLeadingFront=[
    'dissolved_leading_front_with_rear_bunch_pass',
    'dissolved_leading_front_with_prior_dropped',
    'dissolved_leading_front_clear',
    'dissolved_front_survivor_passed_outside',
    'dissolved_three_front_clear',
    'dissolved_three_front_survivor_passed_outside']
    .includes(clock.line.outcome)?(()=>{
      const groups=source.roadGroups;
      const exits=clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops??[]);
      const leading=exits.filter(row=>
        row.fromRoadGroupId===groups[0]?.id);
      const rear=exits.filter(row=>
        row.fromRoadGroupId===groups[1]?.id);
      const passes=clock.passageFrames.flatMap(frame=>
        frame.droppedPassages.filter(row=>
          rear.some(exit=>exit.riderId===row.riderId)&&
          row.contactDistanceM!==null).map(row=>({
            riderId:row.riderId,distanceM:row.contactDistanceM,
            status:row.contactStatus})));
      if(![2,3].includes(groups.length)||
        leading.length!==groups[0].riderIds.length||
        clock.trace.frames.at(-1).roadGroups.length!==groups.length-1||
        clock.trace.frames.at(-1).roadGroups[0].id!==groups[1].id||
        groups.length===3&&
          clock.trace.frames.at(-1).roadGroups[1].id!==groups[2].id||
        passes.length!==rear.length||
        [...leading,...rear].some(row=>
          crossingById.get(row.riderId)?.roadBandId!==
            `isolated:${row.riderId}`)||
        passes.some(row=>row.status!=='bunch_passed_unassisted'))
        throw new Error('Dissolved leading riders lack paid paths.');
      return {sourceDistanceM:source.km*1000,
        dissolvedGroupId:groups[0].id,
        leadingRiderIds:leading.map(row=>row.riderId),
        survivingGroupId:groups[1].id,
        survivingGroupIds:groups.slice(1).map(group=>group.id),
        rearRiderIds:rear.map(row=>row.riderId),
        bunchPasses:passes,
        ...(clock.survivorPasses?{
          survivorPasses:clock.survivorPasses}:{})};
    })():null;
  const dissolvedAllFronts=clock.line.outcome===
    'all_fronts_dissolved_leading_and_rear_isolated'?(()=>{
      const groups=source.roadGroups;
      const exits=clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops??[]);
      const leading=exits.filter(row=>
        row.fromRoadGroupId===groups[0]?.id);
      const rear=exits.filter(row=>
        row.fromRoadGroupId===groups[1]?.id);
      const passes=clock.passageFrames.flatMap(frame=>
        frame.droppedPassages.filter(row=>
          rear.some(exit=>exit.riderId===row.riderId)&&
          row.contactDistanceM!==null).map(row=>({
            riderId:row.riderId,distanceM:row.contactDistanceM,
            status:row.contactStatus})));
      if(groups.length!==2||
        leading.length!==groups[0].riderIds.length||
        rear.length!==groups[1].riderIds.length||
        passes.length!==rear.length||
        clock.trace.frames.at(-1).roadGroups.length!==0||
        [...leading,...rear].some(row=>
          crossingById.get(row.riderId)?.roadBandId!==
            `isolated:${row.riderId}`)||
        passes.some(row=>row.status!=='bunch_passed_unassisted'))
        throw new Error('Both dissolved fronts lack paid rider paths.');
      return {sourceDistanceM:source.km*1000,
        leadingGroupId:groups[0].id,
        leadingRiderIds:leading.map(row=>row.riderId),
        rearGroupId:groups[1].id,
        rearRiderIds:rear.map(row=>row.riderId),
        bunchPasses:passes};
    })():null;
  const dissolvedSingle=clock.line.outcome===
    'single_front_dissolved_leading_isolated'?(()=>{
      const group=source.roadGroups[0];
      const exits=clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops??[]);
      if(source.roadGroups.length!==1||
        exits.length!==group.riderIds.length||
        exits.some(row=>row.fromRoadGroupId!==group.id||
          crossingById.get(row.riderId)?.roadBandId!==
            `isolated:${row.riderId}`)||
        clock.trace.frames.some(frame=>frame.roadGroups.length||
          frame.exhaustionDrops.length)||
        clock.trace.contactAudit.encounters.length)
        throw new Error('The dissolved single front lacks paid rider paths.');
      return {sourceDistanceM:source.km*1000,
        dissolvedGroupId:group.id,
        leadingRiderIds:exits.map(row=>row.riderId)};
    })():null;
  return {version:race.version,settings,
    tuningVersion:recording.tuningVersion,
    handoffKm:source.km,
    kilometreFrames:recording.frames.slice(0,-1).map(frame=>({
      km:frame.km,terrain:frame.terrain,
      attackAttempts:[...frame.attackers],
      joinedRiderIds:[...frame.joinedBreakawayRiderIds],
      caughtRiderIds:[...frame.caughtBreakawayRiderIds],
      frontAttacks:frame.splitAttacks.map(row=>({riderId:row.riderId,
        status:row.status})),
      engagedChaseTeamIds:[...frame.engagedChaseTeamIds],
      chasingTeamIds:[...frame.chasers],
      paidBunchPaceTeamId:frame.paidBunchPace?.teamId??null,
      pullRiderIds:[...frame.pullRiderIds],
      roadGroups:frame.roadGroups.map(group=>({id:group.id,
        gapSeconds:group.gapSeconds,riderIds:group.riderIds})),
      droppedRiders:frame.riderGroups.filter(row=>row.group==='dropped')
        .map(row=>({riderId:row.id,deficitSeconds:row.deficitSeconds,
          energy:row.energy})),
      ownRiders:frame.riderGroups.filter(row=>row.teamId==='you')
        .map(row=>({riderId:row.id,roadGroup:row.group,
          energy:row.energy})),
      coastedRiders:frame.energyLedger.filter(row=>
        row.coastDelaySeconds>0).length})),
    lastKmRoad:clock.passageFrames.map(frame=>({
      ...frame,droppedPassages:frame.droppedPassages??[],
      sourceKm:clock.sourceKm})),
    bandReplays:individualLine.bandRunners.map(band=>({
      id:band.roadBandId,
      riderIds:band.runner.finishers.map(row=>row.riderId),
      passageAt500Seconds:band.paidTo500Seconds??
        clock.passageFrames.find(frame=>frame.distanceM===
          recording.route.distanceKm*1000-500)?.droppedPassages?.find(row=>
          band.roadBandId===`isolated:${row.riderId}`)
          ?.passageSecondsFromBunchMarker,
      frames:band.runner.frames})),
    lineTimes:individualLine.conditionalCrossings,
    provisionalLineOrder:individualLine.provisionalLineOrder,
    ...(race.version===V93_DYNAMIC_SINGLE_PLAYTEST_VERSION?{
      roadPlaceBounds:projectFinaleDynamicSingleRoadBounds(clock,
        individualLine)}:{}),
    ...(race.version===V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION&&
      clock.line.bands.length===3?{
      roadPlaceBounds:projectFinaleDynamicActiveRoadBounds(recording,
        clock,individualLine)}:{}),
    ...(race.version===V93_DYNAMIC_FRONT_PLAYTEST_VERSION&&
      clock.line.bands.length===3?{
      roadPlaceBounds:projectFinaleDynamicFrontRoadBounds(recording,
        clock,individualLine)}:{}),
    managerDecisions:individualLine.sprintPlan.decisions,
    managerOrders:recording.committedInputs.teams.map(team=>({
      teamId:team.id,...team.orders.baseline,
      phaseOrders:team.orders.phases.map(phase=>({...phase}))})),
    leadOutWork:individualLine.bandRunners.flatMap(band=>
      band.runner.frames.flatMap(frame=>frame.riders.filter(row=>
        row.role==='lead_out'&&row.energySpent>0).map(row=>({
        riderId:row.riderId,roadBandId:band.roadBandId,
        startDistanceM:frame.startDistanceM,
        endDistanceM:frame.endDistanceM,
        energySpent:row.energySpent})))),
    pointPreview:race.pointPreview,
    ...(frontCatch?{frontCatch}:{}),
    ...(exhaustedTail?{exhaustedTail}:{}),
    ...(potentialRoadContact?{potentialRoadContact:{
      ...potentialRoadContact,status:'potential_longitudinal_overlap',
      contactResolved:false}}:{}),
    ...(isolatedPassEvents.length?{isolatedPassEvents}:{}),
    ...(isolatedParallelStarts.length?{isolatedParallelStarts}:{}),
    ...(isolatedLaneEncounters.length?{isolatedLaneEncounters}:{}),
    ...(frontExit?{frontExit}:{}),
    ...(unlaunchedSoloSprints.length?{unlaunchedSoloSprints}:{}),
    ...(unresolvedBunchExits?{unresolvedBunchExits}:{}),
    ...(mixedFrontLeavers?{mixedFrontLeavers}:{}),
    ...(dissolvedLeadingFront?{dissolvedLeadingFront}:{}),
    ...(dissolvedAllFronts?{dissolvedAllFronts}:{}),
    ...(dissolvedSingle?{dissolvedSingle}:{}),
    ...(race.lateExitShoulder?{lateExitShoulder:{
      version:race.lateExitShoulder.version,
      status:race.lateExitShoulder.status,
      assignments:race.lateExitShoulder.assignments,
      unresolvedEqualClocks:race.lateExitShoulder.unresolvedEqualClocks,
      pointsStatus:'withheld',canCommitAwards:false}}:{}),
    roadStatus:race.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
