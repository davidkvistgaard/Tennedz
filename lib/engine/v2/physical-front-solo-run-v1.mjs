// Source-replayed paid front solo after a named manager attack. The
// rider can conserve when exhausted, but the team order remains visible.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterNamedAttackV1,
  runPhysicalNamedAttackV1} from
  './physical-start-bunch-v1.mjs';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_FRONT_SOLO_RUN_VERSION=
  'v2-physical-front-solo-run-1';

export function advancePhysicalFrontSoloFromBunchStepV1({
  startInput,prior,bunchStep}){
  const km=bunchStep?.sourceKm;
  const riderId=prior?.riderId;
  const team=startInput?.teams?.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team?.riders.find(row=>
    row.id===riderId);
  const segment=startInput?.routeKilometres?.[km-1];
  if(!rider||!segment||km!==prior.sourceKm+1||
    bunchStep.physicalGroup.riderIds.includes(riderId)||
    !Number.isFinite(prior.elapsedSeconds)||
    !Number.isFinite(prior.bunchElapsedSeconds)||
    !Number.isFinite(prior.energyAfter)||
    !Number.isFinite(prior.gapSecondsToBunch)||
    prior.gapSecondsToBunch<=0||
    Math.abs(prior.bunchElapsedSeconds-
      prior.elapsedSeconds-
      prior.gapSecondsToBunch)>1e-7)
    throw new Error(
      'Front solo needs replayed prior road and bunch step.');
  const stake=teamChaseStakeAtKmV1({
    commitment:startInput.commitment,
    teamId:team.id,km});
  if(!['break_stage','summit_attack'].includes(
    stake.goal))
    throw new Error(
      'Front solo needs a continuing sporting stake.');
  const order=orderAt(team.orders,km-1);
  const effort=prior.energyAfter<
    TUNING.exhaustion.thresholdEnergy?
    'conserve':order.effort;
  if(!['conserve','steady','hard'].includes(effort))
    throw new Error(
      'Front solo needs actual team effort order.');
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:prior.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Front solo needs physical paid pace.');
  const nextGap=prior.gapSecondsToBunch+
    bunchStep.elapsedSeconds-seconds;
  if(nextGap<=0)
    throw new Error(
      'Front solo needs separate physical catch road.');
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:prior.energyAfter,effort,
    role:'solo',distanceM:1000});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'front_solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Front solo cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const after=+Math.min(cap,paid.energyAfter).toFixed(3);
  const elapsedSeconds=prior.elapsedSeconds+seconds;
  const bunchElapsedSeconds=prior.bunchElapsedSeconds+
    bunchStep.elapsedSeconds;
  if(Math.abs(bunchElapsedSeconds-elapsedSeconds-
    nextGap)>1e-7)
    throw new Error(
      'Front gap differs from paid bunch clock.');
  return {sourceKm:km,riderId,
    decision:{goal:stake.goal,
      teamOrderEffort:order.effort,effort,
      choice:effort===order.effort?'drive_break':
        'conserve_to_finish',
      reason:effort===order.effort?
        'committed_break_work':
        'exhaustion_declines_order'},
    physicalGroup:{id:`front-${riderId}`,
      riderIds:[riderId],atDistanceM:km*1000},
    seconds,elapsedSeconds,bunchElapsedSeconds,
    gapSecondsToBunch:nextGap,
    energyBefore:prior.energyAfter,
    energySpent:paid.energyDemand,
    recoveryAward:0,cap,energyAfter:after,
    officialResults:false};
}

export function runPhysicalFrontSoloV1({startInput,start,
  attackKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<attackKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Front solo needs sourced road.');
  const bunch=throughKm===attackKm?{
    attack:runPhysicalNamedAttackV1({startInput,start,attackKm}),
    road:[]}:runPhysicalBunchAfterNamedAttackV1({startInput,start,
    attackKm,throughKm});
  const riderId=bunch.attack.frontSolo.riderIds[0];
  let prior={sourceKm:attackKm,riderId,
    energyAfter:bunch.attack.frontSolo
      .energyByRider[riderId],
    elapsedSeconds:bunch.attack.frontSolo.elapsedSeconds,
    bunchElapsedSeconds:bunch.attack.bunch.elapsedSeconds,
    gapSecondsToBunch:bunch.attack.frontGapSeconds};
  const steps=[];
  for(const bunchStep of bunch.road){
    const step=advancePhysicalFrontSoloFromBunchStepV1({
      startInput,prior,bunchStep});
    steps.push(step);
    prior=step;
  }
  return {version:PHYSICAL_FRONT_SOLO_RUN_VERSION,
    sourceKm:throughKm,riderId,attack:bunch.attack,
    steps,energyAfter:prior.energyAfter,
    elapsedSeconds:prior.elapsedSeconds,
    gapSecondsToBunch:prior.gapSecondsToBunch,
    physicalGroup:steps.at(-1)?.physicalGroup??
      bunch.attack.frontSolo,
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSeconds:prior.elapsedSeconds}:{}),
    officialResults:false};
}

export function validatePhysicalFrontSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalFrontSoloV1(input)))
    throw new Error('Front solo differs from paid physical source.');
  return true;
}
