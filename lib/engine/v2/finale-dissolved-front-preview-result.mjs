import {isDeepStrictEqual} from 'node:util';
import {divisionMultiplier} from '../../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../../calendar/points.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {recordFinaleDissolvedFrontConditionalLine} from
  './finale-dissolved-front-conditional-line.mjs';
import {recordFinaleDissolvedFrontPre500Wheel} from
  './finale-dissolved-front-pre500-wheel.mjs';
import {recordFinaleDissolvedFrontPost500Wheel} from
  './finale-dissolved-front-post500-wheel.mjs';

export const FINALE_DISSOLVED_FRONT_PREVIEW_RESULT_VERSION=
  'v2-finale-dissolved-front-preview-result-1';
const EPSILON=1e-7;

// One bounded whole-race interpretation of the recorded shoulder exit:
// separate outside lanes for isolated riders and no inferred active-band
// wheel contact. The output is a replayable provisional test result only.
export function recordFinaleDissolvedFrontPreviewResult(tour,{
  plans=null,pointContext=null}={}){
  const line=recordFinaleDissolvedFrontConditionalLine(tour,{plans});
  const pre500Wheel=recordFinaleDissolvedFrontPre500Wheel(tour,line);
  const post500Wheel=recordFinaleDissolvedFrontPost500Wheel(tour,line);
  if(pre500Wheel.firstPotentialWheelContact||
    post500Wheel.firstPotentialWheelContact)
    throw new Error('The dissolved-front preview needs separate active wheels.');
  const active=line.positionedSource.roadBands;
  const all=line.conditionalCrossings;
  const front=all.filter(row=>row.roadBandId===active[0].id);
  const bunch=all.filter(row=>row.roadBandId==='peloton');
  const isolated=all.filter(row=>row.roadBandId.startsWith('isolated:'));
  const maximum=rows=>Math.max(...rows.map(row=>
    row.elapsedSecondsFromLastKmStart));
  const minimum=rows=>Math.min(...rows.map(row=>
    row.elapsedSecondsFromLastKmStart));
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const at500=line.shoulder.passages.find(row=>row.distanceM===
    tour.route.distanceKm*1000-500);
  if(!front.length||!bunch.length||!isolated.length||
    all.length!==roster.size||
    new Set(all.map(row=>row.riderId)).size!==roster.size||
    all.some(row=>roster.get(row.riderId)!==row.teamId||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0)||
    !(maximum(front)+EPSILON<minimum(bunch))||
    !(maximum(bunch)+EPSILON<minimum(isolated))||
    at500?.isolated.length!==isolated.length)
    throw new Error('The dissolved-front preview lacks a separated line.');
  const assigned=new Map(line.shoulder.laneAssignments.map(row=>[
    row.riderId,row.outsideLane]));
  const sourceIsolated=line.positionedSource.droppedRiderIds.filter(id=>
    !assigned.has(id));
  const outsideLaneAssignments=[...line.shoulder.laneAssignments,
    ...sourceIsolated.map((riderId,index)=>({riderId,
      outsideLane:line.positionedSource.laneCount+assigned.size+index,
      atDistanceM:line.positionedSource.startDistanceM,
      rule:'source_isolated_outside_no_draft'}))];
  if(outsideLaneAssignments.length!==isolated.length||
    new Set(outsideLaneAssignments.map(row=>row.riderId)).size!==
      isolated.length||
    new Set(outsideLaneAssignments.map(row=>row.outsideLane)).size!==
      isolated.length||
    outsideLaneAssignments.some(row=>
      row.outsideLane<line.positionedSource.laneCount||
      !isolated.some(item=>item.riderId===row.riderId)))
    throw new Error('The isolated riders lack distinct outside lanes.');
  const provisionalLineOrder=positionedLineOrder(all);
  const finalRoadBands=[
    {id:active[0].id,riderIds:front.map(row=>row.riderId),
      firstCrossingSeconds:minimum(front),
      lastCrossingSeconds:maximum(front)},
    {id:'peloton',riderIds:bunch.map(row=>row.riderId),
      firstCrossingSeconds:minimum(bunch),
      lastCrossingSeconds:maximum(bunch)},
    ...[...isolated].sort((a,b)=>
      a.elapsedSecondsFromLastKmStart-
      b.elapsedSecondsFromLastKmStart||
      a.riderId.localeCompare(b.riderId)).map(row=>({id:row.roadBandId,
      riderIds:[row.riderId],
      firstCrossingSeconds:row.elapsedSecondsFromLastKmStart,
      lastCrossingSeconds:row.elapsedSecondsFromLastKmStart}))];
  let pointPreview=null;
  if(pointContext){
    const {tier,divisionIndex,divisionCount}=pointContext;
    if(!Number.isInteger(tier)||tier<1||tier>6)
      throw new Error('The dissolved-front point preview needs a tier.');
    const multiplier=divisionMultiplier(divisionIndex,divisionCount);
    pointPreview=provisionalLineOrder.some(row=>row.position===null)?{
      status:'unavailable',reason:'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false}:{
      version:FINALE_DISSOLVED_FRONT_PREVIEW_RESULT_VERSION,
      status:'illustrative',sourceLineVersion:line.version,
      pointsPolicyVersion:POINT_POLICY_VERSION,
      tier,divisionIndex,divisionCount,multiplier,
      pointsStatus:'experimental_preview_only',
      canCommitAwards:false,awardRows:[],
      riders:provisionalLineOrder.map(row=>({
        riderId:row.riderId,teamId:row.teamId,
        provisionalPlace:row.position,
        elapsedSecondsFromLastKmStart:
          row.elapsedSecondsFromLastKmStart,
        energyAtLine:row.energyAtLine,
        previewPoints:pointsForDivisionResult({tier,
          resultType:'ONE_DAY',placing:row.position,multiplier})}))};
  }
  return {version:FINALE_DISSOLVED_FRONT_PREVIEW_RESULT_VERSION,
    sourceLineVersion:line.version,
    line,pre500Wheel,post500Wheel,outsideLaneAssignments,
    finalRoadBands,provisionalLineOrder,pointPreview,
    roadStatus:'conditional_paid_shoulder_finale',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDissolvedFrontPreviewResult(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleDissolvedFrontPreviewResult(tour,input)))
    throw new Error('The dissolved-front preview result does not replay.');
  return true;
}
