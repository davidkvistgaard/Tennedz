// A stage saver that returned to a measured bunch can later lose its
// paid pace. The split is forced by the committed conserving effort;
// its remaining solo road and both finish clocks are source replayed.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalCommittedStageJoinRaceV1} from
  './physical-committed-stage-join-race-v1.mjs';
import {advancePhysicalBunchAfterStageJoinKmV1,
  advancePhysicalBunchAfterStageReleaseContinuationKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalCommittedStageReleaseSoloKmV1} from
  './physical-committed-stage-release-km-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_COMMITTED_STAGE_POSTJOIN_LOSS_VERSION=
  'v2-physical-committed-stage-postjoin-loss-1';

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

export function replayPhysicalCommittedStagePostjoinLossV1({
  startInput,start,riderId,releaseKm,
  lossKm,throughKm}){
  if(!Number.isInteger(lossKm)||
    !Number.isInteger(throughKm)||
    lossKm<=releaseKm+1||
    throughKm<lossKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Post-join loss needs later source road.');
  const priorRace=replayPhysicalCommittedStageJoinRaceV1({
    startInput,start,riderId,releaseKm,
    throughKm:lossKm-1});
  const contactKm=priorRace.sources.join.sourceKm;
  if(contactKm>=lossKm)
    throw new Error('Post-join loss needs an earlier paid contact.');
  const lastStep=priorRace.sources.later.at(-1)??
    priorRace.sources.join.sources.bunch;
  const priorState=priorRace.kilometres.at(-1)
    .riderStates;
  const prior={riderIds:lastStep.physicalGroup.riderIds,
    energyByRider:{...lastStep.energyByRider,
      [riderId]:priorState.find(row=>
        row.riderId===riderId).energyAfter},
    quietKmByRider:{...lastStep.quietKmByRider,
      [riderId]:priorRace.sources.later
        .at(-1)?.quietKmByRider?.[riderId]??0}};
  if(contactKm===lossKm-1)
    prior.riderIds=[...priorRace.sources.join
      .physicalGroup.riderIds];
  const segment=startInput.routeKilometres[
    lossKm-1];
  const loss=advancePhysicalBunchAfterStageJoinKmV1({
    startInput,prior,segment,riderId,
    contactKm,allowPaceLoss:true});
  const split=loss.splits[0];
  const partial=loss.riders.find(row=>
    row.riderId===riderId);
  const decision=loss.riderDecisions.find(row=>
    row.riderId===riderId);
  const rider=startInput.teams.flatMap(team=>
    team.riders).find(row=>row.id===riderId);
  const remainingM=lossKm*1000-
    split.atDistanceM;
  const effect=riderKilometreEffect(rider,
    segment,{phase:'solo',
      energy:partial.energyAfter,
      exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure.conserve-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0||remainingM<=0||
    remainingM>=1000)
    throw new Error('Post-join solo needs payable remaining road.');
  const paid=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:partial.energyAfter,
    effort:'conserve',role:'solo',
    distanceM:remainingM});
  const recovery=recoveryForKilometre({
    rider,segment,effort:'conserve',
    group:'solo',working:true,
    quietKm:partial.quietKm});
  if(recovery.recovery!==0)
    throw new Error('Post-join solo cannot claim recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:lossKm}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  const reserve=decision.committedStagePlan
    .reserveEnergy;
  if(energyAfter<reserve)
    throw new Error('Post-join loss breaks committed reserve.');
  const priorClock=priorState.find(row=>
    row.physicalGroupId==='peloton')
    .elapsedSeconds;
  let bunchClock=priorClock+
    loss.elapsedSeconds;
  let soloClock=bunchClock+
    secondsPerKm*remainingM/1000;
  const completion={sourceKm:lossKm,riderId,
    startDistanceM:split.atDistanceM,
    endDistanceM:lossKm*1000,
    startClock:bunchClock,
    elapsedSeconds:soloClock,
    gapSecondsToBunch:soloClock-bunchClock,
    energyBefore:partial.energyAfter,
    energySpent:paid.energyDemand,
    partialEnergySpent:partial.energySpent,
    recoveryAward:0,cap,energyAfter,
    decision:structuredClone(decision),
    physicalGroup:{id:`solo-${riderId}`,
      riderIds:[riderId],
      atDistanceM:lossKm*1000}};
  const kilometres=[...priorRace.kilometres];
  const lossStates=bunchStates(loss,bunchClock);
  lossStates.push({riderId,sourceKm:lossKm,
    physicalGroupId:completion.physicalGroup.id,
    atDistanceM:lossKm*1000,
    elapsedSeconds:soloClock,
    energyAfter,decisions:[decision]});
  lossStates.sort((a,b)=>
    start.riderIds.indexOf(a.riderId)-
    start.riderIds.indexOf(b.riderId));
  kilometres.push({sourceKm:lossKm,
    riderStates:lossStates});
  let bunchPrior={riderIds:loss.physicalGroup.riderIds,
    energyByRider:loss.energyByRider,
    quietKmByRider:loss.quietKmByRider};
  let soloEnergy=energyAfter;
  let gap=completion.gapSecondsToBunch;
  const later=[];
  for(let km=lossKm+1;km<=throughKm;km++){
    const road=startInput.routeKilometres[km-1];
    const bunch=advancePhysicalBunchAfterStageReleaseContinuationKmV1({
      startInput,prior:bunchPrior,
      segment:road,riderId});
    const solo=advancePhysicalCommittedStageReleaseSoloKmV1({
      startInput,riderId,km,
      energyBefore:soloEnergy,
      previousClock:soloClock,
      previousGap:gap});
    bunchClock+=bunch.elapsedSeconds;
    const nextGap=solo.elapsedSeconds-
      bunchClock;
    if(nextGap<=0)
      throw new Error('Post-join solo needs paid new bunch contact.');
    const states=bunchStates(bunch,
      bunchClock);
    states.push({riderId,sourceKm:km,
      physicalGroupId:`solo-${riderId}`,
      atDistanceM:km*1000,
      elapsedSeconds:solo.elapsedSeconds,
      energyAfter:solo.energyAfter,
      decisions:[solo.decision]});
    states.sort((a,b)=>
      start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
    kilometres.push({sourceKm:km,
      riderStates:states});
    later.push({sourceKm:km,bunch,
      solo,gapSecondsToBunch:nextGap});
    bunchPrior={riderIds:bunch.physicalGroup.riderIds,
      energyByRider:bunch.energyByRider,
      quietKmByRider:bunch.quietKmByRider};
    soloEnergy=solo.energyAfter;
    soloClock=solo.elapsedSeconds;
    gap=nextGap;
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
    throw new Error('Post-join loss lacks rider kilometre.');
  return {version:PHYSICAL_COMMITTED_STAGE_POSTJOIN_LOSS_VERSION,
    throughKm,lossKm,riderId,
    riderIds:[...start.riderIds],kilometres,
    sources:{priorRace,loss,completion,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStagePostjoinLossV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalCommittedStagePostjoinLossV1(input)))
    throw new Error('Post-join loss differs from paid source.');
  return true;
}
