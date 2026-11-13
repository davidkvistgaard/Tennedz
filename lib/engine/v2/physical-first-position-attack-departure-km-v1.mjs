// A selected attack becomes a separate road only after the rider pays
// for passing the measured bunch front within the same kilometre.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  './physical-first-position-rotation-km-v2.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_POSITION_ATTACK_DEPARTURE_VERSION=
  'physical-first-position-attack-departure-km-1';
const EPS=1e-6;

const choicePriorFromPositions=(prior,activeSoloRoads)=>({
  sourceKm:prior.sourceKm,
  roads:[{roadId:'peloton',
    riderIds:prior.positions.map(row=>row.riderId),
    clockSeconds:prior.clockSeconds},
  ...activeSoloRoads.map(row=>({
    roadId:row.position.roadId,
    riderIds:[row.position.riderId],
    clockSeconds:row.lineClockSeconds}))],
  riders:[...prior.positions.map(row=>({
    riderId:row.riderId,teamId:row.teamId,
    roadId:'peloton',
    distanceM:prior.sourceKm*1000,
    clockSeconds:prior.clockSeconds,
    reserve:row.energy,quietKm:row.quietKm})),
  ...activeSoloRoads.map(row=>({
    riderId:row.position.riderId,
    teamId:row.position.teamId,
    roadId:row.position.roadId,
    distanceM:prior.sourceKm*1000,
    clockSeconds:row.lineClockSeconds,
    reserve:row.position.energy,
    quietKm:row.position.quietKm}))]});

