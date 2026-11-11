// A committed front rider pays one more solo kilometre while a
// separately paid bunch pursues. Contact is handled by another source.
import {isDeepStrictEqual} from 'node:util';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_CHASED_FRONT_STEP_VERSION=
  'v2-physical-chased-front-step-1';

export function advancePhysicalChasedFrontStepV1({startInput,
  frontRiderId,priorFront,segment}){
  const km=segment?.km;
  if(!Number.isInteger(km)||km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[km-1])||
    !Number.isFinite(priorFront?.energyAfter)||
    !Number.isFinite(priorFront?.elapsedSeconds))
    throw new Error('Chased front needs sourced paid road.');
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===frontRiderId));
  const rider=team?.riders.find(row=>row.id===frontRiderId);
  if(!rider)throw new Error('Chased front needs committed rider.');
  const stake=teamChaseStakeAtKmV1({
    commitment:startInput.commitment,teamId:team.id,km});
  if(!['break_stage','summit_attack'].includes(stake.goal))
    throw new Error('Paid front needs continuing sporting stake.');
  const order=orderAt(team.orders,km-1);
  const effort=priorFront.energyAfter<
    TUNING.exhaustion.thresholdEnergy?'conserve':order.effort;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:priorFront.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const seconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Paid front needs valid road pace.');
  const price=priceRearEnergyDemandV1({rider,segment,
    energyBefore:priorFront.energyAfter,effort,
    role:'solo',distanceM:1000});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'front_solo',working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Paid front cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,throughKm:km}).cap;
  const energyAfter=+Math.min(cap,price.energyAfter).toFixed(3);
  const version=startInput.physicalDecisionVersion===1?
    `${PHYSICAL_CHASED_FRONT_STEP_VERSION}-decisions-1`:
    PHYSICAL_CHASED_FRONT_STEP_VERSION;
  return {version,
    riderId:frontRiderId,
    decision:{riderId:frontRiderId,goal:stake.goal,
      ...(startInput.physicalDecisionVersion===1?{
        version}:{}),
      teamOrderEffort:order.effort,effort,
      choice:effort===order.effort?'drive_break':
        'conserve_to_finish',
      reason:effort===order.effort?'committed_break_work':
        'exhaustion_declines_order'},
    seconds,
    elapsedSeconds:priorFront.elapsedSeconds+seconds,
    energyBefore:priorFront.energyAfter,
    energySpent:price.energyDemand,recoveryAward:0,
    cap,energyAfter};
}
