// Price the first observed mountain contact batch through its km finish.
// Other roads and later contacts still need independent settlement.
import {decideV94PhysicalFrontDropFirstBatchV1} from
  './v94-physical-front-drop-first-batch-choice-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_FRAGMENT_VERSION=
  'v94-physical-front-drop-first-batch-fragment-1';
const EPS=1e-7;

export function replayV94PhysicalFrontDropFirstBatchFragmentV1(
  recording,prior,physicalRoads){
  const choice=decideV94PhysicalFrontDropFirstBatchV1(
    recording,prior,physicalRoads);
  const km=choice.sourceKm;
  const segment=recording.route.kilometres[km-1];
  if(!choice.passingWillingToLead||
    !choice.pendingShelterRiderIds.length)
    throw new Error('Front-drop batch fragment needs paid shelter.');
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-choice.passingPerceivedSoloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Front-drop batch has no paid leader speed.');
  const speedMps=1000/secondsPerKm;
  const finishClockSeconds=choice.contactClockSeconds+
    choice.remainingDistanceM/speedMps;
  const riders=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const selected=[{
    riderId:choice.passingRiderId,
    teamOrderEffort:choice.passingManagerEffort,
    effectiveEffort:choice.passingEffectiveEffort,
    sportingGoal:choice.passingSportingGoal,
    sportingCaptainId:choice.passingSportingCaptainId,
    energyBeforeKm:choice.passingEnergyBeforeKm,
    energyAtContact:choice.passingEnergyAtContact,
    paidEnergyToContact:choice.passingPaidEnergyToContact,
    roleAfterContact:'leader',
    previousPhysicalGroup:physicalRoads.roads.find(row=>
      row.roadId===choice.passingRoadId)?.previousGroupIds?.[0]
  },...choice.drops.filter(row=>
    choice.pendingShelterRiderIds.includes(row.riderId))
    .map(row=>({
      ...row,teamOrderEffort:row.managerEffort,
      roleAfterContact:'sheltered',
      previousPhysicalGroup:'peloton'}))];
  const riderWork=selected.map(row=>{
    const rider=riders.get(row.riderId);
    if(!rider||!row.previousPhysicalGroup)
      throw new Error('Front-drop batch lacks joined rider.');
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,
      role:row.roleAfterContact,
      distanceM:choice.remainingDistanceM});
    const recovery=recoveryForKilometre({rider,segment,
      effort:row.effectiveEffort,group:'dropped',
      working:row.roleAfterContact==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Front-drop batch cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,
      throughKm:km}).cap;
    const paidFromReserve=row.paidEnergyToContact+
      paid.energyDemand;
    const capAdjustment=Math.max(0,paid.energyAfter-cap);
    const energyAfter=+Math.min(cap,paid.energyAfter)
      .toFixed(3);
    if(Math.abs(row.energyBeforeKm-paidFromReserve-
      capAdjustment-energyAfter)>.001+EPS)
      throw new Error('Front-drop batch breaks paid reserve.');
    return {version:
        V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_FRAGMENT_VERSION,
      sourceKm:km,riderId:row.riderId,
      previousPhysicalGroup:row.previousPhysicalGroup,
      roleAfterContact:row.roleAfterContact,
      teamOrderEffort:row.teamOrderEffort,
      effectiveEffort:row.effectiveEffort,
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId,
      energyBeforeKm:row.energyBeforeKm,
      paidEnergyToContact:row.paidEnergyToContact,
      energyAtContact:row.energyAtContact,
      paidEnergyAfterContact:paid.energyDemand,
      paidFromReserve,recoveryAward:0,
      capAdjustment,energyAfter,
      atContactDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,
      finishClockSeconds};
  });
  return {version:
      V94_PHYSICAL_FRONT_DROP_FIRST_BATCH_FRAGMENT_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactChoiceVersion:choice.version,
    contactClockSeconds:choice.contactClockSeconds,
    atDistanceM:choice.atDistanceM,
    road:{roadId:`paid-front-drop-batch-km${km}-${
      choice.passingRiderId}`,
      kind:'rear_group_fragment',
      leaderRiderId:choice.passingRiderId,
      shelteredRiderIds:[...choice.pendingShelterRiderIds],
      startClockSeconds:choice.contactClockSeconds,
      finishClockSeconds,
      startDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,speedMps},
    riderWork,
    paidContactGroupFragment:true,
    otherRoadContactsUnchecked:true,
    fullFieldKilometre:false,officialResults:false};
}
