// Check a paid contact fragment against the other known rear roads
// and the front. Front drops still need their own piecewise audit.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalRecordedRestKmV1} from
  './v94-physical-recorded-rest-km-v1.mjs';
import {replayV94PhysicalMidKmContactFragmentV1} from
  './v94-physical-mid-km-contact-fragment-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';

export const V94_PHYSICAL_MID_KM_CONTACT_ROAD_AUDIT_VERSION=
  'v94-physical-mid-km-contact-road-audit-1';
const EPS=1e-8;

export function inspectV94PhysicalMidKmContactRoadsV1(
  recording,prior){
  const fragment=replayV94PhysicalMidKmContactFragmentV1(
    recording,prior);
  let physicalRoads=null;
  try{
    replayV94PhysicalRecordedRestKmV1(recording,prior);
  }catch(error){
    if(error.message!==
      'Physical rear roads need paid contact resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  if(!Array.isArray(physicalRoads?.roads)||
    !Array.isArray(physicalRoads.frontSegments)||
    !Array.isArray(physicalRoads.front?.atFrontClock)||
    fragment.previousRoadIds.some(id=>
      !physicalRoads.roads.some(row=>row.roadId===id)))
    throw new Error('Road audit needs the measured paid crossing.');
  const fromId=new Set(fragment.previousRoadIds);
  const segments=physicalRoads.roads.map(road=>{
    const contacted=fromId.has(road.roadId);
    const endClockSeconds=contacted?
      fragment.contactClockSeconds:road.finishClockSeconds;
    if(endClockSeconds<=road.startClockSeconds+EPS)
      throw new Error('Road audit needs travelled prefix.');
    return {roadId:road.roadId,contacted,
      startClockSeconds:road.startClockSeconds,
      endClockSeconds,
      startDistanceM:road.startDistanceM,
      endDistanceM:contacted?
        road.startDistanceM+road.speedMps*
          (endClockSeconds-road.startClockSeconds):
        road.endDistanceM};
  });
  const fragmentRoad={roadId:fragment.road.roadId,
    startClockSeconds:fragment.road.startClockSeconds,
    endClockSeconds:fragment.road.finishClockSeconds,
    startDistanceM:fragment.road.startDistanceM,
    endDistanceM:fragment.road.endDistanceM};
  const contacts=[];
  const add=(kind,a,b,sharedOrigin=false)=>{
    const contact=firstV94SecondPiecewiseContactV1(
      [a],[b],{sharedOrigin});
    if(contact)contacts.push({kind,...contact,
      roadIds:[a.roadId,b.roadId]});
  };
  for(let i=0;i<segments.length;i++){
    const a=segments[i];
    for(let j=i+1;j<segments.length;j++){
      const b=segments[j];
      if(a.contacted&&b.contacted)continue;
      add('rear_prefix_or_road',a,b,
        Math.abs(a.startClockSeconds-
          b.startClockSeconds)<EPS);
    }
    for(const front of physicalRoads.frontSegments)
      add('front_rear',a,{...front,roadId:'front'});
    if(!a.contacted)
      add('contact_fragment_rear',fragmentRoad,a);
  }
  for(const front of physicalRoads.frontSegments)
    add('contact_fragment_front',fragmentRoad,
      {...front,roadId:'front'});
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.roadIds.join('|').localeCompare(b.roadIds.join('|')));
  const frontDropCount=physicalRoads.front.atFrontClock.filter(row=>
    !row.attached).length;
  return {version:V94_PHYSICAL_MID_KM_CONTACT_ROAD_AUDIT_VERSION,
    sourceKm:fragment.sourceKm,
    contactFragmentVersion:fragment.version,
    contactRoadId:fragment.road.roadId,
    checkedRearRoadCount:segments.length,
    checkedFrontSegmentCount:
      physicalRoads.frontSegments.length,
    frontDropCount,
    firstOtherContact:contacts[0]??null,
    otherContactCount:contacts.length,
    frontDropsUnchecked:frontDropCount>0,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalMidKmContactRoadsV1(
  recording,prior,audit){
  if(!isDeepStrictEqual(audit,
    inspectV94PhysicalMidKmContactRoadsV1(
      recording,prior)))
    throw new Error('Contact road audit differs from paid source.');
  return true;
}
