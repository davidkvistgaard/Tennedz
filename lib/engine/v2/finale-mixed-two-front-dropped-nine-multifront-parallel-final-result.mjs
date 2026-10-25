import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_NINE_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-dropped-nine-multifront-parallel-final-result-1';

// An internal conditional line for nine paid departures from two fronts and
// one later parallel approach. The inferred lanes never classify wheel order.
export function recordFinaleMixedTwoFrontDroppedNineMultifrontParallelFinalResult(
  tour,{plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{
    plans,laneQueuedBandIds:['road-2']});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
    tour,clock,line);
  const final500Audit=recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit(
    tour,clock,line,pre500Audit);
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const leavers=clock.trace.frames.flatMap(frame=>
    frame.frontExhaustionDrops);
  const handoff=new Map(clock.trace.frames.find(frame=>
    frame.endDistanceM===tour.route.distanceKm*1000-500)?.riders.map(row=>
    [row.riderId,row.energy]));
  const lineEnergy=new Map(line.bandRunners.flatMap(band=>
    band.runner.frames[0].riders.map(row=>
      [row.riderId,row.energyAtDecision])));
  const finishers=line.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>row.riderId));
  const roadSlots=id=>line.positionedSource.roadBands.find(row=>
    row.id===id)?.slots.length;
  if(tour.route.distanceKm!==260||tour.committedInputs.teams.length!==20||
    roster.length!==160||clock.passageFrames.length!==7||
    clock.trace.frames.length!==7||
    pre500Audit.olderDroppedRiderIds.length!==33||
    pre500Audit.freshApproaches.length!==9||
    new Set(pre500Audit.freshApproaches.map(row=>
      row.sourceRoadGroupId)).size!==2||
    !pre500Audit.freshApproaches.some(row=>
      row.sourceRoadGroupId==='road-4')||
    !pre500Audit.freshApproaches.some(row=>
      row.sourceRoadGroupId==='road-2')||
    final500Audit.freshApproaches.length!==1||
    final500Audit.parallelFinalLaneEvidence.roadBandId!=='road-2'||
    final500Audit.parallelFinalLaneEvidence.noDraftAfterApproach!==true||
    final500Audit.parallelFinalLaneEvidence.fixedSourceLanes!==true||
    leavers.length!==16||
    ['road-2','road-4'].some(id=>
      leavers.filter(row=>row.fromRoadGroupId===id).length!==8||
      roadSlots(id)!==12)||
    pre500Audit.paidRiderCount!==160||
    final500Audit.paidRiderCount!==160||
    line.conditionalCrossings.length!==160||
    new Set(line.conditionalCrossings.map(row=>row.riderId)).size!==160||
    finishers.length!==160||new Set(finishers).size!==160||
    roster.some(id=>!finishers.includes(id)||
      !Number.isFinite(handoff.get(id))||
      Math.abs(handoff.get(id)-lineEnergy.get(id))>1e-7)||
    line.provisionalLineOrder!==null||line.classifiedResults!==null||
    line.pointsStatus!=='withheld'||line.canCommitAwards!==false)
    throw new Error('The nine-plus-one race lacks a paid conditional line.');
  return {version:
    FINALE_MIXED_TWO_FRONT_DROPPED_NINE_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,
    pointPreview:pointContext?{status:'unavailable',
      reason:'Inferred outside-lane wheel order leaves official points unresolved.',
      pointsStatus:'withheld',canCommitAwards:false}:null,
    roadStatus:'conditional_mixed_two_front_nine_multifront_parallel_final',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedNineMultifrontParallelFinalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedNineMultifrontParallelFinalResult(
      tour,input)))
    throw new Error('The nine-plus-one conditional result does not replay.');
  return true;
}
