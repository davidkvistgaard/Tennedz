// Continue a source-replayed postcatch rear pair with one paid
// exposed leader per kilometre. Refuse unpriced bunch contact or
// another unmodelled bunch loss.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerPostcatchContactV1} from
  './physical-manager-postcatch-contact-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {rearSoloPlanAtKmV1} from './rear-solo-commitment-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_POSTCATCH_GROUP_VERSION=
  'v2-physical-manager-postcatch-group-1';
const effortRank={conserve:0,steady:1,hard:2};

export function replayPhysicalManagerPostcatchGroupV1({
  input,leaderRiderId,throughKm}){
  const contact=replayPhysicalManagerPostcatchContactV1({
    input,leaderRiderId});
  return continuePhysicalPostcatchGroupV1({
    contact,startInput:input.startInput,throughKm,
    loss:contact.source.contactInput.loss,
    groupRoad:contact.source.groupRoad,
    caughtRiderId:contact.source.contact.frontRiderId,
    version:PHYSICAL_MANAGER_POSTCATCH_GROUP_VERSION});
}

export function continuePhysicalPostcatchGroupV1({
  contact,startInput,throughKm,loss,groupRoad,
  caughtRiderId,version}){
  const sourcedLoss=contact?.source?.contactInput?.loss??
    contact?.sources?.loss;
  const sourcedGroup=contact?.source?.groupRoad??
    contact?.sources?.groupRoad;
  const sourcedCaught=contact?.source?.contact
    ?.frontRiderId??contact?.sources?.contact
    ?.frontRiderId;
  if(!Number.isInteger(throughKm)||
    throughKm<=contact.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Post-catch group needs later sourced road.');
  if(typeof version!=='string'||!version||
    !isDeepStrictEqual(loss,sourcedLoss)||
    !isDeepStrictEqual(groupRoad,sourcedGroup)||
    caughtRiderId!==sourcedCaught||
    !groupRoad||!loss||
    !groupRoad.physicalGroup.riderIds.includes(
      caughtRiderId)||
    !contact.riderIds||
    !Array.isArray(contact.kilometres)||
    contact.kilometres.length!==contact.sourceKm)
    throw new Error('Post-catch group needs paid contact source.');
  const riderIds=contact.riderIds;
  const rearIds=groupRoad.physicalGroup.riderIds;
  const detachedIds=loss.splits.map(row=>row.riderId);
  const entries=rearIds.map(riderId=>{
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>rider.id===riderId));
    return {riderId,team,rider:team.riders.find(
      row=>row.id===riderId),
    plan:startInput.soloCommitments?.find(
      row=>row.riderId===riderId)};
  });
  let priorBunch=loss;
  let bunchClock=contact.kilometres.at(-1)
    .riderStates.find(row=>row.physicalGroupId===
      'peloton').elapsedSeconds;
  let groupClock=groupRoad.elapsedSeconds;
  let rearEnergy=groupRoad.energyByRider;
  const later=[];
  for(let km=contact.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:priorBunch.physicalGroup
      .riderIds,energyByRider:priorBunch.energyByRider,
    quietKmByRider:priorBunch.quietKmByRider};
    let bunch;
    try{
      bunch=advancePhysicalBunchAfterPostcatchLossKmV1({
        startInput,prior,segment,
        caughtRiderId,
        detachedRiderIds:detachedIds});
    }catch(error){
      error.sourceKm=km;
      throw error;
    }
    const current=entries.map(entry=>{
      const intent=entry.plan?rearSoloPlanAtKmV1({
        commitment:entry.plan,km}):
        {action:'finish_safely',effort:'conserve'};
      const order=orderAt(entry.team.orders,km-1);
      if(effortRank[intent.effort]===undefined||
        effortRank[intent.effort]>
          effortRank[order.effort])
        throw new Error('Post-catch rear exceeds team order.');
      return {...entry,intent,order};
    });
    const preferred=current[(rearIds.indexOf(
      groupRoad.leaderRiderId)+km-contact.sourceKm)%2];
    const alternate=current.find(row=>row!==preferred);
    const leader=preferred.intent.action===
      'save_for_stage'?alternate:preferred;
    if(leader.intent.action==='save_for_stage')
      throw new Error('Post-catch rear needs willing leader.');
    const follower=current.find(row=>row!==leader);
    const leaderEffect=riderKilometreEffect(
      leader.rider,segment,{phase:'solo',
        energy:rearEnergy[leader.riderId],
        exposed:segment.exposed});
    const leaderMaxAbility=leaderEffect.ability+
      (TUNING.effortPressure[
        leader.intent.effort]-1)*20;
    const followerEffect=riderKilometreEffect(
      follower.rider,segment,{phase:'cruise',
        energy:rearEnergy[follower.riderId],
        exposed:segment.exposed});
    const followerAbility=followerEffect.ability+
      (TUNING.effortPressure[
        follower.intent.effort]-1)*20+
        TUNING.breakaway.bunchDraftAdvantage;
    if(followerAbility+1e-9<leaderMaxAbility&&
      leader.intent.action==='rejoin_bunch')
      throw new Error('Post-catch rear follower cannot hold leader.');
    const groupAbility=Math.min(leaderMaxAbility,
      followerAbility);
    const seconds=segmentBaseSeconds(segment)+
      (50-groupAbility)*
        MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Post-catch rear needs paid pace.');
    const nextBunchClock=bunchClock+
      bunch.elapsedSeconds;
    const nextGroupClock=groupClock+seconds;
    const gapSecondsToBunch=nextGroupClock-
      nextBunchClock;
    if(gapSecondsToBunch<=0)
      throw new Error('Post-catch rear needs paid bunch contact.');
    const rearRows=current.map(entry=>{
      const role=entry===leader?'leader':'sheltered';
      const paid=priceRearEnergyDemandV1({
        rider:entry.rider,segment,
        energyBefore:rearEnergy[entry.riderId],
        effort:entry.intent.effort,role,distanceM:1000});
      const recovery=recoveryForKilometre({
        rider:entry.rider,segment,
        effort:entry.intent.effort,group:'dropped',
        working:role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Post-catch rear cannot claim recovery.');
      const cap=replayRearEnergyCapV1({
        rider:entry.rider,
        kilometres:startInput.routeKilometres,
        throughKm:km}).cap;
      const energyAfter=+Math.min(cap,
        paid.energyAfter).toFixed(3);
      if(entry.intent.action==='save_for_stage'&&
        energyAfter<entry.intent.committedStagePlan
          .reserveEnergy)
        throw new Error('Post-catch rear breaks stage reserve.');
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
    const decisions=new Map(bunch.riderDecisions
      .map(row=>[row.riderId,row]));
    const states=bunch.physicalGroup.riderIds.map(
      riderId=>{
        const row=bunch.riders.find(item=>
          item.riderId===riderId);
        return {riderId,sourceKm:km,
          physicalGroupId:'peloton',
          atDistanceM:km*1000,
          elapsedSeconds:nextBunchClock,
          energyAfter:row.energyAfter,
          decisions:[decisions.get(riderId)]};
      });
    for(const row of rearRows)
      states.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:groupRoad.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:nextGroupClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]});
    if(states.length!==riderIds.length||
      new Set(states.map(row=>row.riderId)).size!==
        riderIds.length||states.some(row=>
        !row.decisions[0]||row.energyAfter<0))
      throw new Error('Post-catch rear lacks rider road.');
    const riderStates=states.sort((a,b)=>
      riderIds.indexOf(a.riderId)-
      riderIds.indexOf(b.riderId));
    later.push({sourceKm:km,bunch,rearRows,
      leaderRiderId:leader.riderId,seconds,
      groupAbility,followerAbility,
      bunchElapsedSeconds:nextBunchClock,
      groupElapsedSeconds:nextGroupClock,
      gapSecondsToBunch,riderStates});
    priorBunch=bunch;
    bunchClock=nextBunchClock;
    groupClock=nextGroupClock;
    rearEnergy=Object.fromEntries(rearRows.map(row=>
      [row.riderId,row.energyAfter]));
  }
  const kilometres=[...contact.kilometres,
    ...later.map(row=>({sourceKm:row.sourceKm,
      riderStates:row.riderStates}))];
  return {version,
    throughKm,riderIds:[...riderIds],kilometres,
    sources:{contact,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerPostcatchGroupV1(
input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerPostcatchGroupV1(input)))
    throw new Error('Post-catch rear road differs from source.');
  return true;
}
