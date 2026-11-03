// Finish a split kilometre only when every independently paid rear road
// and every new solo road has no measured contact with another road.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearLossBoundaryV1} from
  './physical-ordered-rear-loss-boundary-v1.mjs';
import {measurePhysicalOrderedRearSoloBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';

export const PHYSICAL_ORDERED_REAR_LOSS_KM_VERSION=
  'v2-physical-ordered-rear-loss-km-1';
const EPS=.002;

export function advancePhysicalOrderedRearLossKmV1({
  startInput,prior}){
  const source=sourcePhysicalOrderedRearLossBoundaryV1({
    startInput,prior});
  const {recording,losses,tracks}=source;
  const {next}=losses.sources;
  const {step}=next;
  const km=losses.sourceKm;
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  let passage=null;
  if(recording.firstEvent){
    const event=recording.firstEvent;
    const roadId=event.roadIds.find(id=>
      id!=='peloton');
    const solo=tracks.find(track=>
      track.id===roadId);
    if(recording.candidateEventCount!==1||
      !event.involvesBunch||
      !oldEntities.has(roadId)||
      solo?.kind!=='solo'||
      !solo.rows)
      throw new Error(
        'Split kilometre needs ordered contact choice.');
    const contact=
      measurePhysicalOrderedRearSoloBunchContactV1({
        startInput,next,event,solo});
    if(contact.canHold&&contact.payable&&
      contact.reserveOkay&&
      contact.shelterCheaper)
      throw new Error(
        'Split kilometre needs paid bunch join.');
    const reason=!contact.canHold?
      'cannot_hold_measured_bunch_pace':
      !contact.payable?
        'cannot_pay_bunch_shelter':
        !contact.reserveOkay?
          'protect_committed_stage_reserve':
          'bunch_shelter_not_cheaper';
    passage={contact,
      decision:{riderId:contact.riderId,
        goal:contact.intent.action,
        effort:contact.intent.effort,
        teamOrderEffort:
          contact.intent.teamOrderEffort,
        committedTeamStake:
          contact.intent.committedTeamStake,
        intentSource:contact.intent.source,
        choice:'stay_solo_after_bunch_contact',
        reason,
        atDistanceM:event.atDistanceM,
        atClockSeconds:event.clockSeconds,
        energyAtContact:
          contact.energyAtContact,
        holdAbility:contact.holdAbility,
        leaderAbility:
          contact.leaderAbility}};
  }else if(recording.candidateEventCount!==0)
    throw new Error(
      'Split kilometre needs ordered contact choice.');
  const completions=new Map(losses.completions
    .map(row=>[row.riderId,row]));
  const byDecision=new Map(step.riderDecisions
    .map(row=>[row.riderId,row]));
  const byBunchRow=new Map(step.riders
    .map(row=>[row.riderId,row]));
  const bunchStates=step.physicalGroup.riderIds
    .map(riderId=>{
      const row=byBunchRow.get(riderId);
      const decision=byDecision.get(riderId);
      if(!row||!decision||
        row.energyAfter!==
          step.energyByRider[riderId])
        throw new Error(
          'Split kilometre lacks paid bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:losses.bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[decision]};
    });
  const rearStates=[];
  const endRearEntities=tracks.map(track=>{
    const old=oldEntities.get(track.id);
    if(old){
      if(!isDeepStrictEqual(track.riderIds,
        old.riderIds)||
        Math.abs(track.startClock-old.clock)>EPS)
        throw new Error(
          'Split kilometre lacks prior rear road.');
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
            'Split kilometre breaks rear energy.');
        energyByRider[row.riderId]=row.energyAfter;
        const contact=passage?.contact
          .riderId===row.riderId?
          passage.contact:null;
        if(contact&&(
          track.kind!=='solo'||
          Math.abs(row.energyBefore-
            contact.soloEnergyBefore)>EPS||
          Math.abs(row.energyBefore-
            contact.soloEnergySpentToContact-
            contact.energyAtContact)>EPS||
          contact.energyAtContact<
            row.energyAfter-EPS))
          throw new Error(
            'Split kilometre breaks paid solo passage.');
        const decisions=contact?[
          {...row.decision,
            fromDistanceM:(km-1)*1000,
            toDistanceM:contact.atDistanceM,
            energyBefore:row.energyBefore,
            energySpent:
              contact.soloEnergySpentToContact,
            energyAfter:
              contact.energyAtContact},
          passage.decision,
          {...row.decision,
            fromDistanceM:contact.atDistanceM,
            toDistanceM:km*1000,
            energyBefore:
              contact.energyAtContact,
            energySpent:
              contact.energyAtContact-
                row.energyAfter,
            energyAfter:row.energyAfter}]:
          [row.decision];
        rearStates.push({riderId:row.riderId,
          sourceKm:km,
          physicalGroupId:track.id,
          atDistanceM:km*1000,
          elapsedSeconds:track.endClock,
          energyAfter:row.energyAfter,
          decisions});
      }
      const leaders=track.rows.filter(row=>
        row.role==='leader');
      if(track.kind==='group'&&(
        leaders.length!==1||
        track.rows.some(row=>
          row.role==='sheltered'&&
            row.draftFraction>=1)))
        throw new Error(
          'Split kilometre lacks one paid leader.');
      return {id:track.id,kind:track.kind,
        riderIds:[...track.riderIds],
        atDistanceM:km*1000,
        clock:track.endClock,
        energyByRider,
        ...(track.kind==='group'?{
          rotationIndex:(old.rotationIndex+1)%
            track.riderIds.length,
          formedKm:old.formedKm}:{})};
    }
    const riderId=track.riderIds[0];
    const completion=completions.get(riderId);
    const partial=byBunchRow.get(riderId);
    const split=step.splits.find(row=>
      row.riderId===riderId);
    if(track.kind!=='solo'||
      track.id!==`solo-${riderId}`||
      track.riderIds.length!==1||
      !completion||!partial||!split||
      Math.abs(track.clockAt(1000)-
        completion.elapsedSeconds)>EPS||
      Math.abs(track.energyAt(1000)-
        (completion.energyBefore-
          completion.energySpent))>EPS||
      completion.startDistanceM!==
        split.atDistanceM||
      completion.totalKmEnergySpent!==
        partial.energySpent+
          completion.energySpent)
      throw new Error(
        'Split kilometre lacks paid new solo road.');
    rearStates.push({riderId,sourceKm:km,
      physicalGroupId:track.id,
      atDistanceM:km*1000,
      elapsedSeconds:completion.elapsedSeconds,
      energyAfter:completion.energyAfter,
      decisions:[completion.decision]});
    return {id:track.id,kind:'solo',
      riderIds:[riderId],
      atDistanceM:km*1000,
      clock:completion.elapsedSeconds,
      energyByRider:{[riderId]:
        completion.energyAfter}};
  });
  const byId=new Map([...bunchStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    bunchStates.length+rearStates.length!==
      prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId))||
    completions.size!==step.splits.length)
    throw new Error(
      'Split kilometre lacks full paid field.');
  return {version:
    PHYSICAL_ORDERED_REAR_LOSS_KM_VERSION,
  sourceKm:km,sources:{boundary:recording,
    losses,
    ...(passage?{passage:passage.decision}:{})},
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

export function validatePhysicalOrderedRearLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalOrderedRearLossKmV1(input)))
    throw new Error(
      'Split kilometre differs from paid source.');
  return true;
}
