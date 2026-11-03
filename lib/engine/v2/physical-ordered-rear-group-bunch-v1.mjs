// Measure every member of a paid rear group when its road meets the
// bunch. The group stays separate unless each member can individually
// pay, hold pace and honor a committed reserve in bunch shelter.
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {riderKilometreEffect} from
  './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from
  './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from
  './tuning.mjs';

export const PHYSICAL_ORDERED_REAR_GROUP_BUNCH_VERSION=
  'v2-physical-ordered-rear-group-bunch-1';
export const PHYSICAL_ORDERED_REAR_GROUP_PARTIAL_JOIN_VERSION=
  'v2-physical-ordered-rear-group-partial-join-1';
const EPS=1e-6;

export function measurePhysicalOrderedRearGroupBunchV1({
  startInput,next,event,group}){
  if(!event?.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.includes('peloton')||
    !group||group.kind!=='group'||
    group.riderIds.length<2||
    !event.roadIds.includes(group.id)||
    event.riders.length!==group.riderIds.length||
    event.metresIntoKm<=group.startM||
    event.metresIntoKm>=1000||
    group.rows.filter(row=>
      row.role==='leader').length!==1||
    group.rows.some(row=>
      row.role==='sheltered'&&
        row.draftFraction>=1))
    throw new Error(
      'Group bunch meeting needs paid group road.');
  const km=next.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const metres=event.metresIntoKm;
  if(Math.abs(next.bunchStartClock+
    next.step.elapsedSeconds*metres/1000-
    event.clockSeconds)>EPS||
    Math.abs(group.clockAt(metres)-
      event.clockSeconds)>EPS)
    throw new Error(
      'Group bunch meeting breaks road clock.');
  const leaderAbility=50+
    (segmentBaseSeconds(segment)-
      next.step.elapsedSeconds)/
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const groupRiders=group.riderIds.map(riderId=>{
    const row=group.rows.find(item=>
      item.riderId===riderId);
    const atContact=event.riders.find(item=>
      item.riderId===riderId);
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>
        rider.id===riderId));
    const rider=team?.riders.find(item=>
      item.id===riderId);
    const intent=physicalRearIntentAtKmV2({
      startInput,riderId,km});
    if(!row||!atContact||!rider)
      throw new Error(
        'Group bunch meeting loses paid member.');
    const groupPaid=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:row.energyBefore,
      effort:intent.effort,
      role:row.role,
      distanceM:metres-group.startM});
    if(Math.abs(groupPaid.energyAfter-
      atContact.energyAtContact)>.002)
      throw new Error(
        'Group bunch meeting breaks member energy.');
    const effect=riderKilometreEffect(rider,
      segment,{phase:'cruise',
        energy:atContact.energyAtContact,
        exposed:segment.exposed});
    const holdAbility=effect.ability+
      (TUNING.effortPressure[
        intent.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const remainingM=1000-metres;
    const sheltered=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:atContact.energyAtContact,
      effort:intent.effort,
      role:'sheltered',
      distanceM:remainingM});
    const exposed=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:atContact.energyAtContact,
      effort:intent.effort,
      role:'solo',
      distanceM:remainingM});
    const reserveOkay=intent.action!==
      'save_for_stage'||
      sheltered.energyAfter>=intent
        .committedStagePlan.reserveEnergy;
    return {riderId,groupRole:row.role,
      groupDecision:row.decision,
      intent,
      energyBeforeGroup:row.energyBefore,
      groupEnergySpentToContact:
        groupPaid.energyDemand,
      energyAtContact:
        atContact.energyAtContact,
      holdAbility,leaderAbility,
      payable:atContact.energyAtContact+
        EPS>=sheltered.energyDemand,
      canHold:holdAbility+EPS>=
        leaderAbility,
      reserveOkay,
      shelterCheaper:
        sheltered.energyDemand<
          exposed.energyDemand,
      shelteredEnergyDemand:
        sheltered.energyDemand,
      exposedAlternativeEnergyDemand:
        exposed.energyDemand};
  });
  const bunchRiders=next.step.physicalGroup
    .riderIds.map(riderId=>{
      const row=next.step.riders.find(item=>
        item.riderId===riderId);
      return {riderId,role:row.role,
        energyBefore:row.energyBefore,
        energyAtContact:row.energyBefore-
          row.energySpent*metres/1000};
    });
  if(bunchRiders.filter(row=>
    row.role==='leader').length!==1||
    bunchRiders.some(row=>
      !Number.isFinite(row.energyAtContact)||
      row.energyAtContact<0))
    throw new Error(
      'Group bunch meeting lacks paid bunch leader.');
  return {...event,
    groupLeaderRiderId:
      group.leaderRiderId,
    bunchLeaderRiderId:
      next.step.leaderRiderId,
    groupRiders,bunchRiders,
    nextChoiceUnsettled:true,
    physicalGroupsStillSeparate:true};
}

