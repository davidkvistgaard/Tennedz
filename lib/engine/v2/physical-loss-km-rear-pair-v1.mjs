// Isolated paid rear pair after an exact loss-kilometre contact. The
// source refuses a bunch catch; contacts with other solos remain open.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalLossKmContactV1,
  finishPhysicalSoloFieldContactKmV1} from
  './physical-loss-km-contact-road-v1.mjs';
import {rearSoloPlanAtKmV1} from
  './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from './tuning.mjs';

export const PHYSICAL_LOSS_KM_REAR_PAIR_VERSION=
  'v2-physical-loss-km-rear-pair-1';
export const PHYSICAL_SOLO_FIELD_REAR_PAIR_VERSION=
  'v2-physical-solo-field-rear-pair-1';
const effortRank={conserve:0,steady:1,hard:2};

// Call only after the contact remainder has been replayed against
// its exact source. The public wrappers below enforce that boundary.
export function runVerifiedRearPairRoadV1({startInput,staggered,contact,
  contactRoad,throughKm,version}){
  if(!Number.isInteger(throughKm)||
    throughKm<=contact.sourceKm||
    throughKm>staggered.throughKm)
    throw new Error('Rear pair needs exact paid contact road.');
  const riderIds=contact.riderIds;
  const entries=riderIds.map(riderId=>{
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>rider.id===riderId));
    const rider=team.riders.find(item=>
      item.id===riderId);
    const plan=startInput.soloCommitments?.find(item=>
      item.riderId===riderId);
    return {riderId,team,rider,plan};
  });
  let energyByRider=Object.fromEntries(
    contactRoad.riders.map(row=>[
      row.riderId,row.energyAfter]));
  let elapsedSeconds=contactRoad.elapsedSeconds;
  let gapSecondsToBunch=
    contactRoad.gapSecondsToBunch;
  let bunchElapsedSeconds=staggered.road.slice(0,
    contact.sourceKm).reduce((sum,row)=>
    sum+row.elapsedSeconds,0);
  const steps=[];
  for(let km=contact.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const bunchStep=staggered.road[km-1];
    const current=entries.map(entry=>{
      const intent=entry.plan?rearSoloPlanAtKmV1({
        commitment:entry.plan,km}):
        {action:'finish_safely',effort:'conserve'};
      const order=orderAt(entry.team.orders,km-1);
      if(effortRank[intent.effort]===undefined||
        effortRank[intent.effort]>
          effortRank[order.effort])
        throw new Error('Rear pair exceeds team order.');
      return {...entry,intent,order};
    });
    const preferred=current[
      (km-contact.sourceKm-1)%2];
    const alternate=current.find(row=>
      row!==preferred);
    const leader=preferred.intent.action===
      'save_for_stage'?alternate:preferred;
    if(leader.intent.action==='save_for_stage')
      throw new Error('Rear pair needs willing leader.');
    const follower=current.find(row=>row!==leader);
    const leaderEffect=riderKilometreEffect(
      leader.rider,segment,{phase:'solo',
        energy:energyByRider[leader.riderId],
        exposed:segment.exposed});
    const leaderAbility=leaderEffect.ability+
      (TUNING.effortPressure[
        leader.intent.effort]-1)*20;
    const followerEffect=riderKilometreEffect(
      follower.rider,segment,{phase:'cruise',
        energy:energyByRider[follower.riderId],
        exposed:segment.exposed});
    const followerAbility=followerEffect.ability+
      (TUNING.effortPressure[
        follower.intent.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const groupAbility=Math.min(leaderAbility,
      followerAbility);
    const seconds=segmentBaseSeconds(segment)+
      (50-groupAbility)*
        MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Rear pair needs paid pace.');
    const nextGap=gapSecondsToBunch+seconds-
      bunchStep.elapsedSeconds;
    if(nextGap<=0)
      throw new Error('Rear pair needs paid bunch contact.');
    const riders=current.map(entry=>{
      const role=entry===leader?'leader':'sheltered';
      const paid=priceRearEnergyDemandV1({
        rider:entry.rider,segment,
        energyBefore:energyByRider[entry.riderId],
        effort:entry.intent.effort,role,distanceM:1000});
      const recovery=recoveryForKilometre({
        rider:entry.rider,segment,
        effort:entry.intent.effort,group:'dropped',
        working:role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Rear pair cannot claim recovery.');
      const cap=replayRearEnergyCapV1({
        rider:entry.rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        paid.energyAfter).toFixed(3);
      if(entry.intent.action==='save_for_stage'&&
        energyAfter<entry.intent.committedStagePlan
          .reserveEnergy)
        throw new Error('Rear pair breaks stage reserve.');
      return {riderId:entry.riderId,
        teamId:entry.team.id,role,
        decision:{riderId:entry.riderId,
          goal:entry.intent.action,
          teamOrderEffort:entry.order.effort,
          effort:entry.intent.effort,
          choice:role==='leader'?'pull':'shelter',
          reason:role==='leader'?
            'paid_rear_rotation':
            'save_energy_in_rear_shelter'},
        energyBefore:paid.energyBefore,
        energySpent:paid.energyDemand,
        recoveryAward:0,cap,energyAfter};
    });
    elapsedSeconds+=seconds;
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    if(Math.abs(elapsedSeconds-bunchElapsedSeconds-
      nextGap)>1e-7)
      throw new Error('Rear pair clock differs from bunch.');
    energyByRider=Object.fromEntries(riders.map(row=>[
      row.riderId,row.energyAfter]));
    gapSecondsToBunch=nextGap;
    steps.push({sourceKm:km,
      leaderRiderId:leader.riderId,
      groupAbility,
      startDistanceM:(km-1)*1000,
      endDistanceM:km*1000,seconds,
      elapsedSeconds,bunchElapsedSeconds,
      gapSecondsToBunch,
      physicalGroup:{
        id:contactRoad.physicalGroup.id,
        riderIds:[...riderIds],
        atDistanceM:km*1000},
      riders,energyByRider,
      officialResults:false});
  }
  return {version,
    sourceKm:throughKm,steps,
    physicalGroup:steps.at(-1).physicalGroup,
    energyByRider,elapsedSeconds,
    gapSecondsToBunch,
    otherRidersUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function runPhysicalLossKmRearPairV1({startInput,
  start,staggered,contact,contactRoad,throughKm}){
  if(!isDeepStrictEqual(contactRoad,
    finishPhysicalLossKmContactV1({startInput,start,
      staggered,contact})))
    throw new Error('Rear pair needs exact paid contact road.');
  return runVerifiedRearPairRoadV1({startInput,staggered,contact,
    contactRoad,throughKm,
    version:PHYSICAL_LOSS_KM_REAR_PAIR_VERSION});
}

export function runPhysicalSoloFieldRearPairV1({startInput,
  start,staggered,soloField,fieldContact,contactRoad,
  throughKm}){
  if(!isDeepStrictEqual(contactRoad,
    finishPhysicalSoloFieldContactKmV1({startInput,
      start,staggered,soloField,fieldContact})))
    throw new Error('Field rear pair needs paid contact road.');
  return runVerifiedRearPairRoadV1({startInput,staggered,
    contact:fieldContact.firstContact,
    contactRoad,throughKm,
    version:PHYSICAL_SOLO_FIELD_REAR_PAIR_VERSION});
}

export function validatePhysicalSoloFieldRearPairV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalSoloFieldRearPairV1(input)))
    throw new Error('Field rear pair differs from paid source.');
  return true;
}

export function validatePhysicalLossKmRearPairV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalLossKmRearPairV1(input)))
    throw new Error('Rear pair differs from paid source.');
  return true;
}
