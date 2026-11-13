// Advance a caught break rider and a later dropped follower from their
// recorded split. Their rear group forms only at a measured paid meeting.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalEarlyCaughtFollowerLossV1} from
  './physical-early-caught-follower-loss-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalSlidBreakSoloKmV1} from
  './physical-slid-break-solo-run-v1.mjs';
import {findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_EARLY_CAUGHT_NEXT_REAR_KM_VERSION=
  'v2-physical-early-caught-next-rear-km-1';
const EPS=1e-7;
const effortRank={conserve:0,steady:1,hard:2};

function droppedSolo(startInput,completion,segment,
  bunchClock){
  const riderId=completion.riderId;
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team?.riders.find(row=>row.id===riderId);
  const plan=startInput.soloCommitments?.find(row=>
    row.riderId===riderId);
  const intent=plan?rearSoloPlanAtKmV1({
    commitment:plan,km:segment.km}):
    {action:'finish_safely',effort:'conserve'};
  const order=orderAt(team?.orders,segment.km-1);
  if(!rider||!order||
    effortRank[intent.effort]>
      effortRank[order.effort])
    throw new Error('Caught rear solo exceeds paid order.');
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:completion.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[intent.effort]-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Caught rear solo needs paid pace.');
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:completion.energyAfter,
    effort:intent.effort,role:'solo',distanceM:1000});
  const recovery=recoveryForKilometre({rider,segment,
    effort:intent.effort,group:'solo',working:true,
    quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Caught rear solo cannot claim recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:segment.km}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(intent.action==='save_for_stage'&&
    energyAfter<intent.committedStagePlan
      .reserveEnergy)
    throw new Error('Caught rear solo breaks stage reserve.');
  const elapsedSeconds=completion.elapsedSeconds+
    seconds;
  if(elapsedSeconds<=bunchClock)
    throw new Error('Caught rear solo needs paid bunch contact.');
  return {sourceKm:segment.km,riderId,
    decision:{riderId,goal:intent.action,
      effort:intent.effort,
      teamOrderEffort:order.effort,
      choice:'ride_solo',reason:plan?
        'committed_detached_solo_plan':
        'cannot_hold_paid_front_pace'},
    seconds,elapsedSeconds,
    energyBefore:completion.energyAfter,
    energySpent:paid.energyDemand,
    recoveryAward:0,cap,energyAfter};
}

function soloTrack(step,priorClock){
  return {riderId:step.riderId,
    riderIds:[step.riderId],breaks:[],
    clockAt:metres=>priorClock+
      step.seconds*metres/1000,
    energyAt:metres=>step.energyBefore-
      step.energySpent*metres/1000};
}

function firstBunchMeeting(tracks,bunch){
  return tracks.map(track=>
    findFirstPaidRoadClockMeetingV1(
      track,bunch,bunch.sourceKm))
    .filter(Boolean).sort((a,b)=>
      a.clockSeconds-b.clockSeconds)[0]??null;
}

function state(row,km,groupId,clock,energy,
  decisions){
  return {riderId:row,sourceKm:km,
    physicalGroupId:groupId,
    atDistanceM:km*1000,
    elapsedSeconds:clock,energyAfter:energy,
    decisions};
}

