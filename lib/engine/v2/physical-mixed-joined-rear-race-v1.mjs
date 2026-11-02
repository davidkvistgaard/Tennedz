// Full-field replay after one paid solo joins a 19-rider rear group.
// The contact kilometre and every later exposed turn are paid.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalMixedRearSoloV1} from
  './physical-mixed-rear-solo-contact-v1.mjs';
import {finishPhysicalMixedRearContactKmV1} from
  './physical-mixed-rear-contact-road-v1.mjs';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
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
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MIXED_JOINED_REAR_RACE_VERSION=
  'v2-physical-mixed-joined-rear-race-1';
const effortRank={conserve:0,steady:1,hard:2};

function bunchStates(step,clock){
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  return step.physicalGroup.riderIds.map(riderId=>{
    const row=step.riders.find(item=>
      item.riderId===riderId);
    return {riderId,sourceKm:step.sourceKm,
      physicalGroupId:'peloton',
      atDistanceM:step.sourceKm*1000,
      elapsedSeconds:clock,
      energyAfter:row.energyAfter,
      decisions:[decisions.get(riderId)]};
  });
}

function fullKm(riderIds,km,states){
  if(states.length!==riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      riderIds.length||states.some(row=>
      row.sourceKm!==km||
      !Number.isFinite(row.elapsedSeconds)||
      !Number.isFinite(row.energyAfter)||
      row.energyAfter<0||
      !row.decisions.length||
      row.decisions.some(decision=>!decision)))
    throw new Error('Mixed joined rear lacks rider kilometre.');
  return {sourceKm:km,riderStates:states.sort((a,b)=>
    riderIds.indexOf(a.riderId)-
    riderIds.indexOf(b.riderId))};
}

