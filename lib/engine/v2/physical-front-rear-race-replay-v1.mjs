// Opt-in full-field replay from one committed front attack and the
// first paid bunch loss. Every later kilometre uses the prior paid
// physical state and refuses an unresolved event before the finish.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRaceV1} from
  './physical-front-race-replay-v1.mjs';
import {replayPhysicalFrontFirstRearLossKmV1} from
  './physical-front-first-rear-loss-v1.mjs';
import {advancePhysicalFrontRearClearKmV1} from
  './physical-front-rear-next-km-v1.mjs';
import {replayPhysicalFrontRearAllContactsKmV1} from
  './physical-front-rear-joined-km-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_FRONT_REAR_RACE_REPLAY_VERSION=
  'v2-physical-front-rear-race-replay-1';
export const PHYSICAL_FRONT_REAR_ORDERED_CHASE_RACE_VERSION=
  'v2-physical-front-rear-ordered-chase-race-1';

function checkPaidRearSegments(prior,full){
  const segments=full.sources.rearSegments;
  if(!segments)return;
  const byId=Map.groupBy(segments,row=>row.riderId);
  const before=new Map(prior.riderStates.map(row=>[
    row.riderId,row]));
  const after=new Map(full.riderStates.map(row=>[
    row.riderId,row]));
  const expected=prior.endRearEntities.reduce(
    (count,row)=>count+row.riderIds.length,0)+
    full.sources.boundary.sources.step.splits.length;
  if(byId.size!==expected)
    throw new Error(
      'Front-rear race lacks paid rear segments.');
  for(const [riderId,rows] of byId){
    let metres=0;
    let energy=before.get(riderId)?.energyAfter;
    for(const row of rows){
      if(Math.abs(row.fromMetres-metres)>.002||
        row.toMetres<=row.fromMetres||
        Math.abs(row.energyBefore-energy)>.003)
        throw new Error(
          'Front-rear race breaks rear segment chain.');
      metres=row.toMetres;
      energy=row.energyAfter;
    }
    if(Math.abs(metres-1000)>.002||
      Math.abs(energy-after.get(riderId)
        ?.energyAfter)>.003)
      throw new Error(
        'Front-rear race breaks rear end energy.');
  }
}

