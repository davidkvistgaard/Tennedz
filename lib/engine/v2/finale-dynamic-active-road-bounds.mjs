import {isDeepStrictEqual} from 'node:util';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {recordFinalePre500ActiveOverlapAudit} from
  './finale-pre500-active-overlap-audit.mjs';
import {recordFinaleMultibandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION} from
  './finale-depleted-individual-line.mjs';

export const FINALE_DYNAMIC_ACTIVE_ROAD_BOUNDS_VERSION=
  'v2-finale-dynamic-active-road-bounds-1';
const EPSILON=1e-7;

// New bunch leavers may meet the bunch, but a separately paid front can
// retain its own conditional road range when neither half records an overlap.
export function projectFinaleDynamicActiveRoadBounds(tour,clock,line){
  if(clock?.version!==FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_CLOCK_VERSION||
    line?.version!==FINALE_COAST_DYNAMIC_ACTIVE_INDIVIDUAL_LINE_VERSION||
    line.provisionalLineOrder!==null||
    clock.classifiedResults!==null||line.classifiedResults!==null||
    clock.line?.bands?.length!==3||
    clock.line.bands[0].kind!=='road_group'||
    clock.line.bands[1].kind!=='peloton'||
    clock.line.bands[2].kind!=='unresolved_dropped'||
    line.bandRunners?.[0]?.roadBandId!==clock.line.bands[0].id||
    !Array.isArray(line.conditionalCrossings))
    throw new Error('Active-drop bounds need a paid front and unresolved rear.');
  const front=clock.line.bands[0];
  const rear=clock.line.bands.slice(1).flatMap(band=>band.riderIds);
  const sourceFront=line.positionedSource?.roadBands?.[0];
  const first=clock.passageFrames.slice(0,2);
  const start=line.positionedSource?.startDistanceM;
  if(first.length!==2||first[0].distanceM!==start+250||
    first[1].distanceM!==start+500||
    line.bandRunners.length<3||
    sourceFront?.id!==front.id||
    !Array.isArray(sourceFront.slots)||
    !isDeepStrictEqual(sourceFront.slots.map(row=>row.riderId).sort(),
      [...front.riderIds].sort())||
    !front.riderIds.length||!rear.length)
    throw new Error('Active-drop bounds lack paid half-kilometre passages.');
  const passages=first.map(frame=>({endDistanceM:frame.distanceM,
    bandTimes:[...frame.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    frame.bunchPassageSecondsFromBunchMarker],
    riderEnergy:clock.trace.frames.find(row=>
      row.endDistanceM===frame.distanceM)?.riders}));
  const pre500=recordFinalePre500ActiveOverlapAudit(
    line.positionedSource,passages);
  if(pre500.firstPotentialOverlap!==null||
    line.bandRunners.slice(1).some(band=>
      recordFinaleMultibandOverlapAudit([
        line.bandRunners[0],band]).firstPotentialOverlap!==null))
    throw new Error('The front may meet another paid road band.');
  const bands=assignFinishBandPlaces([
    {id:front.id,kind:'conditional_front',riderIds:front.riderIds},
    {id:'unresolved_rear',kind:'unresolved_rear',riderIds:rear}]);
  const byId=new Map(bands.flatMap(band=>band.riderIds.map(id=>
    [id,band])));
  const crossings=line.conditionalCrossings;
  const byBand=new Map(line.bandRunners.map(band=>[
    band.roadBandId,new Set(band.runner.finishers.map(row=>row.riderId))]));
  const frontTimes=crossings.filter(row=>front.riderIds.includes(row.riderId))
    .map(row=>row.elapsedSecondsFromLastKmStart);
  const rearTimes=crossings.filter(row=>!front.riderIds.includes(row.riderId))
    .map(row=>row.elapsedSecondsFromLastKmStart);
  if(!isDeepStrictEqual([...byId.keys()].sort(),
    tour.committedInputs.teams.flatMap(team=>team.riders.map(row=>row.id))
      .sort())||
    !isDeepStrictEqual(line.bandRunners.flatMap(band=>
      band.runner.finishers.map(row=>row.riderId)).sort(),
    [...byId.keys()].sort())||
    byId.size!==crossings.length||
    new Set(crossings.map(row=>row.riderId)).size!==crossings.length||
    crossings.some(row=>!byId.has(row.riderId)||
      !byBand.get(row.roadBandId)?.has(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart))||
    Math.max(...frontTimes)>=Math.min(...rearTimes)-EPSILON)
    throw new Error('Active-drop crossings contradict the separated front.');
  return {version:FINALE_DYNAMIC_ACTIVE_ROAD_BOUNDS_VERSION,
    sourceClockVersion:clock.version,sourceLineVersion:line.version,
    status:'conditional_front_separated_rear_contact_unresolved',bands,
    riders:crossings.map(row=>({riderId:row.riderId,
      firstPossiblePlace:byId.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:byId.get(row.riderId).lastPossiblePlace})),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDynamicActiveRoadBounds(tour,clock,line,
  recorded){
  if(!isDeepStrictEqual(recorded,
    projectFinaleDynamicActiveRoadBounds(tour,clock,line)))
    throw new Error('The dynamic active road bounds do not replay.');
  return true;
}
