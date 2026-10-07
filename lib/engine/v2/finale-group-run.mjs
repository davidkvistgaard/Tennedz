import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep} from './finale-group-step.mjs';
import {finaleWorkerStep,validateFinaleWorker} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_GROUP_RUN_VERSION='v2-finale-group-run-1';

// One road group against the bunch, with fixed named pullers across the
// eleven-slice grid. Every slice uses the energy left by the prior slice.
// The run stops at a catch; it does not rank finishers or continue a merge.
export function simulateFinaleGroupRun({route,snapshot,teams,frontPullRiderId,
  chasePullRiderId}){
  const grid=finaleDistanceGrid(route);
  if(snapshot?.roadGroups?.length!==1||
    !Array.isArray(snapshot.peloton?.riderIds)||
    !snapshot.peloton.riderIds.length||
    !Array.isArray(snapshot.riders)||!Array.isArray(teams))
    throw new Error('A group run needs one source road group and the bunch.');
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,team])));
  const riderById=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,rider])));
  const sourceIds=[...snapshot.roadGroups[0].riderIds,...snapshot.peloton.riderIds];
  const states=new Map(snapshot.riders.map(rider=>[rider.riderId,rider]));
  if(new Set(sourceIds).size!==sourceIds.length||
    !snapshot.roadGroups[0].riderIds.includes(frontPullRiderId)||
    !snapshot.peloton.riderIds.includes(chasePullRiderId)||
    sourceIds.some(id=>!teamByRider.has(id)||!states.has(id)))
    throw new Error('The group run has an invalid source rider or puller.');
  const frontTeam=teamByRider.get(frontPullRiderId);
  const chaseTeam=teamByRider.get(chasePullRiderId);
  validateFinaleWorker({team:frontTeam,riderId:frontPullRiderId,
    energy:states.get(frontPullRiderId).energy,role:'front'});
  validateFinaleWorker({team:chaseTeam,riderId:chasePullRiderId,
    energy:states.get(chasePullRiderId).energy,role:'chase'});
  const energies=new Map(sourceIds.map(id=>[id,states.get(id).energy]));
  let frontGroup={...snapshot.roadGroups[0],
    riderIds:[...snapshot.roadGroups[0].riderIds]};
  const frames=[];
  for(const slice of grid){
    const segment=route.kilometres[slice.sourceKm-1];
    const frontOrder=orderAt(frontTeam.orders,slice.sourceKm-1);
    if(frontOrder.breakWork==='sit_on')
      throw new Error('A rider ordered to sit on cannot pull the front group.');
    const stepFor=(id,role)=>finaleWorkerStep({rider:riderById.get(id),segment,
      order:orderAt(teamByRider.get(id).orders,slice.sourceKm-1),
      energy:energies.get(id),role});
    const frontStep=stepFor(frontPullRiderId,'front');
    const chaseStep=stepFor(chasePullRiderId,'chase');
    const riderPlans=sourceIds.map(riderId=>{
      const pulling=riderId===frontPullRiderId||riderId===chasePullRiderId;
      return {riderId,energy:energies.get(riderId),
        workCostPerKm:pulling?
          (riderId===frontPullRiderId?frontStep:chaseStep).workCostPerKm:
          TUNING.effortCost.conserve*riderKilometreEffect(
            riderById.get(riderId),segment,{phase:'chase',
              energy:energies.get(riderId),exposed:segment.exposed,
            }).energyCostMultiplier};
    });
    const step=advanceFinaleGroupStep({slice,frontGroup,
      pelotonRiderIds:snapshot.peloton.riderIds,
      frontPull:{riderId:frontPullRiderId,speedKph:frontStep.speedKph},
      chasePull:{riderId:chasePullRiderId,speedKph:chaseStep.speedKph},
      riderPlans});
    frames.push({...step,sourceKm:slice.sourceKm,phase:slice.phase});
    for(const rider of step.riders)energies.set(rider.riderId,rider.energy);
    if(step.event)break;
    frontGroup=step.roadGroups[0];
  }
  return {version:FINALE_GROUP_RUN_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    sourceKm:snapshot.sourceKm,frontPullRiderId,chasePullRiderId,
    frames,outcome:frames.at(-1).event?'caught':'survived',
    endDistanceM:frames.at(-1).endDistanceM,
    finishGapSeconds:frames.at(-1).roadGroups[0]?.gapSeconds??0};
}

export function validateFinaleGroupRun(input,recording){
  if(!isDeepStrictEqual(recording,simulateFinaleGroupRun(input)))
    throw new Error('Finale group run differs from its locked source and pullers.');
  return true;
}
