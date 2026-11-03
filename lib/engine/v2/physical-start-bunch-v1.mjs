// First-kilometre physical source: all starters share the start line.
// A named front worker pays for the pace; every other rider pays shelter.
// Attacks and chases refuse; a separate opt-in road records paid pace loss.
import {isDeepStrictEqual} from 'node:util';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt,normalizeOrders} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {commitRearSoloPlanV1} from './rear-solo-commitment-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT,
  MOTOR_DRAFT_SHELTER} from
  './tuning.mjs';

export const PHYSICAL_START_BUNCH_VERSION=
  'v2-physical-start-bunch-1';
export const PHYSICAL_BUNCH_PACE_LOSS_VERSION=
  'v2-physical-bunch-pace-loss-1';
export const PHYSICAL_STAGGERED_BUNCH_LOSS_VERSION=
  'v2-physical-staggered-bunch-loss-1';
export const PHYSICAL_NAMED_ATTACK_VERSION=
  'v2-physical-named-attack-1';
export const PHYSICAL_BUNCH_AFTER_ATTACK_VERSION=
  'v2-physical-bunch-after-attack-1';
const DRAFT_COST_FRACTION=.8;
const physicalVersion=(base,input)=>
  [2,3,4].includes(input?.physicalDraftVersion)?
    base.replace(/-1$/,
      `-${input.physicalDraftVersion}`):base;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Physical start needs valid road pace.');
  return 3600/seconds;
};
const terrainLoad=segment=>1+Math.max(0,segment.gradientPct)*.035+
  (segment.surface==='road'?0:.15);

export function startPhysicalBunchV1({teams,routeKilometres,
  commitment,raceSeed,soloCommitments,
  emergencyFrontWorkers,physicalDraftVersion}){
  if(!Array.isArray(teams)||teams.length<2||
    !Array.isArray(routeKilometres)||
    routeKilometres.length!==commitment?.distanceKm||
    routeKilometres.some((segment,index)=>segment?.km!==index+1||
      !['flat','hill','climb','descent'].includes(segment.terrain)||
      !Number.isFinite(segment.gradientPct)||
      !['road','cobbles','gravel','dirt'].includes(segment.surface)||
      typeof segment.exposed!=='boolean'||
      !Number.isFinite(segment.weather?.temperatureC)||
      !Number.isFinite(segment.weather?.windKph)||
      !Number.isFinite(segment.weather?.rainMm))||
    typeof raceSeed!=='string'||!raceSeed||
    (physicalDraftVersion!==undefined&&
      ![2,3,4].includes(physicalDraftVersion))||
    !isDeepStrictEqual(commitment.roster,teams.map(team=>({
      teamId:team.id,riderIds:team.riders.map(rider=>rider.id)}))))
    throw new Error('Physical start needs committed field and route.');
  const riderIds=teams.flatMap(team=>team.riders.map(row=>row.id));
  if(new Set(riderIds).size!==riderIds.length||
    riderIds.length!==teams.length*8)
    throw new Error('Physical start needs unique eight-rider teams.');
  for(const team of teams){
    const normalized=normalizeOrders(team.orders,{
      riderIds:team.riders.map(rider=>rider.id),
      distanceKm:routeKilometres.length,
      keypoints:commitment.keypoints,
      allowFrontWork:true,allowNamedFrontWorker:true});
    if(!isDeepStrictEqual(team.orders,normalized))
      throw new Error('Physical start needs normalized manager orders.');
  }
  if(emergencyFrontWorkers!==undefined&&(
    !Array.isArray(emergencyFrontWorkers)||
    new Set(emergencyFrontWorkers.map(row=>
      `${row?.teamId}:${row?.unavailableRiderId}`))
      .size!==emergencyFrontWorkers.length||
    emergencyFrontWorkers.some(row=>{
      const team=teams.find(item=>item.id===
        row?.teamId);
      return row?.version!==1||!team||
        !team.orders.helperIds.includes(
          row.unavailableRiderId)||
        !team.orders.helperIds.includes(
          row.replacementRiderId)||
        row.unavailableRiderId===
          row.replacementRiderId||
        Object.keys(row).sort().join(',')!==
          'replacementRiderId,teamId,unavailableRiderId,version';
    })))
    throw new Error('Physical start needs named emergency front workers.');
  if(soloCommitments!==undefined&&(
    !Array.isArray(soloCommitments)||
    new Set(soloCommitments.map(plan=>plan?.riderId)).size!==
      soloCommitments.length||
    soloCommitments.some(plan=>!riderIds.includes(plan?.riderId)||
      plan.distanceKm!==routeKilometres.length||
      !isDeepStrictEqual(plan,commitRearSoloPlanV1(plan)))))
    throw new Error('Physical start needs replayed solo plans.');
  const energyByRider={};
  for(const team of teams)for(const rider of team.riders){
    const initial=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:0}).initialCap;
    if(!Number.isFinite(team.energy?.[rider.id])||
      Math.abs(team.energy[rider.id]-initial)>1e-6)
      throw new Error('Physical start energy differs from committed rider.');
    energyByRider[rider.id]=initial;
  }
  return {version:physicalVersion(
      PHYSICAL_START_BUNCH_VERSION,
      {physicalDraftVersion}),
    raceSeed,atDistanceM:0,sourceKm:0,
    committedSource:structuredClone({teams,routeKilometres,
      commitment,...(soloCommitments===undefined?{}:{soloCommitments}),
      ...(emergencyFrontWorkers===undefined?{}:{
        emergencyFrontWorkers}),
      ...(physicalDraftVersion===undefined?{}:{
        physicalDraftVersion})}),
    riderIds,energyByRider,
    quietKmByRider:Object.fromEntries(riderIds.map(id=>[id,0])),
    elapsedSeconds:0,officialResults:false};
}

