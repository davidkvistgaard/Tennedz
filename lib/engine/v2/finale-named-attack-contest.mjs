import {advanceFinaleNamedAttackSlice} from './finale-named-attack-step.mjs';
import {finalePassiveBunchSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_CONTEST_VERSION=
  'v2-finale-named-attack-contest-1';

// A single launch against a present, independent bunch. No existing road
// groups or simultaneous attacks are admitted; this is not a race runner.
export function contestFinaleNamedAttackSlice({slice,route,teams,
  pelotonRiderIds,energies,attackerTeamId,attackerRiderId,repeatLoad}){
  if(!Array.isArray(teams)||teams.length<2||
    new Set(teams.map(team=>team.id)).size!==teams.length||
    !Array.isArray(pelotonRiderIds)||
    new Set(pelotonRiderIds).size!==pelotonRiderIds.length||
    !(energies instanceof Map))
    throw new Error('The named attack contest needs distinct locked teams and a bunch.');
  const attackerTeam=teams.find(team=>team.id===attackerTeamId);
  if(!attackerTeam||!pelotonRiderIds.includes(attackerRiderId)||
    !attackerTeam.riders.some(rider=>rider.id===attackerRiderId))
    throw new Error('The named attacker must be present in their locked team.');
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  if(ridersById.size!==teams.reduce((sum,team)=>sum+team.riders.length,0)||
    pelotonRiderIds.length!==ridersById.size||
    pelotonRiderIds.some(id=>!ridersById.has(id)||
      !Number.isFinite(energies.get(id))))
    throw new Error('The contest needs one complete bunch and present energy.');
  const km=slice?.sourceKm;
  const segment=route?.kilometres?.[km-1];
  const bunchIds=pelotonRiderIds.filter(id=>id!==attackerRiderId);
  const passiveSpeedKph=finalePassiveBunchSpeed({riderIds:bunchIds,
    ridersById,energies,segment});
  const eligible=[];
  for(const team of teams){
    if(team.id===attackerTeamId)continue;
    const order=orderAt(team.orders,km-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('Simultaneous attacks and selective chase need a recorded decision.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!bunchIds.includes(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role:'chase',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      const energySpent=energyCostForFinaleSlice(slice,step.workCostPerKm);
      if(energySpent<=energy+1e-9)
        eligible.push({teamId:team.id,riderId,energy,energySpent,
          speedKph:step.speedKph});
    }
  }
  eligible.sort((a,b)=>b.speedKph-a.speedKph||
    a.teamId.localeCompare(b.teamId)||a.riderId.localeCompare(b.riderId));
  const chase=eligible[0]??null;
  const bunchSpeedKph=Math.max(passiveSpeedKph,chase?.speedKph??0);
  const attack=advanceFinaleNamedAttackSlice({slice,route,
    team:attackerTeam,riderId:attackerRiderId,
    energy:energies.get(attackerRiderId),repeatLoad,bunchSpeedKph});
  return {version:FINALE_NAMED_ATTACK_CONTEST_VERSION,
    attack,passiveSpeedKph,bunchSpeedKph,
    chase:chase?{teamId:chase.teamId,riderId:chase.riderId,
      speedKph:chase.speedKph,energyAtDecision:chase.energy,
      energySpent:chase.energySpent,
      energyAfter:Math.max(0,chase.energy-chase.energySpent)}:null};
}
