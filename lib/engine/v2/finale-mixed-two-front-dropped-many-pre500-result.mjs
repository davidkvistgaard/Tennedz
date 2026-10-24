import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit,
  recordFinaleMixedTwoFrontDroppedThirteenMultifrontPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit,
  recordFinaleMixedTwoFrontDroppedThirteenMultifrontFinal500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-many-pre500-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_CLEAN_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-many-pre500-clean-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FIVE_PRE500_CLEAN_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-five-pre500-clean-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_SEVEN_PRE500_CLEAN_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-seven-pre500-clean-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-multifront-clean-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_CROWDED_MULTIFRONT_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-crowded-multifront-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-multifront-parallel-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_ELEVEN_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-eleven-multifront-parallel-final-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_THIRTEEN_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-thirteen-multifront-clean-final-result-1';

// Several exact same-source approaches are paid. The outside lanes and
// their occupied-wheel responses remain inferred, so this only yields a
// conditional individual line and never an official classification.
function recordResult(tour,{plans=null,pointContext=null}={},
  {cleanFinal=false,fiveCleanFinal=false,sevenCleanFinal=false,
    multifront=false,crowded=false,
    parallelFinal=false,elevenParallelFinal=false,
    thirteenMultifrontCleanFinal=false}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{
    plans,...(parallelFinal||elevenParallelFinal||thirteenMultifrontCleanFinal?
      {laneQueuedBandIds:['road-2']}:{})});
  const pre500Audit=(thirteenMultifrontCleanFinal?
    recordFinaleMixedTwoFrontDroppedThirteenMultifrontPre500Audit:
    multifront||crowded||parallelFinal||elevenParallelFinal?
    recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit:
    recordFinaleMixedTwoFrontDroppedManyPre500Audit)(tour,clock,line);
  const final500Audit=(thirteenMultifrontCleanFinal?
    recordFinaleMixedTwoFrontDroppedThirteenMultifrontFinal500Audit:
    parallelFinal||elevenParallelFinal?
    recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit:
    multifront||crowded?
      recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit:
    recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit)(
    tour,clock,line,pre500Audit);
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(row=>row.id));
  const crossings=line.conditionalCrossings;
  const finishers=line.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>row.riderId));
  const at500=new Map(clock.trace.frames.find(frame=>
    frame.endDistanceM===tour.route.distanceKm*1000-500)?.riders.map(row=>
    [row.riderId,row.energy]));
  const lineHandoff=new Map(line.bandRunners.flatMap(band=>
    band.runner.frames[0].riders.map(row=>[
      row.riderId,row.energyAtDecision])));
  if(tour.committedInputs.teams.length!==20||
    tour.route.distanceKm!==260||
    clock.trace.frames.length!==7||clock.passageFrames.length!==7||
    roster.length!==160||pre500Audit.paidRiderCount!==160||
    final500Audit.paidRiderCount!==160||
    (multifront||crowded||parallelFinal||elevenParallelFinal||
      thirteenMultifrontCleanFinal?
      pre500Audit.freshApproaches.length<
        (thirteenMultifrontCleanFinal?13:
          elevenParallelFinal?11:crowded?11:parallelFinal?10:6)||
      pre500Audit.freshApproaches.length>
        (thirteenMultifrontCleanFinal?13:
          elevenParallelFinal?11:crowded?12:10)||
      new Set(pre500Audit.freshApproaches.map(row=>
        row.sourceRoadGroupId)).size!==2:
      pre500Audit.freshApproaches.length!==
        (cleanFinal?10:sevenCleanFinal?7:5))||
    final500Audit.freshApproaches.length!==
      (parallelFinal||elevenParallelFinal?1:
        cleanFinal||fiveCleanFinal||sevenCleanFinal||
        thirteenMultifrontCleanFinal||
        multifront||crowded?0:1)||
    crossings.length!==160||finishers.length!==160||
    new Set(crossings.map(row=>row.riderId)).size!==160||
    new Set(finishers).size!==160||
    roster.some(id=>!finishers.includes(id)||
      !Number.isFinite(at500.get(id))||
      Math.abs(at500.get(id)-lineHandoff.get(id))>1e-7)||
    line.provisionalLineOrder!==null||
    line.classifiedResults!==null||
    line.pointsStatus!=='withheld'||line.canCommitAwards!==false)
    throw new Error('The many-approach race lacks a paid conditional line.');
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'Several inferred outside-lane wheel approaches leave official points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {
    version:thirteenMultifrontCleanFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_THIRTEEN_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION:
      elevenParallelFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_ELEVEN_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION:
      parallelFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION:
      crowded?
      FINALE_MIXED_TWO_FRONT_DROPPED_CROWDED_MULTIFRONT_RESULT_VERSION:
      multifront?
      FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION:
      fiveCleanFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_FIVE_PRE500_CLEAN_FINAL_RESULT_VERSION:
      sevenCleanFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_SEVEN_PRE500_CLEAN_FINAL_RESULT_VERSION:
      cleanFinal?
      FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_CLEAN_FINAL_RESULT_VERSION:
      FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,pointPreview,
    roadStatus:thirteenMultifrontCleanFinal?
      'conditional_mixed_two_front_thirteen_multifront_clean_final':
      elevenParallelFinal?
      'conditional_mixed_two_front_eleven_multifront_parallel_final':
      parallelFinal?
      'conditional_mixed_two_front_multifront_parallel_final':
      crowded?
      'conditional_mixed_two_front_crowded_multifront':
      multifront?
      'conditional_mixed_two_front_multifront_clean_final':
      fiveCleanFinal?
      'conditional_mixed_two_front_five_pre500_clean_final':
      sevenCleanFinal?
      'conditional_mixed_two_front_seven_pre500_clean_final':
      cleanFinal?
      'conditional_mixed_two_front_many_pre500_clean_final':
      'conditional_mixed_two_front_many_pre500',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function recordFinaleMixedTwoFrontDroppedManyPre500Result(tour,
  input={}){
  return recordResult(tour,input);
}

