// Isolated candidate for one exposed rider at a time in an existing road group.
// It plans only the extra group-work charge. Baseline riding, contact and the
// road clock still need a separate paid version before this may govern a race.
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export function planRoadGroupTurnsV1({group,riderDecisions,teams,segment,
  activePullRiderIds=null}){
  if(!group||!Array.isArray(group.riderIds)||!group.riderIds.length||
    !Array.isArray(riderDecisions)||!Array.isArray(teams)||
    !Number.isInteger(segment?.km)||segment.km<1)
    throw new Error('Invalid road-group turn input.');
  const members=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{rider,energy:team.energy?.[rider.id]}])));
  const decisions=new Map(riderDecisions.filter(row=>row.roadGroupId===group.id)
    .map(row=>[row.riderId,row]));
  if(decisions.size!==group.riderIds.length||
    group.riderIds.some(id=>!members.has(id)||!decisions.has(id)||
      !['pull','sit_in'].includes(decisions.get(id).choice))||
    new Set(group.riderIds).size!==group.riderIds.length)
    throw new Error('Every group rider needs one valid decision.');
  if(activePullRiderIds!==null&&(!Array.isArray(activePullRiderIds)||
    new Set(activePullRiderIds).size!==activePullRiderIds.length||
    activePullRiderIds.some(id=>!decisions.has(id)||
      decisions.get(id).choice!=='pull')))
    throw new Error('Active turns must come from willing group pullers.');
  const active=activePullRiderIds===null?null:new Set(activePullRiderIds);
  const pullers=group.riderIds.filter(id=>decisions.get(id).choice==='pull'&&
    (active===null||active.has(id)));
  // No leader means this planner cannot credit the group with worked pace or
  // settle even its shelter cost. Callers must refuse a physical transition.
  if(!pullers.length)return {version:1,roadGroupId:group.id,
    status:'unsupported_unworked',turns:[],extraEnergyCosts:[]};
  const rotated=[...pullers.slice((segment.km-1)%pullers.length),
    ...pullers.slice(0,(segment.km-1)%pullers.length)];
  let metre=0;
  const turns=rotated.map((riderId,index)=>{
    const lengthM=Math.floor(1000/rotated.length)+
      (index<1000%rotated.length?1:0);
    const startM=metre;metre+=lengthM;
    const {rider,energy}=members.get(riderId);
    if(!Number.isFinite(energy)||energy<0||energy>100)
      throw new Error('Invalid leader energy.');
    return {leaderRiderId:riderId,startM,endM:metre,
      ability:riderKilometreEffect(rider,segment,{phase:'solo',energy,
        exposed:segment.exposed}).ability};
  });
  const extraEnergyCosts=group.riderIds.map(riderId=>{
    const leadingM=turns.filter(turn=>turn.leaderRiderId===riderId)
      .reduce((sum,turn)=>sum+turn.endM-turn.startM,0);
    const extraCost=+(leadingM/1000*TUNING.breakaway.extraCostPerKm+
      (1000-leadingM)/1000*TUNING.breakaway.sitOnExtraCostPerKm)
      .toFixed(6);
    const energy=members.get(riderId).energy;
    if(!Number.isFinite(energy)||energy<extraCost)
      throw new Error('Road-group turn cannot be paid.');
    return {riderId,leadingM,extraCost};
  });
  return {version:1,roadGroupId:group.id,status:'worked',turns,
    extraEnergyCosts,
    leadAbility:+(turns.reduce((sum,turn)=>
      sum+turn.ability*(turn.endM-turn.startM),0)/1000).toFixed(3)};
}
