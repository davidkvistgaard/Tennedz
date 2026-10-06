import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';

export const FINALE_PAIR_VERSION='v2-finale-pair-1';

function validWorker(worker,sliceCount){
  return worker&&typeof worker.riderId==='string'&&worker.riderId.length>0&&
    Number.isFinite(worker.energy)&&worker.energy>=0&&worker.energy<=100&&
    Array.isArray(worker.steps)&&worker.steps.length===sliceCount&&
    worker.steps.every(step=>Number.isFinite(step?.speedKph)&&step.speedKph>0&&
      Number.isFinite(step?.workCostPerKm)&&step.workCostPerKm>=0);
}

// A two-worker laboratory integration of the distance grid. The caller must
// supply each worker's pace and cost for each slice. No race skill, order or
// road-group decision is inferred here, and the live v2 finish does not call it.
export function simulateFinalePair({route,initialGapSeconds,front,rear}){
  const grid=finaleDistanceGrid(route);
  if(!Number.isFinite(initialGapSeconds)||initialGapSeconds<=0||
    !validWorker(front,grid.length)||!validWorker(rear,grid.length)||
    front.riderId===rear.riderId)
    throw new Error('A finale pair needs two distinct workers and complete finite plans.');
  const frames=[];
  let gapSeconds=initialGapSeconds;
  let frontEnergy=front.energy,rearEnergy=rear.energy;
  for(const [index,slice] of grid.entries()){
    const frontPlan=front.steps[index],rearPlan=rear.steps[index];
    const movement=advanceFinaleGap({slice,gapSeconds,
      frontSpeedKph:frontPlan.speedKph,chaseSpeedKph:rearPlan.speedKph});
    const workFraction=movement.caught?
      (movement.catchDistanceM-slice.startDistanceM)/slice.lengthM:1;
    const frontCost=energyCostForFinaleSlice(slice,frontPlan.workCostPerKm)*workFraction;
    const rearCost=energyCostForFinaleSlice(slice,rearPlan.workCostPerKm)*workFraction;
    if(frontCost>frontEnergy+1e-9||rearCost>rearEnergy+1e-9)
      throw new Error('A finale worker cannot spend energy they do not have.');
    frontEnergy=Math.max(0,frontEnergy-frontCost);
    rearEnergy=Math.max(0,rearEnergy-rearCost);
    gapSeconds=movement.gapSeconds;
    frames.push({startDistanceM:slice.startDistanceM,
      endDistanceM:movement.catchDistanceM??slice.endDistanceM,
      remainingM:route.distanceKm*1000-(movement.catchDistanceM??slice.endDistanceM),
      sourceKm:slice.sourceKm,profileResolutionM:slice.profileResolutionM,
      phase:slice.phase,frontSpeedKph:frontPlan.speedKph,
      rearSpeedKph:rearPlan.speedKph,frontEnergy,rearEnergy,
      frontEnergySpent:frontCost,rearEnergySpent:rearCost,
      gapSeconds,event:movement.caught?'catch':null});
    if(movement.caught)break;
  }
  return {version:FINALE_PAIR_VERSION,distanceKm:route.distanceKm,
    frontRiderId:front.riderId,rearRiderId:rear.riderId,
    initialGapSeconds,frames,
    outcome:gapSeconds===0?'caught':'survived',finishGapSeconds:gapSeconds};
}

export function validateFinalePair(input,recording){
  if(!isDeepStrictEqual(recording,simulateFinalePair(input)))
    throw new Error('Finale pair recording differs from its committed plan.');
  return true;
}
