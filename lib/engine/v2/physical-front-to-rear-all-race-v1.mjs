// Opt-in complete replay when a paid rear road catches the front
// before the bunch. The requested contact kilometre is checked
// against its source; no official result or guided route is changed.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {replayPhysicalFrontToRearContactsKmV1,
  replayPhysicalAllRearAllContactsKmV1} from
  './physical-front-rear-joined-km-v1.mjs';
import {advancePhysicalAllRearClearKmV1} from
  './physical-all-rear-next-km-v1.mjs';

export const PHYSICAL_FRONT_TO_REAR_ALL_RACE_VERSION=
  'v2-physical-front-to-rear-all-race-1';

function eventsFrom(recording){
  const separated=recording.sources
    .groupSeparations??[];
  const separationEvents=new Set(separated
    .map(row=>row.event));
  return [
    ...(recording.sources.rearPassages??[])
      .map(row=>({event:row.event,
        choice:'pass_through',
        riderIds:row.choice.riderDecisions
          .map(decision=>decision.riderId)})),
    ...(recording.sources.contacts??[])
      .map(row=>({event:row.event,
        choice:row.choice.outcome,
        leaderRiderId:row.groupRoad
          .leaderRiderId})),
    ...(recording.sources.bunchJoins??[])
      .filter(row=>!separationEvents.has(
        row.event))
      .map(row=>({event:row.event,
        choice:'join_bunch',
        riderIds:row.decisions.map(
          decision=>decision.riderId)})),
    ...(recording.sources.bunchPassages??[])
      .map(row=>({event:row.event,
        choice:'stay_solo',
        riderIds:[row.decision.riderId]})),
    ...separated.map(row=>({
      event:row.event,
      choice:'partial_group_bunch_join',
      joiningRiderIds:row.paidJoin.decisions
        .map(decision=>decision.riderId),
      slidingRiderId:row.slideDecision
        .riderId}))]
    .sort((a,b)=>a.event.clockSeconds-
      b.event.clockSeconds);
}

function verifyStates(roster,prior,next){
  const before=new Map(prior.riderStates.map(
    row=>[row.riderId,row]));
  const after=new Map(next.riderStates.map(
    row=>[row.riderId,row]));
  if(after.size!==roster.length||
    roster.some(riderId=>{
      const old=before.get(riderId);
      const row=after.get(riderId);
      return !old||!row||
        row.sourceKm!==next.sourceKm||
        row.elapsedSeconds<=
          old.elapsedSeconds||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0||
        !row.decisions?.length||
        row.decisions.some(decision=>
          !decision);
    }))
    throw new Error(
      'Front-to-rear race lacks full paid states.');
}

export function replayPhysicalFrontToRearAllRaceV1({
  startInput,start,attackKm,lossKm,
  frontContactKm,chaseObserverTeamId=null}){
  const distanceKm=startInput?.routeKilometres
    ?.length;
  if(!Number.isInteger(frontContactKm)||
    frontContactKm<=lossKm||
    frontContactKm>distanceKm)
    throw new Error(
      'Front-to-rear race needs source contact kilometre.');
  const prefix=replayPhysicalFrontRearRaceV1({
    startInput,start,attackKm,lossKm,
    throughKm:frontContactKm-1,
    chaseObserverTeamId});
  const roster=prefix.riderIds;
  const kilometres=[...prefix.kilometres];
  let prior=prefix.sources.last;
  const activeChaseTeamId=
    chaseObserverTeamId!==null&&
    orderAt(startInput.teams.find(team=>
      team.id===chaseObserverTeamId)
      .orders,frontContactKm-1)
      .chase!=='ignore'?
      chaseObserverTeamId:null;
  const transition=
    replayPhysicalFrontToRearContactsKmV1({
      startInput,prior,
      chaseObserverTeamId:
        activeChaseTeamId});
  if(transition.endFrontState||
    !transition.endRearEntities.some(row=>
      row.riderIds.includes(
        prior.endFrontState.riderId)))
    throw new Error(
      'Front-to-rear race lacks joined front road.');
  verifyStates(roster,prior,transition);
  kilometres.push({sourceKm:frontContactKm,
    riderStates:transition.riderStates,
    contactEvents:eventsFrom(transition)});
  prior=transition;
  for(let km=frontContactKm+1;
    km<=distanceKm;km++){
    const input={startInput,prior};
    const boundary=
      advancePhysicalAllRearClearKmV1(input);
    const next=boundary.fieldKilometreIncomplete?
      replayPhysicalAllRearAllContactsKmV1(
        input):boundary;
    if(next.fieldKilometreIncomplete||
      next.sourceKm!==km)
      throw new Error(
        'Front-to-rear race lacks paid kilometre.');
    verifyStates(roster,prior,next);
    kilometres.push({sourceKm:km,
      riderStates:next.riderStates,
      contactEvents:eventsFrom(next)});
    prior=next;
  }
  if(kilometres.length!==distanceKm||
    kilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==roster.length))
    throw new Error(
      'Front-to-rear race lacks whole route.');
  return {version:
    PHYSICAL_FRONT_TO_REAR_ALL_RACE_VERSION,
    distanceKm,attackKm,lossKm,
    frontContactKm,riderIds:[...roster],
    kilometres,
    observedFinishSecondsByRider:
      Object.fromEntries(prior.riderStates
        .map(row=>[row.riderId,
          row.elapsedSeconds])),
    observedFinishEnergyByRider:
      Object.fromEntries(prior.riderStates
        .map(row=>[row.riderId,
          row.energyAfter])),
    sources:{prefix,transition,last:prior},
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontToRearAllRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontToRearAllRaceV1(input)))
    throw new Error(
      'Front-to-rear race differs from paid source.');
  return true;
}
