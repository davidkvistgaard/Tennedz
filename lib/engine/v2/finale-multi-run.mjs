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
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {assertNoPendingFinaleAttacks,pendingFinaleAttacksAt,
  FINALE_PENDING_ATTACK_GUARD_VERSION,
  FINALE_EXHAUSTED_ATTACK_DECISION_VERSION} from './finale-attack-guard.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';

export const FINALE_MULTI_SEPARATED_VERSION='v2-finale-multi-separated-1';
export const FINALE_MULTI_NEW_CHASE_VERSION='v2-finale-multi-separated-2';
export const FINALE_MULTI_SELECTIVE_CHASE_VERSION='v2-finale-multi-separated-3';
export const FINALE_SEPARATED_ONE_OR_MORE_VERSION=
  'v2-finale-separated-one-or-more-4';
export const FINALE_SEPARATED_POST_ATTACK_VERSION=
  'v2-finale-separated-post-attack-5';
export const FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION=
  'v2-finale-separated-exhausted-attack-6';

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
// bunch. V4 also accepts exactly one source group. Any catch or group contact
// refuses the complete run. It
// records travel and work, never a finisher or a point award.
export function probeFinaleSeparatedGroupsFromTour(tour,{version=null}={}){
  if(version!==null&&![FINALE_MULTI_SEPARATED_VERSION,
    FINALE_MULTI_NEW_CHASE_VERSION,
    FINALE_MULTI_SELECTIVE_CHASE_VERSION,
    FINALE_SEPARATED_ONE_OR_MORE_VERSION,
    FINALE_SEPARATED_POST_ATTACK_VERSION,
    FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION].includes(version))
    throw new Error('Unknown separated finale version.');
  const selectedVersion=version??FINALE_SEPARATED_ONE_OR_MORE_VERSION;
  const recordExhaustedAttack=
    selectedVersion===FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION;
  const postAttack=selectedVersion===FINALE_SEPARATED_POST_ATTACK_VERSION||
    recordExhaustedAttack;
  const allowSingle=selectedVersion===FINALE_SEPARATED_ONE_OR_MORE_VERSION||
    postAttack;
  const selectiveChase=selectedVersion===FINALE_MULTI_SELECTIVE_CHASE_VERSION||
    allowSingle;
  const newChase=selectedVersion===FINALE_MULTI_NEW_CHASE_VERSION||
    selectiveChase;
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm:postAttack?4:5});
  if(snapshot.roadGroups.length<(allowSingle?1:2)||
    !snapshot.peloton.riderIds.length)
    throw new Error('A separated finale needs multiple road groups and a bunch (or one group in v4).');
  const grid=finaleDistanceGrid(tour.route,{
    remainingKm:postAttack?4:5});
  if(!recordExhaustedAttack)
    assertNoPendingFinaleAttacks(tour,snapshot,grid);
  const sourceFrame=tour.frames[snapshot.sourceKm-1];
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
        slice.sourceKm,{includeBlocked:true})){
        const energy=energies.get(pending.riderId);
        const team=teamsById.get(pending.teamId);
        const supportingNamedHelper=team?.orders.helperIds.includes(
          pending.riderId)&&
          orderAt(team.orders,slice.sourceKm-1).captainSupport===
            'drop_back_if_dropped'&&
          currentSnapshot.riders.some(row=>
            row.riderId===team.orders.captainId&&row.status==='dropped');
        if(pending.kind!=='peloton_attack'||pending.riderId===null||
          !Number.isFinite(energy)||
          supportingNamedHelper||
          caughtAtSource.has(pending.riderId)&&
            slice.sourceKm-caughtAtSource.get(pending.riderId)<=
              TUNING.breakaway.reattackRecoveryKm||
          energy>=TUNING.attack.minEnergyFraction*100)
          throw new Error(pending.message);
        blockedNamedAttacks.push({teamId:pending.teamId,
          riderId:pending.riderId,reason:'exhausted',
          sourceKm:slice.sourceKm,distanceM:slice.startDistanceM,
          energyAtDecision:energy});
      }
    }
    const selectiveDecisions=new Map();
    const chaseEligible=select(pelotonRiderIds,'chase',slice,segment,
      selectiveDecisions);
    const chase=chaseEligible.length?
      chaseEligible[index%chaseEligible.length]:null;
    const exhaustion=dropExhaustedSheltered({riderIds:pelotonRiderIds,
      pullRiderId:chase?.riderId??null,segment,ridersById,energies,
      startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM});
    pelotonRiderIds=exhaustion.riderIds;
    exhaustionDrops.push(...exhaustion.drops);
    const passiveBunchSpeed=finalePassiveBunchSpeed({
      riderIds:pelotonRiderIds,ridersById,energies,segment});
    const bunchSpeedKph=Math.max(passiveBunchSpeed,
      chase?.step.speedKph??0);
    const groupPlans=groups.map(group=>{
      const eligible=select(group.riderIds,'front',slice,segment);
      const pull=eligible.length?eligible[index%eligible.length]:null;
      const speedKph=pull?.step.speedKph??finalePassiveFrontSpeed({
        riderIds:group.riderIds,ridersById,energies,segment});
      const movement=advanceFinaleGap({slice,
        gapSeconds:group.gapSeconds,frontSpeedKph:speedKph,
        chaseSpeedKph:bunchSpeedKph});
      if(movement.caught)
        throw new Error(`The separated finale needs a recorded catch for ${
          group.id} at ${movement.catchDistanceM} m.`);
      return {group,pull,movement};
    });
    if(groupPlans.length>1)assertNoFinaleGroupContact(slice,groupPlans);
    const pullById=new Map(groupPlans.filter(plan=>plan.pull)
      .map(plan=>[plan.pull.riderId,plan.pull.step]));
    if(chase)pullById.set(chase.riderId,chase.step);
    const activeIds=[...groups.flatMap(group=>group.riderIds),
      ...pelotonRiderIds];
    const riders=activeIds.map(riderId=>{
      const energy=energies.get(riderId);
      const step=pullById.get(riderId);
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
    groups=groupPlans.map(({group,movement})=>({...group,
      gapSeconds:movement.gapSeconds}));
    frames.push({startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      phase:slice.phase,bunchPullRiderId:chase?.riderId??null,
      bunchElapsedSeconds:slice.lengthM*3.6/bunchSpeedKph,
      roadGroups:groupPlans.map(({group,pull,movement})=>({
        id:group.id,gapSeconds:movement.gapSeconds,
        riderIds:[...group.riderIds],teamIds:[...group.teamIds],
        pullRiderId:pull?.riderId??null,
        elapsedSeconds:movement.frontSeconds})),
      pelotonRiderIds:[...pelotonRiderIds],
      ...(recordExhaustedAttack?{blockedNamedAttacks}:{}),
      ...(selectiveChase?{selectiveChaseDecisions:
        [...selectiveDecisions.entries()].sort(([a],[b])=>
          a.localeCompare(b)).map(([teamId,decision])=>
          ({teamId,decision}))}:{}),
      exhaustionDrops:exhaustion.drops,riders});
  }
  return {version:selectedVersion,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:tour.tuningVersion,
    workerTuningVersion:TUNING_VERSION,
    workerPaceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
    passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION,
    passiveFrontVersion:FINALE_PASSIVE_FRONT_VERSION,
    exhaustionDropVersion:FINALE_EXHAUSTION_DROP_VERSION,
    pendingAttackGuardVersion:FINALE_PENDING_ATTACK_GUARD_VERSION,
    ...(recordExhaustedAttack?{attackDecisionVersion:
      FINALE_EXHAUSTED_ATTACK_DECISION_VERSION}:{}),
    ...(allowSingle?{singleRoadGroupVersion:
      selectedVersion}:{}),
    ...(postAttack?{postAttackHandoffKm:snapshot.sourceKm}:{}),
    ...(newChase?{chaseEligibilityVersion:selectiveChase?
      'v2-finale-selective-chase-1':
      'v2-finale-new-all-chase-1'}:{}),
    sourceKm:snapshot.sourceKm,sourceRoadGroupIds:
      snapshot.roadGroups.map(group=>group.id),frames,exhaustionDrops,
    finalRiderEnergy:frames.at(-1).riders.map(row=>({
      riderId:row.riderId,energy:row.energy})),
    outcome:'separated',endDistanceM:tour.route.distanceKm*1000};
}

export function validateFinaleSeparatedGroupsFromTour(tour,recording){
  if(!isDeepStrictEqual(recording,probeFinaleSeparatedGroupsFromTour(tour,
    {version:recording?.version})))
    throw new Error('Separated finale differs from its locked tour and work.');
  return true;
}
