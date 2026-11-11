// Versioned per-rider km-6 boundary choices from the paid km-5 field.
// The source's uncontacted break plan cannot move these riders.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';
import {inspectV94PhysicalSixthSourceBoundaryV1} from
  './v94-physical-sixth-source-boundary-v1.mjs';

export const V94_PHYSICAL_SIXTH_RIDER_BOUNDARY_VERSION=
  'v94-physical-sixth-rider-boundary-1';
export const V94_PHYSICAL_SIXTH_RIDER_DECISION_VERSION=
  'v94-physical-sixth-rider-decision-1';

export function decideV94PhysicalSixthRiderBoundaryV1(
  recording,prior){
  const source=inspectV94PhysicalSixthSourceBoundaryV1(
    recording,prior);
  const segment=recording.route.kilometres[5];
  const byId=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const sourceBreakRiders=new Set(recording.frames[4].roadGroups.flatMap(
    group=>group.riderIds));
  const sourceTurnLeaders=new Set(recording.frames[5].roadGroupTurnPlans
    .flatMap(plan=>plan.turns.map(turn=>turn.leaderRiderId)));
  const frontClockSeconds=prior.front.frontClockSeconds;
  if(!Number.isFinite(frontClockSeconds)||
    new Set(prior.finishes.map(row=>row.riderId)).size!==
      prior.finishes.length)
    throw new Error('Sixth rider boundary needs unique paid arrivals.');
  const decisions=prior.finishes.map(finish=>{
    const entry=byId.get(finish.riderId);
    const stake=stakes.get(entry?.team.id);
    if(!entry||!stake?.sportingGoal||
      !stake.sportingCaptainId||
      finish.endDistanceM!==5000||
      !Number.isFinite(finish.energyAfter)||
      !Number.isFinite(finish.clockSeconds))
      throw new Error('Sixth rider decision lacks paid source.');
    const order=orderAt(entry.team.orders,5);
    const cruise=riderKilometreEffect(entry.rider,segment,{
      phase:'cruise',energy:finish.energyAfter,
      exposed:segment.exposed});
    const solo=riderKilometreEffect(entry.rider,segment,{
      phase:'solo',energy:finish.energyAfter,
      exposed:segment.exposed});
    const effortBonus=(TUNING.effortPressure[order.effort]-1)*20;
    return {version:V94_PHYSICAL_SIXTH_RIDER_DECISION_VERSION,
      sourceKm:6,riderId:finish.riderId,teamId:entry.team.id,
      atDistanceM:5000,clockSeconds:finish.clockSeconds,
      relativeToPaidFrontSeconds:
        finish.clockSeconds-frontClockSeconds,
      physicalGroupAtBoundary:finish.physicalGroup,
      energyAtBoundary:finish.energyAfter,
      managerEffort:order.effort,
      managerChase:order.chase,
      managerFrontWork:order.frontWork??null,
      managerAttack:order.attack,
      managerBreakWork:order.breakWork,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      perceivedCruiseAbility:cruise.ability+effortBonus,
      perceivedSoloAbility:solo.ability+effortBonus,
      sourceBreakMembershipClaim:
        sourceBreakRiders.has(finish.riderId),
      sourceNamedBreakTurnClaim:
        sourceTurnLeaders.has(finish.riderId),
      choice:'await_paid_physical_road_plan',
      paidNewDistanceM:0,paidNewEnergy:0};
  });
  return {version:V94_PHYSICAL_SIXTH_RIDER_BOUNDARY_VERSION,
    sourceKm:6,atDistanceM:5000,
    priorPhysicalVersion:prior.version,
    frontClockSeconds,decisions,
    sourceBoundaryVersion:source.version,
    unattachableSourceRoadIds:source.sourceRoads.filter(row=>
      row.sourcePlanCannotAttach).map(row=>row.sourceRoadGroupId),
    physicalRoadGroups:[],
    paidNewDistanceM:0,paidNewEnergy:0,
    officialResults:false};
}

export function validateV94PhysicalSixthRiderBoundaryV1(
  recording,prior,observation){
  if(!isDeepStrictEqual(observation,
    decideV94PhysicalSixthRiderBoundaryV1(recording,prior)))
    throw new Error('Sixth rider boundary differs from paid source.');
  return true;
}
