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
import {assertNoPendingFinaleAttacks,
  FINALE_PENDING_ATTACK_GUARD_VERSION} from './finale-attack-guard.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';

export const FINALE_MULTI_SEPARATED_VERSION='v2-finale-multi-separated-1';

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

// Read-only continuation of two or more source road groups while they remain
// distinct. Any catch or front/rear contact refuses the complete run. It
// records travel and work, never a finisher or a point award.
export function probeFinaleSeparatedGroupsFromTour(tour){
  const snapshot=finaleSnapshotFromTour(tour);
  if(snapshot.roadGroups.length<2||!snapshot.peloton.riderIds.length)
    throw new Error('A separated finale needs multiple road groups and a bunch.');
  const grid=finaleDistanceGrid(tour.route);
  assertNoPendingFinaleAttacks(tour,snapshot,grid);
  const sourceFrame=tour.frames[snapshot.sourceKm-1];
  const teamsById=new Map(tour.committedInputs.teams.map(team=>[team.id,team]));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const states=new Map(snapshot.riders.map(row=>[row.riderId,row]));
  const energies=new Map(snapshot.riders.map(row=>[row.riderId,row.energy]));
  const frontTeamIds=new Set(snapshot.roadGroups.flatMap(group=>group.teamIds));
  const engaged=new Set(sourceFrame.engagedChaseTeamIds);
  let groups=snapshot.roadGroups.map(group=>({...group,
    riderIds:[...group.riderIds]}));
  let pelotonRiderIds=[...snapshot.peloton.riderIds];
  const frames=[],exhaustionDrops=[];
  const select=(ids,role,slice,segment)=>{
    const byTeam=new Map();
    for(const riderId of ids){
      const state=states.get(riderId),team=teamsById.get(state?.teamId);
      const energy=energies.get(riderId);
      if(!team||!ridersById.has(riderId)||!Number.isFinite(energy)||
        energy<(role==='front'?TUNING.breakaway.minPullEnergy:
          TUNING.chase.minHelperEnergy)||
        role==='chase'&&(!engaged.has(team.id)||frontTeamIds.has(team.id)||
          !team.orders.helperIds.includes(riderId)))continue;
      const order=orderAt(team.orders,slice.sourceKm-1);
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
    const chaseEligible=select(pelotonRiderIds,'chase',slice,segment);
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
    assertNoFinaleGroupContact(slice,groupPlans);
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
      exhaustionDrops:exhaustion.drops,riders});
  }
  return {version:FINALE_MULTI_SEPARATED_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:tour.tuningVersion,
    workerTuningVersion:TUNING_VERSION,
    workerPaceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
    passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION,
    passiveFrontVersion:FINALE_PASSIVE_FRONT_VERSION,
    exhaustionDropVersion:FINALE_EXHAUSTION_DROP_VERSION,
    pendingAttackGuardVersion:FINALE_PENDING_ATTACK_GUARD_VERSION,
    sourceKm:snapshot.sourceKm,sourceRoadGroupIds:
      snapshot.roadGroups.map(group=>group.id),frames,exhaustionDrops,
    finalRiderEnergy:frames.at(-1).riders.map(row=>({
      riderId:row.riderId,energy:row.energy})),
    outcome:'separated',endDistanceM:tour.route.distanceKm*1000};
}

export function validateFinaleSeparatedGroupsFromTour(tour,recording){
  if(!isDeepStrictEqual(recording,probeFinaleSeparatedGroupsFromTour(tour)))
    throw new Error('Separated finale differs from its locked tour and work.');
  return true;
}
