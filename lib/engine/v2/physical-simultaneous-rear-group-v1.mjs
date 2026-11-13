// A rear group starts only after all of its members have paid solo
// road to the same metre and clock. One exposed leader per kilometre
// pays more than each sheltered rider; all riders retain decisions.
import {isDeepStrictEqual} from 'node:util';
import {contactPhysicalSimultaneousLossV1,
  partitionPhysicalSimultaneousLossV1} from
  './physical-simultaneous-loss-contact-v1.mjs';
import {runPhysicalDetachedSoloV1} from
  './physical-detached-solo-run-v1.mjs';
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

export const PHYSICAL_SIMULTANEOUS_REAR_GROUP_VERSION=
  'v2-physical-simultaneous-rear-group-1';
export const PHYSICAL_MIXED_SIMULTANEOUS_REAR_GROUP_VERSION=
  'v2-physical-mixed-simultaneous-rear-group-1';
const effortRank={conserve:0,steady:1,hard:2};

function bunchStates(step,clock){
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  return step.physicalGroup.riderIds.map(riderId=>{
    const row=step.riders.find(item=>item.riderId===riderId);
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
    throw new Error('Simultaneous rear race lacks rider kilometre.');
  return {sourceKm:km,riderStates:states.sort((a,b)=>
    riderIds.indexOf(a.riderId)-
    riderIds.indexOf(b.riderId))};
}

function replayPhysicalSimultaneousRearGroup({
  startInput,start,lossKm,throughKm,mixed}){
  if(!Number.isInteger(throughKm)||throughKm<=lossKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Simultaneous rear group needs later road.');
  const contact=mixed?
    partitionPhysicalSimultaneousLossV1({
      startInput,start,lossKm}):
    contactPhysicalSimultaneousLossV1({
      startInput,start,lossKm});
  if(mixed&&(contact.contacts.length!==1||
    contact.separateSoloRiderIds.length!==1||
    contact.contacts[0].riderIds.length<2))
    throw new Error('Mixed rear needs one paid group and solo.');
  const meeting=mixed?contact.contacts[0]:contact.contact;
  const bunch=runPhysicalBunchAfterPaceLossV1({
    startInput,start,lossKm,throughKm});
  if(!isDeepStrictEqual(bunch.loss,contact.loss))
    throw new Error('Simultaneous group lacks paid bunch source.');
  const riderIds=start.riderIds;
  const groupIds=meeting.riderIds;
  const soloRiderId=mixed?
    contact.separateSoloRiderIds[0]:null;
  const separateSolo=mixed?
    runPhysicalDetachedSoloV1({startInput,start,lossKm,
      throughKm,riderId:soloRiderId}):null;
  if(mixed&&!isDeepStrictEqual(separateSolo.completion,
    contact.completions.find(row=>
      row.riderId===soloRiderId)))
    throw new Error('Mixed rear lacks paid solo source.');
  const entries=groupIds.map(riderId=>{
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>rider.id===riderId));
    return {riderId,team,rider:team.riders.find(row=>
      row.id===riderId),
    plan:startInput.soloCommitments?.find(row=>
      row.riderId===riderId)};
  });
  const kilometres=[];
  let bunchClock=0;
  for(const step of contact.loss.priorRoad){
    bunchClock+=step.elapsedSeconds;
    kilometres.push(fullKm(riderIds,step.sourceKm,
      bunchStates(step,bunchClock)));
  }
  bunchClock+=contact.loss.step.elapsedSeconds;
  const lossStates=bunchStates(contact.loss.step,bunchClock);
  for(const completion of contact.completions)
    lossStates.push({riderId:completion.riderId,
      sourceKm:lossKm,
      physicalGroupId:completion.physicalGroup.id,
      atDistanceM:lossKm*1000,
      elapsedSeconds:completion.elapsedSeconds,
      energyAfter:completion.energyAfter,
      decisions:[completion.decision]});
  kilometres.push(fullKm(riderIds,lossKm,lossStates));
  let groupClock=meeting.clockSeconds;
  let energyByRider=Object.fromEntries(contact
    .completions.filter(row=>groupIds.includes(
      row.riderId)).map(row=>[
      row.riderId,row.energyAfter]));
  const groupId=`rear-${groupIds.join('-')}`;
  const later=[];
  for(const bunchStep of bunch.road){
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
        throw new Error('Simultaneous rear exceeds team order.');
      return {...entry,intent,order};
    });
    const first=(km-lossKm-1)%current.length;
    const leader=Array.from({length:current.length},
      (_,offset)=>current[(first+offset)%current.length])
      .find(row=>row.intent.action!==
        'save_for_stage');
    if(!leader)
      throw new Error('Simultaneous rear needs willing leader.');
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
      throw new Error('Simultaneous rear needs paid pace.');
    const nextBunchClock=bunchClock+
      bunchStep.elapsedSeconds;
    const nextGroupClock=groupClock+seconds;
    const gapSecondsToBunch=nextGroupClock-
      nextBunchClock;
    if(gapSecondsToBunch<=0)
      throw new Error('Simultaneous rear needs paid bunch contact.');
    const soloStep=mixed?separateSolo.steps.find(row=>
      row.sourceKm===km):null;
    if(mixed){
      const previousSoloClock=km===lossKm+1?
        separateSolo.completion.elapsedSeconds:
        separateSolo.steps.find(row=>
          row.sourceKm===km-1).elapsedSeconds;
      const priorDifference=previousSoloClock-groupClock;
      const nextDifference=soloStep.elapsedSeconds-
        nextGroupClock;
      if(priorDifference*nextDifference<=0){
        const error=new Error(
          'Mixed rear and solo need paid contact road.');
        error.sourceKm=km;
        throw error;
      }
    }
    const rearRows=current.map(entry=>{
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
        throw new Error('Simultaneous rear cannot claim recovery.');
      const cap=replayRearEnergyCapV1({
        rider:entry.rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        paid.energyAfter).toFixed(3);
      if(entry.intent.action==='save_for_stage'&&
        energyAfter<entry.intent.committedStagePlan
          .reserveEnergy)
        throw new Error('Simultaneous rear breaks stage reserve.');
      return {riderId:entry.riderId,
        teamId:entry.team.id,
        decision:{riderId:entry.riderId,
          goal:entry.intent.action,
          teamOrderEffort:entry.order.effort,
          effort:entry.intent.effort,
          choice:role==='leader'?'pull':'shelter',
          reason:role==='leader'?
            'paid_rear_rotation':
            'save_energy_in_rear_shelter'},
        role,energyBefore:paid.energyBefore,
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
    if(mixed)states.push({riderId:soloRiderId,
      sourceKm:km,
      physicalGroupId:soloStep.physicalGroup.id,
      atDistanceM:km*1000,
      elapsedSeconds:soloStep.elapsedSeconds,
      energyAfter:soloStep.energyAfter,
      decisions:[soloStep.decision]});
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
    bunchClock=nextBunchClock;
    groupClock=nextGroupClock;
    energyByRider=Object.fromEntries(rearRows.map(
      row=>[row.riderId,row.energyAfter]));
  }
  return {version:mixed?
      PHYSICAL_MIXED_SIMULTANEOUS_REAR_GROUP_VERSION:
      PHYSICAL_SIMULTANEOUS_REAR_GROUP_VERSION,
    throughKm,lossKm,riderIds:[...riderIds],
    kilometres,sources:{contact,bunch,
      ...(mixed?{separateSolo}:{}),later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function replayPhysicalSimultaneousRearGroupV1(input){
  return replayPhysicalSimultaneousRearGroup({...input,
    mixed:false});
}

export function replayPhysicalMixedSimultaneousRearGroupV1(input){
  return replayPhysicalSimultaneousRearGroup({...input,
    mixed:true});
}

export function validatePhysicalSimultaneousRearGroupV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalSimultaneousRearGroupV1(input)))
    throw new Error('Simultaneous rear road differs from source.');
  return true;
}

export function validatePhysicalMixedSimultaneousRearGroupV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalMixedSimultaneousRearGroupV1(input)))
    throw new Error('Mixed rear road differs from paid source.');
  return true;
}
