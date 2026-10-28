// Source-derived ability of the exposed chase leader on each named turn.
// This does not itself award time: a later road clock must combine it with
// every other paid bunch-front worker before moving a physical group.
import {riderKilometreEffect} from './physiology.mjs';
import {CHASE_TURNS_VERSION} from './chase-turns-v1.mjs';

export const CHASE_ROAD_PACE_VERSION='v2-chase-road-pace-1';

export function planChaseRoadPaceV1({turnPlan,teams,segment}){
  if(turnPlan?.version!==CHASE_TURNS_VERSION||
    !['worked','no_chase'].includes(turnPlan.status)||
    !Array.isArray(turnPlan.turns)||!Array.isArray(turnPlan.candidates)||
    !Array.isArray(teams)||!segment)
    throw new Error('Invalid chase road source.');
  if(turnPlan.status==='no_chase'){
    if(turnPlan.turns.length||turnPlan.candidates.length)
      throw new Error('Unpaid chase cannot set road pace.');
    return {version:CHASE_ROAD_PACE_VERSION,status:'no_chase',
      turns:[],leaderAbility:null};
  }
  const riders=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{teamId:team.id,rider,energy:team.energy?.[rider.id]??100}])));
  const candidates=new Map(turnPlan.candidates.map(row=>[row.riderId,row]));
  if(candidates.size!==turnPlan.candidates.length)
    throw new Error('Duplicate named chase road candidate.');
  let endM=0;
  const seen=new Set();
  const turns=turnPlan.turns.map(turn=>{
    const source=riders.get(turn.leaderRiderId);
    const candidate=candidates.get(turn.leaderRiderId);
    if(!source||!candidate||source.teamId!==turn.teamId||
      candidate.teamId!==turn.teamId||seen.has(turn.leaderRiderId)||
      turn.startM!==endM||
      !Number.isInteger(turn.endM)||turn.endM<=turn.startM||
      Math.abs(candidate.energy-source.energy)>.002)
      throw new Error('Chase road leader differs from committed source.');
    endM=turn.endM;
    seen.add(turn.leaderRiderId);
    const ability=riderKilometreEffect(source.rider,segment,{phase:'chase',
      energy:source.energy,exposed:segment.exposed}).ability;
    return {teamId:turn.teamId,leaderRiderId:turn.leaderRiderId,
      startM:turn.startM,endM:turn.endM,ability};
  });
  if(endM!==1000||turns.length!==candidates.size)
    throw new Error('Chase road must cover exactly one kilometre.');
  return {version:CHASE_ROAD_PACE_VERSION,status:'worked',turns,
    leaderAbility:+(turns.reduce((sum,turn)=>sum+
      turn.ability*(turn.endM-turn.startM),0)/1000).toFixed(3)};
}
