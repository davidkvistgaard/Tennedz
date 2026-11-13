// Separate paid road for one rider after a staggered bunch loss.
// Contact with another detached rider needs its own sourced transition.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalStaggeredLossKmV1,
  partitionPhysicalStaggeredLossArrivalsV1} from
  './physical-pace-loss-completion-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_STAGGERED_DETACHED_SOLO_VERSION=
  'v2-physical-staggered-detached-solo-1';
export const PHYSICAL_STAGGERED_SOLO_FIELD_CANDIDATES_VERSION=
  'v2-physical-staggered-solo-field-candidates-1';
const ARRIVAL_ONLY_CANDIDATE_VERSION=
  'v2-physical-staggered-solo-arrival-candidate-1';
const effortRank={conserve:0,steady:1,hard:2};

function runFromCompletion({startInput,staggered,riderId,
  throughKm,completion}){
  const loss=staggered.losses.find(row=>row.riderId===riderId);
  if(!loss||throughKm<=loss.sourceKm)
    throw new Error('Staggered solo needs later paid road.');
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const plan=startInput.soloCommitments?.find(row=>
    row.riderId===riderId);
  let energy=completion.energyAfter;
  let elapsedSeconds=completion.elapsedSeconds;
  let gapSeconds=completion.gapSecondsToBunch;
  let bunchElapsedSeconds=staggered.road.slice(0,
    loss.sourceKm).reduce((sum,row)=>sum+row.elapsedSeconds,0);
  const steps=[];
  for(let km=loss.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const bunchStep=staggered.road[km-1];
    const intent=startInput.physicalRearIntentVersion===2?
      physicalRearIntentAtKmV2({startInput,riderId,km}):
      plan?rearSoloPlanAtKmV1({commitment:plan,km}):
        {action:'finish_safely',effort:'conserve'};
    const teamOrder=orderAt(team.orders,km-1);
    if(effortRank[intent.effort]>effortRank[teamOrder.effort])
      throw new Error('Staggered solo exceeds team effort order.');
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[intent.effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Staggered solo needs paid pace.');
    const nextGap=gapSeconds+seconds-bunchStep.elapsedSeconds;
    if(nextGap<=0)
      throw new Error('Staggered solo needs separate bunch contact.');
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort:intent.effort,
      role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort:intent.effort,group:'solo',working:true,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Staggered solo cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:startInput.routeKilometres,throughKm:km}).cap;
    const after=+Math.min(cap,paid.energyAfter).toFixed(3);
    if(intent.action==='save_for_stage'&&
      after<intent.committedStagePlan.reserveEnergy)
      throw new Error('Staggered solo breaks future-stage reserve.');
    elapsedSeconds+=seconds;
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    if(Math.abs(elapsedSeconds-bunchElapsedSeconds-
      nextGap)>1e-7)
      throw new Error('Staggered solo clock differs from bunch.');
    steps.push({sourceKm:km,riderId,
      decision:{goal:intent.action,effort:intent.effort,
        teamOrderEffort:teamOrder.effort,
        ...(startInput.physicalRearIntentVersion===2?{
          committedTeamStake:intent.committedTeamStake,
          intentSource:intent.source,
          ...(intent.committedStagePlan?{
            committedStagePlan:structuredClone(
              intent.committedStagePlan)}:{})}:{}),
        reason:plan?'committed_detached_solo_plan':
          startInput.physicalRearIntentVersion===2?
            'committed_order_after_paid_loss':
            'cannot_hold_paid_front_pace'},
      physicalGroup:{id:`solo-${riderId}`,
        riderIds:[riderId],atDistanceM:km*1000},
      seconds,elapsedSeconds,bunchElapsedSeconds,
      gapSecondsToBunch:nextGap,
      energyBefore:energy,energySpent:paid.energyDemand,
      recoveryAward:0,cap,energyAfter:after,
      officialResults:false});
    energy=after;
    gapSeconds=nextGap;
  }
  return {version:PHYSICAL_STAGGERED_DETACHED_SOLO_VERSION,
    sourceKm:throughKm,riderId,lossKm:loss.sourceKm,
    completion,steps,elapsedSeconds,
    gapSecondsToBunch:gapSeconds,energyAfter:energy,
    physicalGroup:steps.at(-1).physicalGroup,
    officialResults:false};
}

export function runPhysicalStaggeredDetachedSoloV1({startInput,
  start,staggered,riderId,throughKm}){
  if(!isDeepStrictEqual(staggered,
    runPhysicalStaggeredBunchLossV1({startInput,start,
      throughKm:staggered?.throughKm}))||
    !Number.isInteger(throughKm)||
    throughKm>staggered.throughKm)
    throw new Error('Staggered solo needs replayed bunch road.');
  const completion=completePhysicalStaggeredLossKmV1({
    startInput,start,staggered,riderId});
  return runFromCompletion({startInput,staggered,
    riderId,throughKm,completion});
}

// Batch source candidates for diagnostics only. Other solo and rear
// group contacts are not settled by these independent trajectories.
export function probePhysicalStaggeredSoloFieldV1({startInput,
  start,staggered,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<1||
    throughKm>staggered?.throughKm)
    throw new Error('Solo field probe needs a sourced kilometre.');
  const arrivals=partitionPhysicalStaggeredLossArrivalsV1({
    startInput,start,staggered});
  const candidates=[];
  const refusals=[];
  for(const completion of arrivals.completions){
    if(throughKm<completion.sourceKm)continue;
    if(throughKm===completion.sourceKm){
      candidates.push({version:ARRIVAL_ONLY_CANDIDATE_VERSION,
        sourceKm:throughKm,riderId:completion.riderId,
        lossKm:completion.sourceKm,
        completion,steps:[],
        elapsedSeconds:completion.elapsedSeconds,
        energyAfter:completion.energyAfter,
        physicalGroup:completion.physicalGroup,
        officialResults:false});
      continue;
    }
    try{
      candidates.push(runFromCompletion({startInput,
        staggered,riderId:completion.riderId,
        throughKm,completion}));
    }catch(error){refusals.push({
      riderId:completion.riderId,
      reason:error.message});}
  }
  return {version:
    PHYSICAL_STAGGERED_SOLO_FIELD_CANDIDATES_VERSION,
  throughKm,bunchSourceVersion:staggered.version,
  paidArrivalsVersion:arrivals.version,
  candidates,refusals,
  contactsWithOtherRidersUnsettled:true,
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalStaggeredSoloFieldV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalStaggeredSoloFieldV1(input)))
    throw new Error('Solo field probe differs from source.');
  return true;
}

export function validatePhysicalStaggeredDetachedSoloV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalStaggeredDetachedSoloV1(input)))
    throw new Error('Staggered solo differs from paid source.');
  return true;
}
