import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedFinal500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_RESULT_VERSION=
  'v2-finale-mixed-two-front-older-drops-outside-lane-result-1';

// This conditional result is deliberately separate from the established
// two-front paths. Source-adjacent riders depart in distinct inferred lanes;
// neither occupied wheel order nor official classification is resolved.
export function recordFinaleMixedTwoFrontDroppedResult(tour,{
  plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{plans});
  const pre500Audit=recordFinaleMixedTwoFrontDroppedPre500Audit(tour,
    clock,line);
  const final500Audit=recordFinaleMixedTwoFrontDroppedFinal500Audit(
    tour,clock,line,pre500Audit);
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(row=>row.id));
  const crossings=line.conditionalCrossings;
  const finishers=line.bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>row.riderId));
  if(clock.trace.frames.length!==7||
    clock.passageFrames.length!==7||
    pre500Audit.paidRiderCount!==roster.length||
    final500Audit.paidRiderCount!==roster.length||
    crossings.length!==roster.length||
    finishers.length!==roster.length||
    new Set(crossings.map(row=>row.riderId)).size!==roster.length||
    new Set(finishers).size!==roster.length||
    roster.some(id=>!finishers.includes(id))||
    line.provisionalLineOrder!==null||
    line.classifiedResults!==null||
    line.pointsStatus!=='withheld'||line.canCommitAwards!==false)
    throw new Error('The two-front whole race lacks a paid conditional line.');
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'Inferred outside lanes leave occupied wheel order and policy points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {version:FINALE_MIXED_TWO_FRONT_DROPPED_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,pointPreview,
    roadStatus:'conditional_mixed_two_front_older_drops_outside_lanes',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMixedTwoFrontDroppedResult(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedResult(tour,input)))
    throw new Error('The two-front conditional result does not replay.');
  return true;
}
