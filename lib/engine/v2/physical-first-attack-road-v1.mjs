// Pay an ordered rider's first solo kilometre from measured bunch contact.
// The launch is an event at the boundary; no gap is credited at the line.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_ATTACK_ROAD_VERSION=
  'physical-first-attack-road-1';

export function advancePhysicalFirstAttackRoadV1({prior,choice,
  segment,kilometres,teams,stakes}){
  const km=prior?.sourceKm+1;
  const bunch=prior?.roads?.find(row=>row.roadId==='peloton');
  if(segment?.km!==km||kilometres?.[km-1]?.km!==km||
    choice?.sourceKm!==km||
    choice.choice!=='attempt_paid_attack'||
    !Array.isArray(bunch?.riderIds)||
    !bunch.riderIds.includes(choice.riderId)||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error('Attack road needs an ordered measured launch.');
  const expected=choosePhysicalFirstBoundaryAttacksV1({
    prior,segment,teams,stakes}).find(row=>
    row.teamId===choice.teamId);
  if(!isDeepStrictEqual(choice,expected))
    throw new Error('Attack road choice differs from committed order.');
  const team=teams.find(row=>row.id===choice.teamId);
  const rider=team?.riders.find(row=>row.id===choice.riderId);
  const state=prior.riders.find(row=>row.riderId===choice.riderId);
  const roadId=`solo:${choice.riderId}`;
  if(!rider||!state||state.roadId!=='peloton'||
    state.distanceM!==(km-1)*1000||
    Math.abs(state.clockSeconds-bunch.clockSeconds)>.002||
    prior.roads.some(row=>row.roadId===roadId))
    throw new Error('Attack road lacks exclusive bunch contact.');
  const order=orderAt(team.orders,km-1);
  const effect=riderKilometreEffect(rider,segment,{
    phase:'attack',energy:state.reserve,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Attack road lacks payable speed.');
  const work=quoteRearEnergyDemandV1({rider,segment,
    energyBefore:state.reserve,effort:order.effort,
    role:'solo',distanceM:1000});
  const paidFromReserve=work.energyDemand+
    choice.attackInitiationCost;
  if(paidFromReserve>state.reserve+1e-9)
    throw new Error('Attacker cannot pay the full kilometre.');
  const cap=replayRearEnergyCapV1({rider,kilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    state.reserve-paidFromReserve).toFixed(3);
  const capAdjustment=Math.max(0,
    state.reserve-paidFromReserve-cap);
  const finishClockSeconds=bunch.clockSeconds+
    secondsPerKm;
  const launchEvent={version:PHYSICAL_FIRST_ATTACK_ROAD_VERSION,
    sourceKm:km,riderId:rider.id,teamId:team.id,
    fromRoadId:'peloton',toRoadId:roadId,
    atDistanceM:(km-1)*1000,
    atClockSeconds:bunch.clockSeconds,
    choiceVersion:choice.version,
    choice:'launch_from_measured_bunch_contact'};
  const decision={version:PHYSICAL_FIRST_ATTACK_ROAD_VERSION,
    sourceKm:km,riderId:rider.id,teamId:team.id,
    roadId,leaderRiderId:rider.id,role:'solo_attacker',
    teamOrderAttack:order.attack,
    teamOrderEffort:order.effort,
    sportingGoal:choice.sportingGoal,
    sportingCaptainId:choice.sportingCaptainId,
    perceivedAbilityAtChoice:ability,
    choice:'pay_attack_solo_kilometre',
    energyBefore:state.reserve,
    roadWorkCost:work.energyDemand,
    attackInitiationCost:choice.attackInitiationCost,
    paidFromReserve,recoveryAward:0,
    capAdjustment,energyAfter,quietKm:0};
  const road={roadId,kind:'solo_attack',
    leaderRiderId:rider.id,riderIds:[rider.id],
    startDistanceM:(km-1)*1000,endDistanceM:km*1000,
    startClockSeconds:bunch.clockSeconds,
    finishClockSeconds,speedMps:1000/secondsPerKm,
    riderDecisions:[decision]};
  const finish={riderId:rider.id,sourceKm:km,
    physicalGroup:roadId,endDistanceM:km*1000,
    clockSeconds:finishClockSeconds,
    energyBefore:state.reserve,paidFromReserve,
    recoveryAward:0,capAdjustment,energyAfter,quietKm:0};
  return {version:PHYSICAL_FIRST_ATTACK_ROAD_VERSION,
    sourceKm:km,launchEvent,choice,road,finishes:[finish],
    officialResults:false};
}

export function launchPhysicalFirstAttackRoadsV1({prior,
  choices,segment,kilometres,teams,stakes}){
  if(!Array.isArray(choices)||
    choices.length!==teams?.length||
    new Set(choices.map(row=>row.teamId)).size!==
      choices.length)
    throw new Error('Attack launch needs every team choice.');
  const attempts=choices.filter(row=>
    row.choice==='attempt_paid_attack');
  const attackSteps=attempts.map(choice=>
    advancePhysicalFirstAttackRoadV1({prior,choice,
      segment,kilometres,teams,stakes}));
  const departing=new Set(attempts.map(row=>row.riderId));
  const bunch=prior.roads.find(row=>
    row.roadId==='peloton');
  if(departing.size!==attempts.length||
    !bunch||bunch.riderIds.length<=departing.size)
    throw new Error('Attack launch needs a remaining bunch.');
  const state={...prior,
    roads:prior.roads.map(row=>row.roadId==='peloton'?
      {...row,riderIds:row.riderIds.filter(id=>
        !departing.has(id))}:row).concat(
      attackSteps.map(step=>({
        roadId:step.road.roadId,
        riderIds:[step.choice.riderId],
        clockSeconds:bunch.clockSeconds}))),
    riders:prior.riders.map(row=>
      departing.has(row.riderId)?
        {...row,roadId:`solo:${row.riderId}`}:row)};
  return {state,attackSteps,
    launchEvents:attackSteps.map(step=>
      step.launchEvent)};
}