export function advancePhysicalStartBunchV1({startInput,start,
  segment}){
  if(!isDeepStrictEqual(start,startPhysicalBunchV1(startInput))||
    !isDeepStrictEqual(segment,startInput.routeKilometres[0])||
    segment?.km!==1)
    throw new Error('First bunch kilometre needs replayed start source.');
  return advanceSupportedBunchKm(startInput,start,segment);
}

function advanceSupportedBunchKm(startInput,prior,segment,
  allowPaceLoss=false,allowNamedAttack=false,
  existingForwardRiderId=null,formerForwardRiderId=null,
  knownDetachedRiderIds=[],allowOrderedChase=false,
  resolvedChaseTeamId=null,returnedContact=null){
  const {teams,commitment,routeKilometres}=startInput;
  const km=segment.km;
  const ordered=teams.map(team=>({team,
    order:orderAt(team.orders,km-1),
    stake:teamChaseStakeAtKmV1({commitment,teamId:team.id,km})}));
  const attacks=ordered.filter(({order})=>order.attack!=='none');
  const blockedForwardAttacks=attacks.filter(({order})=>
    (existingForwardRiderId!==null&&
    order.attackRiderId===existingForwardRiderId)||
    (formerForwardRiderId!==null&&
    order.attackRiderId===formerForwardRiderId)||
    (returnedContact!==null&&
    order.attackRiderId===returnedContact.riderId)||
    knownDetachedRiderIds.includes(order.attackRiderId));
  if(returnedContact!==null&&(
    returnedContact.version!==
      'v2-physical-manager-return-contact-1'||
    returnedContact.sourceKm>=km||
    !prior.riderIds.includes(returnedContact.riderId)))
    throw new Error('Returned rider needs paid prior contact.');
  if(resolvedChaseTeamId!==null&&(
    formerForwardRiderId===null||
    !teams.some(team=>team.id===resolvedChaseTeamId)))
    throw new Error('Resolved chase needs sourced caught target.');
  if(ordered.some(({team,order,stake})=>
    !['conserve','steady','hard'].includes(order.effort)||
    !['none','selective','repeated'].includes(order.attack)||
    (order.chase!=='ignore'&&!(
      (allowOrderedChase||
        resolvedChaseTeamId===team.id)&&
      ['selective','all'].includes(order.chase)&&
      order.frontWork==='rotate'&&
      ['sprint_finish','summit_attack'].includes(
        stake.goal)))||
    !['rotate','sit_in',undefined].includes(order.frontWork))||
    ordered.filter(({order})=>order.frontWork==='rotate').length!==1||
    attacks.length&&(allowNamedAttack?attacks.length!==1:
      attacks.length!==blockedForwardAttacks.length))
    throw new Error('First bunch road needs one ordered front worker.');
  if(allowNamedAttack&&attacks.length!==1)
    throw new Error('Named attack road needs one committed attacker.');
  if(existingForwardRiderId!==null&&
    prior.riderIds.includes(existingForwardRiderId))
    throw new Error('Forward rider cannot regain bunch without contact.');
  if(formerForwardRiderId!==null&&
    prior.riderIds.includes(formerForwardRiderId))
    throw new Error('Slid rider cannot regain bunch without contact.');
  if(knownDetachedRiderIds.some(id=>prior.riderIds.includes(id)))
    throw new Error('Detached rider cannot regain bunch without contact.');
  const attacking=allowNamedAttack?attacks[0]:null;
  if(attacking&&!['break_stage','summit_attack'].includes(
    attacking.stake.goal))
    throw new Error('Named attack needs an actual sporting stake.');
  const attackerId=attacking?.order.attackRiderId;
  if(attacking&&(!attacking.team.riders.some(row=>
    row.id===attackerId)||!prior.riderIds.includes(attackerId)))
    throw new Error('Named attacker is not in physical bunch.');
  const {team:frontTeam,order:frontOrder}=ordered.find(({order})=>
    order.frontWork==='rotate');
  if(resolvedChaseTeamId!==null&&(
    frontTeam.id!==resolvedChaseTeamId||
    frontOrder.chase==='ignore'))
    throw new Error('Resolved chase needs its named working team.');
  if(allowOrderedChase&&frontOrder.chase==='ignore')
    throw new Error('Perceived chase needs an active manager order.');
  let leaderId=frontOrder.frontWorkRiderId;
  let emergencyFrontWorker=null;
  if(!prior.riderIds.includes(leaderId)){
    const plan=startInput.emergencyFrontWorkers?.find(row=>
      row.teamId===frontTeam.id&&
      row.unavailableRiderId===leaderId);
    if(!plan||!prior.riderIds.includes(
      plan.replacementRiderId))
      throw new Error('Ordered front worker is no longer in bunch.');
    emergencyFrontWorker={version:1,sourceKm:km,
      teamId:frontTeam.id,
      unavailableRiderId:leaderId,
      replacementRiderId:plan.replacementRiderId,
      reason:'committed_worker_absent_from_paid_bunch'};
    leaderId=plan.replacementRiderId;
  }
  const leader=frontTeam.riders.find(row=>row.id===leaderId);
  if(!leader||!frontTeam.orders.helperIds.includes(leaderId))
    throw new Error('First bunch road needs a named helper leader.');
  if(attackerId===leaderId)
    throw new Error('Named attacker cannot also lead the bunch.');
  const byId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{rider,team}])));
  const leaderEffect=riderKilometreEffect(leader,segment,{
    phase:'cruise',energy:prior.energyByRider[leaderId],
    exposed:segment.exposed});
  const adjustment=frontOrder.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[frontOrder.effort];
  const base=segmentBaseSeconds(segment);
  const leaderAbility=leaderEffect.ability+adjustment;
  const bunchSpeedKph=speed(base,leaderAbility);
  const load=terrainLoad(segment);
  const riderDecisions=[];
  const splits=[];
  let attackRecord=null;
  const riders=prior.riderIds.map(riderId=>{
    const {rider,team}=byId.get(riderId);
    const {order,stake}=ordered.find(row=>row.team.id===team.id);
    const leading=riderId===leaderId;
    const before=prior.energyByRider[riderId];
    if(riderId===attackerId){
      const effect=riderKilometreEffect(rider,segment,{
        phase:'attack',energy:before,
        exposed:segment.exposed});
      const attackAbility=effect.ability+
        (TUNING.effortPressure[order.effort]-1)*20;
      const attackSpeedKph=speed(base,attackAbility);
      const attackSeconds=3600/attackSpeedKph;
      const gapSeconds=3600/bunchSpeedKph-attackSeconds;
      if(gapSeconds<=0)
        throw new Error('Named attack cannot establish physical gap.');
      const extraCost=order.attack==='repeated'?
        TUNING.attack.repeatedCost:
        TUNING.attack.selectiveCost;
      const spent=(TUNING.effortCost[order.effort]*load+
        extraCost)*effect.energyCostMultiplier;
      if(spent>before+1e-9)
        throw new Error('Named attacker cannot pay road.');
      const cap=replayRearEnergyCapV1({rider,
        kilometres:routeKilometres,throughKm:km}).cap;
      const energyAfter=+Math.min(cap,before-spent).toFixed(3);
      attackRecord={riderId,teamId:team.id,
        attackType:order.attack,attackAbility,
        attackSpeedKph,attackSeconds,gapSeconds,
        frontSolo:{id:'front-'+riderId,
          riderIds:[riderId],atDistanceM:km*1000},
        energyAfter};
      riderDecisions.push({riderId,teamId:team.id,
        goal:stake.goal,choice:'attack',
        reason:'named_manager_attack',effort:order.effort});
      return {riderId,role:'attacker',
        energyBefore:before,energySpent:spent,
        recoveryAward:0,cap,energyAfter,
        quietKm:0,holdAbility:null};
    }
    const effect=leading?leaderEffect:riderKilometreEffect(rider,
      segment,{phase:'cruise',energy:before,
        exposed:segment.exposed});
    const draftBonus=[2,3,4].includes(
      startInput.physicalDraftVersion)?
      MOTOR_DRAFT_SHELTER[segment.terrain]:
      TUNING.breakaway.bunchDraftAdvantage;
    const holdAbility=leading?leaderAbility:effect.ability+
      (TUNING.effortPressure[order.effort]-1)*20+
      draftBonus;
    const soloEffect=!leading&&
      [2,3,4].includes(startInput.physicalDraftVersion)?
      riderKilometreEffect(rider,segment,{
        phase:'solo',energy:before,
        exposed:segment.exposed}):null;
    const soloAbility=soloEffect?
      soloEffect.ability+
        (TUNING.effortPressure[
          order.effort]-1)*20:null;
    const paidPaceMatch=soloAbility!==null&&
      soloAbility+1e-9>=leaderAbility&&
      holdAbility+1e-9<leaderAbility;
    if(holdAbility+1e-9<leaderAbility&&
      !paidPaceMatch){
      if(!allowPaceLoss)
        throw new Error('Physical start follower cannot hold paid pace.');
      const splitEffect=soloEffect??
        riderKilometreEffect(rider,segment,{
          phase:'solo',energy:before,
          exposed:segment.exposed});
      const soloSpeedKph=speed(base,splitEffect.ability+
        (TUNING.effortPressure[order.effort]-1)*20);
      const distanceM=1000*soloSpeedKph/bunchSpeedKph;
      if(distanceM<=0||distanceM>=1000)
        throw new Error('Pace loss needs physical distance behind bunch.');
      const spent=TUNING.effortCost[order.effort]*load*
        splitEffect.energyCostMultiplier*distanceM/1000;
      if(spent>before+1e-9)
        throw new Error('Pace-loss solo cannot pay its partial road.');
      const atDistanceM=(km-1)*1000+distanceM;
      const energyAfter=+(before-spent).toFixed(3);
      const hardHoldAbility=effect.ability+
        (TUNING.effortPressure.hard-1)*20+
        draftBonus;
      const hardHoldEnergyDemand=
        TUNING.effortCost.hard*load*
        DRAFT_COST_FRACTION*
        effect.energyCostMultiplier;
      const orderLimited=startInput.physicalDraftVersion===4&&
        hardHoldAbility+1e-9>=leaderAbility&&
        hardHoldEnergyDemand<=before+1e-9;
      splits.push({kind:'physical_pace_loss',riderId,
        bunchLeaderRiderId:leaderId,atDistanceM,
        soloSpeedKph,bunchSpeedKph,
        behindBunchM:km*1000-atDistanceM,
        ...(startInput.physicalDraftVersion===4?{
          hardHoldAbility,hardHoldEnergyDemand,
          orderLimited}: {})});
      riderDecisions.push({riderId,teamId:team.id,
        goal:stake.goal,
        choice:orderLimited?'try_hold_within_order':
          'pace_loss',
        reason:startInput.physicalDraftVersion===4?
          orderLimited?'team_effort_ceiling':
            'cannot_hold_even_at_hard_effort':
          'cannot_hold_paid_front_pace',
        effort:order.effort});
      return {riderId,role:'solo_partial',atDistanceM,
        energyBefore:before,energySpent:spent,
        recoveryAward:0,cap:null,energyAfter,
        quietKm:prior.quietKmByRider[riderId],holdAbility};
    }
    const workerExtra=leading?(order.effort==='hard'?
      TUNING.groups.hardPaceWorkerExtraCostPerKm:
      order.effort==='steady'?
        TUNING.groups.steadyPaceWorkerExtraCostPerKm:
        MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm):0;
    const shelteredPaceMatch=paidPaceMatch&&
      [3,4].includes(startInput.physicalDraftVersion);
    const spent=(TUNING.effortCost[order.effort]*load*
      (leading||paidPaceMatch&&
        !shelteredPaceMatch?1:DRAFT_COST_FRACTION)+
      workerExtra)*
      (paidPaceMatch?soloEffect:effect)
        .energyCostMultiplier;
    if(spent>before+1e-9)
      throw new Error('Physical start rider cannot pay road.');
    const recovery=recoveryForKilometre({rider,segment,
      effort:order.effort,group:'peloton',
      working:leading||paidPaceMatch,
      quietKm:prior.quietKmByRider[riderId]});
    const cap=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:km}).cap;
    const energyAfter=+Math.min(cap,before-spent+
      recovery.recovery).toFixed(3);
    riderDecisions.push({riderId,teamId:team.id,
      goal:stake.goal,choice:leading?
        allowOrderedChase?'chase':'pull':
        paidPaceMatch?'hold_pace':'shelter',
      reason:leading?allowOrderedChase?
        'committed_perceived_chase':
        emergencyFrontWorker?
          'committed_emergency_front_worker':
        resolvedChaseTeamId===team.id?
          'caught_chase_target_continued_front_work':
          'committed_front_work':
        returnedContact?.riderId===riderId?
          'shelter_after_paid_return':
        paidPaceMatch?shelteredPaceMatch?
          'paid_individual_pace_match_in_shelter':
          'paid_individual_pace_match':
          'hold_start_wheel',
      effort:order.effort});
    return {riderId,role:leading?'leader':
      paidPaceMatch&&!shelteredPaceMatch?
        'pace_match':'sheltered',
      energyBefore:before,energySpent:spent,
      recoveryAward:recovery.recovery,cap,energyAfter,
      quietKm:recovery.quietKm,
      holdAbility:paidPaceMatch?
        soloAbility:holdAbility};
  });
  return {version:physicalVersion(
      PHYSICAL_START_BUNCH_VERSION,startInput),
    sourceKm:km,startDistanceM:(km-1)*1000,endDistanceM:km*1000,
    leaderRiderId:leaderId,bunchSpeedKph,
    elapsedSeconds:3600/bunchSpeedKph,
    ...(emergencyFrontWorker?{emergencyFrontWorker}:{}),
    ...(returnedContact?{returnedRider:{
      riderId:returnedContact.riderId,
      contactKm:returnedContact.sourceKm,
      contactAtDistanceM:
        returnedContact.contactAtDistanceM}}:{}),
    ...(resolvedChaseTeamId===null?{}:{
      resolvedChase:{teamId:resolvedChaseTeamId,
        caughtRiderId:formerForwardRiderId,
        order:frontOrder.chase}}),
    riderDecisions,riders,
    physicalGroup:{id:'peloton',atDistanceM:km*1000,
      riderIds:prior.riderIds.filter(id=>!splits.some(row=>
        row.riderId===id)&&id!==attackerId)},
    ...(allowNamedAttack?{attack:attackRecord}:{}),
    ...(existingForwardRiderId===null&&formerForwardRiderId===null&&
      !knownDetachedRiderIds.length?{}:{
      blockedAttacks:blockedForwardAttacks.map(({team,order})=>({
        teamId:team.id,riderId:order.attackRiderId,
        reason:order.attackRiderId===formerForwardRiderId?
          'dropped_after_paid_catch':
          returnedContact?.riderId===
            order.attackRiderId?
            'returned_after_paid_contact':
          knownDetachedRiderIds.includes(order.attackRiderId)?
            'rider_dropped_before_attack':'already_ahead'}))}),
    ...(allowPaceLoss?{splits,
      rearSolos:splits.map(row=>({id:`solo-${row.riderId}`,
        riderId:row.riderId,atDistanceM:row.atDistanceM}))}:{}),
    energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energyAfter])),
    quietKmByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.quietKm])),
    officialResults:false};
}

