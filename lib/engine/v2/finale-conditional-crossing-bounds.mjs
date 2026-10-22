import {isDeepStrictEqual} from 'node:util';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {FINALE_PARTIAL_CONTACT_RUNNER_VERSION,
  FINALE_CHASED_PARTIAL_CONTACT_RUNNER_VERSION,
  FINALE_CHASED_PARTIAL_AFTER_LEAD_OUT_VERSION,
  FINALE_PASSIVE_PARTIAL_AFTER_LEAD_OUT_VERSION,
  FINALE_CHASED_PARTIAL_ACTIVE_LEAD_OUT_VERSION} from
  './finale-partial-contact-runner.mjs';

export const FINALE_CONDITIONAL_CROSSING_BOUNDS_VERSION=
  'v2-finale-conditional-crossing-bounds-1';

const PARTIAL_CONTACT_VERSIONS=new Set([
  FINALE_PARTIAL_CONTACT_RUNNER_VERSION,
  FINALE_CHASED_PARTIAL_CONTACT_RUNNER_VERSION,
  FINALE_CHASED_PARTIAL_AFTER_LEAD_OUT_VERSION,
  FINALE_PASSIVE_PARTIAL_AFTER_LEAD_OUT_VERSION,
  FINALE_CHASED_PARTIAL_ACTIVE_LEAD_OUT_VERSION]);

export const hasFinaleConditionalCrossingBounds=paidFinale=>
  PARTIAL_CONTACT_VERSIONS.has(paidFinale?.version);

// The paid runner measures crossings, but a shared timestamp does not locate
// wheels inside the bunch. These are conditional bounds, never race results.
export function recordFinaleConditionalCrossingBounds(paidFinale){
  if(!hasFinaleConditionalCrossingBounds(paidFinale)||
    paidFinale.resultStatus!=='provisional_conditional'||
    paidFinale.pointsStatus!=='withheld'||
    paidFinale.canCommitAwards!==false||
    paidFinale.lineOrder!==undefined||
    !Array.isArray(paidFinale.finishers)||
    !paidFinale.finishers.length||
    !Array.isArray(paidFinale.frames)||
    !paidFinale.frames.length)
    throw new Error('Crossing bounds need a paid partial-contact line.');
  const last=paidFinale.frames.at(-1);
  const finalRows=new Map(last.riders?.map(row=>[row.riderId,row]));
  const seen=new Set();
  if(finalRows.size!==paidFinale.finishers.length||
    !Number.isFinite(paidFinale.lineDistanceM)||
    paidFinale.finishers.some(row=>{
      if(typeof row.riderId!=='string'||
        typeof row.teamId!=='string'||seen.has(row.riderId)||
        !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
        !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
        finalRows.get(row.riderId)?.positionM!==
          paidFinale.lineDistanceM||
        finalRows.get(row.riderId)?.elapsedToLineSeconds!==
          row.elapsedSecondsFromLastKmStart||
        finalRows.get(row.riderId)?.energyAfter!==row.energyAtLine)
        return true;
      seen.add(row.riderId);
      return false;
    }))
    throw new Error('Crossing bounds lost a paid rider or line timestamp.');
  const byTime=new Map();
  for(const row of paidFinale.finishers){
    const ids=byTime.get(row.elapsedSecondsFromLastKmStart)??[];
    ids.push(row.riderId);
    byTime.set(row.elapsedSecondsFromLastKmStart,ids);
  }
  const bands=assignFinishBandPlaces([...byTime.entries()]
    .sort(([a],[b])=>a-b)
    .map(([elapsedSecondsFromLastKmStart,riderIds])=>({
      elapsedSecondsFromLastKmStart,riderIds})));
  const byId=new Map(bands.flatMap(band=>band.riderIds.map(id=>
    [id,band])));
  return {version:FINALE_CONDITIONAL_CROSSING_BOUNDS_VERSION,
    sourceFinaleVersion:paidFinale.version,
    lineDistanceM:paidFinale.lineDistanceM,bands,
    riders:paidFinale.finishers.map(row=>({
      riderId:row.riderId,teamId:row.teamId,
      elapsedSecondsFromLastKmStart:row.elapsedSecondsFromLastKmStart,
      firstPossiblePlace:byId.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:byId.get(row.riderId).lastPossiblePlace})),
    resultStatus:'conditional_bounds_only',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleConditionalCrossingBounds(paidFinale,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConditionalCrossingBounds(paidFinale)))
    throw new Error('The conditional crossing bounds do not replay.');
  return true;
}
