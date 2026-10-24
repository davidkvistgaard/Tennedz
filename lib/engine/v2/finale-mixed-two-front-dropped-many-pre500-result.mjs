import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-many-pre500-result-1';

// Several exact same-source approaches are paid. The outside lanes and
// their occupied-wheel responses remain inferred, so this only yields a
// conditional individual line and never an official classification.
export function recordFinaleMixedTwoFrontDroppedManyPre500Result(tour,{
  plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{plans});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedManyPre500Audit(
    tour,clock,line);
  const final500Audit=recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit(
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
    pre500Audit.freshApproaches.length!==5||
    final500Audit.freshApproaches.length!==1||
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
    version:FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,pointPreview,
    roadStatus:'conditional_mixed_two_front_many_pre500',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedManyPre500Result(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedManyPre500Result(tour,input)))
    throw new Error('The many-approach conditional result does not replay.');
  return true;
}
