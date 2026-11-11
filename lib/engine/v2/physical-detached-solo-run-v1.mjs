// Source-replayed solo kilometres after a paid bunch pace loss. The
// rider's pre-race plan sets the goal; current energy sets the pace.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_DETACHED_SOLO_RUN_VERSION=
  'v2-physical-detached-solo-run-1';
const effortRank={conserve:0,steady:1,hard:2};

export function runPhysicalDetachedSoloV1({startInput,start,
  lossKm,throughKm,riderId}){
  const plan=startInput?.soloCommitments?.find(row=>
    row.riderId===riderId);
  if(!Number.isInteger(throughKm)||throughKm<=lossKm)
    throw new Error('Detached solo needs later sourced road.');
  const bunch=runPhysicalBunchAfterPaceLossV1({startInput,start,
    lossKm,throughKm});
  const completion=completePhysicalPaceLossKmV1({
    startInput,start,lossKm,loss:bunch.loss,riderId});
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const steps=[];
  let energy=completion.energyAfter;
  let elapsedSeconds=completion.elapsedSeconds;
  let gapSeconds=completion.gapSecondsToBunch;
  for(const bunchStep of bunch.road){
    const km=bunchStep.sourceKm;
    const segment=startInput.routeKilometres[km-1];
    const intent=plan?rearSoloPlanAtKmV1({commitment:plan,km}):
      {action:'finish_safely',effort:'conserve'};
    const teamOrder=orderAt(team.orders,km-1);
    if(effortRank[intent.effort]>effortRank[teamOrder.effort])
      throw new Error('Detached solo exceeds the team effort order.');
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[intent.effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Detached solo needs physical paid pace.');
    const nextGap=gapSeconds+seconds-bunchStep.elapsedSeconds;
    if(nextGap<=0)
      throw new Error('Detached solo needs separate paid contact road.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort:intent.effort,
      role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort:intent.effort,group:'solo',working:true,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Detached solo cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:startInput.routeKilometres,throughKm:km}).cap;
    const after=+Math.min(cap,price.energyAfter).toFixed(3);
    if(intent.action==='save_for_stage'&&
      after<intent.committedStagePlan.reserveEnergy)
      throw new Error('Detached solo breaks future-stage reserve.');
    elapsedSeconds+=seconds;
    steps.push({sourceKm:km,riderId,
      decision:{goal:intent.action,effort:intent.effort,
        teamOrderEffort:teamOrder.effort,
        reason:plan?'committed_detached_solo_plan':
          'cannot_hold_paid_front_pace'},
      physicalGroup:{id:`solo-${riderId}`,
        riderIds:[riderId],atDistanceM:km*1000},
      seconds,elapsedSeconds,
      bunchElapsedSeconds:bunch.loss.elapsedSeconds+
        bunch.road.filter(row=>row.sourceKm<=km).reduce(
          (sum,row)=>sum+row.elapsedSeconds,0),
      gapSecondsToBunch:nextGap,
      energyBefore:energy,energySpent:price.energyDemand,
      recoveryAward:0,cap,energyAfter:after,
      officialResults:false});
    energy=after;
    gapSeconds=nextGap;
  }
  return {version:PHYSICAL_DETACHED_SOLO_RUN_VERSION,
    sourceKm:throughKm,riderId,completion,steps,
    elapsedSeconds,gapSecondsToBunch:gapSeconds,
    energyAfter:energy,
    physicalGroup:steps.at(-1).physicalGroup,
    officialResults:false};
}

export function validatePhysicalDetachedSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,runPhysicalDetachedSoloV1(input)))
    throw new Error('Detached solo differs from committed road.');
  return true;
}
