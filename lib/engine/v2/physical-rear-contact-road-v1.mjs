// The remainder of a contact kilometre is a paid two-rider road.
// The rider who was ahead keeps the front unless a committed future-
// stage reserve prevents it; the catcher may take that single turn.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalRearSolosV1} from
  './physical-rear-solo-contact-v1.mjs';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_REAR_CONTACT_ROAD_VERSION=
  'v2-physical-rear-contact-road-1';
const effortRank={conserve:0,steady:1,hard:2};
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Rear contact needs physical group pace.');
  return 3600/seconds;
};

export function finishPhysicalRearContactKmV1({startInput,start,
  lossKm,contactKm,riderIds,contact}){
  if(!isDeepStrictEqual(contact,contactPhysicalRearSolosV1({
    startInput,start,lossKm,contactKm,riderIds})))
    throw new Error('Rear contact road needs replayed paid meeting.');
  const segment=startInput.routeKilometres[contactKm-1];
  const byId=new Map(startInput.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const entries=contact.riders.map(row=>{
    const {rider,team}=byId.get(row.riderId);
    const plan=startInput.soloCommitments.find(item=>
      item.riderId===row.riderId);
    const intent=rearSoloPlanAtKmV1({commitment:plan,km:contactKm});
    const order=orderAt(team.orders,contactKm-1);
    if(effortRank[intent.effort]>effortRank[order.effort])
      throw new Error('Rear contact exceeds a team effort order.');
    return {rider,team,row,intent};
  });
  const ahead=entries.find(item=>item.rider.id===
    contact.aheadRiderId);
  const catching=entries.find(item=>item.rider.id===
    contact.catchingRiderId);
  const leader=ahead.intent.action==='save_for_stage'?
    catching:ahead;
  if(leader.intent.action==='save_for_stage')
    throw new Error('Rear contact needs a willing paid leader.');
  const follower=leader===ahead?catching:ahead;
  const base=segmentBaseSeconds(segment);
  const leaderEffect=riderKilometreEffect(leader.rider,segment,{
    phase:'solo',energy:leader.row.energyAfter,
    exposed:segment.exposed});
  const leaderAbility=leaderEffect.ability+
    (TUNING.effortPressure[leader.intent.effort]-1)*20;
  const speedKph=speed(base,leaderAbility);
  const followerEffect=riderKilometreEffect(follower.rider,segment,{
    phase:'cruise',energy:follower.row.energyAfter,
    exposed:segment.exposed});
  const followerAbility=followerEffect.ability+
    (TUNING.effortPressure[follower.intent.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(followerAbility+1e-9<leaderAbility)
    throw new Error('Rear contact follower cannot hold paid leader.');
  const remainingM=contactKm*1000-
    contact.contactAtDistanceM;
  const groupSeconds=3600*remainingM/1000/speedKph;
  const bunch=runPhysicalBunchAfterPaceLossV1({startInput,start,
    lossKm,throughKm:contactKm});
  const bunchAtContactSeconds=bunch.elapsedSeconds-
    bunch.road.at(-1).elapsedSeconds*remainingM/1000;
  const bunchRemainingSeconds=bunch.elapsedSeconds-
    bunchAtContactSeconds;
  const gapSecondsToBunch=contact.behindBunchSeconds+
    groupSeconds-bunchRemainingSeconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Rear group needs separate bunch contact road.');
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
      throw new Error('Rear contact breaks future-stage reserve.');
    return {riderId:item.rider.id,teamId:item.team.id,
      decision:{goal:item.intent.action,
        effort:item.intent.effort,
        choice:role==='leader'?'pull':'shelter',
        reason:role==='leader'?'continue_or_take_front_after_contact':
          'save_energy_after_contact'},
      role,energyBefore:item.row.energyAfter,
      energySpent:paid.energyDemand,recoveryAward:0,
      cap,energyAfter};
  });
  return {version:PHYSICAL_REAR_CONTACT_ROAD_VERSION,
    sourceKm:contactKm,
    startDistanceM:contact.contactAtDistanceM,
    endDistanceM:contactKm*1000,
    leaderRiderId:leader.rider.id,
    groupSpeedKph:speedKph,
    elapsedSeconds:contact.contactClockSeconds+groupSeconds,
    gapSecondsToBunch,
    physicalGroup:{id:contact.physicalGroup.id,
      riderIds:[...riderIds],atDistanceM:contactKm*1000},
    riders,energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energyAfter])),
    officialResults:false};
}

export function validatePhysicalRearContactRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalRearContactKmV1(input)))
    throw new Error('Rear contact road differs from paid source.');
  return true;
}
