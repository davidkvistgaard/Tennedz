// One explicit later-stage release from a physical bunch. The rider
// could hold at the ordered effort, then pays a slower solo road.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchV1,
  advancePhysicalBunchAfterStageReleaseKmV1,
  advancePhysicalBunchAfterStageReleaseContinuationKmV1} from
  './physical-start-bunch-v1.mjs';
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
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from './tuning.mjs';

export const PHYSICAL_COMMITTED_STAGE_RELEASE_KM_VERSION=
  'v2-physical-committed-stage-release-km-1';
export const PHYSICAL_COMMITTED_STAGE_RELEASE_FINISH_VERSION=
  'v2-physical-committed-stage-release-finish-1';

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

export function replayPhysicalCommittedStageReleaseKmV1({
  startInput,start,riderId,releaseKm}){
  if(startInput?.physicalDraftVersion!==4||
    !Number.isInteger(releaseKm)||releaseKm<2||
    releaseKm>startInput.routeKilometres.length)
    throw new Error('Stage release needs versioned later road.');
  const priorRun=runPhysicalBunchV1({
    startInput,start,throughKm:releaseKm-1});
  const priorStep=priorRun.road.at(-1);
  const prior={riderIds:priorStep.physicalGroup.riderIds,
    energyByRider:priorStep.energyByRider,
    quietKmByRider:priorStep.quietKmByRider};
  const segment=startInput.routeKilometres[
    releaseKm-1];
  const bunch=advancePhysicalBunchAfterStageReleaseKmV1({
    startInput,prior,segment,riderId});
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team?.riders.find(row=>row.id===riderId);
  const order=orderAt(team?.orders,releaseKm-1);
  const energyBefore=prior.energyByRider[riderId];
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:energyBefore,
    exposed:segment.exposed});
  const leader=bunch.step.riders.find(row=>
    row.riderId===bunch.step.leaderRiderId);
  const orderedHoldAbility=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const load=1+Math.max(0,
    segment.gradientPct)*.035+
    (segment.surface==='road'?0:.15);
  const shelteredEnergyDemand=
    TUNING.effortCost[order.effort]*load*.8*
    effect.energyCostMultiplier;
  if(!leader||!Number.isFinite(energyBefore)||
    orderedHoldAbility+1e-9<
      leader.holdAbility||
    shelteredEnergyDemand>energyBefore+1e-9)
    throw new Error('Stage release needs a rider able to hold.');
  const soloEffect=riderKilometreEffect(
    rider,segment,{phase:'solo',
      energy:energyBefore,
      exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure.conserve-1)*20;
  const soloSeconds=segmentBaseSeconds(segment)+
    (50-soloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(soloSeconds)||
    soloSeconds<=bunch.step.elapsedSeconds)
    throw new Error('Stage release needs paid gap behind bunch.');
  const paid=priceRearEnergyDemandV1({
    rider,segment,energyBefore,
    effort:'conserve',role:'solo',
    distanceM:1000});
  const recovery=recoveryForKilometre({
    rider,segment,effort:'conserve',
    group:'solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Stage release cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:releaseKm}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(energyAfter<bunch.stagePlan.reserveEnergy)
    throw new Error('Stage release breaks committed reserve.');
  const previousClock=priorRun.elapsedSeconds;
  const elapsedSeconds=previousClock+soloSeconds;
  const bunchClock=previousClock+
    bunch.step.elapsedSeconds;
  const decision={riderId,teamId:team.id,
    goal:'save_for_stage',
    choice:'chose_to_release',
    reason:'committed_later_stage_target',
    effort:'conserve',
    teamOrderEffort:order.effort,
    committedStagePlan:structuredClone(
      bunch.stagePlan),
    orderedHoldAbility,
    leaderAbility:leader.holdAbility,
    shelteredEnergyDemand};
  const release={riderId,sourceKm:releaseKm,
    startDistanceM:(releaseKm-1)*1000,
    endDistanceM:releaseKm*1000,
    startClock:previousClock,
    elapsedSeconds,seconds:soloSeconds,
    gapSecondsToBunch:elapsedSeconds-
      bunchClock,
    energyBefore,energySpent:paid.energyDemand,
    recoveryAward:0,cap,energyAfter,
    physicalGroup:{id:`solo-${riderId}`,
      riderIds:[riderId],
      atDistanceM:releaseKm*1000},
    decision};
  const kilometres=[];
  let clock=0;
  for(const step of priorRun.road){
    clock+=step.elapsedSeconds;
    kilometres.push({sourceKm:step.sourceKm,
      riderStates:bunchStates(step,clock)});
  }
  const riderStates=[...bunchStates(
    bunch.step,bunchClock),{
      riderId,sourceKm:releaseKm,
      physicalGroupId:release.physicalGroup.id,
      atDistanceM:releaseKm*1000,
      elapsedSeconds,
      energyAfter,decisions:[decision]}].sort(
    (a,b)=>start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>row.riderId))
      .size!==start.riderIds.length||
    riderStates.some(row=>!row.decisions[0]||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0))
    throw new Error('Stage release lacks rider kilometre.');
  kilometres.push({sourceKm:releaseKm,
    riderStates});
  return {version:
    PHYSICAL_COMMITTED_STAGE_RELEASE_KM_VERSION,
  releaseKm,riderIds:[...start.riderIds],
  kilometres,sources:{priorRun,bunch,release},
  laterRoadUnsettled:true,
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStageReleaseKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalCommittedStageReleaseKmV1(input)))
    throw new Error('Stage release differs from paid source.');
  return true;
}

