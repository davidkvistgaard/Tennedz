// Pay one exposed leader and one sheltered rider from measured
// staggered solo contact to the end of that kilometre.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalStaggeredSolosV1} from
  './physical-staggered-solo-contact-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_STAGGERED_CONTACT_ROAD_VERSION=
  'v2-physical-staggered-contact-road-1';
const effortRank={conserve:0,steady:1,hard:2};

export function finishPhysicalStaggeredContactKmV1({startInput,
  start,staggered,riderIds,contactKm,contact}){
  const source={startInput,start,staggered,riderIds,contactKm};
  if(!isDeepStrictEqual(contact,
    contactPhysicalStaggeredSolosV1(source)))
    throw new Error('Staggered road needs replayed paid contact.');
  const segment=startInput.routeKilometres[contactKm-1];
  const entries=contact.riders.map(row=>{
    const team=startInput.teams.find(item=>item.riders.some(rider=>
      rider.id===row.riderId));
    const rider=team.riders.find(item=>item.id===row.riderId);
    const plan=startInput.soloCommitments?.find(item=>
      item.riderId===row.riderId);
    const intent=plan?rearSoloPlanAtKmV1({commitment:plan,
      km:contactKm}):{action:'finish_safely',effort:'conserve'};
    const order=orderAt(team.orders,contactKm-1);
    if(effortRank[intent.effort]>effortRank[order.effort])
      throw new Error('Staggered contact exceeds team effort order.');
    return {rider,team,row,intent};
  });
  const ahead=entries.find(item=>item.rider.id===
    contact.aheadRiderId);
  const catching=entries.find(item=>item.rider.id===
    contact.catchingRiderId);
  const leader=ahead.intent.action==='save_for_stage'?
    catching:ahead;
  if(leader.intent.action==='save_for_stage')
    throw new Error('Staggered contact needs willing leader.');
  const follower=leader===ahead?catching:ahead;
  const leaderEffect=riderKilometreEffect(leader.rider,segment,{
    phase:'solo',energy:leader.row.energyAfter,
    exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[leader.intent.effort]-1)*20;
  const followerEffect=riderKilometreEffect(follower.rider,
    segment,{phase:'cruise',energy:follower.row.energyAfter,
      exposed:segment.exposed});
  const followerAbility=followerEffect.ability+
    (TUNING.effortPressure[follower.intent.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(followerAbility+1e-9<leaderAbility)
    throw new Error('Staggered follower cannot hold paid leader.');
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-leaderAbility)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const remainingM=contactKm*1000-
    contact.contactAtDistanceM;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0||
    remainingM<=0||remainingM>=1000)
    throw new Error('Staggered contact needs payable remaining road.');
  const groupSeconds=secondsPerKm*remainingM/1000;
  const bunchStep=staggered.road[contactKm-1];
  const bunchRemainingSeconds=bunchStep.elapsedSeconds*
    remainingM/1000;
  const gapSecondsToBunch=contact.behindBunchSeconds+
    groupSeconds-bunchRemainingSeconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Staggered group needs separate bunch contact.');
  const riders=entries.map(item=>{
    const role=item===leader?'leader':'sheltered';
    const paid=priceRearEnergyDemandV1({rider:item.rider,
      segment,energyBefore:item.row.energyAfter,
      effort:item.intent.effort,role,distanceM:remainingM});
    const cap=replayRearEnergyCapV1({rider:item.rider,
      kilometres:startInput.routeKilometres,
      throughKm:contactKm}).cap;
    const energyAfter=+Math.min(cap,paid.energyAfter).toFixed(3);
    if(item.intent.action==='save_for_stage'&&
      energyAfter<item.intent.committedStagePlan.reserveEnergy)
      throw new Error('Staggered group breaks future-stage reserve.');
    return {riderId:item.rider.id,teamId:item.team.id,
      decision:{goal:item.intent.action,
        effort:item.intent.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'? 'paid_rear_contact_turn':
          'shelter_after_paid_contact'},
      role,energyBefore:item.row.energyAfter,
      energySpent:paid.energyDemand,recoveryAward:0,
      cap,energyAfter};
  });
  return {version:PHYSICAL_STAGGERED_CONTACT_ROAD_VERSION,
    sourceKm:contactKm,
    startDistanceM:contact.contactAtDistanceM,
    endDistanceM:contactKm*1000,
    leaderRiderId:leader.rider.id,
    elapsedSeconds:contact.contactClockSeconds+groupSeconds,
    gapSecondsToBunch,
    physicalGroup:{id:contact.physicalGroup.id,
      riderIds:[...riderIds],atDistanceM:contactKm*1000},
    riders,energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energyAfter])),officialResults:false};
}

export function validatePhysicalStaggeredContactKmV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalStaggeredContactKmV1(input)))
    throw new Error('Staggered contact road differs from paid source.');
  return true;
}
