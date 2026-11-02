// An observer's next-kilometre pace estimate. The front rider's last
// paid road is visible; their exact skill, energy and future order are not.
import {orderAt} from './orders.mjs';
import {perceiveRivalStrength} from
  './break-threat-perception.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const PHYSICAL_OBSERVER_PACE_ESTIMATE_VERSION=
  'v2-physical-observer-pace-estimate-1';
const secondsPerPoint=MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;

export function estimatePhysicalObserverPaceV1({teams,
  observerTeamId,raceSeed,frontRiderId,priorFrontSeconds,
  priorSegment,nextSegment}){
  const observer=teams?.find(team=>team.id===observerTeamId);
  const frontTeam=teams?.find(team=>team.riders.some(row=>
    row.id===frontRiderId));
  if(!observer||!frontTeam||frontTeam.id===observerTeamId||
    !Number.isFinite(priorFrontSeconds)||priorFrontSeconds<=0||
    nextSegment?.km!==priorSegment?.km+1)
    throw new Error('Observer pace needs separate paid front road.');
  const order=orderAt(observer.orders,nextSegment.km-1);
  const leader=observer.riders.find(row=>
    row.id===order.frontWorkRiderId);
  if(order.frontWork!=='rotate'||!leader||
    !observer.orders.helperIds.includes(leader.id)||
    !Number.isFinite(observer.energy?.[leader.id]))
    throw new Error('Observer pace needs own named paid leader.');
  const perceived=perceiveRivalStrength({teams,
    observerTeamId,raceSeed});
  const perceivedFront=perceived.teams.flatMap(team=>team.riders)
    .find(row=>row.id===frontRiderId);
  const frontEnergy=perceived.teams.find(team=>
    team.id===frontTeam.id).energy[frontRiderId];
  const priorNatural=riderKilometreEffect(perceivedFront,
    priorSegment,{phase:'solo',energy:frontEnergy,
      exposed:priorSegment.exposed}).ability;
  const observedPriorAbility=50+(
    segmentBaseSeconds(priorSegment)-priorFrontSeconds)/
    secondsPerPoint;
  const inferredEffortAdjustment=observedPriorAbility-
    priorNatural;
  const nextNatural=riderKilometreEffect(perceivedFront,
    nextSegment,{phase:'solo',energy:frontEnergy,
      exposed:nextSegment.exposed}).ability;
  const frontAbility=nextNatural+inferredEffortAdjustment;
  const frontSeconds=segmentBaseSeconds(nextSegment)+
    (50-frontAbility)*secondsPerPoint;
  const leaderEffect=riderKilometreEffect(leader,nextSegment,{
    phase:'cruise',energy:observer.energy[leader.id],
    exposed:nextSegment.exposed});
  const adjustment=order.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[order.effort];
  const bunchSeconds=segmentBaseSeconds(nextSegment)+
    (50-leaderEffect.ability-adjustment)*secondsPerPoint;
  if(!Number.isFinite(frontSeconds)||frontSeconds<=0||
    !Number.isFinite(bunchSeconds)||bunchSeconds<=0)
    throw new Error('Observer pace needs valid estimated clocks.');
  return {version:PHYSICAL_OBSERVER_PACE_ESTIMATE_VERSION,
    sourceKm:nextSegment.km,observerTeamId,
    frontRiderId,leaderRiderId:leader.id,
    observedPriorFrontSeconds:priorFrontSeconds,
    estimatedFrontSeconds:+frontSeconds.toFixed(3),
    ownLeaderSeconds:+bunchSeconds.toFixed(3),
    estimatedGapChangeSeconds:+(
      bunchSeconds-frontSeconds).toFixed(3),
    basis:'observed_front_pace_and_perceived_rival_strength'};
}
