import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {MOTOR_EXPLICIT_FRONT,TUNING} from './tuning.mjs';

export const FINALE_BUNCH_FRONT_WORK_VERSION=
  'v2-finale-bunch-front-work-candidate-1';

const workExtra=effort=>effort==='hard'?
  TUNING.groups.hardPaceWorkerExtraCostPerKm:
  effort==='steady'?TUNING.groups.steadyPaceWorkerExtraCostPerKm:
    MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;

// Candidate continuation of an already committed front-work order. A pair
// must be present and able to pay this exact slice; a named worker is never
// replaced. This returns a plan only and changes no recorded road by itself.
export function planFinaleBunchFrontWork({teams,pelotonRiderIds,energies,
  aheadTeamIds=[],busyTeamIds=[],segment,sourceKm,sliceLengthKm}){
  if(!Array.isArray(teams)||!Array.isArray(pelotonRiderIds)||
    !(energies instanceof Map)||!segment||!Number.isInteger(sourceKm)||
    sourceKm<1||!Number.isFinite(sliceLengthKm)||sliceLengthKm<=0||
    sliceLengthKm>1)
    throw new Error('Invalid last-kilometre front-work state.');
  const present=new Set(pelotonRiderIds);
  const ahead=new Set(aheadTeamIds),busy=new Set(busyTeamIds);
  const options=[];
  for(const team of teams){
    const order=orderAt(team.orders,sourceKm-1);
    if(order.frontWork!=='rotate'||ahead.has(team.id)||busy.has(team.id)||
      !['hard','steady','conserve'].includes(order.effort))continue;
    const workers=team.riders.filter(rider=>
      team.orders.helperIds.includes(rider.id)&&present.has(rider.id)&&
      energies.get(rider.id)>TUNING.chase.minHelperEnergy).map(rider=>{
      const energy=energies.get(rider.id);
      const effect=riderKilometreEffect(rider,segment,{phase:'cruise',
        energy,exposed:segment.exposed});
      const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+
        (segment.surface==='road'?0:.15);
      const costPerKm=(TUNING.effortCost[order.effort]*terrainLoad+
        workExtra(order.effort))*effect.energyCostMultiplier;
      return {riderId:rider.id,energy,ability:effect.ability,costPerKm};
    }).filter(row=>row.energy+1e-9>=row.costPerKm*sliceLengthKm)
      .sort((a,b)=>b.ability-a.ability||a.riderId.localeCompare(b.riderId));
    if(workers.length<2)continue;
    const named=order.frontWorkRiderId;
    if(named&&!workers.some(row=>row.riderId===named))continue;
    const pair=named?[workers.find(row=>row.riderId===named),
      workers.find(row=>row.riderId!==named)]:workers.slice(0,2);
    const ability=(pair[0].ability+pair[1].ability)/2+
      (order.effort==='conserve'?
        MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
        TUNING.groups.frontPaceAdjustmentPoints[order.effort]);
    const secondsPerKm=segmentBaseSeconds(segment)+
      (50-ability-TUNING.breakaway.bunchDraftAdvantage)*
        TUNING.breakaway.driftSecondsPerAbilityPoint;
    if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
      throw new Error('Invalid paid bunch-front speed.');
    options.push({teamId:team.id,effort:order.effort,
      riderIds:pair.map(row=>row.riderId),ability,
      speedKph:3600/secondsPerKm,
      workers:pair.map(row=>({riderId:row.riderId,
        energyBefore:row.energy,energySpent:row.costPerKm*sliceLengthKm}))});
  }
  options.sort((a,b)=>a.teamId.localeCompare(b.teamId));
  return options.length?{
    version:FINALE_BUNCH_FRONT_WORK_VERSION,
    ...options[(sourceKm-1)%options.length]}:null;
}
