import {isDeepStrictEqual} from 'node:util';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';

export const FINALE_DYNAMIC_SINGLE_ROAD_BOUNDS_VERSION=
  'v2-finale-dynamic-single-road-bounds-1';
const EPSILON=1e-7;

// The new front leavers share a group at the split. Only the paid passages
// after that split can bound their conditional road order at the line.
export function projectFinaleDynamicSingleRoadBounds(clock,line){
  if(clock?.version!==FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_CLOCK_VERSION||
    line?.version!==FINALE_COAST_DYNAMIC_SINGLE_INDIVIDUAL_LINE_VERSION||
    line.provisionalLineOrder!==null||
    clock.line?.bands?.length!==1||
    clock.line.bands[0].kind!=='unresolved_contact'||
    clock.classifiedResults!==null||
    line.classifiedResults!==null||
    !Array.isArray(clock.passageFrames)||
    clock.passageFrames.length<2||
    !Array.isArray(line.conditionalCrossings))
    throw new Error('Road bounds need a paid dynamic single-front line.');
  const final=clock.passageFrames.at(-1);
  const front=final.groups[0];
  const dropped=final.droppedPassages.map(row=>row.riderId);
  const bunch=clock.trace.frames.at(-1).pelotonRiderIds;
  const sameIds=(a,b)=>isDeepStrictEqual([...a].sort(),[...b].sort());
  if(final.groups.length!==1||!front?.riderIds.length||
    dropped.length<1||!bunch?.length||
    clock.passageFrames.some(frame=>frame.groups.length!==1||
      frame.groups[0].id!==front.id||
      !sameIds(frame.groups[0].riderIds,front.riderIds)||
      !sameIds(frame.droppedPassages.map(row=>row.riderId),dropped)||
      frame.groups[0].passageSecondsFromBunchMarker>=
        Math.min(...frame.droppedPassages.map(row=>
          row.passageSecondsFromBunchMarker))-EPSILON||
      Math.max(...frame.droppedPassages.map(row=>
        row.passageSecondsFromBunchMarker))>=
        frame.bunchPassageSecondsFromBunchMarker-EPSILON))
    throw new Error('Front, leavers and bunch lack separate paid passages.');
  const bands=assignFinishBandPlaces([
    {id:front.id,kind:'front',riderIds:front.riderIds},
    {id:'front_leavers',kind:'unresolved_leavers',riderIds:dropped},
    {id:'peloton',kind:'bunch',riderIds:bunch}]);
  const byId=new Map(bands.flatMap(band=>band.riderIds.map(id=>
    [id,band])));
  const crossings=line.conditionalCrossings;
  const timeFor=ids=>ids.map(id=>crossings.find(row=>
    row.riderId===id)?.elapsedSecondsFromLastKmStart);
  const frontTimes=timeFor(front.riderIds);
  const dropTimes=timeFor(dropped);
  const bunchTimes=timeFor(bunch);
  if(byId.size!==crossings.length||
    new Set(crossings.map(row=>row.riderId)).size!==crossings.length||
    crossings.some(row=>!byId.has(row.riderId)||
      row.roadBandId!==(front.riderIds.includes(row.riderId)?front.id:
        dropped.includes(row.riderId)?`isolated:${row.riderId}`:
          'peloton'))||
    [...frontTimes,...dropTimes,...bunchTimes]
      .some(time=>!Number.isFinite(time))||
    Math.max(...frontTimes)>=Math.min(...dropTimes)-EPSILON||
    Math.max(...dropTimes)>=Math.min(...bunchTimes)-EPSILON)
    throw new Error('Conditional crossings contradict the paid road bands.');
  return {version:FINALE_DYNAMIC_SINGLE_ROAD_BOUNDS_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    status:'conditional_road_bands',bands,
    riders:crossings.map(row=>({riderId:row.riderId,
      firstPossiblePlace:byId.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:byId.get(row.riderId).lastPossiblePlace})),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDynamicSingleRoadBounds(clock,line,recorded){
  if(!isDeepStrictEqual(recorded,
    projectFinaleDynamicSingleRoadBounds(clock,line)))
    throw new Error('The dynamic single-front road bounds do not replay.');
  return true;
}
