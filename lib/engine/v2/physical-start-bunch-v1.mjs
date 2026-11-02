// First-kilometre physical source: all starters share the start line.
// A named front worker pays for the pace; every other rider pays shelter.
// An unsupported attack, chase or wheel loss refuses before road movement.
import {isDeepStrictEqual} from 'node:util';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const PHYSICAL_START_BUNCH_VERSION=
  'v2-physical-start-bunch-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Physical start needs valid road pace.');
  return 3600/seconds;
};
const terrainLoad=segment=>1+Math.max(0,segment.gradientPct)*.035+
  (segment.surface==='road'?0:.15);

export function startPhysicalBunchV1({teams,routeKilometres,
  commitment,raceSeed}){
  if(!Array.isArray(teams)||teams.length<2||
    !Array.isArray(routeKilometres)||
    routeKilometres.length!==commitment?.distanceKm||
    routeKilometres.some((segment,index)=>segment?.km!==index+1)||
    typeof raceSeed!=='string'||!raceSeed||
    !isDeepStrictEqual(commitment.roster,teams.map(team=>({
      teamId:team.id,riderIds:team.riders.map(rider=>rider.id)}))))
    throw new Error('Physical start needs committed field and route.');
  const riderIds=teams.flatMap(team=>team.riders.map(row=>row.id));
  if(new Set(riderIds).size!==riderIds.length||
    riderIds.length!==teams.length*8)
    throw new Error('Physical start needs unique eight-rider teams.');
  const energyByRider={};
  for(const team of teams)for(const rider of team.riders){
    const initial=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:0}).initialCap;
    if(!Number.isFinite(team.energy?.[rider.id])||
      Math.abs(team.energy[rider.id]-initial)>1e-6)
      throw new Error('Physical start energy differs from committed rider.');
    energyByRider[rider.id]=initial;
  }
  return {version:PHYSICAL_START_BUNCH_VERSION,
    raceSeed,atDistanceM:0,sourceKm:0,
    riderIds,energyByRider,
    quietKmByRider:Object.fromEntries(riderIds.map(id=>[id,0])),
    elapsedSeconds:0,officialResults:false};
}

export function advancePhysicalStartBunchV1({startInput,start,
  segment}){
  if(!isDeepStrictEqual(start,startPhysicalBunchV1(startInput))||
    !isDeepStrictEqual(segment,startInput.routeKilometres[0])||
    segment?.km!==1)
    throw new Error('First bunch kilometre needs replayed start source.');
  const {teams,commitment,routeKilometres}=startInput;
  const ordered=teams.map(team=>({team,
    order:orderAt(team.orders,0),
    stake:teamChaseStakeAtKmV1({commitment,teamId:team.id,km:1})}));
  if(ordered.some(({order})=>order.attack!=='none'||
    order.chase!=='ignore')||
    ordered.filter(({order})=>order.frontWork==='rotate').length!==1)
    throw new Error('First bunch road needs one ordered front worker.');
  const {team:frontTeam,order:frontOrder}=ordered.find(({order})=>
    order.frontWork==='rotate');
  const leaderId=frontOrder.frontWorkRiderId;
  const leader=frontTeam.riders.find(row=>row.id===leaderId);
  if(!leader||!frontTeam.orders.helperIds.includes(leaderId))
    throw new Error('First bunch road needs a named helper leader.');
  const byId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,{rider,team}])));
  const leaderEffect=riderKilometreEffect(leader,segment,{
    phase:'cruise',energy:start.energyByRider[leaderId],
    exposed:segment.exposed});
  const adjustment=frontOrder.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[frontOrder.effort];
  const base=segmentBaseSeconds(segment);
  const leaderAbility=leaderEffect.ability+adjustment;
  const bunchSpeedKph=speed(base,leaderAbility);
  const load=terrainLoad(segment);
  const riderDecisions=[];
  const riders=start.riderIds.map(riderId=>{
    const {rider,team}=byId.get(riderId);
    const {order,stake}=ordered.find(row=>row.team.id===team.id);
    const leading=riderId===leaderId;
    const before=start.energyByRider[riderId];
    const effect=leading?leaderEffect:riderKilometreEffect(rider,
      segment,{phase:'cruise',energy:before,
        exposed:segment.exposed});
    const holdAbility=leading?leaderAbility:effect.ability+
      (TUNING.effortPressure[order.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage;
    if(holdAbility+1e-9<leaderAbility)
      throw new Error('Physical start follower cannot hold paid pace.');
    const workerExtra=leading?(order.effort==='hard'?
      TUNING.groups.hardPaceWorkerExtraCostPerKm:
      order.effort==='steady'?
        TUNING.groups.steadyPaceWorkerExtraCostPerKm:
        MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm):0;
    const spent=(TUNING.effortCost[order.effort]*load*
      (leading?1:DRAFT_COST_FRACTION)+workerExtra)*
      effect.energyCostMultiplier;
    if(spent>before+1e-9)
      throw new Error('Physical start rider cannot pay road.');
    const recovery=recoveryForKilometre({rider,segment,
      effort:order.effort,group:'peloton',working:leading,
      quietKm:start.quietKmByRider[riderId]});
    const cap=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:1}).cap;
    const energyAfter=+Math.min(cap,before-spent+
      recovery.recovery).toFixed(3);
    riderDecisions.push({riderId,teamId:team.id,
      goal:stake.goal,choice:leading?'pull':'shelter',
      reason:leading?'committed_front_work':'hold_start_wheel',
      effort:order.effort});
    return {riderId,role:leading?'leader':'sheltered',
      energyBefore:before,energySpent:spent,
      recoveryAward:recovery.recovery,cap,energyAfter,
      quietKm:recovery.quietKm,holdAbility};
  });
  return {version:PHYSICAL_START_BUNCH_VERSION,
    sourceKm:1,startDistanceM:0,endDistanceM:1000,
    leaderRiderId:leaderId,bunchSpeedKph,
    elapsedSeconds:3600/bunchSpeedKph,
    riderDecisions,riders,
    physicalGroup:{id:'peloton',atDistanceM:1000,
      riderIds:[...start.riderIds]},
    energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energyAfter])),
    quietKmByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.quietKm])),
    officialResults:false};
}

export function validatePhysicalStartBunchV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalStartBunchV1(input)))
    throw new Error('Physical start differs from committed road.');
  return true;
}
