// Version the existing forward-group choice against the committed rider,
// team order and sporting stake. The checkpoint group is not a physical wheel.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';

export const V94_ROAD_GROUP_RIDER_DECISIONS_VERSION=
  'v94-road-group-rider-decisions-1';

export function sourceV94RoadGroupRiderDecisionsV1({
  decisions,groups,teams,intent,priorRiderStates,segment}){
  const km=segment?.km;
  if(!Number.isInteger(km)||km<1||
    !Array.isArray(decisions)||!Array.isArray(groups)||
    !Array.isArray(teams)||!Array.isArray(intent)||
    !Array.isArray(priorRiderStates)||
    intent.length!==teams.length)
    throw new Error('Invalid V94 forward decision source.');
  const members=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{team,rider}])));
  const stakes=new Map(intent.map(row=>[row.teamId,row]));
  const states=new Map(priorRiderStates.map(row=>[row.id,row]));
  const groupsByRider=new Map(groups.flatMap(group=>
    group.riderIds.map(riderId=>[riderId,group.id])));
  if(members.size!==teams.reduce((sum,team)=>
    sum+team.riders.length,0)||
    stakes.size!==teams.length||
    states.size!==priorRiderStates.length||
    groupsByRider.size!==groups.reduce((sum,group)=>
      sum+group.riderIds.length,0)||
    decisions.length!==groupsByRider.size||
    new Set(decisions.map(row=>row.riderId)).size!==decisions.length)
    throw new Error('Incomplete V94 forward decision source.');
  return decisions.map(row=>{
    const member=members.get(row.riderId);
    const stake=stakes.get(row.teamId);
    const state=states.get(row.riderId);
    if(!member||member.team.id!==row.teamId||
      groupsByRider.get(row.riderId)!==row.roadGroupId||
      !state||state.group!=='breakaway'||
      !Number.isFinite(state.energy)||state.energy<0||
      !Number.isFinite(member.team.energy[row.riderId])||
      Math.abs(member.team.energy[row.riderId]-state.energy)>.001||
      !stake||stake.teamId!==row.teamId||
      typeof stake.sportingGoal!=='string'||
      !member.team.riders.some(rider=>
        rider.id===stake.sportingCaptainId)||
      !['pull','sit_in'].includes(row.choice)||
      typeof row.reason!=='string'||!row.reason)
      throw new Error('Forward choice differs from committed source.');
    const order=orderAt(member.team.orders,km-1);
    const perceivedAbility=riderKilometreEffect(member.rider,segment,{
      phase:row.choice==='pull'?'solo':'cruise',
      energy:state.energy,exposed:segment.exposed}).ability;
    return {...row,version:V94_ROAD_GROUP_RIDER_DECISIONS_VERSION,
      sourceKm:km,goal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      teamOrderEffort:order.effort,
      teamOrderBreakWork:order.breakWork,
      perceivedAbility:+perceivedAbility.toFixed(3),
      energyBefore:state.energy};
  });
}