// Distinct bounded geometry: ten paid source exits, then no new final-half
// proximity. It never inherits the five-plus-one result version.
export function recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
  tour,input={}){
  return recordResult(tour,input,{cleanFinal:true});
}

// Exactly five paid first-half approaches and no fresh final-half
// approach. This is a separate conditional version from five-plus-one.
export function recordFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(
  tour,input={}){
  return recordResult(tour,input,{fiveCleanFinal:true});
}

// Exactly seven paid first-half approaches with no fresh final-half
// approach. Keep this bounded geometry in its own recording version.
export function recordFinaleMixedTwoFrontDroppedSevenPre500CleanFinalResult(
  tour,input={}){
  return recordResult(tour,input,{sevenCleanFinal:true});
}

// Both paid surviving fronts have exhausted leavers, with no new
// possible final-half approach. This remains conditional only.
export function recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
  tour,input={}){
  return recordResult(tour,input,{multifront:true});
}

// Crowded source exits are a distinct, exact 11–12-approach geometry.
// The final half must remain free of further longitudinal approaches.
export function recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
  tour,input={}){
  return recordResult(tour,input,{crowded:true});
}

export function recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
  tour,input={}){
  return recordResult(tour,input,{parallelFinal:true});
}

// Separate 11+1 geometry: the paid final approach uses distinct fixed
// source lanes, without draft after the encounter. Wheel order is conditional.
export function recordFinaleMixedTwoFrontDroppedElevenMultifrontParallelFinalResult(
  tour,input={}){
  return recordResult(tour,input,{elevenParallelFinal:true});
}

// Exact thirteen paid exits from both fronts, with no fresh final-half
// approach under a fixed road-2 source-lane queue. Order stays conditional.
export function recordFinaleMixedTwoFrontDroppedThirteenMultifrontCleanFinalResult(
  tour,input={}){
  return recordResult(tour,input,{thirteenMultifrontCleanFinal:true});
}

export function validateFinaleMixedTwoFrontDroppedManyPre500Result(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedManyPre500Result(tour,input)))
    throw new Error('The many-approach conditional result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(tour,input)))
    throw new Error('The clean-final many-approach result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFivePre500CleanFinalResult(tour,input)))
    throw new Error('The five-approach clean-final result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedSevenPre500CleanFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedSevenPre500CleanFinalResult(tour,input)))
    throw new Error('The seven-approach clean-final result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(tour,input)))
    throw new Error('The multifront conditional result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(tour,input)))
    throw new Error('The crowded multifront result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(tour,input)))
    throw new Error('The parallel-final multifront result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedElevenMultifrontParallelFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedElevenMultifrontParallelFinalResult(
      tour,input)))
    throw new Error('The eleven-plus-one multifront result does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedThirteenMultifrontCleanFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedThirteenMultifrontCleanFinalResult(
      tour,input)))
    throw new Error('The thirteen-approach clean-final result does not replay.');
  return true;
}
