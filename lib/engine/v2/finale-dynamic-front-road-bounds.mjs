import {isDeepStrictEqual} from 'node:util';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';

export const FINALE_DYNAMIC_FRONT_ROAD_BOUNDS_VERSION=
  'v2-finale-dynamic-front-road-bounds-1';
const EPSILON=1e-7;
const sameIds=(a,b)=>isDeepStrictEqual([...a].sort(),[...b].sort());

// Only bound a surviving front against the rest of the field. Front leavers
// may meet the bunch during the split, so its internal order and all awards
// remain unresolved even when the paid front stays ahead at every marker.
export function projectFinaleDynamicFrontRoadBounds(tour,clock,line){
  if(clock?.version!==FINALE_COAST_DYNAMIC_FRONT_LAST_KM_CLOCK_VERSION||
    line?.version!==FINALE_COAST_DYNAMIC_FRONT_INDIVIDUAL_LINE_VERSION||
    line.provisionalLineOrder!==null||
    clock.classifiedResults!==null||line.classifiedResults!==null||
    !Array.isArray(line.conditionalCrossings))
    throw new Error('Dynamic-front bounds need a paid unresolved line.');
  const bands=clock.line?.bands;
  const frames=clock.passageFrames;
  const front=bands?.[0];
  // Multiple fronts need their own order/contact proof.
  if(bands?.length!==3||front?.kind!=='road_group'||
    bands[1]?.kind!=='peloton'||
    bands[2]?.kind!=='unresolved_dropped'||
    !front.riderIds.length||!bands[1].riderIds.length||
    !bands[2].riderIds.length||!Array.isArray(frames)||
    frames.length<3||frames[0].distanceM!==clock.lineDistanceM-750||
    frames[1].distanceM!==clock.lineDistanceM-500||
    frames.at(-1).distanceM!==clock.lineDistanceM||
    frames.some(frame=>frame.groups?.length!==1||
      frame.groups[0].id!==front.id||
      !sameIds(frame.groups[0].riderIds,front.riderIds)))
    return null;
  const rear=[...bands[1].riderIds,...bands[2].riderIds];
  const frontTimes=line.conditionalCrossings.filter(row=>
    front.riderIds.includes(row.riderId)).map(row=>
    row.elapsedSecondsFromLastKmStart);
  const rearTimes=line.conditionalCrossings.filter(row=>
    rear.includes(row.riderId)).map(row=>
    row.elapsedSecondsFromLastKmStart);
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(row=>row.id));
  const lineIds=line.conditionalCrossings.map(row=>row.riderId);
  if(!sameIds([...front.riderIds,...rear],locked)||
    !sameIds(lineIds,locked)||
    new Set(lineIds).size!==locked.length||
    line.conditionalCrossings.some(row=>!Number.isFinite(
      row.elapsedSecondsFromLastKmStart)||
      row.roadBandId!==(front.riderIds.includes(row.riderId)?
        front.id:bands[1].riderIds.includes(row.riderId)?
          bands[1].id:`isolated:${row.riderId}`))||
    frames.some(frame=>frame.groups[0]
      .passageSecondsFromBunchMarker>=
      frame.bunchPassageSecondsFromBunchMarker-EPSILON||
      frame.droppedPassages.some(row=>
        frame.groups[0].passageSecondsFromBunchMarker>=
        row.passageSecondsFromBunchMarker-EPSILON))||
    Math.max(...frontTimes)>=Math.min(...rearTimes)-EPSILON)
    throw new Error('Dynamic-front crossings contradict the paid road.');
  const ranked=assignFinishBandPlaces([
    {id:front.id,kind:'conditional_front',riderIds:front.riderIds},
    {id:'unresolved_rear',kind:'unresolved_rear',riderIds:rear}]);
  const byId=new Map(ranked.flatMap(band=>band.riderIds.map(id=>
    [id,band])));
  return {version:FINALE_DYNAMIC_FRONT_ROAD_BOUNDS_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    status:'conditional_front_separated_rear_contact_unresolved',
    bands:ranked,riders:line.conditionalCrossings.map(row=>({
      riderId:row.riderId,
      firstPossiblePlace:byId.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:byId.get(row.riderId).lastPossiblePlace})),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDynamicFrontRoadBounds(tour,clock,line,
  recorded){
  if(!isDeepStrictEqual(recorded,
    projectFinaleDynamicFrontRoadBounds(tour,clock,line)))
    throw new Error('The dynamic front road bounds do not replay.');
  return true;
}