// The first physical loss ends the supported run. Detached riders have
// paid a partial solo road and cannot be advanced as full-km bunch riders.
export function runPhysicalBunchToPaceLossV1({startInput,start,
  lossKm}){
  if(!Number.isInteger(lossKm)||lossKm<1||
    lossKm>startInput?.routeKilometres?.length||
    !isDeepStrictEqual(start,startPhysicalBunchV1(startInput)))
    throw new Error('Pace loss needs replayed committed start.');
  const priorRun=lossKm===1?null:runPhysicalBunchV1({
    startInput,start,throughKm:lossKm-1});
  const prior=priorRun?{
    riderIds:priorRun.physicalGroup.riderIds,
    energyByRider:priorRun.energyByRider,
    quietKmByRider:priorRun.road.at(-1).quietKmByRider}:start;
  const segment=startInput.routeKilometres[lossKm-1];
  const step=advanceSupportedBunchKm(startInput,prior,segment,true);
  if(!step.splits.length)
    throw new Error('Requested kilometre has no physical pace loss.');
  return {version:physicalVersion(
      PHYSICAL_BUNCH_PACE_LOSS_VERSION,startInput),
    sourceKm:lossKm,priorRoad:priorRun?.road??[],step,
    elapsedSeconds:(priorRun?.elapsedSeconds??0)+step.elapsedSeconds,
    officialResults:false};
}

