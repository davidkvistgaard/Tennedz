// One paid full-field chase kilometre. An observer first commits from
// a source-derived gap and perceived rival strength; its manager-named
// helper then leads the bunch while every other rider pays shelter.
import {isDeepStrictEqual} from 'node:util';
import {decidePhysicalFrontThreatV1} from
  './physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseBunchKmV1} from
  './physical-start-bunch-v1.mjs';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_PERCEIVED_CHASE_KM_VERSION=
  'v2-physical-perceived-chase-km-1';

export function advancePhysicalPerceivedChaseKmV1({startInput,
  start,attackKm,choiceKm,observerTeamId,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[]}){
  const threat=decidePhysicalFrontThreatV1({startInput,start,
    attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds});
  if(!['commit_now','commit_and_request_help'].includes(
    threat.choice.choice.assessments[0].action))
    throw new Error('Perceived threat has not committed paid chase.');
  const segment=startInput.routeKilometres[choiceKm-1];
  const priorStep=threat.physicalSource.bunch.road.at(-1);
  const prior={riderIds:priorStep.physicalGroup.riderIds,
    energyByRider:priorStep.energyByRider,
    quietKmByRider:priorStep.quietKmByRider};
  const bunchStep=advancePhysicalPerceivedChaseBunchKmV1({
    startInput,prior,segment,
    frontRiderId:threat.frontRiderId});
  const leaderTeam=startInput.teams.find(team=>team.riders.some(
    rider=>rider.id===bunchStep.leaderRiderId));
  const chaseDecision=bunchStep.riderDecisions.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  if(leaderTeam.id!==observerTeamId||
    chaseDecision.choice!=='chase')
    throw new Error('Perceived choice lacks named paid chase leader.');
  const frontBefore=threat.physicalSource.front;
  const frontTeam=startInput.teams.find(team=>team.riders.some(
    rider=>rider.id===threat.frontRiderId));
  const rider=frontTeam.riders.find(row=>
    row.id===threat.frontRiderId);
  const stake=teamChaseStakeAtKmV1({
    commitment:startInput.commitment,
    teamId:frontTeam.id,km:choiceKm});
  if(!['break_stage','summit_attack'].includes(stake.goal))
    throw new Error('Paid front needs continuing sporting stake.');
  const order=orderAt(frontTeam.orders,choiceKm-1);
  const effort=frontBefore.energyAfter<
    TUNING.exhaustion.thresholdEnergy?'conserve':order.effort;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:frontBefore.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Paid front needs valid road pace.');
  const gapSecondsToBunch=threat.observedGapSeconds+
    bunchStep.elapsedSeconds-seconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Paid pursuit needs a separate contact road.');
  const price=priceRearEnergyDemandV1({rider,segment,
    energyBefore:frontBefore.energyAfter,effort,
    role:'solo',distanceM:1000});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'front_solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Paid front cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:choiceKm}).cap;
  const energyAfter=+Math.min(cap,price.energyAfter).toFixed(3);
  const frontElapsedSeconds=frontBefore.elapsedSeconds+seconds;
  const bunchElapsedSeconds=threat.physicalSource.bunch
    .elapsedSeconds+bunchStep.elapsedSeconds;
  if(Math.abs(bunchElapsedSeconds-frontElapsedSeconds-
    gapSecondsToBunch)>1e-7)
    throw new Error('Paid pursuit clocks differ from physical gap.');
  const frontDecision={riderId:threat.frontRiderId,
    goal:stake.goal,teamOrderEffort:order.effort,
    effort,choice:effort===order.effort?'drive_break':
      'conserve_to_finish',
    reason:effort===order.effort?'committed_break_work':
      'exhaustion_declines_order'};
  const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
    const row=bunchStep.riders.find(item=>item.riderId===id);
    return {riderId:id,sourceKm:choiceKm,
      physicalGroupId:'peloton',atDistanceM:choiceKm*1000,
      elapsedSeconds:bunchElapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[bunchStep.riderDecisions.find(item=>
        item.riderId===id)]};
  });
  riderStates.push({riderId:threat.frontRiderId,
    sourceKm:choiceKm,
    physicalGroupId:frontBefore.physicalGroup.id,
    atDistanceM:choiceKm*1000,
    elapsedSeconds:frontElapsedSeconds,
    energyAfter,decisions:[frontDecision]});
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>row.riderId)).size!==
      start.riderIds.length)
    throw new Error('Paid pursuit lacks full-field rider decisions.');
  riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
    start.riderIds.indexOf(b.riderId));
  return {version:PHYSICAL_PERCEIVED_CHASE_KM_VERSION,
    sourceKm:choiceKm,threat,bunchStep,
    frontStep:{riderId:threat.frontRiderId,
      decision:frontDecision,seconds,
      elapsedSeconds:frontElapsedSeconds,
      energyBefore:frontBefore.energyAfter,
      energySpent:price.energyDemand,
      recoveryAward:0,cap,energyAfter},
    gapSecondsToBunch,riderStates,
    officialResults:false};
}

export function validatePhysicalPerceivedChaseKmV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalPerceivedChaseKmV1(input)))
    throw new Error('Paid perceived chase differs from source.');
  return true;
}
