// Settle the road after a source-replayed meeting of two rear solos.
// A named exposed leader pays more than the sheltered rider.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalPostcatchSplitV1} from
  './physical-postcatch-split-contact-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_POSTCATCH_CONTACT_ROAD_VERSION=
  'v2-physical-postcatch-contact-road-1';
const effortRank={conserve:0,steady:1,hard:2};

export function finishPhysicalPostcatchContactKmV1({
  contactInput,contact,leaderRiderId}){
  if(!isDeepStrictEqual(contact,
    contactPhysicalPostcatchSplitV1(contactInput)))
    throw new Error('Post-catch group road needs paid contact.');
  const {roadInput,loss,priorBunchClock}=contactInput;
  const {startInput,segment}=roadInput;
  const remainingM=segment.km*1000-
    contact.contactAtDistanceM;
  if(!contact.riders.some(row=>row.riderId===
    leaderRiderId)||remainingM<=0||remainingM>=1000)
    throw new Error('Post-catch group needs named leader and road.');
  const entries=contact.riders.map(row=>{
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>rider.id===row.riderId));
    const rider=team?.riders.find(item=>item.id===
      row.riderId);
    const order=orderAt(team?.orders,segment.km-1);
    const plan=startInput.soloCommitments?.find(item=>
      item.riderId===row.riderId);
    const intent=plan?rearSoloPlanAtKmV1({
      commitment:plan,km:segment.km}):
      {action:'finish_safely',effort:row.effort};
    if(!rider||!order||
      intent.effort!==row.effort||
      effortRank[row.effort]>effortRank[order.effort])
      throw new Error('Post-catch group exceeds rider order.');
    return {row,team,rider,order,intent};
  });
  const leader=entries.find(item=>item.rider.id===
    leaderRiderId);
  const follower=entries.find(item=>item!==leader);
  if(leader.intent.action==='save_for_stage')
    throw new Error('Post-catch group needs willing leader.');
  const leaderEffect=riderKilometreEffect(leader.rider,
    segment,{phase:'solo',energy:leader.row.energyAfter,
      exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[leader.row.effort]-1)*20;
  const followerEffect=riderKilometreEffect(
    follower.rider,segment,{phase:'cruise',
      energy:follower.row.energyAfter,
      exposed:segment.exposed});
  const followerAbility=followerEffect.ability+
    (TUNING.effortPressure[follower.row.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(followerAbility+1e-9<leaderAbility)
    throw new Error('Post-catch follower cannot hold paid leader.');
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-leaderAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Post-catch group needs paid pace.');
  const groupSeconds=secondsPerKm*remainingM/1000;
  const bunchClock=priorBunchClock+loss.elapsedSeconds;
  const groupClock=contact.contactClockSeconds+
    groupSeconds;
  const gapSecondsToBunch=groupClock-bunchClock;
  if(gapSecondsToBunch<=0)
    throw new Error('Post-catch group needs separate bunch contact.');
  const riders=entries.map(item=>{
    const role=item===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({
      rider:item.rider,segment,
      energyBefore:item.row.energyAfter,
      effort:item.row.effort,role,
      distanceM:remainingM});
    const cap=replayRearEnergyCapV1({
      rider:item.rider,kilometres:startInput
        .routeKilometres,throughKm:segment.km}).cap;
    const energyAfter=+Math.min(cap,
      paid.energyAfter).toFixed(3);
    if(item.intent.action==='save_for_stage'&&
      energyAfter<item.intent.committedStagePlan
        .reserveEnergy)
      throw new Error('Post-catch group breaks stage reserve.');
    return {riderId:item.rider.id,teamId:item.team.id,
      decision:{goal:item.intent.action,
        teamOrderEffort:item.order.effort,
        effort:item.row.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'?
          'paid_postcatch_contact_turn':
          'shelter_after_paid_postcatch_contact'},
      role,energyBefore:item.row.energyAfter,
      energySpent:paid.energyDemand,
      recoveryAward:0,cap,
      energyAfter};
  });
  return {version:PHYSICAL_POSTCATCH_CONTACT_ROAD_VERSION,
    sourceKm:segment.km,
    startDistanceM:contact.contactAtDistanceM,
    endDistanceM:segment.km*1000,
    leaderRiderId,seconds:groupSeconds,
    elapsedSeconds:groupClock,
    bunchElapsedSeconds:bunchClock,
    gapSecondsToBunch,
    physicalGroup:{id:`rear-${contact.riders.map(
      row=>row.riderId).sort().join('-')}`,
    riderIds:contact.riders.map(row=>row.riderId),
    atDistanceM:segment.km*1000},
    riders,energyByRider:Object.fromEntries(
      riders.map(row=>[row.riderId,row.energyAfter])),
    officialResults:false};
}

export function validatePhysicalPostcatchContactKmV1(input,
recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalPostcatchContactKmV1(input)))
    throw new Error('Post-catch group road differs from paid source.');
  return true;
}