export function validatePhysicalBunchPaceLossV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalBunchToPaceLossV1(input)))
    throw new Error('Pace loss differs from paid physical source.');
  return true;
}

// Continue only the surviving physical bunch. Detached riders must have
// their own paid road; they cannot inherit the bunch position or energy.
export function runPhysicalBunchAfterPaceLossV1({startInput,start,
  lossKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=lossKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Post-loss bunch needs later source kilometre.');
  const loss=runPhysicalBunchToPaceLossV1({startInput,start,lossKm});
  const road=[];
  let prior={riderIds:loss.step.physicalGroup.riderIds,
    energyByRider:loss.step.energyByRider,
    quietKmByRider:loss.step.quietKmByRider};
  const detachedRiderIds=loss.step.splits.map(row=>row.riderId);
  for(let km=lossKm+1;km<=throughKm;km++){
    const current=advanceSupportedBunchKm(startInput,prior,
      startInput.routeKilometres[km-1],false,false,
      null,null,detachedRiderIds);
    road.push(current);
    prior={riderIds:current.physicalGroup.riderIds,
      energyByRider:current.energyByRider,
      quietKmByRider:current.quietKmByRider};
  }
  return {version:physicalVersion(
      PHYSICAL_START_BUNCH_VERSION,startInput),
    sourceKm:throughKm,loss,road,
    physicalGroup:road.at(-1).physicalGroup,
    bunchEnergyByRider:prior.energyByRider,
    elapsedSeconds:loss.elapsedSeconds+
      road.reduce((sum,row)=>sum+row.elapsedSeconds,0),
    officialResults:false};
}

export function validatePhysicalBunchAfterPaceLossV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalBunchAfterPaceLossV1(input)))
    throw new Error('Post-loss bunch differs from physical source.');
  return true;
}

