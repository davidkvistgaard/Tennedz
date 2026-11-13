import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {roadGroupExposureCosts,selectRoadGroupWork} from './road-groups.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_COOPERATIVE_FRONT_VERSION=
  'v2-finale-cooperative-front-1';

// Apply the existing break-work choices to one short finale slice. The
// kilometre model supplies worker eligibility, drive, cooperation and cost
// sharing. Its ability is converted to route speed with the already used
// passive-slope conversion; this remains an opt-in, unclassified road band.
export function finaleCooperativeFront({group,teams,energies,segment}){
  const byId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{team,rider}])));
  const withEnergy=teams.map(team=>({...team,energy:Object.fromEntries(
    team.riders.map(rider=>[rider.id,energies.get(rider.id)]))}));
  const workers=selectRoadGroupWork([group],withEnergy,segment.km)
    .pullRiderIds;
  const workerSet=new Set(workers);
  const driveIds=workers.filter(id=>
    orderAt(byId.get(id).team.orders,segment.km-1).breakWork==='drive');
  const exposure=roadGroupExposureCosts([group],workers,
    {driveRiderIds:driveIds});
  const selected=workers.length?workers:group.riderIds;
  const ability=selected.reduce((sum,id)=>{
    const entry=byId.get(id);
    const energy=energies.get(id);
    if(!entry||!Number.isFinite(energy)||energy<0||energy>100)
      throw new Error('The cooperative front lost a rider or energy.');
    return sum+riderKilometreEffect(entry.rider,segment,{
      phase:'solo',energy,exposed:segment.exposed}).ability+
      (driveIds.includes(id)?TUNING.breakaway.driveAbilityBonusPoints:0);
  },0)/selected.length;
  const cooperation=workers.length?
    Math.min(workers.length-1,TUNING.breakaway.maxCooperatingRiders)*
      TUNING.breakaway.roadGroupCooperationPerExtraRider:
    -TUNING.breakaway.noWorkPenaltyPoints;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability-cooperation)*TUNING.breakaway.driftSecondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('The cooperative front produced an invalid pace.');
  const workCosts=new Map(group.riderIds.map(id=>{
    const entry=byId.get(id);
    const energy=energies.get(id);
    const order=orderAt(entry.team.orders,segment.km-1);
    const effect=riderKilometreEffect(entry.rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+
      (segment.surface==='road'?0:.15);
    return [id,((workerSet.has(id)?TUNING.effortCost[order.effort]:
      TUNING.effortCost.conserve)*terrainLoad+exposure.get(id))*
      effect.energyCostMultiplier];
  }));
  return {version:FINALE_COOPERATIVE_FRONT_VERSION,
    workerRiderIds:workers,driveRiderIds:driveIds,
    speedKph:3600/secondsPerKm,workCosts};
}
