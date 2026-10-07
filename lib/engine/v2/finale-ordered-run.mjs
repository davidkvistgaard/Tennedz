import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {simulateFinaleGroupToLine} from './finale-group-run.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ORDERED_RUN_VERSION='v2-finale-ordered-run-1';

// A read-only bridge from committed manager orders to the existing one-group
// short-step laboratory. It chooses one present, energetic worker per eligible
// team, then rotates those teams. It does not rank finishers or award points.
export function probeFinaleOrderedGroupToLineFromTour(tour){
  const snapshot=finaleSnapshotFromTour(tour);
  if(snapshot.roadGroups.length!==1||!snapshot.peloton.riderIds.length)
    throw new Error('The ordered finale needs one road group and the bunch.');
  const frame=tour.frames[snapshot.sourceKm-1];
  const front=snapshot.roadGroups[0];
  const frontTeams=new Set(front.teamIds);
  const engaged=new Set(frame.engagedChaseTeamIds);
  const teams=new Map(tour.committedInputs.teams.map(team=>[team.id,team]));
  const states=new Map(snapshot.riders.map(rider=>[rider.riderId,rider]));
  const grid=finaleDistanceGrid(tour.route);
  const nominated=(slice,role)=>{
    const roadIds=role==='front'?front.riderIds:snapshot.peloton.riderIds;
    const minimum=role==='front'?TUNING.breakaway.minPullEnergy:
      TUNING.chase.minHelperEnergy;
    const byTeam=new Map();
    for(const riderId of roadIds){
      const state=states.get(riderId);
      const team=teams.get(state?.teamId);
      if(!team||state.energy<minimum||
        role==='chase'&&(!engaged.has(team.id)||frontTeams.has(team.id)||
          !team.orders.helperIds.includes(riderId)))continue;
      const order=orderAt(team.orders,slice.sourceKm-1);
      if(role==='front'?order.breakWork==='sit_on':order.chase==='ignore')
        continue;
      const previous=byTeam.get(team.id);
      if(!previous||state.energy>previous.energy||
        state.energy===previous.energy&&riderId<previous.riderId)
        byTeam.set(team.id,{riderId,energy:state.energy});
    }
    return [...byTeam.entries()].sort(([a],[b])=>a.localeCompare(b))
      .map(([,row])=>row.riderId);
  };
  const frontPullRiderIds=[],chasePullRiderIds=[];
  for(const [index,slice] of grid.entries()){
    const frontEligible=nominated(slice,'front');
    const chaseEligible=nominated(slice,'chase');
    if(!frontEligible.length||!chaseEligible.length)
      throw new Error(`The locked orders provide no eligible finale puller: ${
        !frontEligible.length?'front':'chase'} at ${slice.startDistanceM} m.`);
    frontPullRiderIds.push(frontEligible[index%frontEligible.length]);
    chasePullRiderIds.push(chaseEligible[index%chaseEligible.length]);
  }
  const input={route:tour.route,snapshot,teams:tour.committedInputs.teams,
    frontPullRiderId:frontPullRiderIds[0],
    chasePullRiderId:chasePullRiderIds[0],
    frontRotationRiderIds:new Set(frontPullRiderIds).size>1?
      frontPullRiderIds:null,
    chaseRotationRiderIds:new Set(chasePullRiderIds).size>1?
      chasePullRiderIds:null,
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION};
  const recording=simulateFinaleGroupToLine(input);
  return {version:FINALE_ORDERED_RUN_VERSION,
    sourceTuningVersion:tour.tuningVersion,
    schedule:{frontPullRiderIds,chasePullRiderIds},input,recording};
}

export function validateFinaleOrderedGroupToLineFromTour(tour,probe){
  if(!isDeepStrictEqual(probe,probeFinaleOrderedGroupToLineFromTour(tour)))
    throw new Error('Ordered finale differs from its locked tour and recorded work.');
  return true;
}