// A continuing physical bunch may lose different riders on later paid
// kilometres. Every split keeps its measured partial road and is removed
// from later bunch membership; their separate road remains unsettled.
export function runPhysicalStaggeredBunchLossV1({startInput,start,
  throughKm}){
  if(!isDeepStrictEqual(start,startPhysicalBunchV1(startInput))||
    !Number.isInteger(throughKm)||throughKm<2||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Staggered loss needs replayed committed start.');
  const road=[];
  const losses=[];
  const detachedRiderIds=[];
  let prior=start;
  for(let km=1;km<=throughKm;km++){
    const current=advanceSupportedBunchKm(startInput,prior,
      startInput.routeKilometres[km-1],true,false,null,null,
      detachedRiderIds);
    road.push(current);
    for(const split of current.splits){
      detachedRiderIds.push(split.riderId);
      losses.push({sourceKm:km,...split});
    }
    prior={riderIds:current.physicalGroup.riderIds,
      energyByRider:current.energyByRider,
      quietKmByRider:current.quietKmByRider};
  }
  if(losses.length<1||
    new Set(detachedRiderIds).size!==losses.length)
    throw new Error('Staggered source needs paid losses.');
  return {version:physicalVersion(
      PHYSICAL_STAGGERED_BUNCH_LOSS_VERSION,startInput),
    throughKm,road,losses,
    detachedRiderIds,physicalGroup:road.at(-1).physicalGroup,
    energyByRider:prior.energyByRider,
    elapsedSeconds:road.reduce((sum,row)=>
      sum+row.elapsedSeconds,0),officialResults:false};
}

export function validatePhysicalStaggeredBunchLossV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalStaggeredBunchLossV1(input)))
    throw new Error('Staggered losses differ from paid source.');
  return true;
}

