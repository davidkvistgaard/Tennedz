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

export function buildFinaleWorkerPlan({route,team,riderId,energy,role}){
  const grid=finaleDistanceGrid(route);
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

  let remainingEnergy=energy;
  const steps=grid.map(slice=>{
    const segment=route.kilometres[slice.sourceKm-1];
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(!Object.hasOwn(TUNING.effortCost,order.effort)||
      !Object.hasOwn(TUNING.effortPressure,order.effort))
      throw new Error('Invalid locked finale effort.');
    if(role==='chase'&&!['selective','all'].includes(order.chase))
      throw new Error('The locked order does not permit this chase.');
    const effect=riderKilometreEffect(rider,segment,{
      phase:role==='front'?'solo':'chase',energy:remainingEnergy,
      exposed:segment.exposed,
    });
    const workCostPerKm=(TUNING.effortCost[order.effort]+
      (role==='front'?TUNING.breakaway.extraCostPerKm:
        order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost))*
      effect.energyCostMultiplier;
    const cost=energyCostForFinaleSlice(slice,workCostPerKm);
    if(cost>remainingEnergy+1e-9)
      throw new Error('A finale worker cannot sustain the locked work with their energy.');
    const effortAbility=(TUNING.effortPressure[order.effort]-1)*
      EFFORT_ABILITY_POINTS;
    const secondsPerKm=segmentBaseSeconds(segment)*
      (1+(50-effect.ability-effortAbility)*SECONDS_PER_ABILITY_POINT);
    if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
      throw new Error('The route and rider produced an invalid finale pace.');
    remainingEnergy=Math.max(0,remainingEnergy-cost);
    return {speedKph:3600/secondsPerKm,workCostPerKm};
  });
  return {riderId,energy,steps};
}
