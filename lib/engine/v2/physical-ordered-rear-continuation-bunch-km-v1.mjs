// Complete one solo-to-bunch contact kilometre only after all other
// rear roads pay through its end without a later measured meeting.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalOrderedRearContinuationBunchJoinV1} from
  './physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_KM_VERSION=
  'v2-physical-ordered-rear-continuation-bunch-km-1';
const EPS=.002;

export function replayPhysicalOrderedRearContinuationBunchKmV1({
  startInput,prior}){
  const joined=
    finishPhysicalOrderedRearContinuationBunchJoinV1({
      startInput,prior});
  const {recording:boundary,tracks,bunch,next}=
    sourcePhysicalOrderedRearBoundaryFromStateV1({
      startInput,prior});
  const event=boundary.firstEvent;
  const riderId=joined.joinDecision.riderId;
  const soloId=`solo-${riderId}`;
  if(!event?.involvesBunch||
    !event.roadIds.includes(soloId)||
    !event.roadIds.includes('peloton')||
    Math.abs(joined.contactAtDistanceM-
      event.atDistanceM)>EPS)
    throw new Error(
      'Rear bunch km lacks same paid contact.');
  const remaining=tracks.filter(track=>
    track.id!==soloId);
  if(findPhysicalOrderedBoundaryEventsV1(
    remaining,bunch,next.sourceKm).length)
    throw new Error(
      'Rear bunch km needs later contact choice.');
  const km=next.sourceKm;
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const rearStates=[];
  const endRearEntities=remaining.map(track=>{
    const old=oldEntities.get(track.id);
    if(!old||!isDeepStrictEqual(
      old.riderIds,track.riderIds)||
      Math.abs(old.clock-track.startClock)>EPS)
      throw new Error(
        'Rear bunch km lacks paid rear source.');
    for(const row of track.rows){
      if(Math.abs(row.energyBefore-
        old.energyByRider[row.riderId])>EPS)
        throw new Error(
          'Rear bunch km breaks energy.');
      rearStates.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]});
    }
    if(track.kind==='group'&&(
      track.rows.filter(row=>
        row.role==='leader').length!==1||
      track.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Rear bunch km lacks one paid leader.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:(old.rotationIndex+1)%
          track.riderIds.length,
        formedKm:old.formedKm}:{})};
  });
  const byId=new Map([...joined.riderStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    joined.riderStates.length+
      rearStates.length!==prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId)))
    throw new Error(
      'Rear bunch km lacks full field.');
  return {version:
    PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_KM_VERSION,
  sourceKm:km,
  sources:{joined,boundary},
  riderStates:prior.riderStates.map(row=>
    byId.get(row.riderId)),
  endBunchState:joined.nextBunchState,
  endRearEntities,
  riderCount:byId.size,
  physicalGroups:[joined.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearContinuationBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearContinuationBunchKmV1(
      input)))
    throw new Error(
      'Rear bunch km differs from paid source.');
  return true;
}