function continuedSolo({startInput,riderId,km,
  energyBefore,previousClock,previousGap}){
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const plan=startInput.soloCommitments.find(row=>
    row.riderId===riderId);
  const intent=rearSoloPlanAtKmV1({
    commitment:plan,km});
  const order=orderAt(team.orders,km-1);
  if(intent.action!=='save_for_stage'||
    intent.effort!=='conserve')
    throw new Error('Stage release continuation needs committed reserve.');
  const segment=startInput.routeKilometres[km-1];
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:energyBefore,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure.conserve-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Stage release continuation needs payable pace.');
  const paid=priceRearEnergyDemandV1({
    rider,segment,energyBefore,
    effort:'conserve',role:'solo',
    distanceM:1000});
  const recovery=recoveryForKilometre({
    rider,segment,effort:'conserve',
    group:'solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Stage release continuation cannot claim recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(energyAfter<intent.committedStagePlan.reserveEnergy)
    throw new Error('Stage release continuation breaks reserve.');
  const elapsedSeconds=previousClock+seconds;
  return {sourceKm:km,riderId,
    startDistanceM:(km-1)*1000,
    endDistanceM:km*1000,
    startClock:previousClock,seconds,
    elapsedSeconds,energyBefore,
    energySpent:paid.energyDemand,
    recoveryAward:0,cap,energyAfter,
    previousGap,decision:{riderId,
      teamId:team.id,goal:intent.action,
      choice:'continue_stage_saving_solo',
      reason:'committed_later_stage_target',
      effort:intent.effort,
      teamOrderEffort:order.effort,
      committedStagePlan:structuredClone(
        intent.committedStagePlan)}};
}

export function replayPhysicalCommittedStageReleaseFinishV1({
  startInput,start,riderId,releaseKm}){
  const first=replayPhysicalCommittedStageReleaseKmV1({
    startInput,start,riderId,releaseKm});
  const throughKm=startInput.routeKilometres.length;
  if(releaseKm>=throughKm)
    throw new Error('Stage release finish needs later paid road.');
  const kilometres=[...first.kilometres];
  const later=[];
  let bunchPrior=first.sources.bunch.step;
  let bunchClock=kilometres.at(-1).riderStates.find(row=>
    row.physicalGroupId==='peloton').elapsedSeconds;
  let soloClock=first.sources.release.elapsedSeconds;
  let soloEnergy=first.sources.release.energyAfter;
  let gap=first.sources.release.gapSecondsToBunch;
  for(let km=releaseKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:bunchPrior.physicalGroup.riderIds,
      energyByRider:bunchPrior.energyByRider,
      quietKmByRider:bunchPrior.quietKmByRider};
    const bunch=advancePhysicalBunchAfterStageReleaseContinuationKmV1({
      startInput,prior,segment,riderId});
    const solo=continuedSolo({startInput,riderId,km,
      energyBefore:soloEnergy,previousClock:soloClock,
      previousGap:gap});
    const nextBunchClock=bunchClock+bunch.elapsedSeconds;
    const nextGap=solo.elapsedSeconds-nextBunchClock;
    if(gap<=0||nextGap<=0)
      throw new Error('Stage release finish needs paid bunch contact.');
    const riderStates=bunchStates(bunch,nextBunchClock);
    riderStates.push({riderId,sourceKm:km,
      physicalGroupId:`solo-${riderId}`,
      atDistanceM:km*1000,
      elapsedSeconds:solo.elapsedSeconds,
      energyAfter:solo.energyAfter,
      decisions:[solo.decision]});
    if(riderStates.length!==start.riderIds.length||
      new Set(riderStates.map(row=>row.riderId))
        .size!==start.riderIds.length||
      riderStates.some(row=>!row.decisions[0]||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0))
      throw new Error('Stage release finish lacks rider kilometre.');
    riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
    kilometres.push({sourceKm:km,riderStates});
    later.push({sourceKm:km,bunch,solo,
      gapSecondsToBunch:nextGap});
    bunchPrior=bunch;
    bunchClock=nextBunchClock;
    soloClock=solo.elapsedSeconds;
    soloEnergy=solo.energyAfter;
    gap=nextGap;
  }
  return {version:
    PHYSICAL_COMMITTED_STAGE_RELEASE_FINISH_VERSION,
  throughKm,riderIds:[...start.riderIds],
  kilometres,sources:{first,later},
  observedFinishSecondsByRider:Object.fromEntries(
    kilometres.at(-1).riderStates.map(row=>[
      row.riderId,row.elapsedSeconds])),
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStageReleaseFinishV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalCommittedStageReleaseFinishV1(input)))
    throw new Error('Stage release finish differs from paid source.');
  return true;
}
