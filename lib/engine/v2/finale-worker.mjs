import {finaleDistanceGrid} from './finale-grid.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

// Experimental, read-only pace conversion for the pair laboratory. It is not
// calibrated and must not be used by the official v79 result or point path.
const SECONDS_PER_ABILITY_POINT=.003;
const EFFORT_ABILITY_POINTS=20;

export function validateFinaleWorker({team,riderId,energy,role}){
  if(!team||!Array.isArray(team.riders)||team.riders.length!==8||
    new Set(team.riders.map(rider=>rider?.id)).size!==8||
    !team.orders||team.orders.version!==2||
    !Array.isArray(team.orders.phases)||!team.orders.baseline||
    !Number.isFinite(energy)||energy<0||energy>100||
    !['front','chase'].includes(role))
    throw new Error('A finale worker needs a locked v2 lineup, orders and valid energy.');
  const rider=team.riders.find(candidate=>candidate.id===riderId);
  if(!rider)throw new Error('Finale worker must belong to the locked lineup.');
  if(role==='chase'&&!team.orders.helperIds?.includes(riderId))
    throw new Error('A chasing worker must be a nominated helper.');
  return rider;
}

export function finaleWorkerStep({rider,segment,order,energy,role,sheltered=false}){
  if(!Number.isFinite(energy)||energy<0||energy>100||
    !['front','chase'].includes(role)||sheltered&&role!=='chase'||
    !Object.hasOwn(TUNING.effortCost,order?.effort)||
    !Object.hasOwn(TUNING.effortPressure,order?.effort))
    throw new Error('Invalid finale worker state or locked effort.');
  if(role==='chase'&&!['selective','all'].includes(order.chase))
    throw new Error('The locked order does not permit this chase.');
  const effect=riderKilometreEffect(rider,segment,{
    phase:role==='front'?'solo':'chase',energy,exposed:segment.exposed,
  });
  const workCostPerKm=(sheltered?TUNING.effortCost.conserve:
    TUNING.effortCost[order.effort]+(role==='front'?TUNING.breakaway.extraCostPerKm:
      order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost))*
    effect.energyCostMultiplier;
  const effortAbility=(TUNING.effortPressure[order.effort]-1)*
    EFFORT_ABILITY_POINTS;
  const secondsPerKm=segmentBaseSeconds(segment)*
    (1+(50-effect.ability-effortAbility)*SECONDS_PER_ABILITY_POINT);
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('The route and rider produced an invalid finale pace.');
  return {speedKph:3600/secondsPerKm,workCostPerKm};
}

export function buildFinaleWorkerPlan({route,team,riderId,energy,role}){
  const grid=finaleDistanceGrid(route);
  const rider=validateFinaleWorker({team,riderId,energy,role});
  let remainingEnergy=energy;
  const steps=grid.map(slice=>{
    const step=finaleWorkerStep({rider,segment:route.kilometres[slice.sourceKm-1],
      order:orderAt(team.orders,slice.sourceKm-1),energy:remainingEnergy,role});
    const cost=energyCostForFinaleSlice(slice,step.workCostPerKm);
    if(cost>remainingEnergy+1e-9)
      throw new Error('A finale worker cannot sustain the locked work with their energy.');
    remainingEnergy=Math.max(0,remainingEnergy-cost);
    return step;
  });
  return {riderId,energy,steps};
}
