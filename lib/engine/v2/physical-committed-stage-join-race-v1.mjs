// Full race witness for one planned release, measured return and
// explicit shelter. Later bunch road keeps the rider's own plan.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalCommittedStageBunchJoinKmV1} from
  './physical-committed-stage-bunch-join-v1.mjs';
import {advancePhysicalBunchAfterStageJoinKmV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_COMMITTED_STAGE_JOIN_RACE_VERSION=
  'v2-physical-committed-stage-join-race-1';

function bunchStates(step,clock){
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  return step.physicalGroup.riderIds.map(riderId=>{
    const row=step.riders.find(item=>
      item.riderId===riderId);
    return {riderId,sourceKm:step.sourceKm,
      physicalGroupId:'peloton',
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds:clock,
      energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
}

export function replayPhysicalCommittedStageJoinRaceV1({
  startInput,start,riderId,releaseKm,
  throughKm}){
  const join=finishPhysicalCommittedStageBunchJoinKmV1({
    startInput,start,riderId,releaseKm,throughKm});
  const {first,earlier}=join.sources.probe.sources;
  const kilometres=[...first.kilometres];
  let bunchClock=kilometres.at(-1)
    .riderStates.find(row=>
      row.physicalGroupId==='peloton').elapsedSeconds;
  for(const step of earlier){
    bunchClock+=step.bunch.elapsedSeconds;
    const riderStates=bunchStates(step.bunch,
      bunchClock);
    riderStates.push({riderId,
      sourceKm:step.sourceKm,
      physicalGroupId:`solo-${riderId}`,
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds:step.solo.elapsedSeconds,
      energyAfter:step.solo.energyAfter,
      decisions:[step.solo.decision]});
    riderStates.sort((a,b)=>
      start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
    kilometres.push({sourceKm:step.sourceKm,
      riderStates});
  }
  kilometres.push({sourceKm:join.sourceKm,
    riderStates:join.riderStates});
  bunchClock=join.bunchEndClock;
  let prior={riderIds:join.physicalGroup.riderIds,
    energyByRider:{...join.sources.bunch
      .energyByRider,[riderId]:join.energyAfter},
    quietKmByRider:{...join.sources.bunch
      .quietKmByRider,[riderId]:0}};
  const later=[];
  for(let km=join.sourceKm+1;km<=throughKm;km++){
    const step=advancePhysicalBunchAfterStageJoinKmV1({
      startInput,prior,
      segment:startInput.routeKilometres[km-1],
      riderId,contactKm:join.sourceKm});
    bunchClock+=step.elapsedSeconds;
    const riderStates=bunchStates(step,bunchClock);
    if(step.riders.filter(row=>
      row.role==='leader').length!==1||
      step.riders.find(row=>
        row.riderId===riderId)?.role!==
          'sheltered')
      throw new Error('Post-join road lacks paid shelter.');
    riderStates.sort((a,b)=>
      start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
    kilometres.push({sourceKm:km,riderStates});
    later.push(step);
    prior={riderIds:step.physicalGroup.riderIds,
      energyByRider:step.energyByRider,
      quietKmByRider:step.quietKmByRider};
  }
  if(kilometres.length!==throughKm||
    kilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==start.riderIds.length||
      new Set(row.riderStates.map(state=>
        state.riderId)).size!==
        start.riderIds.length||
      row.riderStates.some(state=>
        !Number.isFinite(state.elapsedSeconds)||
        !Number.isFinite(state.energyAfter)||
        state.energyAfter<0||
        !state.decisions.length||
        state.decisions.some(decision=>!decision))))
    throw new Error('Stage join race lacks rider kilometre.');
  return {version:PHYSICAL_COMMITTED_STAGE_JOIN_RACE_VERSION,
    throughKm,riderIds:[...start.riderIds],
    kilometres,sources:{join,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStageJoinRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalCommittedStageJoinRaceV1(input)))
    throw new Error('Stage join race differs from paid source.');
  return true;
}