function priceGroupBunchJoin({startInput,next,contact,
  joiningRiderIds=null}){
  const members=joiningRiderIds===null?
    contact.groupRiders:contact.groupRiders
      .filter(row=>joiningRiderIds.includes(
        row.riderId));
  if(!contact.nextChoiceUnsettled||
    !contact.physicalGroupsStillSeparate||
    contact.groupRiders.length<2||
    !members.length||
    joiningRiderIds!==null&&(
      joiningRiderIds.length!==members.length||
      joiningRiderIds.length>=
        contact.groupRiders.length||
      new Set(joiningRiderIds).size!==
        joiningRiderIds.length)||
    members.some(row=>
      !row.canHold||!row.payable||
      !row.reserveOkay||
      !row.shelterCheaper))
    throw new Error(
      'Group bunch join needs payable holding members.');
  const km=next.sourceKm;
  const remainingM=1000-
    contact.metresIntoKm;
  const decisions=members.map(row=>{
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>
        rider.id===row.riderId));
    const rider=team.riders.find(item=>
      item.id===row.riderId);
    const sheltered=priceRearEnergyDemandV1({
      rider,
      segment:startInput.routeKilometres[km-1],
      energyBefore:row.energyAtContact,
      effort:row.intent.effort,
      role:'sheltered',
      distanceM:remainingM});
    const cap=replayRearEnergyCapV1({
      rider,
      kilometres:startInput.routeKilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      sheltered.energyAfter).toFixed(3);
    if(energyAfter<0||
      row.intent.action==='save_for_stage'&&
        energyAfter<row.intent
          .committedStagePlan.reserveEnergy)
      throw new Error(
        'Group bunch join breaks committed reserve.');
    return {riderId:row.riderId,
      teamId:team.id,
      goal:row.intent.action,
      effort:row.intent.effort,
      teamOrderEffort:
        row.intent.teamOrderEffort,
      committedTeamStake:
        row.intent.committedTeamStake,
      intentSource:row.intent.source,
      choice:'join_bunch_shelter',
      reason:'paid_group_contact_shelter_saves_energy',
      atDistanceM:contact.atDistanceM,
      atClockSeconds:contact.clockSeconds,
      energyAtContact:
        row.energyAtContact,
      shelteredEnergySpent:
        sheltered.energyDemand,
      cap,energyAfter,
      ...(row.intent.committedStagePlan?{
        committedStagePlan:structuredClone(
          row.intent.committedStagePlan)}:{})};
  });
  const bunchEndClock=next.bunchStartClock+
    next.step.elapsedSeconds;
  if(Math.abs(contact.clockSeconds+
    next.step.elapsedSeconds*remainingM/1000-
    bunchEndClock)>EPS||
    new Set(decisions.map(row=>
      row.riderId)).size!==decisions.length)
    throw new Error(
      'Group bunch join breaks paid clock or membership.');
  return {decisions,bunchEndClock};
}

export function pricePhysicalOrderedRearGroupBunchJoinV1(
  input){
  return priceGroupBunchJoin(input);
}

export function pricePhysicalOrderedRearGroupBunchPartialJoinV1(
  input){
  if(!Array.isArray(input.joiningRiderIds))
    throw new Error(
      'Partial group join needs individual choices.');
  return {...priceGroupBunchJoin(input),
    version:
      PHYSICAL_ORDERED_REAR_GROUP_PARTIAL_JOIN_VERSION,
    slidingRiderIds:input.contact.groupRiders
      .filter(row=>!input.joiningRiderIds
        .includes(row.riderId))
      .map(row=>row.riderId)};
}
