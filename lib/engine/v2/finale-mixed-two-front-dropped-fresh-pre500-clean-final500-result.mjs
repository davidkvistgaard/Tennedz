import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_CLEAN_FINAL500_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-fresh-pre500-clean-final500-result-1';

// A single exact early approach is paid, while final-half pairwise wheels
// stay in their source groups. Inferred lanes never classify a race.
export function recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
  tour,{plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{plans});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedFreshPre500Audit(
    tour,clock,line);
  const final500Audit=
    recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Audit(
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
    !pre500Audit.firstFreshApproach||
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
    throw new Error('The early-only fresh race lacks a paid conditional line.');
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'An inferred outside lane and early individual wheel approach leave official points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {
    version:FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_CLEAN_FINAL500_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,pointPreview,
    roadStatus:'conditional_mixed_two_front_fresh_pre500_clean_final500',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(tour,
      input)))
    throw new Error('The early-only fresh conditional result does not replay.');
  return true;
}