// Recompute from the committed start on every call. A caller cannot supply
// an invented prior group, clock or energy as the source of the next road.
export function runPhysicalBunchV1({startInput,start,throughKm}){
  if(!isDeepStrictEqual(start,startPhysicalBunchV1(startInput))||
    !Number.isInteger(throughKm)||throughKm<1||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Bunch run needs a replayed start and distance.');
  const road=[];
  let prior=start;
  for(let index=0;index<throughKm;index++){
    const segment=startInput.routeKilometres[index];
    if(segment?.km!==index+1)
      throw new Error('Bunch run needs consecutive source kilometres.');
    const current=advanceSupportedBunchKm(startInput,prior,segment);
    road.push(current);
    prior={riderIds:current.physicalGroup.riderIds,
      energyByRider:current.energyByRider,
      quietKmByRider:current.quietKmByRider};
  }
  return {version:physicalVersion(
      PHYSICAL_START_BUNCH_VERSION,startInput),
    throughKm,road,physicalGroup:road.at(-1).physicalGroup,
    energyByRider:prior.energyByRider,
    elapsedSeconds:road.reduce((sum,row)=>sum+row.elapsedSeconds,0),
    officialResults:false};
}

export function validatePhysicalBunchRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runPhysicalBunchV1(input)))
    throw new Error('Bunch run differs from committed paid road.');
  return true;
}

