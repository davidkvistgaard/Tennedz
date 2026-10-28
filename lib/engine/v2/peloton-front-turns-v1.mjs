// Isolated source-paid plan for one exposed bunch leader at a time.
// A chase and a separate team's committed front pair share the same road.
import {planChaseRoadPaceV1} from './chase-road-pace-v1.mjs';
import {planBunchFrontTurnsV1} from './bunch-front-turns-v1.mjs';

export const PELOTON_FRONT_TURNS_VERSION='v2-peloton-front-turns-1';

export function planPelotonFrontTurnsV1({chaseTurnPlan,paidPace,teams,segment,km}){
  if(!Number.isInteger(km)||km<1||segment?.km!==km||
    !Array.isArray(teams))throw new Error('Invalid peloton turn source.');
  const chase=planChaseRoadPaceV1({turnPlan:chaseTurnPlan,teams,segment});
  const front=paidPace?planBunchFrontTurnsV1({paidPace,teams,segment,km}):null;
  const chaseCandidates=new Map(chaseTurnPlan.candidates.map(row=>
    [row.riderId,row]));
  const candidates=chase.turns.map(turn=>{
    const source=chaseCandidates.get(turn.leaderRiderId);
    return {teamId:turn.teamId,riderId:turn.leaderRiderId,
      workKind:'chase',ability:turn.ability,
      chaseCapacity:source.capacity,costPerKm:source.costPerKm,
      energy:source.energy};
  });
  if(front){
    const team=teams.find(row=>row.id===front.teamId);
    for(const turn of front.turns)candidates.push({teamId:front.teamId,
      riderId:turn.leaderRiderId,workKind:'front',
      ability:turn.ability,chaseCapacity:0,
      costPerKm:front.extraEnergyCosts.find(row=>
        row.riderId===turn.leaderRiderId).extraCost*2,
      energy:team.energy[turn.leaderRiderId]});
  }
  if(new Set(candidates.map(row=>row.riderId)).size!==candidates.length)
    throw new Error('A rider cannot take two simultaneous bunch jobs.');
  if(!candidates.length)return {version:PELOTON_FRONT_TURNS_VERSION,
    status:'no_front',turns:[],extraEnergyCosts:[],
    leaderAbility:null,chasePower:0};
  const sorted=candidates.sort((a,b)=>a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const start=(km-1)%sorted.length;
  const rotated=[...sorted.slice(start),...sorted.slice(0,start)];
  let metre=0;
  const turns=rotated.map((worker,index)=>{
    const lengthM=Math.floor(1000/rotated.length)+
      (index<1000%rotated.length?1:0);
    const turn={teamId:worker.teamId,leaderRiderId:worker.riderId,
      workKind:worker.workKind,startM:metre,endM:metre+lengthM,
      ability:worker.ability,chaseCapacity:worker.chaseCapacity};
    metre+=lengthM;
    return turn;
  });
  const byId=new Map(sorted.map(row=>[row.riderId,row]));
  const extraEnergyCosts=turns.map(turn=>{
    const source=byId.get(turn.leaderRiderId);
    const leadingM=turn.endM-turn.startM;
    const extraCost=+(source.costPerKm*leadingM/1000).toFixed(6);
    if(extraCost>source.energy+1e-9)
      throw new Error('Named bunch-front turn cannot be paid.');
    return {teamId:turn.teamId,riderId:turn.leaderRiderId,
      workKind:turn.workKind,leadingM,extraCost};
  });
  return {version:PELOTON_FRONT_TURNS_VERSION,status:'worked',turns,
    extraEnergyCosts,
    leaderAbility:+(turns.reduce((sum,turn)=>sum+
      turn.ability*(turn.endM-turn.startM),0)/1000).toFixed(3),
    chasePower:turns.reduce((sum,turn)=>sum+
      turn.chaseCapacity*(turn.endM-turn.startM)/1000,0)};
}
