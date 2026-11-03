// One physical rear group's payable road from a known clock and energy.
// Callers establish membership through a recorded contact before use.
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
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

export const PHYSICAL_REAR_EVENT_TRACK_VERSION=
  'v2-physical-rear-event-track-1';
export const PHYSICAL_REAR_SOLO_TRACK_VERSION=
  'v2-physical-rear-solo-track-1';
export const PHYSICAL_REAR_SOLO_FROM_CONTACT_VERSION=
  'v2-physical-rear-solo-from-contact-1';
const effortRank={conserve:0,steady:1,hard:2};

function entriesAtKm(startInput,riderIds,km,energyByRider){
  return riderIds.map(riderId=>{
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    const rider=team?.riders.find(row=>
      row.id===riderId);
    const plan=startInput.soloCommitments?.find(row=>
      row.riderId===riderId);
    const intent=startInput.physicalRearIntentVersion===2?
      physicalRearIntentAtKmV2({startInput,riderId,km}):
      plan?rearSoloPlanAtKmV1({
        commitment:plan,km}):
        {action:'finish_safely',effort:'conserve'};
    const order=team&&orderAt(team.orders,km-1);
    const energyBefore=energyByRider[riderId];
    if(!rider||!order||
      effortRank[intent.effort]===undefined||
      effortRank[intent.effort]>
        effortRank[order.effort]||
      !Number.isFinite(energyBefore)||
      energyBefore<0)
      throw new Error('Rear event track lacks paid rider plan.');
    return {riderId,team,rider,intent,order,
      energyBefore};
  });
}

