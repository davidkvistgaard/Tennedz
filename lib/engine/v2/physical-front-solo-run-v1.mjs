// Source-replayed paid front solo after a named manager attack. The
// rider can conserve when exhausted, but the team order remains visible.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterNamedAttackV1} from
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

export function runPhysicalFrontSoloV1({startInput,start,
  attackKm,throughKm}){
  const bunch=runPhysicalBunchAfterNamedAttackV1({startInput,start,
    attackKm,throughKm});
  const riderId=bunch.attack.frontSolo.riderIds[0];
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  let energy=bunch.attack.frontSolo.energyByRider[riderId];
  let elapsedSeconds=bunch.attack.frontSolo.elapsedSeconds;
  let gapSeconds=bunch.attack.frontGapSeconds;
  const steps=[];
  let bunchElapsedSeconds=bunch.attack.bunch.elapsedSeconds;
  for(const bunchStep of bunch.road){
    const km=bunchStep.sourceKm;
    const segment=startInput.routeKilometres[km-1];
    const stake=teamChaseStakeAtKmV1({
      commitment:startInput.commitment,teamId:team.id,km});
    if(!['break_stage','summit_attack'].includes(stake.goal))
      throw new Error('Front solo needs a continuing sporting stake.');
    const order=orderAt(team.orders,km-1);
    const effort=energy<TUNING.exhaustion.thresholdEnergy?
      'conserve':order.effort;
    if(!['conserve','steady','hard'].includes(effort))
      throw new Error('Front solo needs actual team effort order.');
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Front solo needs physical paid pace.');
    const nextGap=gapSeconds+bunchStep.elapsedSeconds-seconds;
    if(nextGap<=0)
      throw new Error('Front solo needs separate physical catch road.');
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort,role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort,group:'front_solo',working:true,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Front solo cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:startInput.routeKilometres,throughKm:km}).cap;
    const after=+Math.min(cap,paid.energyAfter).toFixed(3);
    elapsedSeconds+=seconds;
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    if(Math.abs(bunchElapsedSeconds-elapsedSeconds-nextGap)>1e-7)
      throw new Error('Front gap differs from paid bunch clock.');
    steps.push({sourceKm:km,riderId,
      decision:{goal:stake.goal,teamOrderEffort:order.effort,
        effort,choice:effort===order.effort?'drive_break':
          'conserve_to_finish',
        reason:effort===order.effort?'committed_break_work':
          'exhaustion_declines_order'},
      physicalGroup:{id:bunch.attack.frontSolo.id,
        riderIds:[riderId],atDistanceM:km*1000},
      seconds,elapsedSeconds,bunchElapsedSeconds,
      gapSecondsToBunch:nextGap,
      energyBefore:energy,energySpent:paid.energyDemand,
      recoveryAward:0,cap,energyAfter:after,
      officialResults:false});
    energy=after;
    gapSeconds=nextGap;
  }
  return {version:PHYSICAL_FRONT_SOLO_RUN_VERSION,
    sourceKm:throughKm,riderId,attack:bunch.attack,
    steps,energyAfter:energy,elapsedSeconds,
    gapSecondsToBunch:gapSeconds,
    physicalGroup:steps.at(-1).physicalGroup,
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSeconds:elapsedSeconds}:{}),
    officialResults:false};
}

export function validatePhysicalFrontSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalFrontSoloV1(input)))
    throw new Error('Front solo differs from paid physical source.');
  return true;
}
