// Audit the remaining measured roads after a paid first contact batch.
// The fragment is never promoted to a whole kilometre by this probe.
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_FRAGMENT_VERSION} from
  './v94-physical-front-drop-first-batch-fragment-v1.mjs';

export const V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_NEXT_VERSION=
  'v94-physical-front-drop-first-batch-next-1';
const EPS=1e-7;
const segmentOf=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});

export function inspectV94PhysicalFrontDropFirstBatchNextV1(
  physicalRoads,fragment){
  const {roads,newFrontDrops,frontSegments}=physicalRoads??{};
  if(![
    V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_FRAGMENT_VERSION,
    'v94-physical-front-drop-batch-extension-1'
  ].includes(fragment?.version)||
    !fragment.paidContactGroupFragment||
    !Array.isArray(roads)||
    !Array.isArray(newFrontDrops)||
    !Array.isArray(frontSegments))
    throw new Error('Front-drop next probe needs paid fragment.');
  const joined=new Set(fragment.riderWork.map(row=>row.riderId));
  const passed=new Set((fragment.passThroughContacts??[])
    .map(row=>row.passedRiderId));
  if(!joined.has(fragment.road.leaderRiderId)||
    !fragment.road.shelteredRiderIds.every(id=>joined.has(id))||
    [...passed].some(id=>joined.has(id)))
    throw new Error('Front-drop next probe loses joined riders.');
  const remainingRoads=roads.filter(road=>
    !road.riderDecisions.some(row=>joined.has(row.riderId)));
  const remainingDrops=newFrontDrops.filter(drop=>
    !joined.has(drop.riderId)&&!passed.has(drop.riderId));
  const group={roadId:fragment.road.roadId,
    segments:[segmentOf(fragment.road)]};
  const other=[...remainingRoads.map(road=>({
    roadId:road.roadId,kind:road.kind,
    riderIds:road.riderDecisions.map(row=>row.riderId),
    segments:[segmentOf(road)],origin:null})),
  ...remainingDrops.map(drop=>({
    roadId:`solo-${drop.riderId}`,
    kind:'front_drop_solo',riderIds:[drop.riderId],
    segments:drop.segments,origin:drop.origin}))];
  const contacts=[];
  const add=(a,b,sharedOrigin=false)=>{
    const meeting=firstV94SecondPiecewiseContactV1(
      a.segments,b.segments,{sharedOrigin});
    if(meeting)contacts.push({...meeting,
      roadIds:[a.roadId,b.roadId],
      riderIds:[...(a.riderIds??[]),...(b.riderIds??[])]});
  };
  for(let i=0;i<other.length;i++){
    const a=other[i];
    add(group,a);
    for(let j=i+1;j<other.length;j++){
      const b=other[j];
      const sharedOrigin=a.origin&&b.origin&&
        Math.abs(a.origin.startClockSeconds-
          b.origin.startClockSeconds)<=EPS&&
        Math.abs(a.origin.startDistanceM-
          b.origin.startDistanceM)<=EPS;
      add(a,b,!!sharedOrigin);
    }
    if(a.origin)for(const front of frontSegments)
      add(a,{roadId:'peloton',segments:[front]},true);
  }
  for(const front of frontSegments)
    add(group,{roadId:'peloton',segments:[front]});
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.atDistanceM-b.atDistanceM||
    a.roadIds[0].localeCompare(b.roadIds[0])||
    a.roadIds[1].localeCompare(b.roadIds[1]));
  const first=contacts[0]??null;
  const simultaneous=first?contacts.filter(row=>
    Math.abs(row.clockSeconds-first.clockSeconds)<=EPS&&
    Math.abs(row.atDistanceM-first.atDistanceM)<=EPS):[];
  return {version:V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_NEXT_VERSION,
    sourceKm:fragment.sourceKm,
    contactFragmentVersion:fragment.version,
    remainingRearRoadCount:remainingRoads.length,
    remainingFrontDropCount:remainingDrops.length,
    contactCount:contacts.length,
    firstAdditionalContact:first?{
      clockSeconds:first.clockSeconds,
      atDistanceM:first.atDistanceM,
      roadIds:simultaneous.map(row=>row.roadIds),
      riderIds:simultaneous.map(row=>row.riderIds)}:null,
    fullFieldKilometre:false,officialResults:false};
}
