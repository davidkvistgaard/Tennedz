// An ordered rear solo may shelter behind the paid bunch only after a
// measured crossing, a new choice and a payable partial kilometre.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalOrderedSoloBunchContactV1} from
  './physical-ordered-solo-bunch-contact-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from './tuning.mjs';

export const PHYSICAL_ORDERED_SOLO_BUNCH_JOIN_VERSION=
  'v2-physical-ordered-solo-bunch-join-1';

export function finishPhysicalOrderedSoloBunchJoinKmV1(input){
  const probe=probePhysicalOrderedSoloBunchContactV1(
    input);
  const {startInput,start,riderId}=input;
  const contact=probe.contact;
  if(!contact||
    contact.otherRearRoadsUnsettled||
    contact.candidateOnly||
    !contact.physicalGroupsStillSeparate||
    !contact.nextChoiceUnsettled||
    contact.metresIntoKm>=1000)
    throw new Error(
      'Ordered bunch join needs isolated paid contact.');
  const km=contact.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const bunch=probe.sources.bunchStep;
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const rider=team.riders.find(row=>
    row.id===riderId);
  const intent=contact.soloDecision;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',
    energy:contact.soloEnergyAtContact,
    exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure[intent.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const leaderAbility=50+
    (segmentBaseSeconds(segment)-
      bunch.elapsedSeconds)/
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(holdAbility+1e-9<leaderAbility)
    throw new Error(
      'Ordered join cannot hold paid bunch pace.');
  const remainingM=1000-contact.metresIntoKm;
  const sheltered=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:contact.soloEnergyAtContact,
    effort:intent.effort,role:'sheltered',
    distanceM:remainingM});
  const exposed=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:contact.soloEnergyAtContact,
    effort:intent.effort,role:'solo',
    distanceM:remainingM});
  if(sheltered.energyDemand>=
    exposed.energyDemand)
    throw new Error(
      'Ordered join needs lower shelter cost.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    sheltered.energyAfter).toFixed(3);
  if(intent.action==='save_for_stage'&&
    Math.min(cap,sheltered.energyAfter)<
      intent.committedStagePlan
      .reserveEnergy)
    throw new Error(
      'Ordered join breaks stage reserve.');
  const bunchEndClock=contact.clockSeconds+
    bunch.elapsedSeconds*remainingM/1000;
  const decisions=new Map(bunch.riderDecisions
    .map(row=>[row.riderId,row]));
  const riderStates=bunch.physicalGroup
    .riderIds.map(id=>{
      const row=bunch.riders.find(item=>
        item.riderId===id);
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(id)]};
    });
  const soloDecision={riderId,
    teamId:team.id,goal:intent.action,
    effort:intent.effort,
    teamOrderEffort:intent.teamOrderEffort,
    committedTeamStake:
      intent.committedTeamStake,
    choice:'ride_to_paid_bunch_contact',
    reason:'observed_closing_paid_gap'};
  const joinDecision={riderId,
    teamId:team.id,goal:intent.action,
    effort:intent.effort,
    teamOrderEffort:intent.teamOrderEffort,
    committedTeamStake:
      intent.committedTeamStake,
    observedSoloSecondsPerKm:
      contact.soloSecondsPerKm,
    observedBunchSecondsPerKm:
      contact.bunchSecondsPerKm,
    choice:'join_bunch_shelter',
    reason:'paid_contact_shelter_saves_energy',
    ...(intent.committedStagePlan?{
      committedStagePlan:structuredClone(
        intent.committedStagePlan)}:{})};
  riderStates.push({riderId,sourceKm:km,
    physicalGroupId:'peloton',
    atDistanceM:km*1000,
    elapsedSeconds:bunchEndClock,
    energyAfter,
    decisions:[soloDecision,joinDecision]});
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>
      row.riderId)).size!==
      start.riderIds.length||
    riderStates.some(row=>
      row.decisions.some(decision=>!decision)||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0))
    throw new Error(
      'Ordered join lacks paid rider state.');
  riderStates.sort((a,b)=>
    start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
  return {version:
    PHYSICAL_ORDERED_SOLO_BUNCH_JOIN_VERSION,
  riderId,sourceKm:km,
  contactAtDistanceM:contact.atDistanceM,
  contactClockSeconds:contact.clockSeconds,
  soloDistanceM:contact.metresIntoKm,
  shelteredDistanceM:remainingM,
  soloEnergySpent:
    contact.soloEnergySpentToContact,
  shelteredEnergySpent:sheltered.energyDemand,
  exposedAlternativeEnergyDemand:
    exposed.energyDemand,
  energyAtContact:
    contact.soloEnergyAtContact,
  cap,energyAfter,
  bunchEndClock,holdAbility,leaderAbility,
  decision:joinDecision,riderStates,
  physicalGroup:{id:'peloton',
    riderIds:[...bunch.physicalGroup.riderIds,
      riderId],atDistanceM:km*1000},
  nextBunchState:{
    riderIds:[...bunch.physicalGroup.riderIds,
      riderId],
    energyByRider:{...bunch.energyByRider,
      [riderId]:energyAfter},
    quietKmByRider:{...bunch.quietKmByRider,
      [riderId]:0}},
  sources:{probe},laterRoadUnsettled:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedSoloBunchJoinKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalOrderedSoloBunchJoinKmV1(input)))
    throw new Error(
      'Ordered bunch join differs from paid source.');
  return true;
}
