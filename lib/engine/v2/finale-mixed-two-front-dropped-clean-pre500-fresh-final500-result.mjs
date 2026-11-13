import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_CLEAN_PRE500_FRESH_FINAL500_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-clean-pre500-fresh-final500-result-1';

// The two exact final approaches are paid. Outside lanes and occupied-wheel
// order remain inferred; this result can only expose a conditional line.
export function recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
  tour,{plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{plans});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedPre500Audit(tour,
    clock,line);
  const final500Audit=
    recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Audit(
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
  if(tour.committedInputs.teams.length!==15||
    tour.route.distanceKm!==260||
    clock.trace.frames.length!==7||clock.passageFrames.length!==7||
    pre500Audit.paidRiderCount!==roster.length||
    final500Audit.paidRiderCount!==roster.length||
    final500Audit.freshApproaches.length!==2||
    crossings.length!==roster.length||
    finishers.length!==roster.length||
    new Set(crossings.map(row=>row.riderId)).size!==roster.length||
    new Set(finishers).size!==roster.length||
    roster.some(id=>!finishers.includes(id)||
      !Number.isFinite(at500.get(id))||
      Math.abs(at500.get(id)-lineHandoff.get(id))>1e-7)||
    line.provisionalLineOrder!==null||
    line.classifiedResults!==null||
    line.pointsStatus!=='withheld'||line.canCommitAwards!==false)
    throw new Error('The final-only fresh race lacks a paid conditional line.');
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'Inferred lanes and individual final-wheel approaches leave official points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {
    version:FINALE_MIXED_TWO_FRONT_DROPPED_CLEAN_PRE500_FRESH_FINAL500_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,pointPreview,
    roadStatus:'conditional_mixed_two_front_clean_pre500_fresh_final500',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(tour,
      input)))
    throw new Error('The final-only fresh conditional result does not replay.');
  return true;
}
