// Experimental event-ordered rear road. A detached rider first pays
// the existing solo source; only a measured clock crossing joins roads.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {probePhysicalStaggeredSoloFieldV1} from
  './physical-staggered-detached-solo-v1.mjs';
import {staggeredSoloTrajectoryV1,
  findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';

export const PHYSICAL_STAGGERED_REAR_EVENT_REPLAY_VERSION=
  'v2-physical-staggered-rear-event-replay-1';
const EPS=1e-7;

function soloTrack(entity,solo,step,bunchPriorSeconds){
  const km=step.sourceKm;
  const paid=staggeredSoloTrajectoryV1(solo,km,
    bunchPriorSeconds,step);
  if(!paid)return null;
  const split=km===solo.lossKm?
    step.splits.find(row=>
      row.riderId===entity.riderIds[0]):null;
  const domainStartM=split?
    split.atDistanceM-(km-1)*1000:0;
  const sourceRow=km===solo.lossKm?
    solo.completion:solo.steps.find(row=>
      row.sourceKm===km);
  if(!sourceRow||!Number.isFinite(domainStartM)||
    domainStartM<0||domainStartM>=1000)
    throw new Error('Rear event solo lacks paid source.');
  return {...paid,id:entity.id,
    riderId:entity.id,
    kind:'solo',riderIds:[...entity.riderIds],
    domainStartM,sourceRow,
    leaderRiderId:entity.riderIds[0]};
}

function groupTrack(entity,km,startInput){
  const track=pricePhysicalRearEventTrackV1({
    startInput,riderIds:entity.riderIds,
    energyByRider:entity.energyByRider,
    km,startM:0,startClock:entity.clock,
    rotationIndex:entity.rotationIndex,
    groupId:entity.id});
  return {...track,id:entity.id,kind:'group'};
}

function energyAt(track,metres){
  const energy=track.energyAt(metres);
  const rows=Array.isArray(energy)?energy:[{
    riderId:track.riderIds[0],
    energyAtContact:energy}];
  if(rows.length!==track.riderIds.length||
    rows.some(row=>!Number.isFinite(
      row.energyAtContact)||
      row.energyAtContact<0))
    throw new Error('Rear event lacks paid contact energy.');
  return rows.map(row=>({riderId:row.riderId,
    energyAtContact:+row.energyAtContact.toFixed(6)}));
}

function pairKey(a,b){
  return [a,b].sort().join('|');
}

function observedSecondsPerKm(track,metres){
  const before=Math.max(track.domainStartM,
    metres-.1);
  const after=Math.min(1000,metres+.1);
  if(after-before<=EPS)
    throw new Error('Rear contact lacks observed pace.');
  return (track.clockAt(after)-
    track.clockAt(before))*1000/(after-before);
}

function firstEvent(tracks,km,ignored){
  const roads=[...tracks.values()];
  let first=null;
  for(let left=0;left<roads.length;left++)
    for(let right=left+1;right<roads.length;
      right++){
      const a=roads[left];
      const b=roads[right];
      if(ignored.has(pairKey(a.id,b.id)))continue;
      const meeting=findFirstPaidRoadClockMeetingV1(
        a,b,km);
      if(!meeting)continue;
      const event={sourceKm:km,
        metresIntoKm:meeting.metresIntoKm,
        atDistanceM:(km-1)*1000+
          meeting.metresIntoKm,
        clockSeconds:meeting.clockSeconds,
        roadIds:[a.id,b.id],
        catchingRoadId:meeting.catchingRiderId,
        riders:[...energyAt(a,
          meeting.metresIntoKm),
        ...energyAt(b,meeting.metresIntoKm)]};
      if(!first||event.clockSeconds<
        first.clockSeconds-EPS||
        Math.abs(event.clockSeconds-
          first.clockSeconds)<=EPS&&
        event.atDistanceM<first.atDistanceM)
        first=event;
    }
  return first;
}

function firstBunchContact(tracks,step,
  bunchPriorSeconds){
  const bunch={riderId:'peloton',
    domainStartM:0,breaks:[],
    clockAt:metres=>bunchPriorSeconds+
      step.elapsedSeconds*metres/1000};
  let first=null;
  for(const track of tracks.values()){
    const meeting=findFirstPaidRoadClockMeetingV1(
      track,bunch,step.sourceKm);
    if(meeting&&(!first||
      meeting.clockSeconds<first.clockSeconds))
      first={...meeting,roadId:track.id};
  }
  return first;
}

function segmentRecord(track,endM){
  const distanceM=endM-track.domainStartM;
  if(distanceM<=EPS)
    return null;
  const startClock=track.clockAt(
    track.domainStartM);
  const endClock=track.clockAt(endM);
  const startEnergy=energyAt(track,
    track.domainStartM);
  const endEnergy=energyAt(track,endM);
  const riders=track.riderIds.map(riderId=>{
    const before=startEnergy.find(row=>
      row.riderId===riderId).energyAtContact;
    const after=endEnergy.find(row=>
      row.riderId===riderId).energyAtContact;
    const row=track.kind==='group'?
      track.rows.find(item=>
        item.riderId===riderId):null;
    return {riderId,role:row?.role??'solo',
      decision:row?.decision??
        track.sourceRow.decision??
        track.sourceRow.soloDecision,
      ...(row?{draftFraction:row.draftFraction}:{}),
      energyBefore:before,
      energySpent:+(before-after).toFixed(6),
      energyAfter:after,
      recoveryAward:0};
  });
  return {sourceKm:track.kind==='group'?
    track.km:track.sourceRow.sourceKm,
  roadId:track.id,kind:track.kind,
  startDistanceM:((track.kind==='group'?
    track.km:track.sourceRow.sourceKm)-1)*1000+
      track.domainStartM,
  endDistanceM:((track.kind==='group'?
    track.km:track.sourceRow.sourceKm)-1)*1000+
      endM,
  startClock,endClock,riders};
}

function fullKilometre(start,step,segments,endStates,
  bunchEndClock,contactsAtKm){
  const km=step.sourceKm;
  const rear=new Map(endStates.map(row=>[
    row.riderId,row]));
  const bunch=new Set(step.physicalGroup.riderIds);
  if(bunch.size+rear.size!==start.riderIds.length||
    start.riderIds.some(id=>
      !bunch.has(id)&&!rear.has(id)||
      bunch.has(id)&&rear.has(id)))
    throw new Error('Rear event field lacks rider kilometre.');
  const decisions=new Map(step.riderDecisions.map(row=>[
    row.riderId,row]));
  const riderStates=start.riderIds.map(riderId=>{
    if(bunch.has(riderId)){
      const source=step.riders.find(row=>
        row.riderId===riderId);
      if(!source||!decisions.has(riderId))
        throw new Error('Rear event lacks bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:source.energyAfter,
        decisions:[decisions.get(riderId)]};
    }
    const source=rear.get(riderId);
    const road=segments.filter(segment=>
      segment.riders.some(row=>
        row.riderId===riderId)).sort((a,b)=>
      a.startDistanceM-b.startDistanceM);
    const split=step.splits.find(row=>
      row.riderId===riderId);
    const expectedStart=split?
      split.atDistanceM:(km-1)*1000;
    if(!road.length||
      Math.abs(road[0].startDistanceM-
        expectedStart)>1e-5||
      Math.abs(road.at(-1).endDistanceM-
        km*1000)>1e-5||
      road.some((row,index)=>
        !Number.isFinite(row.startClock)||
        !Number.isFinite(row.endClock)||
        row.endClock<=row.startClock||
        index>0&&(
          Math.abs(row.startDistanceM-
            road[index-1].endDistanceM)>1e-5||
          Math.abs(row.startClock-
            road[index-1].endClock)>1e-6||
          Math.abs(row.riders.find(item=>
            item.riderId===riderId).energyBefore-
            road[index-1].riders.find(item=>
              item.riderId===riderId)
              .energyAfter)>1e-5)))
      throw new Error('Rear event lacks continuous paid road.');
    const first=road[0].riders.find(row=>
      row.riderId===riderId);
    const last=road.at(-1).riders.find(row=>
      row.riderId===riderId);
    const splitRow=split&&step.riders.find(row=>
      row.riderId===riderId);
    if(split&&(!splitRow||
      Math.abs(first.energyBefore-
        splitRow.energyAfter)>1e-5)||
      Math.abs(last.energyAfter-
        source.energyAfter)>0.001||
      Math.abs(road.at(-1).endClock-
        source.elapsedSeconds)>1e-6)
      throw new Error('Rear event energy or clock differs.');
    const rearDecisions=road.map(segment=>{
      const row=segment.riders.find(item=>
        item.riderId===riderId);
      if(!row.decision||
        !Number.isFinite(row.energyBefore)||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0||
        row.energySpent<0)
        throw new Error('Rear event lacks rider decision.');
      return {atClock:segment.startClock,
        kind:'road',decision:{riderId,
          ...row.decision}};
    });
    const contactDecisions=contactsAtKm.flatMap(
      contact=>contact.contactDecisions
        .filter(row=>row.riderId===riderId)
        .map(row=>({atClock:contact.clockSeconds,
          kind:'contact',decision:{...row,
            atClockSeconds:contact.clockSeconds}})));
    const timeline=[...rearDecisions,
      ...contactDecisions].sort((a,b)=>
      a.atClock-b.atClock||
      (a.kind==='contact'?0:1)-
        (b.kind==='contact'?0:1));
    return {riderId,sourceKm:km,
      physicalGroupId:source.physicalGroupId,
      atDistanceM:km*1000,
      elapsedSeconds:source.elapsedSeconds,
      energyAfter:source.energyAfter,
      decisions:[...(split?[decisions.get(
        riderId)]:[]),...timeline.map(row=>
          row.decision)]};
  });
  if(segments.some(segment=>segment.kind==='group'&&
    (segment.riders.filter(row=>
      row.role==='leader').length!==1||
    segment.riders.some(row=>!row.decision||
      !['leader','sheltered'].includes(row.role)||
      row.draftFraction!==(row.role==='leader'?
        1:.8)))))
    throw new Error('Rear event group lacks paid rotation.');
  return {sourceKm:km,riderStates,segments};
}

export function replayPhysicalStaggeredRearEventsV1({
  startInput,start,staggered,soloField,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<2||
    throughKm!==staggered?.throughKm||
    throughKm!==soloField?.throughKm||
    !isDeepStrictEqual(staggered,
      runPhysicalStaggeredBunchLossV1({startInput,
        start,throughKm}))||
    !isDeepStrictEqual(soloField,
      probePhysicalStaggeredSoloFieldV1({
        startInput,start,staggered,throughKm}))||
    soloField.refusals.length)
    throw new Error('Rear events need paid bunch and solo source.');
  const candidates=new Map(soloField.candidates.map(row=>
    [row.riderId,row]));
  const active=new Map();
  const contacts=[];
  const kilometres=[];
  let bunchPriorSeconds=0;
  for(const step of staggered.road){
    const km=step.sourceKm;
    for(const split of step.splits){
      const id=`solo-${split.riderId}`;
      if(active.has(id)||!candidates.has(
        split.riderId))
        throw new Error('Rear event lacks paid split.');
      active.set(id,{id,kind:'solo',
        riderIds:[split.riderId]});
    }
    const tracks=new Map([...active.values()].map(entity=>{
      const track=entity.kind==='solo'?
        soloTrack(entity,candidates.get(
          entity.riderIds[0]),step,
        bunchPriorSeconds):
        groupTrack(entity,km,startInput);
      return [entity.id,track];
    }));
    const segments=[];
    const contactStart=contacts.length;
    const ignored=new Set();
    let guard=0;
    while(true){
      if(++guard>active.size*active.size+100)
        throw new Error('Rear contact loop did not settle.');
      const event=firstEvent(tracks,km,
        ignored);
      const bunchContact=firstBunchContact(tracks,
        step,bunchPriorSeconds);
      if(bunchContact&&(!event||
        bunchContact.clockSeconds<=
          event.clockSeconds+EPS))
        throw new Error('Rear event needs paid bunch contact.');
      if(!event)break;
      const [leftId,rightId]=event.roadIds;
      const left=tracks.get(leftId);
      const right=tracks.get(rightId);
      if(!left||!right)
        throw new Error('Rear contact lost paid road.');
      const riderIds=event.riders.map(row=>
        row.riderId);
      const catching=tracks.get(
        event.catchingRoadId);
      const lossSplitLeader=()=>{
        if(left.kind!=='solo'||
          right.kind!=='solo'||
          ![left,right].every(track=>
            candidates.get(track.riderIds[0])
              .lossKm===km&&
            step.splits.some(row=>row.riderId===
              track.riderIds[0])))
          throw new Error('Rear contact lacks catching source.');
        return [...riderIds].sort((a,b)=>{
          const distance=id=>step.splits.find(row=>
            row.riderId===id)?.atDistanceM;
          return distance(a)-distance(b)||
            a.localeCompare(b);
        })[0];
      };
      const leaderRiderId=catching?
        catching.leaderRiderId:lossSplitLeader();
      const choice=decidePhysicalRearContactV1({
        startInput,km,
        roadIds:event.roadIds,
        riderIdsByRoad:{
          [leftId]:left.riderIds,
          [rightId]:right.riderIds},
        catchingRoadId:event.catchingRoadId,
        observedSecondsPerKmByRoad:{
          [leftId]:observedSecondsPerKm(left,
            event.metresIntoKm),
          [rightId]:observedSecondsPerKm(right,
            event.metresIntoKm)},
        leaderRiderId});
      if(choice.outcome==='pass_through'){
        contacts.push({...event,
          outcome:'pass_through',
          contactDecisions:choice.riderDecisions,
          physicalGroupsRemaining:[leftId,
            rightId]});
        ignored.add(pairKey(leftId,rightId));
        continue;
      }
      for(const road of [left,right]){
        const segment=segmentRecord(road,
          event.metresIntoKm);
        if(segment)segments.push(segment);
      }
      const groupId=`rear-event-${
        [...riderIds].sort().join('-')}`;
      const energyByRider=Object.fromEntries(
        event.riders.map(row=>[
          row.riderId,row.energyAtContact]));
      const group={id:groupId,kind:'group',
        riderIds,energyByRider,
        clock:event.clockSeconds,
        rotationIndex:0,formedKm:km};
      const track=pricePhysicalRearEventTrackV1({
        startInput,riderIds,energyByRider,km,
        startM:event.metresIntoKm,
        startClock:event.clockSeconds,
        contactLeaderRiderId:leaderRiderId,
        groupId});
      contacts.push({...event,
        outcome:'join',
        leaderRiderId,
        physicalGroup:{id:groupId,
          riderIds:[...riderIds],
          atDistanceM:event.atDistanceM},
        contactDecisions:
          choice.riderDecisions});
      active.delete(leftId);
      active.delete(rightId);
      tracks.delete(leftId);
      tracks.delete(rightId);
      active.set(groupId,group);
      tracks.set(groupId,{...track,id:groupId,
        kind:'group'});
    }
    const endStates=[];
    for(const [id,track] of tracks){
      const segment=segmentRecord(track,1000);
      if(segment)segments.push(segment);
      const entity=active.get(id);
      if(track.kind==='group'){
        entity.energyByRider=Object.fromEntries(
          track.rows.map(row=>[
            row.riderId,row.energyAfter]));
        entity.clock=track.endClock;
        if(entity.formedKm!==km)
          entity.rotationIndex=(entity.rotationIndex+1)%
            entity.riderIds.length;
        for(const row of track.rows)
          endStates.push({riderId:row.riderId,
            physicalGroupId:id,
            elapsedSeconds:track.endClock,
            energyAfter:row.energyAfter});
      }else{
        const row=track.sourceRow;
        endStates.push({riderId:track.riderIds[0],
          physicalGroupId:id,
          elapsedSeconds:row.elapsedSeconds,
          energyAfter:row.energyAfter});
      }
    }
    if(new Set(endStates.map(row=>row.riderId))
      .size!==endStates.length||
      endStates.length!==active.size+
        [...active.values()].reduce((sum,row)=>
          sum+row.riderIds.length-1,0)||
      endStates.some(row=>!Number.isFinite(
        row.elapsedSeconds)||!Number.isFinite(
        row.energyAfter)||row.energyAfter<0))
      throw new Error('Rear event kilometre lacks paid state.');
    const full=fullKilometre(start,step,
      segments,endStates,bunchPriorSeconds+
        step.elapsedSeconds,
      contacts.slice(contactStart));
    const previous=kilometres.at(-1);
    if(previous&&full.riderStates.some(state=>{
      const prior=previous.riderStates.find(row=>
        row.riderId===state.riderId);
      const rear=segments.find(segment=>
        segment.riders.some(row=>
          row.riderId===state.riderId));
      if(!rear||!prior||step.splits.some(row=>
        row.riderId===state.riderId))return false;
      const first=rear.riders.find(row=>
        row.riderId===state.riderId);
      return Math.abs(first.energyBefore-
        prior.energyAfter)>1e-5;
    }))
      throw new Error('Rear event energy crosses kilometre.');
    kilometres.push(full);
    bunchPriorSeconds+=step.elapsedSeconds;
  }
  return {version:
    PHYSICAL_STAGGERED_REAR_EVENT_REPLAY_VERSION,
  throughKm,contactCount:contacts.length,
  contacts,kilometres,
  observedFinishSecondsByRider:Object.fromEntries(
    kilometres.at(-1).riderStates.map(row=>[
      row.riderId,row.elapsedSeconds])),
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalStaggeredRearEventsV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalStaggeredRearEventsV1(input)))
    throw new Error('Rear event race differs from paid source.');
  return true;
}
