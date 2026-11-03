// Assemble a full field only after the ordered event sequence pays
// each contact and has no remaining group-bunch boundary. Each rider
// keeps the paid approach, choice and remainder for this kilometre.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearEventSequenceV1} from
  './physical-ordered-rear-event-sequence-v1.mjs';

export const PHYSICAL_ORDERED_REAR_EVENT_KM_VERSION=
  'v2-physical-ordered-rear-event-km-1';
const EPS=.002;

export function advancePhysicalOrderedRearEventKmV1({
  startInput,prior}){
  const {recording:sequence,tracks,next}=
    sourcePhysicalOrderedRearEventSequenceV1({
      startInput,prior});
  if(sequence.firstUnsettledEvent||
    sequence.contacts.some(row=>
      row.outcome!=='join'))
    throw new Error(
      'Ordered event km needs settled paid contacts.');
  const km=next.sourceKm;
  const bunchEndClock=next.bunchStartClock+
    next.step.elapsedSeconds;
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const ledger=new Map(prior.riderStates
    .filter(row=>row.physicalGroupId!==
      'peloton')
    .map(row=>[row.riderId,{
      energyAfter:row.energyAfter,
      coveredM:0,decisions:[]}]));
  const joinedStates=new Map();
  for(const contact of sequence.contacts){
    const metres=contact.event.metresIntoKm;
    if(contact.kind==='solo_bunch'){
      const riderId=contact.joinDecision.riderId;
      const row=ledger.get(riderId);
      if(!row||joinedStates.has(riderId)||
        metres<=row.coveredM||
        Math.abs(row.energyAfter-
          contact.soloEnergyBefore)>EPS||
        contact.soloEnergyAtContact>
          row.energyAfter+EPS)
        throw new Error(
          'Ordered event km breaks solo bunch approach.');
      const approach={...contact.soloDecision,
        fromDistanceM:(km-1)*1000+
          row.coveredM,
        toDistanceM:contact.event.atDistanceM,
        energyBefore:row.energyAfter,
        energySpent:
          contact.soloEnergySpentToContact,
        energyAfter:
          contact.soloEnergyAtContact};
      joinedStates.set(riderId,{
        riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:contact.energyAfter,
        decisions:[approach,
          contact.joinDecision]});
      ledger.delete(riderId);
      continue;
    }
    if(contact.kind!=='rear_rear'||
      !contact.paidApproaches||
      !contact.choice?.riderDecisions)
      throw new Error(
        'Ordered event km lacks rear choice.');
    const byChoice=new Map(contact.choice
      .riderDecisions.map(row=>[
        row.riderId,row]));
    if(byChoice.size!==
      contact.paidApproaches.length)
      throw new Error(
        'Ordered event km loses contact rider.');
    for(const approach of contact.paidApproaches){
      const row=ledger.get(approach.riderId);
      const decision=byChoice.get(
        approach.riderId);
      if(!row||!decision||
        metres<=row.coveredM||
        Math.abs(row.energyAfter-
          approach.energyBefore)>EPS||
        approach.energyAtContact>
          row.energyAfter+EPS)
        throw new Error(
          'Ordered event km breaks paid rear approach.');
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
        'Ordered event km breaks prior road.');
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
          'Ordered event km breaks final energy.');
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
        'Ordered event km lacks one paid group leader.');
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
      'Ordered event km leaves rear road unpaid.');
  const byBunchDecision=new Map(next.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=next.step.physicalGroup
    .riderIds.map(riderId=>{
      const row=next.step.riders.find(item=>
        item.riderId===riderId);
      const decision=byBunchDecision.get(
        riderId);
      if(!row||!decision||
        row.energyAfter!==next.step
          .energyByRider[riderId])
        throw new Error(
          'Ordered event km lacks paid bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[decision]};
    });
  bunchStates.push(...joinedStates.values());
  const byId=new Map([...bunchStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    bunchStates.length+rearStates.length!==
      prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId))||
    !isDeepStrictEqual(bunchStates.map(row=>
      row.riderId),sequence.endBunchRiderIds))
    throw new Error(
      'Ordered event km lacks full paid field.');
  const energyByRider={...next.step.energyByRider};
  const quietKmByRider={...next.step
    .quietKmByRider};
  for(const row of joinedStates.values()){
    energyByRider[row.riderId]=
      row.energyAfter;
    quietKmByRider[row.riderId]=0;
  }
  return {version:
    PHYSICAL_ORDERED_REAR_EVENT_KM_VERSION,
  sourceKm:km,sources:{sequence},
  riderStates:prior.riderStates.map(row=>
    byId.get(row.riderId)),
  endBunchState:{
    riderIds:[...sequence.endBunchRiderIds],
    energyByRider,quietKmByRider},
  endRearEntities,riderCount:byId.size,
  physicalGroups:[{
    id:'peloton',
    riderIds:[...sequence.endBunchRiderIds],
    atDistanceM:km*1000},
  ...endRearEntities.map(entity=>({
    id:entity.id,riderIds:entity.riderIds,
    atDistanceM:km*1000}))],
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalOrderedRearEventKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalOrderedRearEventKmV1(input)))
    throw new Error(
      'Ordered event km differs from paid source.');
  return true;
}