export function replayPhysicalEarlyCaughtNextRearKmV1(input){
  const {startInput,start,lossKm}=input;
  const partial=replayPhysicalEarlyCaughtFollowerLossV1(
    input);
  if(partial.sources.contact||
    !partial.sources.caughtStep||
    lossKm>=startInput.routeKilometres.length)
    throw new Error('Caught rear next km needs separate paid solos.');
  const km=lossKm+1;
  const segment=startInput.routeKilometres[km-1];
  const loss=partial.sources.loss;
  const previous=partial.kilometres.at(-1);
  const priorBunchClock=previous.riderStates.find(row=>
    row.physicalGroupId==='peloton')?.elapsedSeconds;
  if(!Number.isFinite(priorBunchClock))
    throw new Error('Caught rear next km lacks bunch clock.');
  const prior={riderIds:loss.physicalGroup.riderIds,
    energyByRider:loss.energyByRider,
    quietKmByRider:loss.quietKmByRider};
  const bunch=advancePhysicalBunchAfterPostcatchLossKmV1({
    startInput,prior,segment,
    caughtRiderId:partial.sources.priorRace
      .sources.slide.riderId,
    detachedRiderIds:loss.splits.map(row=>
      row.riderId)});
  const bunchClock=priorBunchClock+
    bunch.elapsedSeconds;
  const caught=advancePhysicalSlidBreakSoloKmV1({
    startInput,slideRecord:partial.sources.priorRace
      .sources.slide,
    priorStep:partial.sources.caughtStep,
    segment,bunchStep:bunch,
    priorBunchElapsedSeconds:priorBunchClock});
  const dropped=droppedSolo(startInput,
    partial.sources.completion,segment,bunchClock);
  const tracks=[soloTrack(caught,
    partial.sources.caughtStep.elapsedSeconds),
  soloTrack(dropped,
    partial.sources.completion.elapsedSeconds)];
  const bunchTrack={riderId:'peloton',sourceKm:km,
    breaks:[],clockAt:metres=>
      priorBunchClock+bunch.elapsedSeconds*
        metres/1000};
  const meeting=findFirstPaidRoadClockMeetingV1(
    tracks[0],tracks[1],km);
  const bunchMeeting=firstBunchMeeting(
    tracks,bunchTrack);
  if(bunchMeeting&&(!meeting||
    bunchMeeting.clockSeconds<=
      meeting.clockSeconds+EPS))
    throw new Error('Caught rear next km needs paid bunch return.');
  let contact=null;
  let group=null;
  if(meeting){
    if(meeting.catchingRiderId===null||
      meeting.metresIntoKm>=1000-EPS)
      throw new Error('Caught rear contact lacks ordered road.');
    const metres=meeting.metresIntoKm;
    const riderIds=tracks.map(row=>row.riderId);
    const energyByRider=Object.fromEntries(
      tracks.map(row=>[row.riderId,
        +row.energyAt(metres).toFixed(6)]));
    const observedSecondsPerKmByRoad=
      Object.fromEntries(tracks.map(row=>[
        row.riderId,row.clockAt(1000)-
          row.clockAt(0)]));
    const choiceInput={startInput,km,
      roadIds:riderIds,
      riderIdsByRoad:Object.fromEntries(
        riderIds.map(id=>[id,[id]])),
      catchingRoadId:meeting.catchingRiderId,
      observedSecondsPerKmByRoad,
      leaderRiderId:meeting.catchingRiderId};
    let choice=decidePhysicalRearContactV1(
      choiceInput);
    if(choice.outcome==='pass_through'&&
      bunchMeeting)
      throw new Error('Caught rear pass needs paid bunch return.');
    if(choice.outcome==='join'){
      const groupId=`rear-event-${
        [...riderIds].sort().join('-')}`;
      group=pricePhysicalRearEventTrackV1({
        startInput,riderIds,energyByRider,km,
        startM:metres,
        startClock:meeting.clockSeconds,
        contactLeaderRiderId:
          meeting.catchingRiderId,groupId});
      choice=decidePhysicalRearContactV1({
        ...choiceInput,
        leaderRiderId:group.leaderRiderId});
      if(choice.outcome!=='join')
        throw new Error('Caught rear choice changed after payment.');
      const groupMeeting=
        findFirstPaidRoadClockMeetingV1({
          ...group,riderId:groupId},
        bunchTrack,km);
      if(groupMeeting&&
        groupMeeting.metresIntoKm>metres+EPS)
        throw new Error('Caught rear group needs paid bunch return.');
    }
    contact={sourceKm:km,
      atDistanceM:(km-1)*1000+metres,
      clockSeconds:meeting.clockSeconds,
      catchingRiderId:meeting.catchingRiderId,
      riders:riderIds.map(riderId=>({riderId,
        energyAtContact:energyByRider[riderId]})),
      outcome:choice.outcome,
      contactDecisions:choice.riderDecisions};
  }
  const decisions=new Map(bunch.riderDecisions
    .map(row=>[row.riderId,row]));
  const states=bunch.physicalGroup.riderIds.map(
    riderId=>{
      const row=bunch.riders.find(item=>
        item.riderId===riderId);
      return state(riderId,km,'peloton',
        bunchClock,row.energyAfter,
        [decisions.get(riderId)]);
    });
  for(const step of [caught,dropped]){
    const groupRow=group?.rows.find(row=>
      row.riderId===step.riderId);
    states.push(state(step.riderId,km,
      group?group.groupId:
        `solo-${step.riderId}`,
      group?group.endClock:
        step.elapsedSeconds,
      group?groupRow.energyAfter:
        step.energyAfter,
      [step.decision,...(contact?[contact
        .contactDecisions.find(row=>
          row.riderId===step.riderId)]:[]),
      ...(group?[groupRow.decision]:[])]));
  }
  if(states.length!==start.riderIds.length||
    new Set(states.map(row=>row.riderId))
      .size!==start.riderIds.length||
    states.some(row=>row.decisions.some(
      decision=>!decision)||
      !Number.isFinite(row.energyAfter)||
      !Number.isFinite(row.elapsedSeconds)||
      row.energyAfter<0))
    throw new Error('Caught rear next km lacks rider road.');
  const riderStates=states.sort((a,b)=>
    start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
  const rearSegments=tracks.flatMap((track,index)=>{
    const step=index===0?caught:dropped;
    const priorClock=track.clockAt(0);
    const endM=group?contact.atDistanceM-
      (km-1)*1000:1000;
    const after=group?
      contact.riders.find(row=>row.riderId===
        step.riderId).energyAtContact:
      step.energyAfter;
    const solo={riderId:step.riderId,
      role:'solo',startDistanceM:(km-1)*1000,
      endDistanceM:(km-1)*1000+endM,
      startClock:priorClock,
      endClock:group?contact.clockSeconds:
        step.elapsedSeconds,
      energyBefore:step.energyBefore,
      energyAfter:after,
      energySpent:+(step.energyBefore-after)
        .toFixed(6)};
    if(!group)return [solo];
    const row=group.rows.find(item=>
      item.riderId===step.riderId);
    if(Math.abs(row.energyBefore-
      solo.energyAfter)>1e-6||
      Math.abs(group.startClock-
        solo.endClock)>EPS)
      throw new Error('Caught rear contact breaks paid continuity.');
    return [solo,{riderId:step.riderId,
      role:row.role,
      startDistanceM:contact.atDistanceM,
      endDistanceM:km*1000,
      startClock:group.startClock,
      endClock:group.endClock,
      energyBefore:row.energyBefore,
      energyAfter:row.energyAfter,
      energySpent:row.energySpent,
      draftFraction:row.draftFraction}];
  });
  const recordedGroup=group&&Object.fromEntries(
    Object.entries(group).filter(([key])=>
      key!=='clockAt'&&key!=='energyAt'));
  return {version:
    PHYSICAL_EARLY_CAUGHT_NEXT_REAR_KM_VERSION,
  sourceKm:km,riderIds:[...start.riderIds],
  kilometres:[...partial.kilometres,
    {sourceKm:km,riderStates}],
  sources:{partial,bunch,caught,dropped,
    rearSegments,
    ...(contact?{contact}:{}),
    ...(recordedGroup?{group:recordedGroup}:{})},
  laterContactUnsettled:true,
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalEarlyCaughtNextRearKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalEarlyCaughtNextRearKmV1(input)))
    throw new Error('Caught rear next km differs from paid source.');
  return true;
}
