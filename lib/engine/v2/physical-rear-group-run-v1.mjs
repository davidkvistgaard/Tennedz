// Consecutive paid road for a rear group born at recorded physical
// contact. One rider leads each kilometre; the other pays shelter.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalRearContactKmV1} from
  './physical-rear-contact-road-v1.mjs';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_REAR_GROUP_RUN_VERSION=
  'v2-physical-rear-group-run-1';
const effortRank={conserve:0,steady:1,hard:2};
const pace=(segment,ability)=>{
  const seconds=segmentBaseSeconds(segment)+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Rear group needs physical paid pace.');
  return seconds;
};

export function runPhysicalRearGroupV1({startInput,start,lossKm,
  contactKm,riderIds,contact,contactRoad,throughKm}){
  if(!isDeepStrictEqual(contactRoad,
    finishPhysicalRearContactKmV1({startInput,start,lossKm,
      contactKm,riderIds,contact}))||
    !Number.isInteger(throughKm)||throughKm<=contactKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Rear group needs replayed contact and later road.');
  const bunch=runPhysicalBunchAfterPaceLossV1({startInput,start,
    lossKm,throughKm});
  const entries=riderIds.map(riderId=>{
    const team=startInput.teams.find(row=>row.riders.some(rider=>
      rider.id===riderId));
    const rider=team.riders.find(row=>row.id===riderId);
    const plan=startInput.soloCommitments.find(row=>
      row.riderId===riderId);
    return {riderId,rider,team,plan};
  });
  let energyByRider=contactRoad.energyByRider;
  let elapsedSeconds=contactRoad.elapsedSeconds;
  let gapSecondsToBunch=contactRoad.gapSecondsToBunch;
  const steps=[];
  for(let km=contactKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const bunchStep=bunch.road.find(row=>row.sourceKm===km);
    const current=entries.map(entry=>{
      const intent=rearSoloPlanAtKmV1({
        commitment:entry.plan,km});
      const order=orderAt(entry.team.orders,km-1);
      if(effortRank[intent.effort]>effortRank[order.effort])
        throw new Error('Rear group exceeds a team effort order.');
      return {...entry,intent};
    });
    const firstIndex=(km-contactKm)%2;
    const preferred=current[firstIndex];
    const alternate=current[1-firstIndex];
    const leader=preferred.intent.action==='save_for_stage'?
      alternate:preferred;
    if(leader.intent.action==='save_for_stage')
      throw new Error('Rear group needs a willing paid leader.');
    const follower=current.find(row=>row!==leader);
    const leaderEffect=riderKilometreEffect(leader.rider,segment,{
      phase:'solo',energy:energyByRider[leader.riderId],
      exposed:segment.exposed});
    const leaderMaxAbility=leaderEffect.ability+
      (TUNING.effortPressure[leader.intent.effort]-1)*20;
    const followerEffect=riderKilometreEffect(follower.rider,
      segment,{phase:'cruise',
        energy:energyByRider[follower.riderId],
        exposed:segment.exposed});
    const followerAbility=followerEffect.ability+
      (TUNING.effortPressure[follower.intent.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage;
    if(followerAbility+1e-9<leaderMaxAbility&&
      leader.intent.action==='rejoin_bunch')
      throw new Error('Rear follower cannot hold paid leader.');
    const leaderAbility=Math.min(leaderMaxAbility,followerAbility);
    const seconds=pace(segment,leaderAbility);
    const nextGap=gapSecondsToBunch+seconds-
      bunchStep.elapsedSeconds;
    if(nextGap<=0)
      throw new Error('Rear group needs separate bunch contact.');
    const riders=current.map(entry=>{
      const role=entry===leader?'leader':'sheltered';
      const paid=priceRearEnergyDemandV1({
        rider:entry.rider,segment,
        energyBefore:energyByRider[entry.riderId],
        effort:entry.intent.effort,role,distanceM:1000});
      const recovery=recoveryForKilometre({rider:entry.rider,
        segment,effort:entry.intent.effort,
        group:'dropped',working:role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Rear group cannot claim bunch recovery.');
      const cap=replayRearEnergyCapV1({rider:entry.rider,
        kilometres:startInput.routeKilometres,throughKm:km}).cap;
      const energyAfter=+Math.min(cap,paid.energyAfter).toFixed(3);
      if(entry.intent.action==='save_for_stage'&&
        energyAfter<entry.intent.committedStagePlan.reserveEnergy)
        throw new Error('Rear group breaks future-stage reserve.');
      return {riderId:entry.riderId,teamId:entry.team.id,
        decision:{goal:entry.intent.action,
          effort:entry.intent.effort,
          choice:role==='leader'?'pull':'shelter',
          reason:role==='leader'?'paid_rear_rotation':
            'save_energy_in_rear_shelter'},
        role,energyBefore:paid.energyBefore,
        energySpent:paid.energyDemand,recoveryAward:0,
        cap,energyAfter};
    });
    elapsedSeconds+=seconds;
    gapSecondsToBunch=nextGap;
    const bunchElapsedSeconds=bunch.loss.elapsedSeconds+
      bunch.road.filter(row=>row.sourceKm<=km).reduce((sum,row)=>
        sum+row.elapsedSeconds,0);
    if(Math.abs(elapsedSeconds-bunchElapsedSeconds-
      gapSecondsToBunch)>1e-7)
      throw new Error('Rear group clock differs from bunch source.');
    energyByRider=Object.fromEntries(riders.map(row=>
      [row.riderId,row.energyAfter]));
    steps.push({sourceKm:km,leaderRiderId:leader.riderId,
      leaderMaxAbility,groupAbility:leaderAbility,
      followerHoldAbility:followerAbility,
      startDistanceM:(km-1)*1000,
      endDistanceM:km*1000,seconds,elapsedSeconds,
      bunchElapsedSeconds,
      gapSecondsToBunch,
      physicalGroup:{id:contactRoad.physicalGroup.id,
        riderIds:[...riderIds],atDistanceM:km*1000},
      riders,energyByRider,officialResults:false});
  }
  return {version:PHYSICAL_REAR_GROUP_RUN_VERSION,
    sourceKm:throughKm,steps,
    physicalGroup:steps.at(-1).physicalGroup,
    energyByRider,elapsedSeconds,gapSecondsToBunch,
    officialResults:false};
}

export function validatePhysicalRearGroupV1(input,recording){
  if(!isDeepStrictEqual(recording,runPhysicalRearGroupV1(input)))
    throw new Error('Rear group differs from committed paid road.');
  return true;
}
