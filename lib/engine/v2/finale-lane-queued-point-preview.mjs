import {isDeepStrictEqual} from 'node:util';
import {divisionMultiplier} from '../../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../../calendar/points.mjs';
import {FINALE_LANE_QUEUED_EARLY_BUNCH_RUNNER_VERSION,
  FINALE_LANE_QUEUED_CAUGHT_BUNCH_RUNNER_VERSION,
  recordFinaleLaneQueuedEarlyBunchRunnerFromTour,
  recordFinaleLaneQueuedCaughtBunchRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';

export const FINALE_LANE_QUEUED_POINT_PREVIEW_VERSION=
  'v2-finale-lane-queued-point-preview-lab-1';
const EPSILON=1e-8;

// An illustration of the existing policy for an entirely replayable,
// unambiguous experimental line. It is not a race classification or award.
export function projectFinaleLaneQueuedPointPreview(tour,paid,context){
  const {tier,divisionIndex,divisionCount}=context??{};
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Lane-queued preview points need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  if(![FINALE_LANE_QUEUED_EARLY_BUNCH_RUNNER_VERSION,
    FINALE_LANE_QUEUED_CAUGHT_BUNCH_RUNNER_VERSION]
    .includes(paid?.version)||
    paid.passingRule!=='fixed-source-lane-queue-lab-1'||
    paid.resultStatus!=='experimental_inferred_order'||
    paid.positionSourceStatus!==
      'provisional_inferred_independent_wheels'||
    paid.pointsStatus!=='withheld'||paid.canCommitAwards!==false||
    !Array.isArray(paid.finishers)||!Array.isArray(paid.lineOrder))
    throw new Error('Lane-queued preview points need a provisional paid line.');
  const roster=new Map(tour?.committedInputs?.teams?.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id]))??[]);
  const ordered=[...paid.finishers].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart);
  if(!roster.size||ordered.length!==roster.size||
    paid.lineOrder.length!==roster.size||
    new Set(ordered.map(row=>row.riderId)).size!==roster.size||
    ordered.some((row,index)=>{
      const line=paid.lineOrder[index];
      return !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
        roster.get(row.riderId)!==row.teamId||
        index>0&&row.elapsedSecondsFromLastKmStart-
          ordered[index-1].elapsedSecondsFromLastKmStart<=EPSILON||
        line?.riderId!==row.riderId||line.teamId!==row.teamId||
        line.position!==index+1||
        line.firstPossiblePlace!==index+1||
        line.lastPossiblePlace!==index+1||
        line.elapsedSecondsFromLastKmStart!==
          row.elapsedSecondsFromLastKmStart||
        line.energyAtLine!==row.energyAtLine;
    }))
    throw new Error('Lane-queued preview points need an unambiguous line.');
  return {version:FINALE_LANE_QUEUED_POINT_PREVIEW_VERSION,
    sourceFinaleVersion:paid.version,
    positionSourceStatus:paid.positionSourceStatus,
    passingRule:paid.passingRule,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    tier,divisionIndex,divisionCount,multiplier,
    classificationStatus:'provisional_fixed_source_lanes',
    pointsStatus:'experimental_preview_only',
    canCommitAwards:false,awardRows:[],
    riders:ordered.map((row,index)=>({
      riderId:row.riderId,teamId:row.teamId,
      provisionalPlace:index+1,
      elapsedSecondsFromLastKmStart:
        row.elapsedSecondsFromLastKmStart,
      energyAtLine:row.energyAtLine,
      previewPoints:pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing:index+1,multiplier})}))};
}

export function validateFinaleLaneQueuedPointPreview(tour,input,context,
  recorded){
  const record=recorded?.sourceFinaleVersion===
    FINALE_LANE_QUEUED_CAUGHT_BUNCH_RUNNER_VERSION?
    recordFinaleLaneQueuedCaughtBunchRunnerFromTour:
    recordFinaleLaneQueuedEarlyBunchRunnerFromTour;
  const paid=record(tour,input);
  if(!isDeepStrictEqual(recorded,
    projectFinaleLaneQueuedPointPreview(tour,paid,context)))
    throw new Error('Lane-queued preview points do not replay.');
  return true;
}
