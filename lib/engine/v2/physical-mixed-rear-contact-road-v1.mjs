// Continue one already exposed leader and nineteen sheltered riders
// from a recorded rear-solo meeting to the kilometre's end.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalMixedRearSoloV1} from
  './physical-mixed-rear-solo-contact-v1.mjs';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MIXED_REAR_CONTACT_ROAD_VERSION=
  'v2-physical-mixed-rear-contact-road-1';

export function finishPhysicalMixedRearContactKmV1({
  startInput,start,lossKm,contactKm,contact}){
  const sourceInput={startInput,start,lossKm,contactKm};
  if(!isDeepStrictEqual(contact,
    contactPhysicalMixedRearSoloV1(sourceInput)))
    throw new Error('Mixed contact road needs replayed meeting.');
  const segment=startInput.routeKilometres[contactKm-1];
  const remainingM=contactKm*1000-
    contact.atDistanceM;
  if(remainingM<=0||remainingM>=1000)
    throw new Error('Mixed contact needs payable remainder.');
  const entries=contact.riders.map(row=>{
    const team=startInput.teams.find(item=>
      item.id===row.teamId);
    const rider=team?.riders.find(item=>
      item.id===row.riderId);
    if(!rider)
      throw new Error('Mixed contact lacks source rider.');
    return {row,team,rider,
      order:orderAt(team.orders,contactKm-1)};
  });
  const leader=entries.find(entry=>
    entry.row.riderId===contact.leaderRiderId);
  if(!leader||leader.row.role!=='leader')
    throw new Error('Mixed contact lacks exposed leader.');
  const leaderEffect=riderKilometreEffect(leader.rider,
    segment,{phase:'solo',
      energy:leader.row.energyAfter,
      exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[leader.row.effort]-1)*20;
  const followerAbilities=entries.filter(entry=>
    entry!==leader).map(entry=>{
    const effect=riderKilometreEffect(entry.rider,
      segment,{phase:'cruise',
        energy:entry.row.energyAfter,
        exposed:segment.exposed});
    return effect.ability+
      (TUNING.effortPressure[entry.row.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage;
  });
  const groupAbility=Math.min(leaderAbility,
    ...followerAbilities);
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-groupAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Mixed contact lacks payable shared pace.');
  const remainingSeconds=secondsPerKm*
    remainingM/1000;
  const gapSecondsToBunch=
    contact.behindBunchSeconds+
    remainingSeconds-
    contact.bunchSecondsPerKm*remainingM/1000;
  if(gapSecondsToBunch<=0)
    throw new Error('Mixed rear needs paid bunch contact.');
  const riders=entries.map(entry=>{
    const role=entry===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({
      rider:entry.rider,segment,
      energyBefore:entry.row.energyAfter,
      effort:entry.row.effort,role,
      distanceM:remainingM});
    const recovery=recoveryForKilometre({
      rider:entry.rider,segment,
      effort:entry.row.effort,
      group:'dropped',working:role==='leader',
      quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Mixed contact cannot claim recovery.');
    const cap=replayRearEnergyCapV1({
      rider:entry.rider,
      kilometres:startInput.routeKilometres,
      throughKm:contactKm}).cap;
    const energyAfter=+Math.min(cap,
      paid.energyAfter).toFixed(3);
    const plan=startInput.soloCommitments?.find(item=>
      item.riderId===entry.row.riderId);
    if(entry.row.goal==='save_for_stage'&&
      (!plan?.committedStagePlan||
      energyAfter<plan.committedStagePlan
        .reserveEnergy))
      throw new Error('Mixed contact breaks stage reserve.');
    return {riderId:entry.row.riderId,
      teamId:entry.team.id,role,
      decision:{riderId:entry.row.riderId,
        goal:entry.row.goal,
        teamOrderEffort:entry.order.effort,
        effort:entry.row.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'?
          'paid_rear_contact_turn':
          'shelter_after_paid_contact'},
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      recoveryAward:0,cap,energyAfter};
  });
  const bunch=runPhysicalBunchAfterPaceLossV1({
    startInput,start,lossKm,throughKm:contactKm});
  const bunchStep=bunch.road.at(-1);
  const bunchElapsedSeconds=bunch.loss.elapsedSeconds+
    bunch.road.reduce((sum,row)=>
      sum+row.elapsedSeconds,0);
  const elapsedSeconds=contact.clockSeconds+
    remainingSeconds;
  if(Math.abs(elapsedSeconds-bunchElapsedSeconds-
    gapSecondsToBunch)>1e-7)
    throw new Error('Mixed contact road and bunch clocks differ.');
  return {version:PHYSICAL_MIXED_REAR_CONTACT_ROAD_VERSION,
    sourceKm:contactKm,
    startDistanceM:contact.atDistanceM,
    endDistanceM:contactKm*1000,
    leaderRiderId:leader.row.riderId,
    groupAbility,secondsPerKm,
    elapsedSeconds,bunchElapsedSeconds,
    gapSecondsToBunch,bunchStep,
    physicalGroup:{id:contact.physicalGroup.id,
      riderIds:[...contact.physicalGroup.riderIds],
      atDistanceM:contactKm*1000},
    riders,energyByRider:Object.fromEntries(
      riders.map(row=>[
        row.riderId,row.energyAfter])),
    officialResults:false};
}

export function validatePhysicalMixedRearContactKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalMixedRearContactKmV1(input)))
    throw new Error('Mixed contact road differs from paid source.');
  return true;
}
