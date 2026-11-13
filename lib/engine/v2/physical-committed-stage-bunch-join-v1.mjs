// One explicit energy-saving choice at a sourced solo/bunch meeting.
// The rider pays exposed road to contact and sheltered road afterward.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalCommittedStageBunchContactV1} from
  './physical-committed-stage-bunch-contact-v1.mjs';
import {advancePhysicalBunchAfterStageReleaseContinuationKmV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from './tuning.mjs';

export const PHYSICAL_COMMITTED_STAGE_BUNCH_JOIN_VERSION=
  'v2-physical-committed-stage-bunch-join-1';

export function finishPhysicalCommittedStageBunchJoinKmV1(input){
  const probe=probePhysicalCommittedStageBunchContactV1(
    input);
  const {startInput,start,riderId}=input;
  const contact=probe.contact;
  if(!contact)
    throw new Error('Stage bunch join needs measured contact.');
  const km=contact.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const priorStep=probe.sources.earlier.at(-1)?.bunch??
    probe.sources.first.sources.bunch.step;
  const prior={riderIds:priorStep.physicalGroup.riderIds,
    energyByRider:priorStep.energyByRider,
    quietKmByRider:priorStep.quietKmByRider};
  const bunch=advancePhysicalBunchAfterStageReleaseContinuationKmV1({
    startInput,prior,segment,riderId});
  const projection=probe.sources.bunchPaceProjection;
  if(bunch.elapsedSeconds!==projection.secondsPerKm||
    bunch.leaderRiderId!==projection.leaderRiderId)
    throw new Error('Stage join bunch differs from contact source.');
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team.riders.find(row=>
    row.id===riderId);
  const order=orderAt(team.orders,km-1);
  const plan=startInput.soloCommitments.find(row=>
    row.riderId===riderId);
  const planAtContact=rearSoloPlanAtKmV1({
    commitment:plan,km});
  const intent=planAtContact.committedStagePlan;
  if(planAtContact.action!=='save_for_stage'||
    planAtContact.effort!=='conserve'||!intent)
    throw new Error('Stage join needs committed reserve.');
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:contact.soloEnergyAtContact,
    exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure.conserve-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const leaderAbility=50+
    (segmentBaseSeconds(segment)-
      bunch.elapsedSeconds)/
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(holdAbility+1e-9<leaderAbility)
    throw new Error('Stage join rider cannot hold paid bunch.');
  const remainingM=1000-contact.metresIntoKm;
  if(remainingM<=0)
    throw new Error('Stage join needs remaining sheltered road.');
  const sheltered=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:contact.soloEnergyAtContact,
    effort:'conserve',role:'sheltered',
    distanceM:remainingM});
  const exposedAlternative=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:contact.soloEnergyAtContact,
    effort:'conserve',role:'solo',
    distanceM:remainingM});
  if(sheltered.energyDemand>=
    exposedAlternative.energyDemand)
    throw new Error('Stage join needs actual shelter saving.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    sheltered.energyAfter).toFixed(3);
  if(energyAfter<intent.reserveEnergy)
    throw new Error('Stage join breaks committed reserve.');
  const previousBunchClock=
    probe.sources.first.kilometres.at(-1)
      .riderStates.find(row=>
        row.physicalGroupId==='peloton')
      .elapsedSeconds+
    probe.sources.earlier.reduce((sum,row)=>
      sum+row.bunch.elapsedSeconds,0);
  const bunchEndClock=previousBunchClock+
    bunch.elapsedSeconds;
  const decisions=new Map(bunch.riderDecisions.map(row=>
    [row.riderId,row]));
  const riderStates=bunch.physicalGroup.riderIds.map(id=>{
    const row=bunch.riders.find(item=>
      item.riderId===id);
    return {riderId:id,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:bunchEndClock,
      energyAfter:row.energyAfter,
      decisions:[decisions.get(id)]};
  });
  const joinDecision={riderId,teamId:team.id,
    goal:'save_for_stage',effort:'conserve',
    teamOrderEffort:order.effort,
    choice:'shelter_after_paid_contact',
    reason:'preserve_committed_stage_reserve',
    committedStagePlan:structuredClone(intent)};
  riderStates.push({riderId,sourceKm:km,
    physicalGroupId:'peloton',
    atDistanceM:km*1000,
    elapsedSeconds:bunchEndClock,
    energyAfter,
    decisions:[{riderId,teamId:team.id,
      goal:'save_for_stage',
      choice:'continue_stage_saving_solo',
      reason:'paid_road_to_contact',
      effort:'conserve'},joinDecision]});
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>row.riderId))
      .size!==start.riderIds.length||
    riderStates.some(row=>!row.decisions[0]||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0))
    throw new Error('Stage join lacks rider kilometre.');
  riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
    start.riderIds.indexOf(b.riderId));
  return {version:PHYSICAL_COMMITTED_STAGE_BUNCH_JOIN_VERSION,
    sourceKm:km,riderId,
    contactAtDistanceM:contact.atDistanceM,
    contactClockSeconds:contact.clockSeconds,
    soloDistanceM:contact.metresIntoKm,
    shelteredDistanceM:remainingM,
    soloEnergySpent:contact.soloEnergySpentToContact,
    shelteredEnergySpent:sheltered.energyDemand,
    exposedAlternativeEnergyDemand:
      exposedAlternative.energyDemand,
    energyBefore:contact.soloEnergyBefore,
    energyAtContact:contact.soloEnergyAtContact,
    cap,energyAfter,
    bunchEndClock,holdAbility,leaderAbility,
    decision:joinDecision,
    physicalGroup:{id:'peloton',
      riderIds:[...bunch.physicalGroup.riderIds,
        riderId],atDistanceM:km*1000},
    riderStates,sources:{probe,bunch},
    laterRoadUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalCommittedStageBunchJoinKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalCommittedStageBunchJoinKmV1(input)))
    throw new Error('Stage join differs from paid contact source.');
  return true;
}