export function replayPhysicalMixedJoinedRearRaceV1({
  startInput,start,lossKm,contactKm,throughKm}){
  if(!Number.isInteger(throughKm)||
    throughKm<=contactKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Mixed joined rear needs later road.');
  const source={startInput,start,lossKm,contactKm};
  const contact=contactPhysicalMixedRearSoloV1(source);
  const contactRoad=finishPhysicalMixedRearContactKmV1({
    ...source,contact});
  const bunch=runPhysicalBunchAfterPaceLossV1({
    startInput,start,lossKm,throughKm});
  const prior=contact.sources.prior;
  const priorBunch=prior.sources.bunch;
  if(!isDeepStrictEqual(bunch.loss,priorBunch.loss)||
    !isDeepStrictEqual(bunch.road.slice(0,
      contactKm-lossKm-1),priorBunch.road)||
    !isDeepStrictEqual(bunch.road.find(row=>
      row.sourceKm===contactKm),
      contactRoad.bunchStep))
    throw new Error('Mixed joined rear lacks same paid bunch.');
  const riderIds=start.riderIds;
  const groupIds=contactRoad.physicalGroup.riderIds;
  const groupId=contactRoad.physicalGroup.id;
  const kilometres=structuredClone(prior.kilometres);
  const contactStates=bunchStates(contactRoad.bunchStep,
    contactRoad.bunchElapsedSeconds);
  for(const row of contactRoad.riders){
    const beforeContact=contact.riders.find(item=>
      item.riderId===row.riderId);
    contactStates.push({riderId:row.riderId,
      sourceKm:contactKm,
      physicalGroupId:groupId,
      atDistanceM:contactKm*1000,
      elapsedSeconds:contactRoad.elapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[beforeContact.decision,
        row.decision]});
  }
  kilometres.push(fullKm(riderIds,contactKm,
    contactStates));
  const entries=groupIds.map(riderId=>{
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    return {riderId,team,rider:team.riders.find(row=>
      row.id===riderId),
    plan:startInput.soloCommitments?.find(row=>
      row.riderId===riderId)};
  });
  let groupClock=contactRoad.elapsedSeconds;
  let bunchClock=contactRoad.bunchElapsedSeconds;
  let energyByRider=contactRoad.energyByRider;
  const priorLeaderIndex=groupIds.indexOf(
    contactRoad.leaderRiderId);
  const later=[];
  for(const bunchStep of bunch.road.filter(row=>
    row.sourceKm>contactKm)){
    const km=bunchStep.sourceKm;
    const segment=startInput.routeKilometres[km-1];
    const current=entries.map(entry=>{
      const intent=entry.plan?rearSoloPlanAtKmV1({
        commitment:entry.plan,km}):
        {action:'finish_safely',effort:'conserve'};
      const order=orderAt(entry.team.orders,km-1);
      if(effortRank[intent.effort]===undefined||
        effortRank[intent.effort]>
          effortRank[order.effort])
        throw new Error('Mixed joined rear exceeds team order.');
      return {...entry,intent,order};
    });
    const first=(priorLeaderIndex+
      km-contactKm)%current.length;
    const leader=Array.from({length:current.length},
      (_,offset)=>current[(first+offset)%current.length])
      .find(row=>row.intent.action!==
        'save_for_stage');
    if(!leader)
      throw new Error('Mixed joined rear needs willing leader.');
    const leaderEffect=riderKilometreEffect(
      leader.rider,segment,{phase:'solo',
        energy:energyByRider[leader.riderId],
        exposed:segment.exposed});
    const leaderAbility=leaderEffect.ability+
      (TUNING.effortPressure[
        leader.intent.effort]-1)*20;
    const followerAbilities=current.filter(row=>
      row!==leader).map(entry=>{
      const effect=riderKilometreEffect(entry.rider,
        segment,{phase:'cruise',
          energy:energyByRider[entry.riderId],
          exposed:segment.exposed});
      return effect.ability+
        (TUNING.effortPressure[
          entry.intent.effort]-1)*20+
        TUNING.breakaway.bunchDraftAdvantage;
    });
    const groupAbility=Math.min(leaderAbility,
      ...followerAbilities);
    const seconds=segmentBaseSeconds(segment)+
      (50-groupAbility)*
        MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Mixed joined rear needs paid pace.');
    const nextBunchClock=bunchClock+
      bunchStep.elapsedSeconds;
    const nextGroupClock=groupClock+seconds;
    const gapSecondsToBunch=nextGroupClock-
      nextBunchClock;
    if(gapSecondsToBunch<=0)
      throw new Error('Mixed joined rear needs paid bunch contact.');
    const rearRows=current.map(entry=>{
      const role=entry===leader?'leader':'sheltered';
      const paid=priceRearEnergyDemandV1({
        rider:entry.rider,segment,
        energyBefore:energyByRider[entry.riderId],
        effort:entry.intent.effort,role,
        distanceM:1000});
      const recovery=recoveryForKilometre({
        rider:entry.rider,segment,
        effort:entry.intent.effort,
        group:'dropped',
        working:role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Mixed joined rear cannot claim recovery.');
      const cap=replayRearEnergyCapV1({
        rider:entry.rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        paid.energyAfter).toFixed(3);
      if(entry.intent.action==='save_for_stage'&&
        energyAfter<entry.intent.committedStagePlan
          .reserveEnergy)
        throw new Error('Mixed joined rear breaks stage reserve.');
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
    const states=bunchStates(bunchStep,
      nextBunchClock);
    for(const row of rearRows)
      states.push({riderId:row.riderId,
        sourceKm:km,physicalGroupId:groupId,
        atDistanceM:km*1000,
        elapsedSeconds:nextGroupClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]});
    kilometres.push(fullKm(riderIds,km,states));
    later.push({sourceKm:km,
      leaderRiderId:leader.riderId,
      groupAbility,seconds,
      bunchElapsedSeconds:nextBunchClock,
      groupElapsedSeconds:nextGroupClock,
      gapSecondsToBunch,rearRows,
      physicalGroup:{id:groupId,
        riderIds:[...groupIds],
        atDistanceM:km*1000}});
    groupClock=nextGroupClock;
    bunchClock=nextBunchClock;
    energyByRider=Object.fromEntries(rearRows.map(
      row=>[row.riderId,row.energyAfter]));
  }
  return {version:PHYSICAL_MIXED_JOINED_REAR_RACE_VERSION,
    throughKm,lossKm,contactKm,
    riderIds:[...riderIds],kilometres,
    sources:{contact,contactRoad,bunch,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalMixedJoinedRearRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalMixedJoinedRearRaceV1(input)))
    throw new Error('Mixed joined rear race differs from source.');
  return true;
}
