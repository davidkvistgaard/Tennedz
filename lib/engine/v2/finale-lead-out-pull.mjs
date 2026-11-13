import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {selectFinaleLeadOut} from './finale-lead-out.mjs';

export const FINALE_LEAD_OUT_PULL_VERSION='v2-finale-lead-out-pull-1';
const LAUNCH_REMAINING_M=Object.freeze({early:1000,standard:750,late:500});
const PULL_END_REMAINING_M=300;

// A counterfactual work trace over the final kilometre. It records a finite
// worker pull but deliberately grants no unearned position or speed benefit.
export function recordFinaleLeadOutPull({route,team,finisherId,nomineeId=null,
  riderStates,launchIntent}){
  const grid=finaleDistanceGrid(route);
  if(!Object.hasOwn(LAUNCH_REMAINING_M,launchIntent))
    throw new Error('The lead-out needs an early, standard or late launch.');
  const selection=selectFinaleLeadOut({team,finisherId,nomineeId,riderStates,
    segment:route.kilometres.at(-1)});
  const finishM=route.distanceKm*1000;
  const startM=finishM-LAUNCH_REMAINING_M[launchIntent];
  const stopM=finishM-PULL_END_REMAINING_M;
  const worker=selection.selectedRiderId;
  let energy=worker?riderStates.find(state=>state.riderId===worker).energy:null;
  const frames=[];
  for(const slice of grid){
    if(!worker||slice.endDistanceM<=startM||slice.startDistanceM>=stopM)continue;
    const fromM=Math.max(slice.startDistanceM,startM);
    const plannedEndM=Math.min(slice.endDistanceM,stopM);
    const plannedCost=selection.selectedWorkCostPerKm*(plannedEndM-fromM)/1000;
    const fraction=plannedCost>energy?energy/plannedCost:1;
    const endDistanceM=fromM+(plannedEndM-fromM)*fraction;
    const cost=plannedCost*fraction;
    energy=Math.max(0,energy-cost);
    const exhausted=energy===0&&endDistanceM<stopM;
    frames.push({startDistanceM:fromM,endDistanceM,
      remainingM:finishM-endDistanceM,sourceKm:slice.sourceKm,
      profileResolutionM:slice.profileResolutionM,phase:slice.phase,
      roadGroupId:riderStates.find(state=>state.riderId===finisherId).roadGroupId,
      workerRiderId:worker,finisherRiderId:finisherId,
      energySpent:cost,workerEnergy:energy,
      event:exhausted?'worker_exhausted':endDistanceM===stopM?'pull_complete':'pull_continues'});
    if(exhausted)break;
  }
  return {version:FINALE_LEAD_OUT_PULL_VERSION,
    selectionVersion:selection.version,launchIntent,
    nominatedRiderId:selection.nominatedRiderId,
    workerRiderId:worker,finisherRiderId:finisherId,
    fallbackReason:selection.fallbackReason,
    plannedStartDistanceM:startM,plannedEndDistanceM:stopM,frames,
    outcome:!worker?'unavailable':frames.at(-1)?.event==='worker_exhausted'?
      'exhausted':'completed'};
}

export function validateFinaleLeadOutPull(input,recording){
  if(!isDeepStrictEqual(recording,recordFinaleLeadOutPull(input)))
    throw new Error('Lead-out pull differs from its committed riders and route.');
  return true;
}
