import {isDeepStrictEqual} from 'node:util';
import {recordFinaleRotationV91CandidateFromTour} from
  './finale-rotation-v91-candidate.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';

export const FINALE_ROTATION_SOLO_FIRST_TIMING_VERSION=
  'v2-finale-rotation-solo-first-timing-1';

// A surviving one-rider road group has a known first rider and a measured
// time gap. This proves one relative finish time, not the bunch order or awards.
export function probeFinaleRotationSoloFirstTimingFromTour(tour,input){
  const candidate=recordFinaleRotationV91CandidateFromTour(tour,input);
  if(candidate.branch!=='surviving_solo')
    throw new Error('First-rider timing needs a surviving solo branch.');
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const first=candidate.bounds.roadBands[0];
  const line=candidate.line;
  const gapSeconds=first.gapAheadOfBunchSeconds;
  const bunchSeconds=line.bunchElapsedSecondsAtLine;
  const frontSeconds=bunchSeconds-gapSeconds;
  const independentlyRecordedFrontSeconds=road.frames[0].attack.frontSeconds+
    road.frames[1].frontElapsedSeconds+
    line.frames.reduce((sum,frame)=>sum+frame.frontTravelSeconds,0);
  if(candidate.initialDecision.sourceBridgeVersion!==road.version||
    line.sourceRoadTraceVersion!==road.version||
    first.riderIds.length!==1||
    first.riderIds[0]!==candidate.bounds.knownFirstPlaceRiderId||
    first.riderIds[0]!==road.riderId||
    first.firstPossiblePlace!==1||first.lastPossiblePlace!==1||
    !Number.isFinite(gapSeconds)||gapSeconds<=0||
    !Number.isFinite(frontSeconds)||frontSeconds<=0||
    Math.abs(frontSeconds-independentlyRecordedFrontSeconds)>1e-7)
    throw new Error('The surviving solo has inconsistent first-rider timing.');
  return {version:FINALE_ROTATION_SOLO_FIRST_TIMING_VERSION,
    sourceCandidateVersion:candidate.version,
    sourceLineVersion:line.version,
    sourceBoundsVersion:candidate.bounds.version,
    firstRiderId:first.riderIds[0],
    firstRiderElapsedSecondsFromLastKmStart:frontSeconds,
    bunchElapsedSecondsFromLastKmStart:bunchSeconds,
    gapAtLineSeconds:gapSeconds,
    remainingRiderCount:candidate.bounds.riders.length-1,
    remainingPlacesUnresolved:true,
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleRotationSoloFirstTimingFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationSoloFirstTimingFromTour(tour,input)))
    throw new Error('The surviving-solo first timing does not replay.');
  return true;
}
