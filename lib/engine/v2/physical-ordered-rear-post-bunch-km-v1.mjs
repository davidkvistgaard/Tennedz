// Complete a kilometre with a paid solo-to-bunch join followed by an
// ordered series of rear joins. Every affected rider keeps each paid
// approach, contact choice and final group or solo road in their trace.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearPostBunchChainV1} from
  './physical-ordered-rear-post-bunch-chain-v1.mjs';

export const PHYSICAL_ORDERED_REAR_POST_BUNCH_KM_VERSION=
  'v2-physical-ordered-rear-post-bunch-km-1';
const EPS=.002;

export function advancePhysicalOrderedRearPostBunchKmV1({
  startInput,prior}){
  const source=sourcePhysicalOrderedRearPostBunchChainV1({
    startInput,prior});
  const {recording:chain,tracks,joined,next}=source;
  if(chain.firstUnsettledEvent||
    chain.contacts.some(contact=>
      !contact.membershipChanged||
      contact.choice.outcome!=='join'))
    throw new Error(
      'Post-bunch kilometre needs settled rear joins.');
  const km=next.sourceKm;
  const joinedId=joined.joinDecision.riderId;
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const ledger=new Map(prior.riderStates
    .filter(row=>row.physicalGroupId!==
      'peloton'&&row.riderId!==joinedId)
    .map(row=>[row.riderId,{
      energyAfter:row.energyAfter,
      coveredM:0,decisions:[]}]));
  for(const contact of chain.contacts){
    const metres=contact.event.metresIntoKm;
    const byChoice=new Map(contact.choice
      .riderDecisions.map(row=>[
        row.riderId,row]));
    if(byChoice.size!==
      contact.paidApproaches.length)
      throw new Error(
        'Post-bunch kilometre loses contact choice.');
    for(const approach of contact.paidApproaches){
      const row=ledger.get(approach.riderId);
      const decision=byChoice.get(
        approach.riderId);
      if(!row||!decision||
        metres<=row.coveredM||
        Math.abs(row.energyAfter-
          approach.energyBefore)>EPS||
        approach.energyAtContact>
          approach.energyBefore+EPS)
        throw new Error(
          'Post-bunch kilometre breaks paid approach.');
      row.decisions.push({
        ...approach.decision,
        fromDistanceM:(km-1)*1000+
          row.coveredM,
        toDistanceM:contact.event.atDistanceM,
        energyBefore:row.energyAfter,
        energySpent:row.energyAfter-
          approach.energyAtContact,
        energyAfter:
          approach.energyAtContact});
      row.decisions.push({...decision,
        atDistanceM:contact.event.atDistanceM,
        atClockSeconds:
          contact.event.clockSeconds,
        energyAtContact:
          approach.energyAtContact});
      row.energyAfter=approach.energyAtContact;
      row.coveredM=metres;
    }
  }
  const rearStates=[];
  const endRearEntities=tracks.map(track=>{
    const old=oldEntities.get(track.id);
    if(old&&(!isDeepStrictEqual(
      track.riderIds,old.riderIds)||
      Math.abs(track.startClock-old.clock)>EPS))
      throw new Error(
        'Post-bunch kilometre breaks prior road.');
    const energyByRider={};
    for(const part of track.rows){
      const row=ledger.get(part.riderId);
      const measured=track.energyAt(1000);
      const endEnergy=Array.isArray(measured)?
        measured.find(item=>item.riderId===
          part.riderId)?.energyAtContact:measured;
      if(!row||
        Math.abs(row.energyAfter-
          part.energyBefore)>EPS||
        row.coveredM>1000-EPS||
        !Number.isFinite(endEnergy)||
        Math.abs(endEnergy-
          part.energyAfter)>EPS)
        throw new Error(
          'Post-bunch kilometre breaks final energy.');
      row.decisions.push({...part.decision,
        fromDistanceM:(km-1)*1000+
          row.coveredM,
        toDistanceM:km*1000,
        energyBefore:part.energyBefore,
        energySpent:part.energySpent,
        energyAfter:part.energyAfter});
      row.energyAfter=part.energyAfter;
      row.coveredM=1000;
      energyByRider[part.riderId]=
        part.energyAfter;
      rearStates.push({riderId:part.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:part.energyAfter,
        decisions:row.decisions});
    }
    if(track.kind==='group'&&(
      track.rows.filter(row=>
        row.role==='leader').length!==1||
      track.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Post-bunch kilometre lacks one paid leader.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider,
      ...(track.kind==='group'?{
        rotationIndex:old?
          (old.rotationIndex+1)%
            track.riderIds.length:0,
        formedKm:old?.formedKm??km}:{})};
  });
  if([...ledger.values()].some(row=>
    row.coveredM!==1000))
    throw new Error(
      'Post-bunch kilometre leaves rear road unpaid.');
  const byId=new Map([
    ...joined.riderStates,...rearStates]
    .map(row=>[row.riderId,row]));
  if(byId.size!==prior.riderCount||
    joined.riderStates.length+
      rearStates.length!==prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId)))
    throw new Error(
      'Post-bunch kilometre lacks full paid field.');
  return {version:
    PHYSICAL_ORDERED_REAR_POST_BUNCH_KM_VERSION,
  sourceKm:km,sources:{chain},
  riderStates:prior.riderStates.map(row=>
    byId.get(row.riderId)),
  endBunchState:joined.nextBunchState,
  endRearEntities,riderCount:byId.size,
  physicalGroups:[joined.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalOrderedRearPostBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalOrderedRearPostBunchKmV1(input)))
    throw new Error(
      'Post-bunch kilometre differs from paid source.');
  return true;
}
