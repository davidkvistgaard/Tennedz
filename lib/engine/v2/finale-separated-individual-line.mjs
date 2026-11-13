import {isDeepStrictEqual} from 'node:util';
import {validateFinaleSeparatedLastKmClock,
  validateFinaleSingleGroupLastKmClock} from
  './finale-separated-last-km.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';
import {recordFinalePre500ActiveOverlapAudit} from
  './finale-pre500-active-overlap-audit.mjs';

export const FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-separated-individual-line-lab-2';
export const FINALE_SEPARATED_SINGLETON_INDIVIDUAL_LINE_VERSION=
  'v2-finale-separated-individual-line-lab-3';
export const FINALE_SINGLE_GROUP_INDIVIDUAL_LINE_VERSION=
  'v2-finale-single-group-individual-line-lab-4';
const LEGACY_SEPARATED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-separated-individual-line-lab-1';

// Continue an already paid multi-group clock from its own 500 m passage.
// The old band-only clock remains intact and possible encounters stay gated.
export function recordFinaleSeparatedIndividualLine(tour,clock,
  {plans=null}={}){
  return recordActiveGroupIndividualLine(tour,clock,{plans},false);
}

export function recordFinaleSingleGroupIndividualLine(tour,clock,
  {plans=null}={}){
  return recordActiveGroupIndividualLine(tour,clock,{plans},true);
}

function recordActiveGroupIndividualLine(tour,clock,{plans},singleGroup){
  if(singleGroup)validateFinaleSingleGroupLastKmClock(tour,clock);
  else validateFinaleSeparatedLastKmClock(tour,clock);
  if(clock.line.outcome!=='separated')
    throw new Error('The separated individual line needs surviving groups.');
  const positioned=resolveFinaleMultibandPositionedSource(tour);
  if(singleGroup?positioned.roadBands.length!==2:
    positioned.roadBands.length<3)
    throw new Error('The individual line needs its locked front groups.');
  const finishM=tour.route.distanceKm*1000;
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const passage=clock.passageFrames.find(frame=>
    frame.distanceM===finishM-500);
  if(!at500||!passage||
    passage.groups.length!==positioned.roadBands.length-1||
    passage.groups.some((group,index)=>group.id!==
      positioned.roadBands[index].id))
    throw new Error('The separated line has no paid 500 m passage.');
  const pre500Audit=recordFinalePre500ActiveOverlapAudit(positioned,
    clock.passageFrames.filter(frame=>
      frame.distanceM<=finishM-500).map(frame=>({
      endDistanceM:frame.distanceM,
      bandTimes:[...frame.groups.map(group=>
        group.passageSecondsFromBunchMarker),
      frame.bunchPassageSecondsFromBunchMarker],
      riderEnergy:clock.trace.frames.find(row=>
        row.endDistanceM===frame.distanceM)?.riders??[]})));
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500,plans,sourceRoadTraceVersion:clock.version,
    passageTimes:[...passage.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    passage.bunchPassageSecondsFromBunchMarker],
    ...(passage.groups.some(group=>group.riderIds.length===1)?{
      singletonRoad:{trace:clock.trace,
        passageAtLine:clock.passageFrames.at(-1)}}:{}),
    withholdProvisionalOrder:!!pre500Audit.firstPotentialOverlap});
  return {version:singleGroup?
    FINALE_SINGLE_GROUP_INDIVIDUAL_LINE_VERSION:
    passage.groups.some(group=>group.riderIds.length===1)?
    FINALE_SEPARATED_SINGLETON_INDIVIDUAL_LINE_VERSION:
    FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    ...handoff,pre500Audit,
    roadStatus:'band_local_individual_lines_cross_band_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleSeparatedIndividualLine(tour,clock,input,
  recorded){
  const expected=recordFinaleSeparatedIndividualLine(tour,clock,input);
  const {pre500Audit,...prior}=expected;
  const legacy={...prior,
    version:LEGACY_SEPARATED_INDIVIDUAL_LINE_VERSION,
    provisionalLineOrder:pre500Audit.firstPotentialOverlap&&
      !prior.overlapAudit.firstPotentialOverlap?
        positionedLineOrder(prior.conditionalCrossings):
        prior.provisionalLineOrder};
  if(!isDeepStrictEqual(recorded,expected)&&
    !(expected.version===FINALE_SEPARATED_INDIVIDUAL_LINE_VERSION&&
      isDeepStrictEqual(recorded,legacy)))
    throw new Error('The separated individual line does not replay.');
  return true;
}

export function validateFinaleSingleGroupIndividualLine(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleSingleGroupIndividualLine(tour,clock,input)))
    throw new Error('The single-group individual line does not replay.');
  return true;
}