export function replayPhysicalFrontRearRaceV1({
  startInput,start,attackKm,lossKm,
  throughKm=startInput?.routeKilometres?.length,
  chaseObserverTeamId=null}){
  const distanceKm=startInput?.routeKilometres?.length;
  if(!Number.isInteger(attackKm)||attackKm<1||
    !Number.isInteger(lossKm)||
    lossKm<=attackKm+1||lossKm>=distanceKm||
    !Number.isInteger(throughKm)||
    throughKm<lossKm||throughKm>distanceKm||
    (chaseObserverTeamId!==null&&
    !startInput.teams.some(team=>
      team.id===chaseObserverTeamId)))
    throw new Error(
      'Front-rear race needs committed attack and later loss.');
  const before=replayPhysicalFrontRaceV1({
    startInput,start,attackKm,throughKm:lossKm-1});
  let prior=replayPhysicalFrontFirstRearLossKmV1({
    startInput,start,attackKm,lossKm});
  if(prior.fieldKilometreIncomplete)
    throw new Error(
      'Front-rear race lacks first loss contact.');
  const riderIds=[...start.riderIds];
  const kilometres=[...before.kilometres,
    {sourceKm:lossKm,
      riderStates:prior.riderStates}];
  const chaseKilometres=[];
  for(let km=lossKm+1;km<=throughKm;km++){
    const chaseOrder=chaseObserverTeamId===null?null:
      orderAt(startInput.teams.find(team=>
        team.id===chaseObserverTeamId).orders,km-1);
    const activeChaseTeamId=chaseOrder?.chase!==
      'ignore'?chaseObserverTeamId:null;
    const input={startInput,prior,
      chaseObserverTeamId:activeChaseTeamId};
    let boundary;
    try{
      boundary=advancePhysicalFrontRearClearKmV1(
        input);
    }catch(error){
      const refusal=new Error(
        `Front-rear race km ${km}: ${error.message}`,
      {cause:error});
      refusal.sourceKm=km;
      throw refusal;
    }
    let full;
    try{
      full=boundary.fieldKilometreIncomplete?
        replayPhysicalFrontRearAllContactsKmV1(input):
        boundary;
    }catch(error){
      if(!Number.isInteger(error.sourceKm))
        error.sourceKm=km;
      throw error;
    }
    if(full.fieldKilometreIncomplete||
      full.sourceKm!==km||
      full.riderCount!==riderIds.length)
      throw new Error(
        `Front-rear race lacks paid km ${km}.`);
    checkPaidRearSegments(prior,full);
    if(activeChaseTeamId!==null)
      chaseKilometres.push({sourceKm:km,
        workerId:boundary.sources.step.leaderRiderId,
        gapSeconds:full.endFrontState
          .gapSecondsToBunch});
    kilometres.push({sourceKm:km,
      riderStates:full.riderStates,
      contactEvents:[
        ...(full.sources.rearPassages??[])
          .map(row=>({event:row.event,
            choice:'pass_through',
            riderIds:row.choice.riderDecisions
              .map(decision=>decision.riderId)})),
        ...(full.sources.contacts??[]).map(row=>({
          event:row.event,
          choice:row.choice.outcome,
          leaderRiderId:row.groupRoad
            .leaderRiderId,
          ...(row.splitLeader?{
            splitLeader:row.splitLeader}:{}),
        })),
        ...(full.sources.bunchJoins??[]).map(row=>({
          event:row.event,choice:'join_bunch',
          riderIds:row.decisions.map(decision=>
            decision.riderId)})),
        ...(full.sources.bunchPassages??[])
          .map(row=>({event:row.event,
            choice:'stay_solo',
            riderIds:[row.decision.riderId]})),
        ...(full.sources.groupPassages??[])
          .map(row=>({event:row.event,
            choice:'stay_group',
            riderIds:row.decisions.map(
              decision=>decision.riderId),
            leaderRiderId:row.groupRoad
              .leaderRiderId}))]
        .sort((a,b)=>a.event.clockSeconds-
          b.event.clockSeconds)});
    prior=full;
  }
  if(kilometres.length!==throughKm||
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
        !state.decisions.length||
        state.decisions.some(decision=>!decision)))||
    riderIds.some(id=>kilometres.some(
      (row,index)=>index>0&&
        row.riderStates.find(state=>
          state.riderId===id).elapsedSeconds<=
        kilometres[index-1].riderStates.find(
          state=>state.riderId===id)
          .elapsedSeconds)))
    throw new Error(
      'Front-rear race lacks full rider history.');
  if(chaseObserverTeamId!==null&&
    !chaseKilometres.length)
    throw new Error('Front-rear race lacks paid chase order.');
  const finish=kilometres.at(-1).riderStates;
  return {version:chaseObserverTeamId===null?
    PHYSICAL_FRONT_REAR_RACE_REPLAY_VERSION:
    PHYSICAL_FRONT_REAR_ORDERED_CHASE_RACE_VERSION,
    distanceKm,attackKm,lossKm,riderIds,
    kilometres,sources:{before,last:prior},
    ...(chaseObserverTeamId!==null?{
      chaseObserverTeamId,chaseKilometres}:{}),
    ...(throughKm===distanceKm?{
      observedFinishSecondsByRider:
        Object.fromEntries(finish.map(row=>[
          row.riderId,row.elapsedSeconds])),
      observedFinishEnergyByRider:
        Object.fromEntries(finish.map(row=>[
          row.riderId,row.energyAfter]))}:
      {throughKm}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontRearRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearRaceV1(input)))
    throw new Error(
      'Front-rear race differs from paid source.');
  return true;
}