// A named attack leaves the physical bunch only when its own paid
// road reaches the next kilometre before the still-paid bunch.
export function runPhysicalNamedAttackV1({startInput,start,
  attackKm}){
  if(!Number.isInteger(attackKm)||attackKm<1||
    attackKm>startInput?.routeKilometres?.length||
    !isDeepStrictEqual(start,startPhysicalBunchV1(startInput)))
    throw new Error('Named attack needs replayed committed start.');
  const priorRun=attackKm===1?null:runPhysicalBunchV1({
    startInput,start,throughKm:attackKm-1});
  const prior=priorRun?{
    riderIds:priorRun.physicalGroup.riderIds,
    energyByRider:priorRun.energyByRider,
    quietKmByRider:priorRun.road.at(-1).quietKmByRider}:start;
  const step=advanceSupportedBunchKm(startInput,prior,
    startInput.routeKilometres[attackKm-1],false,true);
  const priorSeconds=priorRun?.elapsedSeconds??0;
  return {version:physicalVersion(
      PHYSICAL_NAMED_ATTACK_VERSION,startInput),
    sourceKm:attackKm,priorRoad:priorRun?.road??[],step,
    frontSolo:{...step.attack.frontSolo,
      elapsedSeconds:priorSeconds+
        step.attack.attackSeconds,
      energyByRider:{[step.attack.riderId]:
        step.attack.energyAfter}},
    bunch:{...step.physicalGroup,
      elapsedSeconds:priorSeconds+step.elapsedSeconds},
    frontGapSeconds:step.attack.gapSeconds,
    officialResults:false};
}

export function validatePhysicalNamedAttackV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalNamedAttackV1(input)))
    throw new Error('Named attack differs from paid physical source.');
  return true;
}

// The attack order remains visible while its named rider is ahead.
// It is blocked with a recorded reason, not silently rewritten.
export function runPhysicalBunchAfterNamedAttackV1({startInput,start,
  attackKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=attackKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Post-attack bunch needs later source road.');
  const attack=runPhysicalNamedAttackV1({startInput,start,attackKm});
  const forwardRiderId=attack.frontSolo.riderIds[0];
  let prior={riderIds:attack.bunch.riderIds,
    energyByRider:attack.step.energyByRider,
    quietKmByRider:attack.step.quietKmByRider};
  const road=[];
  for(let km=attackKm+1;km<=throughKm;km++){
    const current=advanceSupportedBunchKm(startInput,prior,
      startInput.routeKilometres[km-1],false,false,
      forwardRiderId);
    road.push(current);
    prior={riderIds:current.physicalGroup.riderIds,
      energyByRider:current.energyByRider,
      quietKmByRider:current.quietKmByRider};
  }
  return {version:physicalVersion(
      PHYSICAL_BUNCH_AFTER_ATTACK_VERSION,startInput),
    sourceKm:throughKm,attack,road,
    physicalGroup:road.at(-1).physicalGroup,
    energyByRider:prior.energyByRider,
    elapsedSeconds:attack.bunch.elapsedSeconds+
      road.reduce((sum,row)=>sum+row.elapsedSeconds,0),
    officialResults:false};
}

export function validatePhysicalBunchAfterNamedAttackV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalBunchAfterNamedAttackV1(input)))
    throw new Error('Post-attack bunch differs from paid source.');
  return true;
}

// Used only after a caller has replayed the paid catch and the rider's
// physical slide. A detached attack order remains visible with its actual
// changed road status; it can no longer be described as already ahead.
export function advancePhysicalBunchAfterCaughtSlideKmV1({startInput,
  prior,segment,caughtRiderId,resolvedChaseTeamId=null}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    typeof caughtRiderId!=='string'||
    !startInput.teams.some(team=>team.riders.some(rider=>
      rider.id===caughtRiderId))||
    (resolvedChaseTeamId!==null&&
    !startInput.teams.some(team=>
      team.id===resolvedChaseTeamId&&
      orderAt(team.orders,segment.km-1).chase!=='ignore')))
    throw new Error('Post-catch bunch needs sourced road and rider.');
  return advanceSupportedBunchKm(startInput,prior,segment,
    false,false,null,caughtRiderId,[],false,
    resolvedChaseTeamId);
}