export function advancePhysicalFirstPositionAttackDepartureKmV1({
  prior,segment,input,choice,activeSoloRoads=[]}){
  const km=prior?.sourceKm+1;
  if(segment?.km!==km||
    input?.kilometres?.[km-1]!==segment||
    !Array.isArray(prior?.positions)||
    !Number.isFinite(prior?.clockSeconds)||
    choice?.choice!=='attempt_paid_attack'||
    choice.sourceKm!==km||
    !Array.isArray(activeSoloRoads)||
    !isDeepStrictEqual(
      activeSoloRoads.map(row=>row.position?.riderId)
        .sort(),
      [...(prior.separateRoadRiderIds??[])]
        .sort())||
    activeSoloRoads.some(row=>
      !Number.isFinite(row.lineClockSeconds)||
      row.position?.roadId!==
        `solo:${row.position?.riderId}`||
      !Number.isFinite(row.position?.energy)))
    throw new Error('Position attack needs a committed attempt.');
  const chosen=choosePhysicalFirstBoundaryAttacksV1({
    prior:choicePriorFromPositions(prior,
      activeSoloRoads),segment,
    teams:input.teams,stakes:input.stakes,
    kilometres:input.kilometres})
    .filter(row=>row.choice==='attempt_paid_attack');
  if(chosen.length!==1||
    !isDeepStrictEqual(choice,chosen[0]))
    throw new Error('Position attack differs from team orders.');
  const attacker=prior.positions.find(row=>
    row.riderId===choice.riderId);
  const front=prior.positions[0];
  const team=input.teams.find(row=>
    row.id===choice.teamId);
  const rider=team?.riders.find(row=>
    row.id===choice.riderId);
  if(!attacker||!rider||
    attacker.teamId!==team.id||
    attacker.riderId===front.riderId||
    prior.positions.some(row=>
      row.riderId!==attacker.riderId&&
      row.lane===attacker.lane&&
      row.distanceM>attacker.distanceM+EPS))
    throw new Error('Position attacker lacks a clear passing lane.');
  const bunch=advancePhysicalFirstPositionRotationKmV2({
    prior,segment,input});
  if(bunch.event?.type==='paid_front_pass')
    throw new Error('Position attack overlaps a front rotation.');
  const elapsedSeconds=bunch.clockSeconds-prior.clockSeconds;
  const order=orderAt(team.orders,km-1);
  const effect=riderKilometreEffect(rider,segment,{
    phase:'attack',energy:attacker.energy,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error('Position attack lacks payable speed.');
  const attackSpeedMps=1000/secondsPerKm;
  const relativeSpeedMps=attackSpeedMps-
    bunch.firstSpeedMps;
  const requiredGainM=front.distanceM-
    attacker.distanceM+prior.grid.wheelSpacingM;
  const passSeconds=requiredGainM/relativeSpeedMps;
  if(relativeSpeedMps<=EPS||
    passSeconds<=EPS||
    passSeconds>=elapsedSeconds-EPS)
    throw new Error('Position attack cannot pass this kilometre.');
  const travelM=attackSpeedMps*elapsedSeconds;
  const endDistanceM=attacker.distanceM+travelM;
  if(travelM<1000||travelM>=2000||
    endDistanceM<=bunch.frontDistanceM+
      prior.grid.wheelSpacingM-EPS)
    throw new Error('Position attack lacks physical separation.');
  const first=priceRearEnergyDemandV1({
    rider,segment,energyBefore:attacker.energy,
    effort:order.effort,role:'solo',distanceM:1000});
  const extra=priceRearEnergyDemandV1({
    rider,segment,energyBefore:first.energyAfter,
    effort:order.effort,role:'solo',
    distanceM:travelM-1000});
  const paidFromReserve=first.energyDemand+
    extra.energyDemand+choice.attackInitiationCost;
  if(paidFromReserve>attacker.energy+EPS)
    throw new Error('Position attacker cannot pay separation.');
  const energyAfter=+(attacker.energy-
    paidFromReserve).toFixed(3);
  const soloRoadId=`solo:${attacker.riderId}`;
  const soloPosition={...attacker,
    roadId:soloRoadId,distanceM:endDistanceM,
    clockSeconds:bunch.clockSeconds,
    paidDistanceM:attacker.paidDistanceM+travelM,
    energy:energyAfter,quietKm:0};
  const lineCrossings=[];
  for(let markerKm=1;markerKm<=km;markerKm++){
    const lineDistanceM=markerKm*1000;
    if(attacker.distanceM+EPS>=lineDistanceM||
      endDistanceM+EPS<lineDistanceM)continue;
    lineCrossings.push({riderId:attacker.riderId,
      km:markerKm,lineDistanceM,
      clockSeconds:prior.clockSeconds+
        (lineDistanceM-attacker.distanceM)/
          attackSpeedMps});
  }
  const passEvent={version:
    PHYSICAL_FIRST_POSITION_ATTACK_DEPARTURE_VERSION,
  type:'paid_attack_pass',sourceKm:km,
  riderId:attacker.riderId,teamId:team.id,
  fromRoadId:'peloton',toRoadId:soloRoadId,
  atClockSeconds:prior.clockSeconds+passSeconds,
  atDistanceM:front.distanceM+
    bunch.firstSpeedMps*passSeconds,
  requiredGainM,relativeSpeedMps,
  attackInitiationCost:choice.attackInitiationCost,
  paidFromReserve};
  const peloton={...bunch,
    separateRoadRiderIds:[
      ...(prior.separateRoadRiderIds??[]),
      attacker.riderId],
    positions:bunch.positions.filter(row=>
      row.riderId!==attacker.riderId),
    decisions:bunch.decisions.filter(row=>
      row.riderId!==attacker.riderId),
    checkpointCrossings:bunch.checkpointCrossings
      .filter(row=>row.riderId!==attacker.riderId)};
  return {version:
    PHYSICAL_FIRST_POSITION_ATTACK_DEPARTURE_VERSION,
  sourceKm:km,raceSeed:prior.raceSeed,
  inputHash:prior.inputHash,choice,
  passEvent,attackSpeedMps,
  startClockSeconds:prior.clockSeconds,
  endClockSeconds:bunch.clockSeconds,
  soloPosition,
  soloDecision:{riderId:attacker.riderId,
    teamId:team.id,role:'solo_attacker',
    startDistanceM:attacker.distanceM,
    endDistanceM,energyBefore:attacker.energy,
    roadWorkCost:first.energyDemand+
      extra.energyDemand,
    attackInitiationCost:
      choice.attackInitiationCost,
    paidFromReserve,energyAfter},
  soloCheckpointCrossings:lineCrossings,
  peloton,sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionAttackDepartureKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionAttackDepartureKmV1(input)))
    throw new Error('Attack departure differs from paid movement.');
  return recorded;
}
