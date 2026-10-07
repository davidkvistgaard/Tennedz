import {isDeepStrictEqual} from 'node:util';
import {lastKmLineStateFromTour} from './finale-last-km-line-state.mjs';

export const FINALE_FINISH_ORDER_BOUNDS_VERSION=
  'v2-finale-finish-order-bounds-1';

// A separated road band is ahead of the bunch at the recorded line. Its
// internal order is unknown; a sprint's timing gain is not a road-band gap.
// This is evidence for a later result rule, never a classified result.
export function probeLastKmFinishOrderBoundsFromTour(tour,options){
  const line=lastKmLineStateFromTour(tour,options);
  const bands=[];
  let firstPossiblePlace=1;
  for(const group of line.roadGroups){
    if(!Number.isFinite(group.gapSeconds)||group.gapSeconds<=0||
      !Array.isArray(group.riderIds)||!group.riderIds.length)
      throw new Error('A finish road band needs a measured positive gap.');
    bands.push({roadGroupId:group.id,riderIds:[...group.riderIds],
      gapAheadOfBunchSeconds:group.gapSeconds,
      firstPossiblePlace,
      lastPossiblePlace:firstPossiblePlace+group.riderIds.length-1});
    firstPossiblePlace+=group.riderIds.length;
  }
  const bunch=line.riders.filter(row=>row.roadGroupId===null);
  if(!bunch.length)throw new Error('The finish bounds need a bunch.');
  bands.push({roadGroupId:null,riderIds:bunch.map(row=>row.riderId),
    gapAheadOfBunchSeconds:0,firstPossiblePlace,
    lastPossiblePlace:firstPossiblePlace+bunch.length-1});
  const byId=new Map(bands.flatMap(band=>band.riderIds.map(id=>[id,band])));
  if(byId.size!==line.riders.length||
    bands.at(-1).lastPossiblePlace!==line.riders.length||
    line.riders.some(row=>byId.get(row.riderId)?.roadGroupId!==
      row.roadGroupId))
    throw new Error('The finish bounds must account for each road rider once.');
  return {version:FINALE_FINISH_ORDER_BOUNDS_VERSION,
    sourceLineStateVersion:line.version,lineDistanceM:line.lineDistanceM,
    bands,riders:line.riders.map(row=>({riderId:row.riderId,
      teamId:row.teamId,roadGroupId:row.roadGroupId,
      firstPossiblePlace:byId.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:byId.get(row.riderId).lastPossiblePlace}))};
}

export function validateLastKmFinishOrderBoundsFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmFinishOrderBoundsFromTour(tour,options)))
    throw new Error('The finish-order bounds do not replay.');
  return true;
}
