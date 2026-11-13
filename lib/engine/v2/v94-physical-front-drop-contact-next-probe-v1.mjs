// Audit the proposed contact group's next measured road meeting.
// The group fragment cannot become a whole field while this is unresolved.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {replayV94PhysicalFrontDropContactFragmentV1} from
  './v94-physical-front-drop-contact-fragment-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_NEXT_PROBE_VERSION=
  'v94-physical-front-drop-contact-next-probe-1';
const EPS=1e-7;

export function inspectV94PhysicalFrontDropContactNextV1(
  recording,prior){
  const fragment=replayV94PhysicalFrontDropContactFragmentV1(
    recording,prior);
  let physicalRoads;
  try{
    replayV94PhysicalSixthKmV1(recording,prior);
  }catch(error){
    if(error.message!==
      'Physical front drop/rear contact needs paid resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  if(!physicalRoads?.roads||
    !physicalRoads.newFrontDrops||
    !physicalRoads.frontSegments)
    throw new Error('Next contact probe needs measured roads.');
  const group=[{
    startClockSeconds:fragment.road.startClockSeconds,
    endClockSeconds:fragment.road.finishClockSeconds,
    startDistanceM:fragment.road.startDistanceM,
    endDistanceM:fragment.road.endDistanceM}];
  const joined=new Set(fragment.previousRoadIds);
  const contacts=[];
  for(const road of physicalRoads.roads){
    if(joined.has(road.roadId))continue;
    const meeting=firstV94SecondPiecewiseContactV1(
      group,[{startClockSeconds:road.startClockSeconds,
        endClockSeconds:road.finishClockSeconds,
        startDistanceM:road.startDistanceM,
        endDistanceM:road.endDistanceM}]);
    if(meeting)contacts.push({...meeting,
      roadId:road.roadId,
      riderIds:road.riderDecisions.map(row=>row.riderId),
      priorRoadKind:road.kind});
  }
  for(const drop of physicalRoads.newFrontDrops){
    const roadId=`solo-${drop.riderId}`;
    if(joined.has(roadId))continue;
    const meeting=firstV94SecondPiecewiseContactV1(
      group,drop.segments);
    if(meeting)contacts.push({...meeting,
      roadId,riderIds:[drop.riderId],
      priorRoadKind:'front_drop_solo'});
  }
  for(const front of physicalRoads.frontSegments){
    const meeting=firstV94SecondPiecewiseContactV1(
      group,[front]);
    if(meeting)contacts.push({...meeting,
      roadId:'peloton',riderIds:[],
      priorRoadKind:'front'});
  }
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.roadId.localeCompare(b.roadId));
  const first=contacts[0]??null;
  const simultaneous=first?contacts.filter(row=>
    Math.abs(row.clockSeconds-first.clockSeconds)<EPS&&
    Math.abs(row.atDistanceM-first.atDistanceM)<1e-6):[];
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_NEXT_PROBE_VERSION,
    sourceKm:fragment.sourceKm,
    contactFragmentVersion:fragment.version,
    contactRoadId:fragment.road.roadId,
    checkedRearRoadCount:physicalRoads.roads.length,
    checkedFrontDropCount:physicalRoads.newFrontDrops.length,
    checkedFrontSegmentCount:physicalRoads.frontSegments.length,
    firstAdditionalContact:first?{
      clockSeconds:first.clockSeconds,
      atDistanceM:first.atDistanceM,
      roadIds:simultaneous.map(row=>row.roadId),
      riderIds:simultaneous.flatMap(row=>row.riderIds),
      priorRoadKinds:simultaneous.map(row=>
        row.priorRoadKind)}:null,
    additionalContactCount:contacts.length,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropContactNextV1(
  recording,prior,probe){
  if(!isDeepStrictEqual(probe,
    inspectV94PhysicalFrontDropContactNextV1(
      recording,prior)))
    throw new Error(
      'Next front-drop contact differs from paid roads.');
  return true;
}
