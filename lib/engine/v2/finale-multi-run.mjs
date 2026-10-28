import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';
import {finaleWorkerStep,finalePassiveBunchSpeed,
  finalePassiveFrontSpeed,FINALE_WORKER_PASSIVE_SLOPE_VERSION,
  FINALE_PASSIVE_BUNCH_VERSION,FINALE_PASSIVE_FRONT_VERSION} from
  './finale-worker.mjs';
import {dropExhaustedSheltered,FINALE_EXHAUSTION_DROP_VERSION} from
  './finale-exhaustion.mjs';
import {advanceFinaleDroppedStep,FINALE_DROPPED_STEP_VERSION,
  FINALE_DEPLETED_DROPPED_STEP_VERSION,
  FINALE_COAST_DROPPED_STEP_VERSION,
  FINALE_FRONT_DROP_CONTACT_STEP_VERSION} from
  './finale-dropped-step.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {auditDissolvedFrontContact} from
  './finale-dissolved-front-contact.mjs';
import {assertNoPendingFinaleAttacks,pendingFinaleAttacksAt,
  FINALE_PENDING_ATTACK_GUARD_VERSION,
  FINALE_EXHAUSTED_ATTACK_DECISION_VERSION,
  FINALE_NAMED_BLOCK_DECISION_VERSION} from './finale-attack-guard.mjs';