export function pricePhysicalRearSoloTrackV1({startInput,
  riderId,energyBefore,km,startClock,groupId}){
  if(!Number.isInteger(km)||km<1||
    km>startInput?.routeKilometres?.length||
    !Number.isFinite(startClock)||startClock<0||
    groupId!==`solo-${riderId}`)
    throw new Error('Rear solo needs recorded road state.');
  const entry=entriesAtKm(startInput,[riderId],
    km,{[riderId]:energyBefore})[0];
  const segment=startInput.routeKilometres[km-1];
  const effect=riderKilometreEffect(entry.rider,
    segment,{phase:'solo',energy:energyBefore,
      exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[entry.intent.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error('Rear solo needs paid pace.');
  const paid=priceRearEnergyDemandV1({
    rider:entry.rider,segment,energyBefore,
    effort:entry.intent.effort,
    role:'solo',distanceM:1000});
  const recovery=recoveryForKilometre({
    rider:entry.rider,segment,
    effort:entry.intent.effort,group:'solo',
    working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Rear solo cannot claim recovery.');
  const cap=replayRearEnergyCapV1({
    rider:entry.rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(entry.intent.action==='save_for_stage'&&
    energyAfter<entry.intent.committedStagePlan
      .reserveEnergy)
    throw new Error('Rear solo breaks stage reserve.');
  const row={riderId,teamId:entry.team.id,
    role:'solo',
    decision:{riderId,goal:entry.intent.action,
      effort:entry.intent.effort,
      teamOrderEffort:entry.order.effort,
      ...(startInput.physicalRearIntentVersion===2?{
        committedTeamStake:
          entry.intent.committedTeamStake,
        intentSource:entry.intent.source}:{}),
      choice:'ride_solo',
      reason:'paid_detached_road'},
    energyBefore,energySpent:paid.energyDemand,
    draftFraction:1,recoveryAward:0,
    cap,energyAfter};
  return {version:PHYSICAL_REAR_SOLO_TRACK_VERSION,
    km,groupId,riderId,kind:'solo',
    riderIds:[riderId],leaderRiderId:riderId,
    startM:0,startClock,secondsPerKm,
    seconds:secondsPerKm,
    endClock:startClock+secondsPerKm,
    rows:[row],domainStartM:0,
    breaks:[],
    clockAt:metres=>startClock+
      secondsPerKm*metres/1000,
    energyAt:metres=>energyBefore-
      row.energySpent*metres/1000};
}

export function pricePhysicalRearSoloFromContactV1({
  startInput,riderId,energyBefore,km,startM,
  startClock,groupId}){
  if(!Number.isFinite(startM)||startM<=0||
    startM>=1000||
    groupId!==`solo-${riderId}`||
    !Number.isFinite(startClock)||
    startClock<0)
    throw new Error(
      'Rear solo continuation needs paid contact.');
  const entry=entriesAtKm(startInput,[riderId],
    km,{[riderId]:energyBefore})[0];
  const segment=startInput.routeKilometres[km-1];
  const effect=riderKilometreEffect(entry.rider,
    segment,{phase:'solo',energy:energyBefore,
      exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[
      entry.intent.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const distanceM=1000-startM;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error(
      'Rear solo continuation needs paid pace.');
  const paid=priceRearEnergyDemandV1({
    rider:entry.rider,segment,energyBefore,
    effort:entry.intent.effort,
    role:'solo',distanceM});
  const recovery=recoveryForKilometre({
    rider:entry.rider,segment,
    effort:entry.intent.effort,group:'solo',
    working:true,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error(
      'Rear solo continuation cannot claim recovery.');
  const cap=replayRearEnergyCapV1({
    rider:entry.rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  if(entry.intent.action==='save_for_stage'&&
    energyAfter<entry.intent.committedStagePlan
      .reserveEnergy)
    throw new Error(
      'Rear solo continuation breaks stage reserve.');
  const decision={riderId,
    goal:entry.intent.action,
    effort:entry.intent.effort,
    teamOrderEffort:entry.order.effort,
    ...(startInput.physicalRearIntentVersion===2?{
      committedTeamStake:
        entry.intent.committedTeamStake,
      intentSource:entry.intent.source}:{}),
    choice:'ride_solo',
    reason:'paid_group_separation'};
  const row={riderId,teamId:entry.team.id,
    role:'solo',decision,energyBefore,
    energySpent:paid.energyDemand,
    draftFraction:1,recoveryAward:0,
    cap,energyAfter};
  return {version:
    PHYSICAL_REAR_SOLO_FROM_CONTACT_VERSION,
    km,groupId,riderId,kind:'solo',
    riderIds:[riderId],
    leaderRiderId:riderId,
    startM,startClock,secondsPerKm,
    seconds:secondsPerKm*distanceM/1000,
    endClock:startClock+
      secondsPerKm*distanceM/1000,
    rows:[row],domainStartM:startM,
    domainEndM:1000,breaks:[],
    clockAt:metres=>startClock+
      secondsPerKm*(metres-startM)/1000,
    energyAt:metres=>energyBefore-
      row.energySpent*(metres-startM)/
        distanceM};
}

export function pricePhysicalRearEventTrackV1({startInput,
  riderIds,energyByRider,km,startM,startClock,
  rotationIndex=0,contactLeaderRiderId=null,
  groupId}){
  if(!Array.isArray(riderIds)||riderIds.length<2||
    new Set(riderIds).size!==riderIds.length||
    !Number.isInteger(km)||km<1||
    km>startInput.routeKilometres.length||
    !Number.isFinite(startM)||startM<0||
    startM>=1000||
    !Number.isFinite(startClock)||startClock<0||
    !Number.isInteger(rotationIndex)||
    rotationIndex<0||rotationIndex>=riderIds.length||
    typeof groupId!=='string'||!groupId)
    throw new Error('Rear event track needs paid group state.');
  const segment=startInput.routeKilometres[km-1];
  const entries=entriesAtKm(startInput,riderIds,
    km,energyByRider);
  const preferred=contactLeaderRiderId?
    entries.find(row=>row.riderId===
      contactLeaderRiderId):
    entries[rotationIndex];
  const leader=preferred?.intent.action===
    'save_for_stage'?entries.find(row=>
      row.intent.action!=='save_for_stage'):
    preferred;
  if(!leader||leader.intent.action===
    'save_for_stage')
    throw new Error('Rear event track needs willing leader.');
  const ability=entry=>{
    const leading=entry===leader;
    const effect=riderKilometreEffect(
      entry.rider,segment,{phase:leading?
        'solo':'cruise',
      energy:entry.energyBefore,
      exposed:segment.exposed});
    return effect.ability+
      (TUNING.effortPressure[
        entry.intent.effort]-1)*20+
      (leading?0:MOTOR_DRAFT_SHELTER[
        segment.terrain]);
  };
  const groupAbility=Math.min(...entries.map(ability));
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-groupAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error('Rear event track needs paid pace.');
  const distanceM=1000-startM;
  const rows=entries.map(entry=>{
    const role=entry===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({
      rider:entry.rider,segment,
      energyBefore:entry.energyBefore,
      effort:entry.intent.effort,role,distanceM});
    const recovery=recoveryForKilometre({
      rider:entry.rider,segment,
      effort:entry.intent.effort,
      group:'dropped',working:role==='leader',
      quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Rear event track cannot claim recovery.');
    const cap=replayRearEnergyCapV1({
      rider:entry.rider,
      kilometres:startInput.routeKilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      paid.energyAfter).toFixed(3);
    if(entry.intent.action==='save_for_stage'&&
      energyAfter<entry.intent.committedStagePlan
        .reserveEnergy)
      throw new Error('Rear event track breaks stage reserve.');
    return {riderId:entry.riderId,
      teamId:entry.team.id,role,
      decision:{riderId:entry.riderId,
        goal:entry.intent.action,
        effort:entry.intent.effort,
        teamOrderEffort:entry.order.effort,
        ...(startInput.physicalRearIntentVersion===2?{
          committedTeamStake:
            entry.intent.committedTeamStake,
          intentSource:entry.intent.source}:{}),
        choice:role==='leader'?'pull':'shelter',
        reason:startM>0?
          role==='leader'?
            'paid_contact_turn':
            'shelter_after_paid_contact':
          role==='leader'?
            'paid_rear_rotation':
            'save_energy_in_rear_shelter'},
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      draftFraction:paid.draftFraction,
      recoveryAward:0,cap,energyAfter};
  });
  const seconds=secondsPerKm*distanceM/1000;
  return {version:PHYSICAL_REAR_EVENT_TRACK_VERSION,
    km,groupId,riderIds:[...riderIds],
    leaderRiderId:leader.riderId,
    startM,startClock,secondsPerKm,seconds,
    endClock:startClock+seconds,
    groupAbility,rows,
    domainStartM:startM,breaks:[],
    riderId:groupId,
    clockAt:metres=>startClock+
      secondsPerKm*(metres-startM)/1000,
    energyAt:metres=>rows.map(row=>({
      riderId:row.riderId,
      energyAtContact:row.energyBefore-
        row.energySpent*(metres-startM)/
          distanceM}))};
}
