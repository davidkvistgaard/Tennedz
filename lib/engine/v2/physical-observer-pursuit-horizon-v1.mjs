// Read-only pursuit horizon from the observer's own committed orders,
// a paid visible front speed, and uncertain rival attributes. No
// rival future order or exact strength enters this projection.
import {isDeepStrictEqual} from 'node:util';
import {decidePhysicalFrontThreatV1} from
  './physical-front-threat-choice-v1.mjs';
import {perceiveRivalStrength} from
  './break-threat-perception.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_EXPLICIT_FRONT} from './tuning.mjs';

export const PHYSICAL_OBSERVER_PURSUIT_HORIZON_VERSION=
  'v2-physical-observer-pursuit-horizon-1';
const secondsPerPoint=MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;

export function estimatePhysicalObserverPursuitHorizonV1(input){
  const {startInput,start,attackKm,choiceKm,
    observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds=[],throughKm}=input;
  if(!Number.isInteger(throughKm)||throughKm<choiceKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Pursuit horizon needs sourced future road.');
  const choice=decidePhysicalFrontThreatV1({startInput,
    start,attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds});
  const frontRiderId=choice.frontRiderId;
  const teams=structuredClone(startInput.teams);
  const knownEnergy={
    ...choice.physicalSource.bunch.energyByRider,
    [frontRiderId]:choice.physicalSource.front.energyAfter};
  for(const team of teams)for(const rider of team.riders)
    team.energy[rider.id]=knownEnergy[rider.id];
  const perceived=perceiveRivalStrength({teams,
    observerTeamId,raceSeed:startInput.raceSeed});
  const own=perceived.teams.find(team=>
    team.id===observerTeamId);
  const rival=perceived.teams.find(team=>
    team.riders.some(row=>row.id===frontRiderId));
  const front=rival.riders.find(row=>row.id===frontRiderId);
  const initialFrontEnergy=rival.energy[frontRiderId];
  const priorSegment=startInput.routeKilometres[choiceKm-2];
  const priorSeconds=choice.physicalSource.front.steps.at(-1)
    .seconds;
  const observedAbility=50+(
    segmentBaseSeconds(priorSegment)-priorSeconds)/
    secondsPerPoint;
  const priorNatural=riderKilometreEffect(front,
    priorSegment,{phase:'solo',
      energy:initialFrontEnergy,
      exposed:priorSegment.exposed}).ability;
  const inferredFrontAdjustment=observedAbility-
    priorNatural;
  let gapSeconds=choice.observedGapSeconds;
  let frontEnergy=initialFrontEnergy;
  const ownEnergy={...own.energy};
  const steps=[];
  let predictedContact=null;
  let stoppedReason=null;
  for(let km=choiceKm;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const order=orderAt(own.orders,km-1);
    if(order.chase==='ignore'||order.frontWork!=='rotate'){
      stoppedReason='own_chase_order_inactive';break;
    }
    const leader=own.riders.find(row=>
      row.id===order.frontWorkRiderId);
    if(!leader||!own.orders.helperIds.includes(leader.id)){
      stoppedReason='own_named_leader_unavailable';break;
    }
    const leaderEnergy=ownEnergy[leader.id];
    const frontEffect=riderKilometreEffect(front,segment,{
      phase:'solo',energy:frontEnergy,
      exposed:segment.exposed});
    const leaderEffect=riderKilometreEffect(leader,segment,{
      phase:'cruise',energy:leaderEnergy,
      exposed:segment.exposed});
    const adjustment=order.effort==='conserve'?
      MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
      TUNING.groups.frontPaceAdjustmentPoints[order.effort];
    const base=segmentBaseSeconds(segment);
    const frontSeconds=base+(50-frontEffect.ability-
      inferredFrontAdjustment)*secondsPerPoint;
    const bunchSeconds=base+(50-leaderEffect.ability-
      adjustment)*secondsPerPoint;
    if(!Number.isFinite(frontSeconds)||frontSeconds<=0||
      !Number.isFinite(bunchSeconds)||bunchSeconds<=0)
      throw new Error('Pursuit horizon has invalid projected pace.');
    const nextGapSeconds=gapSeconds+bunchSeconds-
      frontSeconds;
    if(nextGapSeconds<=0){
      const fraction=gapSeconds/(
        frontSeconds-bunchSeconds);
      if(fraction<=0||fraction>1)
        throw new Error('Pursuit horizon has invalid contact.');
      predictedContact={sourceKm:km,
        atDistanceM:(km-1+fraction)*1000};
      steps.push({sourceKm:km,leaderRiderId:leader.id,
        frontSeconds,bunchSeconds,
        gapBeforeSeconds:gapSeconds,
        gapAfterSeconds:0,
        contactFraction:fraction,
        frontEnergyBefore:frontEnergy,
        leaderEnergyBefore:leaderEnergy});
      break;
    }
    const frontCost=quoteRearEnergyDemandV1({
      rider:front,segment,energyBefore:frontEnergy,
      effort:'steady',role:'solo',distanceM:1000});
    if(frontCost.energyDemand>frontEnergy+1e-9){
      stoppedReason='perceived_front_energy_unpayable';break;
    }
    let ownPayable=true;
    for(const rider of own.riders){
      const energy=ownEnergy[rider.id];
      const cost=quoteRearEnergyDemandV1({rider,segment,
        energyBefore:energy,effort:order.effort,
        role:rider.id===leader.id?'leader':'sheltered',
        distanceM:1000});
      if(cost.energyDemand>energy+1e-9){
        ownPayable=false;break;
      }
      ownEnergy[rider.id]=energy-cost.energyDemand;
    }
    if(!ownPayable){
      stoppedReason='own_projected_energy_unpayable';break;
    }
    steps.push({sourceKm:km,leaderRiderId:leader.id,
      frontSeconds,bunchSeconds,
      gapBeforeSeconds:gapSeconds,
      gapAfterSeconds:nextGapSeconds,
      frontEnergyBefore:frontEnergy,
      leaderEnergyBefore:leaderEnergy,
      frontEnergyAfter:frontEnergy-
        frontCost.energyDemand,
      leaderEnergyAfter:ownEnergy[leader.id]});
    frontEnergy-=frontCost.energyDemand;
    gapSeconds=nextGapSeconds;
  }
  return {version:PHYSICAL_OBSERVER_PURSUIT_HORIZON_VERSION,
    sourceKm:choiceKm,throughKm,observerTeamId,
    frontRiderId,
    observedGapSeconds:choice.observedGapSeconds,
    inferredFrontAdjustment,
    initialPerceivedFrontEnergy:initialFrontEnergy,
    frontEnergyEffortAssumption:'steady',
    steps,predictedContact,stoppedReason,
    basis:'paid_visible_speed_perceived_rival_and_own_orders',
    movesRoad:false,officialResults:false};
}

export function validatePhysicalObserverPursuitHorizonV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    estimatePhysicalObserverPursuitHorizonV1(input)))
    throw new Error('Pursuit horizon differs from perception source.');
  return true;
}
