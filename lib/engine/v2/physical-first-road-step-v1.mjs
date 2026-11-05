// Advance one already-connected road for one kilometre. This step
// cannot create a group, catch a rider, or hide an unpayable drop.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,
  TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_ROAD_STEP_VERSION=
  'physical-first-road-step-1';
const EPS=.002;

export function advancePhysicalFirstRoadV1({prior,roadId,
  leaderRiderId,planVersion,segment,kilometres,teams,stakes}){
  const km=prior?.sourceKm+1;
  const old=prior?.roads?.find(road=>road.roadId===roadId);
  const riderIds=old?.riderIds;
  if(!Number.isInteger(km)||km<1||segment?.km!==km||
    kilometres?.[km-1]?.km!==km||
    typeof planVersion!=='string'||!planVersion||
    !Array.isArray(prior.riders)||
    !Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    !Number.isFinite(old.clockSeconds)||
    !riderIds.includes(leaderRiderId)||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error('Physical road step needs a paid prior road.');
  const byRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const byStake=new Map(stakes.map(stake=>
    [stake.teamId,stake]));
  const priorRiders=new Map(prior.riders.map(row=>
    [row.riderId,row]));
  if(priorRiders.size!==prior.riders.length||
    prior.riders.filter(row=>
      row.roadId===roadId).length!==riderIds.length)
    throw new Error('Physical road step has invalid prior membership.');
  const leader=byRider.get(leaderRiderId);
  const leaderState=priorRiders.get(leaderRiderId);
  if(!leader||!leaderState||
    !Number.isFinite(leaderState.reserve))
    throw new Error('Physical road step lacks named leader.');
  const leaderOrder=orderAt(leader.team.orders,km-1);
  const leaderAbility=riderKilometreEffect(
    leader.rider,segment,{phase:'solo',
      energy:leaderState.reserve,
      exposed:segment.exposed}).ability+
    (TUNING.effortPressure[leaderOrder.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-leaderAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Physical road step lacks payable speed.');
  const decisions=riderIds.map(riderId=>{
    const source=byRider.get(riderId);
    const state=priorRiders.get(riderId);
    const stake=byStake.get(source?.team.id);
    const order=source&&orderAt(source.team.orders,km-1);
    const role=riderId===leaderRiderId?'leader':'sheltered';
    if(!source||!state||state.roadId!==roadId||
      state.distanceM!==(km-1)*1000||
      Math.abs(state.clockSeconds-old.clockSeconds)>EPS||
      !Number.isFinite(state.reserve)||
      !Number.isInteger(state.quietKm)||state.quietKm<0||
      !order?.effort||!stake?.sportingGoal||
      !stake.sportingCaptainId)
      throw new Error(
        `Physical road step km ${km} rider ${riderId} lacks input.`);
    const bonus=(TUNING.effortPressure[order.effort]-1)*20;
    const ability=role==='leader'?leaderAbility:
      riderKilometreEffect(source.rider,segment,{
        phase:'cruise',energy:state.reserve,
        exposed:segment.exposed}).ability+bonus+
        MOTOR_DRAFT_SHELTER[segment.terrain];
    if(ability+EPS<leaderAbility){
      const error=new Error(
        `Physical road step km ${km} rider ${riderId} loses shelter.`);
      error.sourceEvidence={roadId,leaderRiderId,
        leaderAbility,perceivedShelterHoldAbility:ability,
        atDistanceM:(km-1)*1000};
      throw error;
    }
    const paid=priceRearEnergyDemandV1({rider:source.rider,
      segment,energyBefore:state.reserve,
      effort:order.effort,role,distanceM:1000});
    if(role==='sheltered'){
      const abilityAtEnd=riderKilometreEffect(
        source.rider,segment,{phase:'cruise',
          energy:paid.energyAfter,
          exposed:segment.exposed}).ability+bonus+
          MOTOR_DRAFT_SHELTER[segment.terrain];
      if(abilityAtEnd+EPS<leaderAbility){
        const error=new Error(
          `Physical road step km ${km} rider ${riderId} loses shelter.`);
        error.sourceEvidence={roadId,leaderRiderId,
          leaderAbility,perceivedShelterHoldAbility:abilityAtEnd,
          atDistanceM:km*1000};
        throw error;
      }
    }
    const recovery=recoveryForKilometre({rider:source.rider,
      segment,effort:order.effort,
      group:roadId==='peloton'?'peloton':'dropped',
      working:role==='leader',quietKm:state.quietKm});
    const cap=replayRearEnergyCapV1({rider:source.rider,
      kilometres,throughKm:km}).cap;
    const beforeCap=paid.energyAfter+recovery.recovery;
    const capAdjustment=Math.max(0,beforeCap-cap);
    return {version:PHYSICAL_FIRST_ROAD_STEP_VERSION,
      sourceKm:km,riderId,teamId:source.team.id,
      roadId,leaderRiderId,role,
      planVersion,teamOrderEffort:order.effort,
      managerChase:order.chase,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      perceivedAbilityAtChoice:ability,
      leaderAbility,choice:role==='leader'?
        'pay_road_lead':'hold_paid_road_shelter',
      energyBefore:state.reserve,
      paidFromReserve:paid.energyDemand,
      recoveryAward:recovery.recovery,
      capAdjustment,energyAfter:
        +Math.min(cap,beforeCap).toFixed(3),
      quietKm:recovery.quietKm};
  });
  const finishClockSeconds=old.clockSeconds+secondsPerKm;
  const finishes=decisions.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:roadId,endDistanceM:km*1000,
    clockSeconds:finishClockSeconds,
    energyBefore:row.energyBefore,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:row.recoveryAward,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter,
    quietKm:row.quietKm}));
  return {version:PHYSICAL_FIRST_ROAD_STEP_VERSION,
    sourceKm:km,priorRoadId:roadId,planVersion,
    road:{roadId,kind:roadId==='peloton'?'peloton':
      riderIds.length===1?'solo':'rear_group',
      leaderRiderId,riderIds:[...riderIds],
      startDistanceM:(km-1)*1000,endDistanceM:km*1000,
      startClockSeconds:old.clockSeconds,
      finishClockSeconds,speedMps:1000/secondsPerKm,
      riderDecisions:decisions},
    finishes,officialResults:false};
}
