import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_THREE_ONEFRONT_INTERNAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-dropped-three-onefront-internal-result-1';

// A read-only conditional line. All wheel encounters are paid, but their
// occupied-lane response and any official finish order remain unresolved.
export function recordFinaleMixedTwoFrontDroppedThreeOnefrontInternalResult(
  tour,{plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{
    plans,laneQueuedBandIds:['road-2']});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
    tour,clock,line);
  const final500Audit=recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit(
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
    pre500Audit.olderDroppedRiderIds.length!==20||
    pre500Audit.freshApproaches.length!==3||
    pre500Audit.freshApproaches.some(row=>
      row.sourceRoadGroupId!=='road-2')||
    final500Audit.freshApproaches.length!==0||
    leavers.length!==13||
    leavers.filter(row=>row.fromRoadGroupId==='road-2').length!==8||
    leavers.filter(row=>row.fromRoadGroupId==='road-4').length!==5||
    roadSlots('road-2')!==12||roadSlots('road-4')!==15||
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
    throw new Error('The three-approach race lacks a paid conditional line.');
  return {version:
    FINALE_MIXED_TWO_FRONT_DROPPED_THREE_ONEFRONT_INTERNAL_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,
    pointPreview:pointContext?{status:'unavailable',
      reason:'Inferred outside-lane wheel order leaves official points unresolved.',
      pointsStatus:'withheld',canCommitAwards:false}:null,
    roadStatus:'internal_mixed_two_front_three_onefront_clean_final',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedThreeOnefrontInternalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedThreeOnefrontInternalResult(tour,input)))
    throw new Error('The three-approach internal line does not replay.');
  return true;
}
