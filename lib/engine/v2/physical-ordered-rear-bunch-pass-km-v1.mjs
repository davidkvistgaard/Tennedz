// A measured solo crossing need not change membership. When the rider
// cannot hold bunch pace, keep the independently paid solo road and
// record the choice before completing every separate road.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {probePhysicalOrderedRearContinuationBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_BUNCH_PASS_KM_VERSION=
  'v2-physical-ordered-rear-bunch-pass-km-1';
const EPS=.002;

export function advancePhysicalOrderedRearBunchPassKmV1({
  startInput,prior}){
  const source=sourcePhysicalOrderedRearBoundaryFromStateV1({
    startInput,prior});
  const {recording:boundary,tracks,bunch,next}=source;
  const probe=
    probePhysicalOrderedRearContinuationBunchContactV1({
      startInput,prior});
  const event=probe.contact;
  if(!Object.entries(boundary.firstEvent)
    .every(([key,value])=>
      isDeepStrictEqual(event[key],value))||
    event.canHold||
    !event.payable||
    !event.roadIds.includes(
      `solo-${event.riderId}`))
    throw new Error(
      'Bunch pass needs measured unholdable solo.');
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,next.sourceKm);
  if(events.length!==1||
    !isDeepStrictEqual(events[0],
      boundary.firstEvent))
    throw new Error(
      'Bunch pass has later contact to settle.');
  const km=next.sourceKm;
  const {step}=next;
  const contactDecision={riderId:event.riderId,
    goal:event.intent.action,
    effort:event.intent.effort,
    teamOrderEffort:
      event.intent.teamOrderEffort,
    committedTeamStake:
      event.intent.committedTeamStake,
    intentSource:event.intent.source,
    choice:'stay_solo_after_bunch_contact',
    reason:'cannot_hold_measured_bunch_pace',
    atDistanceM:event.atDistanceM,
    atClockSeconds:event.clockSeconds,
    energyAtContact:
      event.energyAtContact,
    holdAbility:event.holdAbility,
    leaderAbility:event.leaderAbility};
  const byBunchRow=new Map(step.riders.map(row=>[
    row.riderId,row]));
  const byDecision=new Map(step.riderDecisions
    .map(row=>[row.riderId,row]));
  const bunchStates=step.physicalGroup.riderIds
    .map(riderId=>{
      const row=byBunchRow.get(riderId);
      const decision=byDecision.get(riderId);
      if(!row||!decision||
        row.energyAfter!==
          step.energyByRider[riderId])
        throw new Error(
          'Bunch pass lacks paid bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:boundary.bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[decision]};
    });
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const rearStates=[];
  const endRearEntities=tracks.map(track=>{
    const old=oldEntities.get(track.id);
    if(!old||!isDeepStrictEqual(track.riderIds,
      old.riderIds)||
      Math.abs(track.startClock-old.clock)>EPS)
      throw new Error(
        'Bunch pass lacks recorded rear road.');
    const energyByRider={};
    for(const row of track.rows){
      const measured=track.energyAt(1000);
      const endEnergy=Array.isArray(measured)?
        measured.find(item=>item.riderId===
          row.riderId)?.energyAtContact:measured;
      if(Math.abs(row.energyBefore-
        old.energyByRider[row.riderId])>EPS||
        !Number.isFinite(endEnergy)||
        Math.abs(endEnergy-row.energyAfter)>EPS)
        throw new Error(
          'Bunch pass breaks paid rear energy.');
      energyByRider[row.riderId]=row.energyAfter;
      rearStates.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:row.riderId===event.riderId?
          [row.decision,contactDecision]:
          [row.decision]});
    }
    if(track.kind==='group'&&(
      track.rows.filter(row=>
        row.role==='leader').length!==1||
      track.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Bunch pass lacks one paid leader.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider,
      ...(track.kind==='group'?{
        rotationIndex:(old.rotationIndex+1)%
          track.riderIds.length,
        formedKm:old.formedKm}:{})};
  });
  const byId=new Map([...bunchStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    bunchStates.length+rearStates.length!==
      prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId)))
    throw new Error(
      'Bunch pass lacks full paid field.');
  return {version:
    PHYSICAL_ORDERED_REAR_BUNCH_PASS_KM_VERSION,
  sourceKm:km,sources:{boundary,probe},
  contactDecision,
  riderStates:prior.riderStates.map(row=>
    byId.get(row.riderId)),
  endBunchState:{
    riderIds:[...step.physicalGroup.riderIds],
    energyByRider:step.energyByRider,
    quietKmByRider:step.quietKmByRider},
  endRearEntities,riderCount:byId.size,
  physicalGroups:[step.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalOrderedRearBunchPassKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalOrderedRearBunchPassKmV1(input)))
    throw new Error(
      'Bunch pass differs from paid source.');
  return true;
}
