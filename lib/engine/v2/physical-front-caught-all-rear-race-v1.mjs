// Opt-in complete source replay for a front catch followed by rear
// roads. It observes finish clocks, energy and contact, not placing.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {replayPhysicalFrontRearCaughtSlideKmV1} from
  './physical-front-rear-caught-slide-km-v1.mjs';
import {advancePhysicalAllRearClearKmV1} from
  './physical-all-rear-next-km-v1.mjs';
import {replayPhysicalAllRearAllContactsKmV1} from
  './physical-front-rear-joined-km-v1.mjs';

export const PHYSICAL_FRONT_CAUGHT_ALL_REAR_RACE_VERSION=
  'v2-physical-front-caught-all-rear-race-1';

function contactEventsFrom(full){
  return [
    ...(full.sources.rearPassages??[])
      .map(row=>({event:row.event,
        choice:'pass_through',
        riderIds:row.choice.riderDecisions
          .map(decision=>decision.riderId)})),
    ...(full.sources.contacts??[]).map(row=>({
      event:row.event,
      choice:row.choice.outcome,
      leaderRiderId:row.groupRoad
        .leaderRiderId})),
    ...(full.sources.bunchJoins??[]).map(row=>({
      event:row.event,choice:'join_bunch',
      riderIds:row.decisions.map(decision=>
        decision.riderId)})),
    ...(full.sources.bunchPassages??[])
      .map(row=>({event:row.event,
        choice:'stay_solo',
        riderIds:[row.decision.riderId]}))]
    .sort((a,b)=>a.event.clockSeconds-
      b.event.clockSeconds);
}

function checkPaidRearSegments(prior,full){
  const segments=full.sources.rearSegments;
  if(!segments)return;
  const byId=Map.groupBy(segments,row=>
    row.riderId);
  const before=new Map(prior.riderStates
    .map(row=>[row.riderId,row]));
  const after=new Map(full.riderStates
    .map(row=>[row.riderId,row]));
  const expected=prior.endRearEntities.reduce(
    (count,row)=>count+row.riderIds.length,0)+
    full.sources.boundary.sources.step
      .splits.length;
  if(byId.size!==expected)
    throw new Error(
      'Caught-front race lacks paid rear segments.');
  for(const [riderId,rows] of byId){
    let metres=0;
    let energy=before.get(riderId)?.energyAfter;
    for(const row of rows){
      if(Math.abs(row.fromMetres-
        metres)>.002||
        row.toMetres<=row.fromMetres||
        Math.abs(row.energyBefore-
          energy)>.003)
        throw new Error(
          'Caught-front race breaks rear segment chain.');
      metres=row.toMetres;
      energy=row.energyAfter;
    }
    if(Math.abs(metres-1000)>.002||
      Math.abs(energy-after.get(riderId)
        ?.energyAfter)>.003)
      throw new Error(
        'Caught-front race breaks rear end energy.');
  }
}

export function replayPhysicalFrontCaughtAllRearRaceV1({
  startInput,start,attackKm,lossKm,catchKm,
  chaseObserverTeamId=null}){
  const distanceKm=startInput?.routeKilometres
    ?.length;
  if(!Number.isInteger(catchKm)||
    catchKm<=lossKm||catchKm>distanceKm)
    throw new Error(
      'Caught-front race needs later paid catch.');
  const prefix=replayPhysicalFrontRearRaceV1({
    startInput,start,attackKm,lossKm,
    throughKm:catchKm-1,
    chaseObserverTeamId});
  const caught=replayPhysicalFrontRearCaughtSlideKmV1({
    startInput,start,attackKm,lossKm,catchKm,
    chaseObserverTeamId});
  if(!isDeepStrictEqual(
    caught.sources.boundary.sources.prefix,
    prefix)||
    caught.fieldKilometreIncomplete||
    caught.riderCount!==start.riderIds.length)
    throw new Error(
      'Caught-front race breaks paid catch source.');
  const riderIds=[...start.riderIds];
  const kilometres=[...prefix.kilometres,
    {sourceKm:catchKm,
      riderStates:caught.riderStates,
      contactEvents:[{
        event:caught.contact,
        choice:'slide_through'},
      ...(caught.nextContact?[{
        event:caught.nextContact.event,
        choice:caught.nextContact.choice
          .outcome,
        leaderRiderId:caught.nextContact
          .group.leaderRiderId}]:[])]}];
  let prior=caught;
  for(let km=catchKm+1;km<=distanceKm;km++){
    const input={startInput,prior};
    let boundary;
    let full;
    try{
      boundary=advancePhysicalAllRearClearKmV1(
        input);
      full=boundary.fieldKilometreIncomplete?
        replayPhysicalAllRearAllContactsKmV1(
          input):boundary;
    }catch(error){
      throw new Error(
        `Caught-front race km ${km}: ${error.message}`,
      {cause:error});
    }
    if(full.fieldKilometreIncomplete||
      full.sourceKm!==km||
      full.riderCount!==riderIds.length)
      throw new Error(
        `Caught-front race lacks paid km ${km}.`);
    checkPaidRearSegments(prior,full);
    kilometres.push({sourceKm:km,
      riderStates:full.riderStates,
      contactEvents:contactEventsFrom(full)});
    prior=full;
  }
  if(kilometres.length!==distanceKm||
    kilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==riderIds.length||
      new Set(row.riderStates.map(state=>
        state.riderId)).size!==riderIds.length||
      row.riderStates.some(state=>
        state.sourceKm!==row.sourceKm||
        state.atDistanceM!==row.sourceKm*1000||
        !Number.isFinite(state.elapsedSeconds)||
        !Number.isFinite(state.energyAfter)||
        state.energyAfter<0||
        !state.decisions.length))||
    riderIds.some(id=>kilometres.some(
      (row,index)=>index>0&&
      row.riderStates.find(state=>
        state.riderId===id)
        .elapsedSeconds<=
        kilometres[index-1].riderStates
          .find(state=>state.riderId===id)
          .elapsedSeconds)))
    throw new Error(
      'Caught-front race lacks full rider history.');
  const finish=kilometres.at(-1)
    .riderStates;
  return {version:
    PHYSICAL_FRONT_CAUGHT_ALL_REAR_RACE_VERSION,
    distanceKm,attackKm,lossKm,catchKm,
    riderIds,kilometres,
    sources:{prefix,caught,last:prior},
    observedFinishSecondsByRider:
      Object.fromEntries(finish.map(row=>[
        row.riderId,row.elapsedSeconds])),
    observedFinishEnergyByRider:
      Object.fromEntries(finish.map(row=>[
        row.riderId,row.energyAfter])),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontCaughtAllRearRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontCaughtAllRearRaceV1(
      input)))
    throw new Error(
      'Caught-front race differs from paid source.');
  return true;
}
