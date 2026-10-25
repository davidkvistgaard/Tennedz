import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedTwoFrontDroppedClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit,
  recordFinaleMixedTwoFrontDroppedFifteenMultifrontPre500Audit} from
  './finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit,
  recordFinaleMixedTwoFrontDroppedFifteenMultifrontFinal500Audit} from
  './finale-mixed-two-front-dropped-final500-audit.mjs';

export const FINALE_MIXED_TWO_FRONT_DROPPED_FIVE_MULTIFRONT_INTERNAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-dropped-five-multifront-internal-result-1';
export const FINALE_MIXED_TWO_FRONT_DROPPED_FIFTEEN_OLDER33_INTERNAL_RESULT_VERSION=
  'v2-finale-mixed-two-front-dropped-fifteen-older33-internal-result-1';

function recordInternalResult(tour,{plans=null,pointContext=null}={},
  {fifteen=false}={}){
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(tour);
  const line=recordFinaleCoastedIndividualLine(tour,clock,{
    plans,laneQueuedBandIds:['road-2']});
  const pre500Audit=(fifteen?
    recordFinaleMixedTwoFrontDroppedFifteenMultifrontPre500Audit:
    recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit)(tour,clock,line);
  const final500Audit=(fifteen?
    recordFinaleMixedTwoFrontDroppedFifteenMultifrontFinal500Audit:
    recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit)(
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
  const sourceCount=id=>pre500Audit.freshApproaches.filter(row=>
    row.sourceRoadGroupId===id).length;
  const roadSlots=id=>line.positionedSource.roadBands.find(row=>
    row.id===id)?.slots.length;
  if(tour.route.distanceKm!==260||tour.committedInputs.teams.length!==20||
    roster.length!==160||clock.passageFrames.length!==7||
    clock.trace.frames.length!==7||
    pre500Audit.olderDroppedRiderIds.length!==(fifteen?33:30)||
    pre500Audit.freshApproaches.length!==(fifteen?15:5)||
    sourceCount('road-2')!==(fifteen?14:4)||
    sourceCount('road-4')!==1||
    final500Audit.freshApproaches.length!==0||
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
    throw new Error('The alternate-12 race lacks a paid conditional line.');
  return {version:fifteen?
    FINALE_MIXED_TWO_FRONT_DROPPED_FIFTEEN_OLDER33_INTERNAL_RESULT_VERSION:
    FINALE_MIXED_TWO_FRONT_DROPPED_FIVE_MULTIFRONT_INTERNAL_RESULT_VERSION,
    clock,line,pre500Audit,final500Audit,
    pointPreview:pointContext?{status:'unavailable',
      reason:'Inferred outside-lane wheel order leaves official points unresolved.',
      pointsStatus:'withheld',canCommitAwards:false}:null,
    roadStatus:fifteen?
      'internal_mixed_two_front_fifteen_older33_clean_final':
      'internal_mixed_two_front_five_multifront_clean_final',
    classifiedResults:null,pointsStatus:'withheld',canCommitAwards:false};
}

export function recordFinaleMixedTwoFrontDroppedFiveMultifrontInternalResult(
  tour,input={}){
  return recordInternalResult(tour,input);
}

export function recordFinaleMixedTwoFrontDroppedFifteenOlder33InternalResult(
  tour,input={}){
  return recordInternalResult(tour,input,{fifteen:true});
}

export function validateFinaleMixedTwoFrontDroppedFiveMultifrontInternalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFiveMultifrontInternalResult(tour,input)))
    throw new Error('The five-multifront internal line does not replay.');
  return true;
}

export function validateFinaleMixedTwoFrontDroppedFifteenOlder33InternalResult(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedTwoFrontDroppedFifteenOlder33InternalResult(tour,input)))
    throw new Error('The fifteen-older33 internal line does not replay.');
  return true;
}
