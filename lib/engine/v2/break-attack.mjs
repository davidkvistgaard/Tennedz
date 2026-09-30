import {breakAttackAt,orderAt} from './orders.mjs';
import {attackCandidate} from './tactics.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {assertRoadGroups} from './road-groups.mjs';
import {TUNING} from './tuning.mjs';

// A precommitted decision uses only the visible group, current energy and
// rider skills. It never looks at the calculated finish or future weather.
export function automaticBreakAttackRider({team,group,teams,segment,distanceKm,teamIdsAhead=[]}){
  const remaining=distanceKm-segment.km;
  if(orderAt(team.orders,segment.km-1).breakFinale!=='attack_if_outsprinted'||
    !TUNING.breakFinale.checkpointsRemainingKm.includes(remaining)||group.riderIds.length<2||
    teamIdsAhead.includes(team.id))
    return null;
  const own=team.riders.filter(rider=>group.riderIds.includes(rider.id));
  const rivals=teams.filter(other=>other.id!==team.id).flatMap(other=>
    other.riders.filter(rider=>group.riderIds.includes(rider.id)));
  if(!own.length||!rivals.length)return null;
  const ownSprint=Math.max(...own.map(rider=>rider.sprint));
  const rivalSprint=Math.max(...rivals.map(rider=>rider.sprint));
  if(rivalSprint-ownSprint<TUNING.breakFinale.sprintDisadvantage)return null;
  const excluded=new Set(team.riders.filter(rider=>!group.riderIds.includes(rider.id)||
    Number(team.energy?.[rider.id]??100)<=TUNING.breakFinale.minEnergy).map(rider=>rider.id));
  return attackCandidate(team,segment,excluded)?.rider.id??null;
}

export function selectBreakAttackAttempt(attempts,{roadGroupCount,maxRoadGroups}){
  return attempts.filter(attempt=>attempt.status==='joined_group_ahead'||
    attempt.status==='split'&&roadGroupCount<maxRoadGroups)
    .sort((a,b)=>b.attackSeconds-a.attackSeconds||
      a.riderId.localeCompare(b.riderId))[0]??null;
}

// Evaluate one team's named or precommitted conditional attack from a break.
// The caller applies the returned energy costs and road-group transition.
export function evaluateBreakAttack({group,teams,teamId,km,segment,teamIdsAhead=[],riderId:requestedRiderId}){
  assertRoadGroups([group]);
  if(!Number.isInteger(km)||km<1||segment?.km!==km)
    throw new Error('Invalid break attack segment.');
  const team=teams.find(candidate=>candidate.id===teamId);
  if(!team)throw new Error('Unknown break attack team.');
  const riderId=requestedRiderId??breakAttackAt(team.orders,km);
  if(!riderId)return null;
  const base={teamId,riderId};
  if(!group.riderIds.includes(riderId))return {...base,status:'not_in_break'};
  if(group.riderIds.length<2)return {...base,status:'solo_break'};
  const chosen=attackCandidate(team,segment,new Set(),riderId);
  if(!chosen)return {...base,status:'exhausted'};
  const attackPower=chosen.pressure*TUNING.effortPressure[orderAt(team.orders,km-1).effort];
  const defenders=[];
  const ahead=new Set(teamIdsAhead);
  for(const otherId of group.riderIds){
    if(otherId===riderId)continue;
    const otherTeam=teams.find(candidate=>candidate.riders.some(rider=>rider.id===otherId));
    // A teammate will not drive the chase against its own rider up the road.
    if(!otherTeam||otherTeam.id===teamId||ahead.has(otherTeam.id)||
      orderAt(otherTeam.orders,km-1).breakWork!=='cooperate')continue;
    const rider=otherTeam.riders.find(candidate=>candidate.id===otherId);
    const energy=Number(otherTeam.energy?.[otherId]??100);
    if(!Number.isFinite(energy)||energy<=TUNING.chase.minHelperEnergy)continue;
    const effect=riderKilometreEffect(rider,segment,{phase:'chase',energy,
      exposed:segment.exposed});
    defenders.push({riderId:otherId,teamId:otherTeam.id,power:effect.ability*(.25+.75*energy/100)});
  }
  defenders.sort((a,b)=>b.power-a.power||a.riderId.localeCompare(b.riderId));
  const working=defenders.slice(0,2);
  const responsePower=working.reduce((sum,rider)=>sum+rider.power,0)*
    TUNING.breakaway.splitResponseFactor;
  const attackSeconds=+Math.max(0,(attackPower-responsePower)*
    TUNING.breakaway.splitSecondsPerPoint).toFixed(2);
  return {...base,status:attackSeconds>=.01?'split':'contained',attackPower,responsePower,
    attackSeconds,repeatLoad:chosen.repeatLoad,
    defenderRiderIds:working.map(rider=>rider.riderId),
    energyCosts:[{teamId,riderId,cost:TUNING.attack.selectiveCost,reason:'attack'},
      ...working.map(rider=>({teamId:rider.teamId,riderId:rider.riderId,
        cost:TUNING.chase.selectiveCost,reason:'chase'}))]};
}