import {TUNING,TUNING_VERSION,MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {planFinaleBunchFrontWork,FINALE_BUNCH_FRONT_WORK_VERSION} from
  './finale-bunch-front-work.mjs';

export const FINALE_MULTI_SEPARATED_VERSION='v2-finale-multi-separated-1';
export const FINALE_MULTI_NEW_CHASE_VERSION='v2-finale-multi-separated-2';
export const FINALE_MULTI_SELECTIVE_CHASE_VERSION='v2-finale-multi-separated-3';
export const FINALE_SEPARATED_ONE_OR_MORE_VERSION=
  'v2-finale-separated-one-or-more-4';
export const FINALE_SEPARATED_POST_ATTACK_VERSION=
  'v2-finale-separated-post-attack-5';
export const FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION=
  'v2-finale-separated-exhausted-attack-6';
export const FINALE_SEPARATED_NAMED_BLOCKS_VERSION=
  'v2-finale-separated-named-blocks-7';
export const FINALE_SEPARATED_DROPPED_TRAVEL_VERSION=
  'v2-finale-separated-dropped-travel-8';
export const FINALE_SEPARATED_TEAM_LIMIT_VERSION=
  'v2-finale-separated-team-limit-9';
export const FINALE_SEPARATED_LAST_KM_VERSION=
  'v2-finale-separated-last-km-10';
export const FINALE_DEPLETED_LAST_KM_VERSION=
  'v2-finale-depleted-last-km-11';
export const FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION=
  'v2-finale-no-front-dropped-last-km-12';
export const FINALE_COAST_DROPPED_LAST_KM_VERSION=
  'v2-finale-coast-dropped-last-km-13';
export const FINALE_SINGLE_GROUP_LAST_KM_VERSION=
  'v2-finale-single-group-last-km-14';
export const FINALE_BUNCH_ONLY_LAST_KM_VERSION=
  'v2-finale-bunch-only-last-km-15';
export const FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION=
  'v2-finale-coast-no-front-dropped-last-km-16';
export const FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_VERSION=
  'v2-finale-coast-dynamic-no-front-last-km-17';
export const FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION=
  'v2-finale-coast-dynamic-front-last-km-18';
export const FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_VERSION=
  'v2-finale-coast-dynamic-active-last-km-19';
export const FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_VERSION=
  'v2-finale-coast-dynamic-single-last-km-20';
export const FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION=
  'v2-finale-coast-front-catch-last-km-21';
export const FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION=
  'v2-finale-single-late-catch-last-km-lab-26';
export const FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION=
  'v2-finale-coast-dissolved-front-last-km-22';
export const FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION=
  'v2-finale-coast-dissolved-all-fronts-last-km-23';
export const FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_VERSION=
  'v2-finale-coast-dissolved-front-dropped-last-km-24';
export const FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION=
  'v2-finale-coast-dissolved-single-last-km-25';
export const FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION=
  'v2-finale-coast-no-front-paid-bunch-candidate-27';
export const FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION=
  'v2-finale-coast-one-front-paid-bunch-candidate-28';

// Re-evaluate the kilometre motor's awareness and safe-gap rule against the
// recorded road positions before each short slice. No fresh attacks are
// admitted by this separated-group continuation.
export function selectiveFinaleChaseDecision({team,awareBefore,rearGapSeconds,
  leadingGapSeconds,remainingKm}){
  const leader=team.riders.find(rider=>
    rider.id===team.orders.roadCaptainId);
  const leadership=Number(leader?.leadership??35);
  if(!Number.isFinite(leadership)||leadership<0||leadership>100||
    ![rearGapSeconds,leadingGapSeconds,remainingKm].every(Number.isFinite)||
    rearGapSeconds<0||leadingGapSeconds<rearGapSeconds||remainingKm<0)
    throw new Error('Invalid selective finale chase state.');
  const awarenessThreshold=TUNING.chase.awarenessThreshold-
    leadership*TUNING.chase.leadershipAwareness;
  const aware=awareBefore||rearGapSeconds*.5>=awarenessThreshold;
  const safeGap=Math.min(TUNING.chase.maxSafeGapSeconds,
    remainingKm*TUNING.chase.safeGapSecondsPerRemainingKm);
  return {aware,decision:!aware?'unaware':
    leadingGapSeconds<=safeGap?'held':'engaged'};
}

export function assertNoFinaleGroupContact(slice,groupPlans){
  if(!Array.isArray(groupPlans)||groupPlans.length<2)
    throw new Error('A group-contact check needs multiple road groups.');
  for(let i=1;i<groupPlans.length;i++){
    const front=groupPlans[i-1],rear=groupPlans[i];
    if(front.movement.gapSeconds>rear.movement.gapSeconds)continue;
    const originalSeparation=front.group.gapSeconds-
      rear.group.gapSeconds;
    const closingSeconds=front.movement.frontSeconds-
      rear.movement.frontSeconds;
    const contactDistanceM=slice.startDistanceM+
      slice.lengthM*originalSeparation/closingSeconds;
    throw new Error(`The separated finale needs a recorded group contact at ${
      contactDistanceM} m.`);
  }
}

// Read-only continuation of road groups while they remain distinct from the
// bunch. V4 also accepts exactly one source group; v10 starts from the locked
// last-kilometre source with at least two groups; v11 also records an already
// dropped source behind one or more groups. Any catch or group contact
// refuses the complete run. It records work, never an individual award.
export function probeFinaleSeparatedGroupsFromTour(tour,{version=null}={}){
  if(version!==null&&![FINALE_MULTI_SEPARATED_VERSION,
    FINALE_MULTI_NEW_CHASE_VERSION,
    FINALE_MULTI_SELECTIVE_CHASE_VERSION,
    FINALE_SEPARATED_ONE_OR_MORE_VERSION,
    FINALE_SEPARATED_POST_ATTACK_VERSION,
    FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION,
    FINALE_SEPARATED_NAMED_BLOCKS_VERSION,
    FINALE_SEPARATED_DROPPED_TRAVEL_VERSION,
    FINALE_SEPARATED_TEAM_LIMIT_VERSION,
    FINALE_SEPARATED_LAST_KM_VERSION,
    FINALE_DEPLETED_LAST_KM_VERSION,
    FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION,
    FINALE_COAST_DROPPED_LAST_KM_VERSION,
    FINALE_SINGLE_GROUP_LAST_KM_VERSION,
    FINALE_BUNCH_ONLY_LAST_KM_VERSION,
    FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION,
    FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_VERSION,
    FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION,
    FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_VERSION,
    FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_VERSION,
    FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION,
    FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION,
    FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION,
    FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION,
    FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_VERSION,
    FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION,
    FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION,
    FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION].includes(version))
    throw new Error('Unknown separated finale version.');
  const selectedVersion=version??FINALE_SEPARATED_ONE_OR_MORE_VERSION;
  const bunchOnly=selectedVersion===FINALE_BUNCH_ONLY_LAST_KM_VERSION;
  const noFrontDropped=
    selectedVersion===FINALE_NO_FRONT_DROPPED_LAST_KM_VERSION;
  const dynamicNoFront=
    selectedVersion===FINALE_COAST_DYNAMIC_NO_FRONT_LAST_KM_VERSION;
  const dynamicActive=
    selectedVersion===FINALE_COAST_DYNAMIC_ACTIVE_LAST_KM_VERSION;
  const dynamicSingle=
    selectedVersion===FINALE_COAST_DYNAMIC_SINGLE_LAST_KM_VERSION;
  const lateSingleCatch=
    selectedVersion===FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION;
  const frontCatch=
    selectedVersion===FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION||
    lateSingleCatch;
  const dissolvedFront=
    [FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION,
      FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION,
      FINALE_COAST_DISSOLVED_FRONT_DROPPED_LAST_KM_VERSION,
      FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION]
      .includes(selectedVersion);
  const dissolvedSingle=selectedVersion===
    FINALE_COAST_DISSOLVED_SINGLE_LAST_KM_VERSION;
  const dissolvedAllFronts=selectedVersion===
    FINALE_COAST_DISSOLVED_ALL_FRONTS_LAST_KM_VERSION;
  const dynamicFront=dynamicActive||dynamicSingle||
    selectedVersion===FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION||
    dissolvedFront||
    selectedVersion===FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION;
  const coastNoFrontDropped=dynamicNoFront||
    selectedVersion===FINALE_COAST_NO_FRONT_DROPPED_LAST_KM_VERSION||
    selectedVersion===FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION;
  const paidFrontNoFront=selectedVersion===
    FINALE_COAST_NO_FRONT_PAID_BUNCH_VERSION;
  const paidFrontOneFront=selectedVersion===
    FINALE_COAST_ONE_FRONT_PAID_BUNCH_VERSION;
  const paidBunchFront=paidFrontNoFront||paidFrontOneFront;
  const noFront=noFrontDropped||coastNoFrontDropped||bunchOnly;
  const singleGroup=selectedVersion===FINALE_SINGLE_GROUP_LAST_KM_VERSION;
  const coastDropped=coastNoFrontDropped||
    dynamicFront||
    selectedVersion===FINALE_COAST_DROPPED_LAST_KM_VERSION||
    frontCatch&&!lateSingleCatch;
  const depletedLastKm=selectedVersion===FINALE_DEPLETED_LAST_KM_VERSION||
    noFrontDropped||coastDropped;
  const lastKm=selectedVersion===FINALE_SEPARATED_LAST_KM_VERSION||
    singleGroup||bunchOnly||
    depletedLastKm||lateSingleCatch;
  const recordTeamLimit=
    selectedVersion===FINALE_SEPARATED_TEAM_LIMIT_VERSION;
  const recordDroppedTravel=depletedLastKm||
    selectedVersion===FINALE_SEPARATED_DROPPED_TRAVEL_VERSION||
    recordTeamLimit;
  const recordNamedBlocks=lastKm||
    selectedVersion===FINALE_SEPARATED_NAMED_BLOCKS_VERSION||
    recordDroppedTravel;
  const recordExhaustedAttack=recordNamedBlocks||
    selectedVersion===FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION;
  const postAttack=selectedVersion===FINALE_SEPARATED_POST_ATTACK_VERSION||
    recordExhaustedAttack;
  const allowSingle=depletedLastKm||singleGroup||lateSingleCatch||
    selectedVersion===FINALE_SEPARATED_ONE_OR_MORE_VERSION||
    postAttack;
  const selectiveChase=selectedVersion===FINALE_MULTI_SELECTIVE_CHASE_VERSION||
    allowSingle;
  const newChase=selectedVersion===FINALE_MULTI_NEW_CHASE_VERSION||
    selectiveChase;
  const remainingKm=lastKm?1:postAttack?4:5;
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm,includeAttackLoad:lastKm});
  if(paidFrontOneFront&&snapshot.roadGroups.length!==1)
    throw new Error('The paid one-front finale needs exactly one leading group.');
  if(paidFrontOneFront&&!snapshot.droppedRiderIds.length)
    throw new Error('The paid one-front finale needs recorded dropped travel.');
  if((coastDropped||lateSingleCatch)&&
    tour.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The coasted finale needs a v93 source road.');
  if(snapshot.roadGroups.length<(noFront?0:singleGroup?1:
    lastKm&&!depletedLastKm&&!lateSingleCatch?2:
    allowSingle?1:2)||noFront&&snapshot.roadGroups.length!==0||
    singleGroup&&snapshot.roadGroups.length!==1||
    lastKm&&!depletedLastKm&&snapshot.droppedRiderIds.length||
    depletedLastKm&&!dynamicFront&&
      !snapshot.droppedRiderIds.length||
    dynamicSingle&&snapshot.roadGroups.length!==1||
    dynamicSingle&&snapshot.droppedRiderIds.length||
    dissolvedSingle&&(snapshot.roadGroups.length!==1||
      snapshot.droppedRiderIds.length)||
    !snapshot.peloton.riderIds.length||
    frontCatch&&snapshot.roadGroups.length!==1)
    throw new Error(bunchOnly?
      'The bunch-only last-kilometre finale needs one complete bunch.':
      noFront?
      'The no-front last-kilometre finale needs a bunch and dropped rider only.':
      depletedLastKm?
      'The depleted last-kilometre finale needs a group, bunch and dropped rider.':
      lastKm?
      'The last-kilometre separated finale needs two groups, one bunch and no dropped riders.':
      'A separated finale needs multiple road groups and a bunch (or one group in v4).');
  const grid=finaleDistanceGrid(tour.route,{
    remainingKm});
  if(!recordExhaustedAttack)
    assertNoPendingFinaleAttacks(tour,snapshot,grid);
  const sourceFrame=tour.frames[snapshot.sourceKm-1];
  if(noFront&&(
    noFrontDropped&&(sourceFrame.chasers.length||
      sourceFrame.engagedChaseTeamIds.length)||
    coastNoFrontDropped&&sourceFrame.engagedChaseTeamIds.length))
    throw new Error('The no-front finale needs no recorded chase target.');
  if(lastKm&&(sourceFrame.activeBreakResponseTeamIds.length||
    sourceFrame.activeGcResponseTeamIds.length||
    tour.committedInputs.teams.some(team=>
      orderAt(team.orders,tour.route.distanceKm-1).frontWork==='rotate'&&
        !paidBunchFront)))
    throw new Error('The separated last-kilometre finale needs recorded response or front rotation.');
  let droppedRiders=[];
  if(recordDroppedTravel){
    const sourceById=new Map(sourceFrame.riderGroups.map(row=>[row.id,row]));
    droppedRiders=snapshot.droppedRiderIds.map(riderId=>{
      const source=sourceById.get(riderId);
      if(source?.group!=='dropped'||
        !Number.isFinite(source.deficitSeconds)||
        source.deficitSeconds<=0)
        throw new Error('Dropped finale travel needs recorded source deficits.');
      return {riderId,deficitSeconds:source.deficitSeconds,
        energy:source.energy};
    });
    if(!droppedRiders.length&&!dynamicFront)
      throw new Error('Dropped finale travel needs a dropped source rider.');
  }
  const teamsById=new Map(tour.committedInputs.teams.map(team=>[team.id,team]));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const states=new Map(snapshot.riders.map(row=>[row.riderId,row]));
  const energies=new Map(snapshot.riders.map(row=>[row.riderId,row.energy]));
  const caughtAtSource=new Map();
  if(recordExhaustedAttack)
    for(let km=Math.max(1,snapshot.sourceKm-
      TUNING.breakaway.reattackRecoveryKm);km<=snapshot.sourceKm;km++)
      for(const riderId of tour.frames[km-1].caughtBreakawayRiderIds)
        caughtAtSource.set(riderId,km);
  const frontTeamIds=new Set(snapshot.roadGroups.flatMap(group=>group.teamIds));
  const engaged=new Set(sourceFrame.engagedChaseTeamIds);
  let groups=snapshot.roadGroups.map(group=>({...group,
    riderIds:[...group.riderIds]}));
  let pelotonRiderIds=[...snapshot.peloton.riderIds];
  const frames=[],exhaustionDrops=[];
  let lastAttackDecisionKm=null;
  const select=(ids,role,slice,segment,selectiveDecisions=null)=>{
    const byTeam=new Map();
    for(const riderId of ids){
      const state=states.get(riderId),team=teamsById.get(state?.teamId);
      const energy=energies.get(riderId);
      const order=team?orderAt(team.orders,slice.sourceKm-1):null;
      if(!team||!ridersById.has(riderId)||!Number.isFinite(energy)||
        energy<(role==='front'?TUNING.breakaway.minPullEnergy:
          TUNING.chase.minHelperEnergy)||
        role==='chase'&&(frontTeamIds.has(team.id)||
          !team.orders.helperIds.includes(riderId)))continue;
      if(role==='chase'&&selectiveChase&&order.chase==='selective'){
        if(!selectiveDecisions.has(team.id)){
          const result=selectiveFinaleChaseDecision({team,
            awareBefore:engaged.has(team.id),
            rearGapSeconds:groups.at(-1).gapSeconds,
            leadingGapSeconds:groups[0].gapSeconds,
            remainingKm:(tour.route.distanceKm*1000-
              slice.startDistanceM)/1000});
          selectiveDecisions.set(team.id,result.decision);
          if(result.aware)engaged.add(team.id);
        }
        if(selectiveDecisions.get(team.id)!=='engaged')continue;
      }else if(role==='chase'&&!engaged.has(team.id)){
        if(newChase&&order.chase==='selective')
          throw new Error(`The separated finale needs a recorded selective chase: ${
            team.id} at km ${slice.sourceKm}.`);
        if(!newChase||order.chase!=='all')continue;
      }
      if(role==='front'?order.breakWork==='sit_on':
        !['selective','all'].includes(order.chase))continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role,
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      if(energy+1e-9<energyCostForFinaleSlice(slice,
        step.workCostPerKm))continue;
      const previous=byTeam.get(team.id);
      if(!previous||energy>previous.energy||
        energy===previous.energy&&riderId<previous.riderId)
        byTeam.set(team.id,{riderId,energy,step});
    }
    return [...byTeam.entries()].sort(([a],[b])=>a.localeCompare(b))
      .map(([,value])=>value);
  };
  for(const [index,slice] of grid.entries()){
    const segment=tour.route.kilometres[slice.sourceKm-1];
    const blockedNamedAttacks=[];
    if(recordExhaustedAttack&&lastAttackDecisionKm!==slice.sourceKm){
      lastAttackDecisionKm=slice.sourceKm;
      const present=new Set(pelotonRiderIds);
      const currentSnapshot={...snapshot,riders:snapshot.riders.map(row=>
        row.status==='peloton'&&!present.has(row.riderId)?
          {...row,status:'dropped'}:row)};
      for(const pending of pendingFinaleAttacksAt(tour,currentSnapshot,
        slice.sourceKm,{includeBlocked:true,
          includeUnavailable:recordNamedBlocks})){
        const energy=energies.get(pending.riderId);
        const team=teamsById.get(pending.teamId);
        const status=currentSnapshot.riders.find(row=>
          row.riderId===pending.riderId)?.status;
        const supportingNamedHelper=team?.orders.helperIds.includes(
          pending.riderId)&&
          orderAt(team.orders,slice.sourceKm-1).captainSupport===
            'drop_back_if_dropped'&&
          currentSnapshot.riders.some(row=>
            row.riderId===team.orders.captainId&&row.status==='dropped');
        if(recordTeamLimit&&pending.kind==='team_break_limit'&&
          pending.riderId===null){
          blockedNamedAttacks.push({teamId:pending.teamId,
            riderId:null,reason:'team_break_limit',
            sourceKm:slice.sourceKm,distanceM:slice.startDistanceM,
            energyAtDecision:null});
          continue;
        }
        if(pending.riderId==null||!Number.isFinite(energy)||
          supportingNamedHelper)
          throw new Error(pending.message);
        const recentlyCaught=caughtAtSource.has(pending.riderId)&&
          slice.sourceKm-caughtAtSource.get(pending.riderId)<=
            TUNING.breakaway.reattackRecoveryKm;
        let reason=null;
        if(recordNamedBlocks&&pending.kind==='team_break_limit')
          reason='team_break_limit';
        else if(recordNamedBlocks&&pending.kind==='named_unavailable')
          reason=status==='dropped'?'dropped':
            status==='breakaway'?'already_ahead':null;
        else if(pending.kind==='peloton_attack'){
          if(recordNamedBlocks&&recentlyCaught)reason='recently_caught';
          else if(!recentlyCaught&&
            energy<TUNING.attack.minEnergyFraction*100)reason='exhausted';
        }
        if(reason===null)throw new Error(pending.message);
        blockedNamedAttacks.push({teamId:pending.teamId,
          riderId:pending.riderId,reason,
          sourceKm:slice.sourceKm,distanceM:slice.startDistanceM,
          energyAtDecision:energy});
      }
    }
    const selectiveDecisions=new Map();
    const frontExhaustionDrops=[];
    const frontGroupDissolutions=[];
    if(dynamicFront)groups=groups.map(group=>{
      const exhaustion=dropExhaustedSheltered({
        riderIds:group.riderIds,pullRiderId:null,segment,
        ridersById,energies,startDistanceM:slice.startDistanceM,
        endDistanceM:slice.endDistanceM});
      if(!exhaustion.riderIds.length){
        if(!dissolvedFront)
          throw new Error('A depleted front group needs recorded group dissolution.');
        if(index!==0||!snapshot.roadGroups.some(row=>row.id===group.id)||
          !(dissolvedAllFronts||dissolvedSingle)&&
            group.id!==snapshot.roadGroups[0]?.id)
          throw new Error('The dissolved-front audit needs the source front to leave at the first boundary.');
        frontGroupDissolutions.push({groupId:group.id,
          atDistanceM:slice.startDistanceM,
          gapSecondsBefore:group.gapSeconds,
          riderIds:[...group.riderIds]});
      }
      frontExhaustionDrops.push(...exhaustion.drops.map(row=>({...row,
        fromRoadGroupId:group.id,
        initialDeficitSeconds:-group.gapSeconds})));
      return exhaustion.riderIds.length?{...group,riderIds:exhaustion.riderIds,
        teamIds:[...new Set(exhaustion.riderIds.map(id=>
          states.get(id).teamId))]}:null;
    }).filter(Boolean);
    if(dissolvedFront&&(!(dissolvedAllFronts||dissolvedSingle)&&
      (!groups.length||
      frontGroupDissolutions.length>1)||
      (dissolvedAllFronts||dissolvedSingle)&&index===0&&(
        groups.length!==0||frontGroupDissolutions.length!==
          snapshot.roadGroups.length)))
      throw new Error('The dissolved-front road needs one surviving group.');
    if(dynamicFront)droppedRiders.push(...frontExhaustionDrops.map(row=>({
      riderId:row.riderId,deficitSeconds:row.initialDeficitSeconds,
      energy:row.remainingEnergy})));
    const chaseEligible=noFront||frontCatch&&!groups.length?[]:
      select(pelotonRiderIds,'chase',slice,segment,selectiveDecisions);
    const chase=chaseEligible.length?
      chaseEligible[index%chaseEligible.length]:null;
    const bunchFrontWork=paidBunchFront?planFinaleBunchFrontWork({
      teams:tour.committedInputs.teams,pelotonRiderIds,energies,
      aheadTeamIds:groups.flatMap(group=>group.teamIds),
      busyTeamIds:chase?[chase.teamId]:[],segment,
      sourceKm:slice.sourceKm,sliceLengthKm:slice.lengthM/1000}):null;
    const exhaustion=dropExhaustedSheltered({riderIds:pelotonRiderIds,
      pullRiderId:chase?.riderId??null,segment,ridersById,energies,
      startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM});
    if(recordDroppedTravel&&!dynamicNoFront&&!dynamicFront&&
      exhaustion.drops.length)
      throw new Error('Newly exhausted finale riders need recorded drop travel.');
    if(bunchOnly&&exhaustion.drops.length)
      throw new Error('The bunch-only finale needs recorded drop travel.');
    pelotonRiderIds=exhaustion.riderIds;
    exhaustionDrops.push(...exhaustion.drops);
    if(dynamicNoFront||dynamicFront)
      droppedRiders.push(...exhaustion.drops.map(row=>({
        riderId:row.riderId,deficitSeconds:0,
        energy:row.remainingEnergy})));
    const passiveBunchSpeed=finalePassiveBunchSpeed({
      riderIds:pelotonRiderIds,ridersById,energies,segment});
    const bunchSpeedKph=Math.max(passiveBunchSpeed,
      chase?.step.speedKph??0,bunchFrontWork?.speedKph??0);
    const bunchElapsedSeconds=slice.lengthM*3.6/bunchSpeedKph;
    const groupPlans=groups.map(group=>{
      const eligible=select(group.riderIds,'front',slice,segment);
      const pull=eligible.length?eligible[index%eligible.length]:null;
      const speedKph=pull?.step.speedKph??finalePassiveFrontSpeed({
        riderIds:group.riderIds,ridersById,energies,segment});
      const movement=advanceFinaleGap({slice,
        gapSeconds:group.gapSeconds,frontSpeedKph:speedKph,
        chaseSpeedKph:bunchSpeedKph});
      if(movement.caught&&!frontCatch)
        throw new Error(`The separated finale needs a recorded catch for ${
          group.id} at ${movement.catchDistanceM} m.`,{cause:{
          groupId:group.id,calculatedCatchDistanceM:movement.catchDistanceM,
          sliceStartDistanceM:slice.startDistanceM}});
      return {group,pull,movement};
    });
    if(groupPlans.length>1)assertNoFinaleGroupContact(slice,groupPlans);
    const contactPlan=frontCatch?
      groupPlans.find(plan=>plan.movement.caught):null;
    const contactDistanceM=contactPlan?.movement.catchDistanceM??null;
    const preContactFraction=contactPlan?
      (contactDistanceM-slice.startDistanceM)/slice.lengthM:1;
    const preContactBunchSeconds=
      bunchElapsedSeconds*preContactFraction;
    const activeBeforeContact=[...groups.flatMap(group=>group.riderIds),
      ...pelotonRiderIds];
    const preContactEnergy=contactPlan?new Map(activeBeforeContact.map(
      riderId=>{
        const energy=energies.get(riderId);
        const step=riderId===chase?.riderId?chase.step:
          contactPlan.pull?.riderId===riderId?
            contactPlan.pull.step:null;
        const costPerKm=step?.workCostPerKm??
          TUNING.effortCost.conserve*riderKilometreEffect(
            ridersById.get(riderId),segment,{phase:'chase',energy,
              exposed:segment.exposed}).energyCostMultiplier;
        const spent=costPerKm*(contactDistanceM-
          slice.startDistanceM)/1000;
        if(spent>energy+1e-9)
          throw new Error(`A front-catch rider cannot pay before contact: ${
            riderId}.`);
        return [riderId,Math.max(0,energy-spent)];
      })):null;
    const mergedIds=contactPlan?[...pelotonRiderIds,
      ...contactPlan.group.riderIds]:null;
    const postContactSpeedKph=contactPlan?
      finalePassiveBunchSpeed({riderIds:mergedIds,ridersById,
        energies:preContactEnergy,segment}):null;
    const postContactBunchSeconds=contactPlan?
      (slice.endDistanceM-contactDistanceM)*3.6/
        postContactSpeedKph:0;
    const paidBunchElapsedSeconds=contactPlan?
      preContactBunchSeconds+postContactBunchSeconds:
      bunchElapsedSeconds;
    const droppedTravel=recordDroppedTravel?
      advanceFinaleDroppedStep({slice,segment,
        bunchElapsedSeconds:paidBunchElapsedSeconds,
        droppedRiders,ridersById,
        ...(dynamicFront?{version:FINALE_FRONT_DROP_CONTACT_STEP_VERSION}:
          coastDropped?{version:FINALE_COAST_DROPPED_STEP_VERSION}:
          depletedLastKm?{
            version:FINALE_DEPLETED_DROPPED_STEP_VERSION}:{})}):null;
    if(recordDroppedTravel)droppedRiders=droppedTravel.riders.map(row=>({
      riderId:row.riderId,deficitSeconds:row.deficitSecondsAfter,
      energy:row.energyAfter}));
    if(recordDroppedTravel)
      for(const row of droppedTravel.riders)
        energies.set(row.riderId,row.energyAfter);
    const pullById=new Map(groupPlans.filter(plan=>plan.pull)
      .map(plan=>[plan.pull.riderId,plan.pull.step]));
    if(chase)pullById.set(chase.riderId,chase.step);
    for(const worker of bunchFrontWork?.workers??[])
      pullById.set(worker.riderId,{speedKph:bunchFrontWork.speedKph,
        workCostPerKm:worker.energySpent/(slice.lengthM/1000)});
    const activeIds=[...groups.flatMap(group=>group.riderIds),
      ...pelotonRiderIds];
    const riders=activeIds.map(riderId=>{
      const energy=energies.get(riderId);
      const step=pullById.get(riderId);
      if(contactPlan){
        const energyAtCatch=preContactEnergy.get(riderId);
        const preContactSpent=energy-energyAtCatch;
        const postContactCostPerKm=TUNING.effortCost.conserve*
          riderKilometreEffect(ridersById.get(riderId),segment,{
            phase:'chase',energy:energyAtCatch,
            exposed:segment.exposed}).energyCostMultiplier;
        const postContactSpent=postContactCostPerKm*
          (slice.endDistanceM-contactDistanceM)/1000;
        if(postContactSpent>energyAtCatch+1e-9)
          throw new Error(`A front-catch rider cannot pay after contact: ${
            riderId}.`);
        const remaining=Math.max(0,energyAtCatch-postContactSpent);
        energies.set(riderId,remaining);
        return {riderId,energy:remaining,
          energySpent:preContactSpent+postContactSpent,
          role:step?'pull':'sheltered'};
      }
      const workCostPerKm=step?.workCostPerKm??
        TUNING.effortCost.conserve*riderKilometreEffect(
          ridersById.get(riderId),segment,{phase:'chase',energy,
            exposed:segment.exposed}).energyCostMultiplier;
      const energySpent=energyCostForFinaleSlice(slice,workCostPerKm);
      if(energySpent>energy+1e-9)
        throw new Error(`A separated-group rider cannot pay for travel: ${
          riderId} at ${slice.startDistanceM} m.`);
      const remaining=Math.max(0,energy-energySpent);
      energies.set(riderId,remaining);
      return {riderId,energy:remaining,energySpent,
        role:step?'pull':'sheltered'};
    });
    if(recordDroppedTravel)
      riders.push(...droppedTravel.riders.map(row=>({
        riderId:row.riderId,energy:row.energyAfter,
        energySpent:row.energySpent,role:'dropped',
        deficitSeconds:row.deficitSecondsAfter})));
    groups=contactPlan?[]:groupPlans.map(({group,movement})=>({...group,
      gapSeconds:movement.gapSeconds}));
    if(contactPlan)pelotonRiderIds=mergedIds;
    frames.push({startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      phase:slice.phase,bunchPullRiderId:chase?.riderId??null,
      ...(paidBunchFront?{bunchFrontWork}:{}),
      bunchElapsedSeconds:paidBunchElapsedSeconds,
      ...(contactPlan?{contact:{kind:'front_catch',
        groupId:contactPlan.group.id,
        atDistanceM:contactDistanceM,
        preContactBunchSeconds,
        postContactBunchSeconds,
        postContactSpeedKph,
        caughtRiderIds:[...contactPlan.group.riderIds]}}:{}),
      roadGroups:(contactPlan?[]:groupPlans).map(({group,pull,movement})=>({
        id:group.id,gapSeconds:movement.gapSeconds,
        riderIds:[...group.riderIds],teamIds:[...group.teamIds],
        pullRiderId:pull?.riderId??null,
        elapsedSeconds:movement.frontSeconds})),
      pelotonRiderIds:[...pelotonRiderIds],
      ...(dynamicFront?{frontExhaustionDrops}:{}),
      ...(dissolvedFront?{frontGroupDissolutions}:{}),
      ...(recordExhaustedAttack?{blockedNamedAttacks}:{}),
      ...(recordDroppedTravel?{droppedTravel}:{}),
      ...(selectiveChase?{selectiveChaseDecisions:
        [...selectiveDecisions.entries()].sort(([a],[b])=>
          a.localeCompare(b)).map(([teamId,decision])=>
          ({teamId,decision}))}:{}),
      exhaustionDrops:exhaustion.drops,riders});
  }
  if(dissolvedFront&&frames[0].frontGroupDissolutions.length!==
    (dissolvedAllFronts||dissolvedSingle?
      snapshot.roadGroups.length:1))
    throw new Error('The dissolved-front audit needs one source-front dissolution.');
  return {version:selectedVersion,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:tour.tuningVersion,
    workerTuningVersion:TUNING_VERSION,
    workerPaceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
    ...(paidBunchFront?{
      bunchFrontWorkVersion:FINALE_BUNCH_FRONT_WORK_VERSION}:{}),
    passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION,
    passiveFrontVersion:FINALE_PASSIVE_FRONT_VERSION,
    exhaustionDropVersion:FINALE_EXHAUSTION_DROP_VERSION,
    pendingAttackGuardVersion:FINALE_PENDING_ATTACK_GUARD_VERSION,
    ...(recordDroppedTravel?{droppedTravelVersion:dynamicFront?
      FINALE_FRONT_DROP_CONTACT_STEP_VERSION:coastDropped?
      FINALE_COAST_DROPPED_STEP_VERSION:depletedLastKm?
        FINALE_DEPLETED_DROPPED_STEP_VERSION:FINALE_DROPPED_STEP_VERSION,
      sourceDroppedRiderIds:[...snapshot.droppedRiderIds],
      ...(dynamicNoFront||dynamicFront?{
        finalDroppedRiderIds:droppedRiders.map(row=>
        row.riderId)}:{}),
      finalDroppedRiderDeficits:droppedRiders.map(row=>({
        riderId:row.riderId,deficitSeconds:row.deficitSeconds}))}:{}),
    ...(recordExhaustedAttack?{attackDecisionVersion:
      recordNamedBlocks?FINALE_NAMED_BLOCK_DECISION_VERSION:
        FINALE_EXHAUSTED_ATTACK_DECISION_VERSION}:{}),
    ...(allowSingle&&!noFront?{singleRoadGroupVersion:
      selectedVersion}:{}),
    ...(noFrontDropped?{noFrontDroppedVersion:selectedVersion}:{}),
    ...(coastNoFrontDropped?{
      coastNoFrontDroppedVersion:selectedVersion}:{}),
    ...(bunchOnly?{bunchOnlyVersion:selectedVersion}:{}),
    ...(postAttack?{postAttackHandoffKm:snapshot.sourceKm}:{}),
    ...(newChase&&!noFront?{chaseEligibilityVersion:selectiveChase?
      'v2-finale-selective-chase-1':
      'v2-finale-new-all-chase-1'}:{}),
    sourceKm:snapshot.sourceKm,sourceRoadGroupIds:
      snapshot.roadGroups.map(group=>group.id),frames,exhaustionDrops,
    ...(dissolvedFront?{
      contactAudit:auditDissolvedFrontContact({frames}),
      roadStatus:'provisional_contact_unresolved',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false}:{}),
    finalRiderEnergy:frames.at(-1).riders.map(row=>({
      riderId:row.riderId,energy:row.energy})),
    outcome:dissolvedFront?'front_dissolved_to_isolated_riders':
      frontCatch?'front_caught_into_coasted_bunch':
      dynamicSingle?'single_front_with_coasted_new_drops':
      dynamicActive?'separated_with_coasted_bunch_drops':
      dynamicFront?'separated_with_coasted_front_drops':
      coastNoFrontDropped?'bunch_with_coasted_dropped':
      bunchOnly?'bunch_only':
      noFront?'bunch_with_dropped':'separated',
    endDistanceM:tour.route.distanceKm*1000};
}

export function validateFinaleSeparatedGroupsFromTour(tour,recording){
  if(!isDeepStrictEqual(recording,probeFinaleSeparatedGroupsFromTour(tour,
    {version:recording?.version})))
    throw new Error('Separated finale differs from its locked tour and work.');
  return true;
}
