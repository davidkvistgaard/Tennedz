// First-kilometre tail loss. A weak last wheel starts in the bunch,
// pays sheltered motion until contact is lost, then pays solo motion.
// Interior sliding and contact between detached riders are separate work.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  './physical-first-position-start-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION} from
  './physical-first-position-rotation-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION} from
  './physical-first-position-rotation-km-v2.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {MOTOR_DRAFT_SHELTER,
  MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_POSITION_REAR_TAIL_DROP_VERSION=
  'physical-first-position-rear-tail-drop-km-1';
const EPS=1e-6;

export function advancePhysicalFirstPositionRearTailDropKmV1({
  prior,segment,input,riderId}){
  const expected=createPhysicalFirstPositionStartV2({
    input,grid:prior?.grid});
  if(prior?.version!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !isDeepStrictEqual(prior,expected)||
    segment?.km!==1||
    !isDeepStrictEqual(input.kilometres[0],segment)||
    prior.positions.length<2||
    prior.positions.at(-1).riderId!==riderId)
    throw new Error('Rear tail drop needs the committed last wheel.');
  const tail=prior.positions.at(-1);
  const ahead=prior.positions.at(-2);
  const source=input.teams.flatMap(team=>
    team.riders.map(rider=>({rider,team})))
    .find(row=>row.rider.id===riderId);
  if(!source||source.team.id!==tail.teamId)
    throw new Error('Rear tail drop lacks its rider source.');
  const legacyInput={...input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_VERSION};
  const legacyStart=createPhysicalFirstPositionStartV1({
    input:legacyInput,grid:prior.grid});
  const paid=advancePhysicalFirstPositionRotationKmV1({
    prior:{...prior,
      version:PHYSICAL_FIRST_POSITION_START_VERSION,
      inputHash:legacyStart.inputHash,
      positions:prior.positions.slice(0,-1),
      separateRoadRiderIds:[riderId]},
    segment,input:legacyInput});
  if(paid.event?.type==='paid_front_pass'||
    paid.leaderRiderId!==prior.positions[0].riderId)
    throw new Error('Rear tail drop overlaps a front pass.');
  const frontSpeed=paid.firstSpeedMps;
  const elapsedSeconds=paid.clockSeconds-
    prior.clockSeconds;
  const order=orderAt(source.team.orders,0);
  const pressure=(TUNING.effortPressure[order.effort]-1)*20;
  const shelteredAbility=riderKilometreEffect(
    source.rider,segment,{phase:'cruise',
      energy:tail.energy,
      exposed:segment.exposed}).ability+
    pressure+MOTOR_DRAFT_SHELTER[segment.terrain];
  const soloAbility=riderKilometreEffect(
    source.rider,segment,{phase:'solo',
      energy:tail.energy,
      exposed:segment.exposed}).ability+pressure;
  const speedFor=ability=>1000/(
    segmentBaseSeconds(segment)+(50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);
  const shelteredSpeed=speedFor(shelteredAbility);
  const soloSpeed=speedFor(soloAbility);
  const initialGapM=ahead.distanceM-
    tail.distanceM;
  const contactThresholdM=prior.grid.wheelSpacingM*2;
  const relativeSpeed=frontSpeed-shelteredSpeed;
  const contactLossSeconds=(contactThresholdM-
    initialGapM)/relativeSpeed;
  if(initialGapM>contactThresholdM+EPS||
    relativeSpeed<=EPS||
    contactLossSeconds<=EPS||
    contactLossSeconds>=elapsedSeconds-EPS)
    throw new Error('Rear tail rider has not lost paid contact.');
  const shelteredDistanceM=shelteredSpeed*
    contactLossSeconds;
  const soloDistanceM=soloSpeed*(elapsedSeconds-
    contactLossSeconds);
  const first=priceRearEnergyDemandV1({
    rider:source.rider,segment,
    energyBefore:tail.energy,
    effort:order.effort,role:'sheltered',
    distanceM:shelteredDistanceM});
  const second=priceRearEnergyDemandV1({
    rider:source.rider,segment,
    energyBefore:first.energyAfter,
    effort:order.effort,role:'solo',
    distanceM:soloDistanceM});
  const cap=replayRearEnergyCapV1({
    rider:source.rider,kilometres:input.kilometres,
    throughKm:1}).cap;
  const energyAfter=+Math.min(cap,
    second.energyAfter).toFixed(3);
  const endDistanceM=tail.distanceM+
    shelteredDistanceM+soloDistanceM;
  const paidAhead=paid.positions.find(row=>
    row.riderId===ahead.riderId);
  if(!paidAhead||
    paidAhead.distanceM-endDistanceM<=
      contactThresholdM+EPS)
    throw new Error('Rear tail gap did not remain open.');
  const soloRoadId=`solo:${riderId}`;
  const position={...tail,roadId:soloRoadId,
    distanceM:endDistanceM,
    paidDistanceM:shelteredDistanceM+
      soloDistanceM,
    energy:energyAfter,quietKm:0,
    clockSeconds:paid.clockSeconds};
  const contactLossEvent={version:
    PHYSICAL_FIRST_POSITION_REAR_TAIL_DROP_VERSION,
  type:'paid_tail_contact_loss',sourceKm:1,
  riderId,fromRoadId:'peloton',
  toRoadId:soloRoadId,
  atClockSeconds:prior.clockSeconds+
    contactLossSeconds,
  atDistanceM:tail.distanceM+
    shelteredDistanceM,
  contactThresholdM,initialGapM,
  paidShelteredDistanceM:shelteredDistanceM,
  paidSoloDistanceM:soloDistanceM};
  const crossings=[];
  if(endDistanceM>=1000-EPS&&
    tail.distanceM<1000-EPS){
    const firstEnd=tail.distanceM+
      shelteredDistanceM;
    crossings.push({riderId,km:1,
      lineDistanceM:1000,
      clockSeconds:prior.clockSeconds+(1000<=firstEnd?
        (1000-tail.distanceM)/
          shelteredSpeed:
        contactLossSeconds+
          (1000-firstEnd)/soloSpeed)});
  }
  const peloton={...paid,
    version:
      PHYSICAL_FIRST_POSITION_ROTATION_KM_V2_VERSION,
    sourceStartVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    basePhysicsVersion:
      PHYSICAL_FIRST_POSITION_ROTATION_KM_VERSION,
    inputHash:prior.inputHash,
    stagedBackupRiderId:prior.stagedBackupRiderId,
    stagedAttackRiderId:prior.stagedAttackRiderId,
    separateRoadRiderIds:[riderId]};
  return {version:
    PHYSICAL_FIRST_POSITION_REAR_TAIL_DROP_VERSION,
  sourceKm:1,raceSeed:prior.raceSeed,
  inputHash:prior.inputHash,
  riderId,contactLossEvent,
  decision:{riderId,role:'rear_tail_drop',
    energyBefore:tail.energy,
    paidShelteredDistanceM:shelteredDistanceM,
    paidSoloDistanceM:soloDistanceM,
    paidFromReserve:first.energyDemand+
      second.energyDemand,
    energyAfter},
  position,crossings,peloton,
  sourceGroupClockUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionRearTailDropKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionRearTailDropKmV1(input)))
    throw new Error('Rear tail drop differs from paid movement.');
  return recorded;
}
