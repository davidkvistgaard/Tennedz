// Enumerate observed front-drop contacts in paid road time order.
// This audit grants no shelter, group membership or finish credit.
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_AUDIT_VERSION=
  'v94-physical-front-drop-contact-audit-1';
const EPS=1e-7;
const segmentOf=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});

export function auditV94PhysicalFrontDropContactsV1(
  physicalRoads,{sourceKm}={}){
  const {roads,newFrontDrops}=physicalRoads??{};
  if(!Number.isInteger(sourceKm)||sourceKm<2||
    !Array.isArray(roads)||!Array.isArray(newFrontDrops)||
    !newFrontDrops.length||
    roads.some(road=>!road.roadId||
      !Number.isFinite(road.startClockSeconds)||
      !Number.isFinite(road.finishClockSeconds)||
      !Number.isFinite(road.startDistanceM)||
      !Number.isFinite(road.endDistanceM))||
    newFrontDrops.some(drop=>!drop.riderId||
      !Array.isArray(drop.segments)||!drop.segments.length))
    throw new Error('Front-drop contact audit needs paid roads.');
  const fromDistanceM=(sourceKm-1)*1000;
  const toDistanceM=sourceKm*1000;
  const contacts=[];
  const add=(a,b,kind,sharedOrigin=false)=>{
    const meeting=firstV94SecondPiecewiseContactV1(
      a.segments,b.segments,{sharedOrigin});
    if(!meeting)return;
    if(meeting.atDistanceM<fromDistanceM-EPS||
      meeting.atDistanceM>toDistanceM+EPS)
      throw new Error('Front-drop contact lies outside paid km.');
    contacts.push({kind,clockSeconds:meeting.clockSeconds,
      atDistanceM:meeting.atDistanceM,
      firstRoadId:a.roadId,secondRoadId:b.roadId,
      firstRiderId:a.riderId,secondRiderId:b.riderId});
  };
  for(let i=0;i<newFrontDrops.length;i++){
    const a=newFrontDrops[i];
    const first={roadId:`solo-${a.riderId}`,
      riderId:a.riderId,segments:a.segments};
    for(const road of roads)add(first,{
      roadId:road.roadId,
      riderId:road.riderDecisions?.length===1?
        road.riderDecisions[0].riderId:null,
      segments:[segmentOf(road)]},'front_drop_rear_road');
    for(let j=i+1;j<newFrontDrops.length;j++){
      const b=newFrontDrops[j];
      const sharedOrigin=Math.abs(a.origin.startClockSeconds-
        b.origin.startClockSeconds)<=EPS&&
        Math.abs(a.origin.startDistanceM-
          b.origin.startDistanceM)<=EPS;
      add(first,{roadId:`solo-${b.riderId}`,
        riderId:b.riderId,segments:b.segments},
      'front_drop_front_drop',sharedOrigin);
    }
  }
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.atDistanceM-b.atDistanceM||
    a.firstRoadId.localeCompare(b.firstRoadId)||
    a.secondRoadId.localeCompare(b.secondRoadId));
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_AUDIT_VERSION,
    sourceKm,frontDropCount:newFrontDrops.length,
    rearRoadCount:roads.length,contactCount:contacts.length,
    contacts,firstContact:contacts[0]??null,
    physicalGroupFormed:false,officialResults:false};
}
