import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';
import {finaleWorkerStep,validateFinaleWorker} from './finale-worker.mjs';
import {orderAt} from './orders.mjs';

export const FINALE_RELAY_VERSION='v2-finale-relay-1';

// One solo rider against two explicitly scheduled helpers. Their sheltered
// travel spends energy, but only the named puller sets the chase pace. This
// does not model drafting speed, a whole peloton, passing or post-catch racing.
export function simulateFinaleRelay({route,initialGapSeconds,front,chasers,rotation}){
  const grid=finaleDistanceGrid(route);
  if(!Number.isFinite(initialGapSeconds)||initialGapSeconds<=0||
    !front||!Array.isArray(chasers)||chasers.length!==2||
    !Array.isArray(rotation)||rotation.length!==grid.length||
    typeof front.team?.id!=='string'||!front.team.id||
    chasers.some(chaser=>typeof chaser?.team?.id!=='string'||!chaser.team.id)||
    chasers.some(chaser=>chaser.team.id===front.team.id))
    throw new Error('A finale relay needs a solo rider, two rival helpers and a full rotation.');
  const frontRider=validateFinaleWorker({...front,role:'front'});
  const workers=chasers.map(chaser=>({
    ...chaser,rider:validateFinaleWorker({...chaser,role:'chase'}),
  }));
  const ids=workers.map(worker=>worker.riderId);
  if(new Set(ids).size!==2||ids.includes(front.riderId)||
    rotation.some(id=>!ids.includes(id)))
    throw new Error('The relay rotation must name only its two distinct helpers.');
  let frontEnergy=front.energy,gapSeconds=initialGapSeconds;
  let frontElapsedSeconds=0,chaseElapsedSeconds=initialGapSeconds;
  const energies=new Map(workers.map(worker=>[worker.riderId,worker.energy]));
  const frames=[];
  for(const [index,slice] of grid.entries()){
    const segment=route.kilometres[slice.sourceKm-1];
    const frontStep=finaleWorkerStep({rider:frontRider,segment,
      order:orderAt(front.team.orders,slice.sourceKm-1),
      energy:frontEnergy,role:'front'});
    const pullRiderId=rotation[index];
    const chaseSteps=workers.map(worker=>finaleWorkerStep({
      rider:worker.rider,segment,
      order:orderAt(worker.team.orders,slice.sourceKm-1),
      energy:energies.get(worker.riderId),role:'chase',
      sheltered:worker.riderId!==pullRiderId,
    }));
    const pullingStep=chaseSteps[ids.indexOf(pullRiderId)];
    const movement=advanceFinaleGap({slice,gapSeconds,
      frontSpeedKph:frontStep.speedKph,chaseSpeedKph:pullingStep.speedKph});
    const riddenFraction=movement.caught?
      (movement.catchDistanceM-slice.startDistanceM)/slice.lengthM:1;
    const frontCost=energyCostForFinaleSlice(slice,
      frontStep.workCostPerKm)*riddenFraction;
    const chaseCosts=chaseSteps.map(step=>
      energyCostForFinaleSlice(slice,step.workCostPerKm)*riddenFraction);
    if(frontCost>frontEnergy+1e-9||chaseCosts.some((cost,workerIndex)=>
      cost>energies.get(ids[workerIndex])+1e-9))
      throw new Error('A finale relay worker cannot spend energy they do not have.');
    frontEnergy=Math.max(0,frontEnergy-frontCost);
    for(const [workerIndex,id] of ids.entries())
      energies.set(id,Math.max(0,energies.get(id)-chaseCosts[workerIndex]));
    frontElapsedSeconds+=movement.frontSeconds*riddenFraction;
    chaseElapsedSeconds+=movement.chaseSeconds*riddenFraction;
    gapSeconds=movement.gapSeconds;
    const endDistanceM=movement.catchDistanceM??slice.endDistanceM;
    frames.push({startDistanceM:slice.startDistanceM,endDistanceM,
      remainingM:route.distanceKm*1000-endDistanceM,
      sourceKm:slice.sourceKm,profileResolutionM:slice.profileResolutionM,
      phase:slice.phase,pullRiderId,
      frontSpeedKph:frontStep.speedKph,chaseSpeedKph:pullingStep.speedKph,
      frontEnergy,frontEnergySpent:frontCost,
      chaseWorkers:ids.map((riderId,workerIndex)=>({riderId,
        pulling:riderId===pullRiderId,energy:energies.get(riderId),
        energySpent:chaseCosts[workerIndex]})),
      frontElapsedSeconds,chaseElapsedSeconds,gapSeconds,
      event:movement.caught?'catch':null});
    if(movement.caught)break;
  }
  return {version:FINALE_RELAY_VERSION,distanceKm:route.distanceKm,
    frontRiderId:front.riderId,chaseRiderIds:ids,
    rotationRiderIds:[...rotation],initialGapSeconds,frames,
    outcome:gapSeconds===0?'caught':'survived',finishGapSeconds:gapSeconds};
}

export function validateFinaleRelay(input,recording){
  if(!isDeepStrictEqual(recording,simulateFinaleRelay(input)))
    throw new Error('Finale relay recording differs from its committed workers and rotation.');
  return true;
}