// Diagnostic branch for a later follower that physically loses the
// post-catch bunch. The step pays the partial split; a caller must
// settle the remaining road before claiming a complete rider km.
export function advancePhysicalBunchAfterCaughtSlideLossKmV1({
  startInput,prior,segment,caughtRiderId}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    typeof caughtRiderId!=='string'||
    !startInput.teams.some(team=>team.riders.some(rider=>
      rider.id===caughtRiderId)))
    throw new Error('Post-catch loss needs sourced road and rider.');
  const step=advanceSupportedBunchKm(startInput,prior,segment,
    true,false,null,caughtRiderId);
  if(!step.splits?.length)
    throw new Error('Post-catch loss needs a paid physical split.');
  return step;
}

export function validatePhysicalBunchAfterCaughtSlideLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalBunchAfterCaughtSlideLossKmV1(input)))
    throw new Error('Post-catch loss differs from paid source.');
  return true;
}

// Continue only the riders still physically in the bunch after a
// sourced post-catch split. The detached rider stays unavailable to
// later bunch orders until a separate paid return contact exists.
export function advancePhysicalBunchAfterPostcatchLossKmV1({
  startInput,prior,segment,caughtRiderId,
  detachedRiderIds}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    typeof caughtRiderId!=='string'||
    !Array.isArray(detachedRiderIds)||
    !detachedRiderIds.length||
    new Set(detachedRiderIds).size!==
      detachedRiderIds.length||
    detachedRiderIds.some(id=>id===caughtRiderId||
      !startInput.teams.some(team=>team.riders.some(
        rider=>rider.id===id))))
    throw new Error('Post-catch bunch needs sourced loss riders.');
  return advanceSupportedBunchKm(startInput,prior,segment,
    false,false,null,caughtRiderId,detachedRiderIds);
}

export function validatePhysicalBunchAfterPostcatchLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalBunchAfterPostcatchLossKmV1(input)))
    throw new Error('Post-catch bunch differs from paid source.');
  return true;
}

// Only a higher-level replay that validates the measured return may
// supply its source here. The original attack order stays visible
// but its completed move cannot fire a second time by default.
export function advancePhysicalBunchAfterReturnKmV1({
  startInput,prior,segment,returnContact}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    returnContact?.version!==
      'v2-physical-manager-return-contact-1'||
    !returnContact.physicalGroup.riderIds.includes(
      returnContact.riderId))
    throw new Error('Return bunch needs recorded paid contact.');
  return advanceSupportedBunchKm(startInput,prior,segment,
    false,false,null,null,[],false,null,returnContact);
}

export function validatePhysicalBunchAfterReturnKmV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalBunchAfterReturnKmV1(input)))
    throw new Error('Return bunch differs from paid source.');
  return true;
}

export function advancePhysicalBunchAfterReturnLossKmV1({
  startInput,prior,segment,returnContact}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    returnContact?.version!==
      'v2-physical-manager-return-contact-1'||
    !returnContact.physicalGroup.riderIds.includes(
      returnContact.riderId))
    throw new Error('Return loss needs recorded paid contact.');
  const step=advanceSupportedBunchKm(startInput,prior,
    segment,true,false,null,null,[],false,null,
    returnContact);
  if(!step.splits?.length)
    throw new Error('Return loss needs physical split.');
  return step;
}

export function validatePhysicalBunchAfterReturnLossKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalBunchAfterReturnLossKmV1(input)))
    throw new Error('Return loss differs from paid source.');
  return true;
}

// A prior paid chase met its target. The manager's named worker keeps
// paying front work; the source explicitly records the completed chase
// target instead of silently changing the chase order.
export function advancePhysicalBunchAfterPerceivedCatchKmV1({
  startInput,prior,segment,caughtRiderId,chasingTeamId}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    typeof caughtRiderId!=='string'||
    !startInput.teams.some(team=>team.riders.some(rider=>
      rider.id===caughtRiderId)))
    throw new Error('Resolved chase needs sourced road and rider.');
  return advanceSupportedBunchKm(startInput,prior,segment,
    false,false,null,caughtRiderId,[],false,chasingTeamId);
}

// A higher-level wrapper must replay the front group and perceived
// commitment before calling this paid bunch transition.
export function advancePhysicalPerceivedChaseBunchKmV1({startInput,
  prior,segment,frontRiderId}){
  if(!Number.isInteger(segment?.km)||segment.km<2||
    !isDeepStrictEqual(segment,
      startInput?.routeKilometres?.[segment.km-1])||
    typeof frontRiderId!=='string'||
    !startInput.teams.some(team=>team.riders.some(rider=>
      rider.id===frontRiderId)))
    throw new Error('Perceived chase bunch needs sourced road.');
  return advanceSupportedBunchKm(startInput,prior,segment,
    false,false,frontRiderId,null,[],true);
}

export function validatePhysicalStartBunchV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalStartBunchV1(input)))
    throw new Error('Physical start differs from committed road.');
  return true;
}
