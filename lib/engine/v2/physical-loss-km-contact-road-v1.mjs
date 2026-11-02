// Pay the road after one measured loss-kilometre solo contact. This
// settles the pair only; other detached riders may still meet them.
import {isDeepStrictEqual} from 'node:util';
import {inspectPhysicalStaggeredLossKmContactsV1} from
  './physical-staggered-loss-km-contact-v1.mjs';
import {inspectFirstStaggeredSoloFieldContactV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from './tuning.mjs';

export const PHYSICAL_LOSS_KM_CONTACT_ROAD_VERSION=
  'v2-physical-loss-km-contact-road-1';
export const PHYSICAL_SOLO_FIELD_CONTACT_ROAD_VERSION=
  'v2-physical-solo-field-contact-road-1';
const effortRank={conserve:0,steady:1,hard:2};

// Call only after the exact contact has been replayed against its
// source. The public wrappers below enforce that boundary.
export function finishVerifiedPairContactRoadV1({startInput,staggered,contact,
  preferredLeaderRiderId,version,withinLoss}){
  const km=contact.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const step=staggered.road[km-1];
  const entries=contact.riders.map(row=>{
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>rider.id===row.riderId));
    const rider=team?.riders.find(item=>
      item.id===row.riderId);
    if(!rider)
      throw new Error('Contact road lacks paid rider.');
    const plan=startInput.soloCommitments?.find(item=>
      item.riderId===row.riderId);
    const intent=plan?rearSoloPlanAtKmV1({
      commitment:plan,km}):
      {action:'finish_safely',effort:'conserve'};
    const order=orderAt(team.orders,km-1);
    if(effortRank[intent.effort]===undefined||
      effortRank[intent.effort]>
        effortRank[order.effort])
      throw new Error('Loss contact exceeds team effort order.');
    return {row,team,rider,intent,order};
  });
  const willing=entries.filter(item=>
    item.intent.action!=='save_for_stage');
  if(!willing.length)
    throw new Error('Loss contact needs willing leader.');
  // The rider who paid the faster catch takes the first exposed turn.
  // A committed stage-saving plan may instead leave the other in front.
  const leader=willing.find(item=>
    item.rider.id===preferredLeaderRiderId)??
    willing[0];
  const follower=entries.find(item=>item!==leader);
  const leaderEffect=riderKilometreEffect(
    leader.rider,segment,{phase:'solo',
      energy:leader.row.energyAtContact,
      exposed:segment.exposed});
  const followerEffect=riderKilometreEffect(
    follower.rider,segment,{phase:'cruise',
      energy:follower.row.energyAtContact,
      exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[
      leader.intent.effort]-1)*20;
  const followerAbility=followerEffect.ability+
    (TUNING.effortPressure[
      follower.intent.effort]-1)*20+
    MOTOR_DRAFT_SHELTER[segment.terrain];
  const groupAbility=Math.min(leaderAbility,
    followerAbility);
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-groupAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const remainingM=km*1000-contact.atDistanceM;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0||
    remainingM<=0||remainingM>=1000)
    throw new Error('Loss contact needs payable road.');
  const elapsedSeconds=contact.clockSeconds+
    secondsPerKm*remainingM/1000;
  const bunchPriorSeconds=staggered.road.slice(0,
    km-1).reduce((sum,row)=>sum+row.elapsedSeconds,0);
  const bunchElapsedSeconds=bunchPriorSeconds+
    step.elapsedSeconds;
  if(elapsedSeconds<=bunchElapsedSeconds)
    throw new Error('Loss group needs separate bunch contact.');
  const riders=entries.map(entry=>{
    const role=entry===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({
      rider:entry.rider,segment,
      energyBefore:entry.row.energyAtContact,
      effort:entry.intent.effort,role,distanceM:remainingM});
    const cap=replayRearEnergyCapV1({
      rider:entry.rider,
      kilometres:startInput.routeKilometres,
      throughKm:km}).cap;
    const energyAfter=+Math.min(cap,
      paid.energyAfter).toFixed(3);
    if(entry.intent.action==='save_for_stage'&&
      energyAfter<entry.intent.committedStagePlan
        .reserveEnergy)
      throw new Error('Loss group breaks stage reserve.');
    return {riderId:entry.rider.id,
      teamId:entry.team.id,role,
      decision:{riderId:entry.rider.id,
        goal:entry.intent.action,
        teamOrderEffort:entry.order.effort,
        effort:entry.intent.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'?
          withinLoss?'paid_loss_contact_turn':
            'paid_solo_field_contact_turn':
          withinLoss?'shelter_after_paid_loss_contact':
            'shelter_after_paid_solo_field_contact'},
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      recoveryAward:0,cap,energyAfter};
  });
  return {version,
    sourceKm:km,startDistanceM:contact.atDistanceM,
    endDistanceM:km*1000,
    leaderRiderId:leader.rider.id,
    groupAbility,secondsPerKm,
    elapsedSeconds,
    gapSecondsToBunch:elapsedSeconds-
      bunchElapsedSeconds,
    physicalGroup:{id:`rear-${withinLoss?
      'loss':'solo-field'}-contact-${
      [...contact.riderIds].sort().join('-')}`,
      riderIds:[...contact.riderIds],
      atDistanceM:km*1000},
    riders,otherRidersUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function finishPhysicalLossKmContactV1({startInput,
  start,staggered,contact}){
  const source=inspectPhysicalStaggeredLossKmContactsV1({
    startInput,start,staggered});
  if(source.contacts.length!==1||
    !isDeepStrictEqual(contact,source.contacts[0]))
    throw new Error('Loss contact road needs exact paid source.');
  const step=staggered.road[contact.sourceKm-1];
  const preferredLeaderRiderId=[...contact.riderIds]
    .sort((a,b)=>{
      const distance=id=>step.splits.find(row=>
        row.riderId===id)?.atDistanceM;
      return distance(a)-distance(b)||
        a.localeCompare(b);
    })[0];
  return finishVerifiedPairContactRoadV1({startInput,staggered,contact,
    preferredLeaderRiderId,
    version:PHYSICAL_LOSS_KM_CONTACT_ROAD_VERSION,
    withinLoss:true});
}

export function finishPhysicalSoloFieldContactKmV1({
  startInput,start,staggered,soloField,fieldContact}){
  const source=inspectFirstStaggeredSoloFieldContactV1({
    startInput,start,staggered,soloField});
  if(!isDeepStrictEqual(fieldContact,source)||
    !fieldContact.firstContact?.catchingRiderId||
    fieldContact.firstContact.riderIds.some(id=>
      staggered.losses.find(row=>
        row.riderId===id)?.sourceKm>=
          fieldContact.firstContact.sourceKm))
    throw new Error('Solo field road needs later paid contact.');
  return finishVerifiedPairContactRoadV1({startInput,staggered,
    contact:fieldContact.firstContact,
    preferredLeaderRiderId:fieldContact
      .firstContact.catchingRiderId,
    version:PHYSICAL_SOLO_FIELD_CONTACT_ROAD_VERSION,
    withinLoss:false});
}

export function validatePhysicalSoloFieldContactKmV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalSoloFieldContactKmV1(input)))
    throw new Error('Solo field contact road differs from source.');
  return true;
}

export function validatePhysicalLossKmContactV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalLossKmContactV1(input)))
    throw new Error('Loss contact remainder differs from source.');
  return true;
}
