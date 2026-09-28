import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function value(rider,key,fallback=40){
  const number=Number(rider?.[key]??fallback);
  if(!Number.isFinite(number)||number<0||number>100)throw new Error(`Invalid rider ${key}.`);
  return number;
}
const terrainSkill=terrain=>({climb:'mountain',hill:'hills',descent:'hills',flat:'flat'})[terrain]??'flat';

function readiness(team,rider){
  return clamp(Number(team.energy?.[rider.id]??100),0,100)/100;
}

function attackCandidate(team,terrain,excluded){
  const skill=terrainSkill(terrain);
  const tune=TUNING.attack;
  return team.riders.filter(rider=>!excluded.has(rider.id)).map(rider=>({rider,pressure:(value(rider,'acceleration',value(rider,'sprint'))*tune.accelerationWeight+
    value(rider,'strength')*tune.strengthWeight+value(rider,skill)*tune.terrainWeight)*(.3+.7*readiness(team,rider))}))
    .sort((a,b)=>b.pressure-a.pressure||String(a.rider.id).localeCompare(String(b.rider.id)))[0];
}

function chaseCapacity(team,terrain){
  const skill=terrainSkill(terrain);
  const tune=TUNING.chase;
  const helpers=team.riders.filter(rider=>team.orders.helperIds.includes(rider.id))
    .map(rider=>({rider,capacity:(value(rider,'strength')*tune.strengthWeight+value(rider,'endurance')*tune.enduranceWeight+
      value(rider,skill)*tune.terrainWeight)*(.25+.75*readiness(team,rider))}))
    .sort((a,b)=>b.capacity-a.capacity||String(a.rider.id).localeCompare(String(b.rider.id))).slice(0,2);
  return {helpers,capacity:helpers.reduce((sum,h)=>sum+h.capacity,0)*tune.helperCapacityFactor};
}

// Resolves the contest between planned attacks and the finite capacity of
// teams willing to chase. This is an isolated v2 model, not live race scoring.
export function resolveTacticalKilometre({teams,km,terrain='flat',gapSeconds=0,isKeypoint=false,breakawayTeamIds=[],breakawayRiderIds=[]}){
  if(!Number.isInteger(km)||km<1||!Number.isFinite(gapSeconds)||gapSeconds<0)
    throw new Error('Invalid tactical kilometre.');
  const sorted=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const attackers=[],energyCosts=[],ahead=new Set(breakawayRiderIds);
  for(const team of sorted){
    const order=orderAt(team.orders,km-1);
    const attempts=order.attack==='repeated'&&(km%TUNING.attack.repeatedEveryKm===0||isKeypoint)
      ||order.attack==='selective'&&(km%TUNING.attack.selectiveEveryKm===0||isKeypoint);
    if(!attempts)continue;
    if(team.riders.filter(r=>ahead.has(r.id)).length>=TUNING.breakaway.maxRidersPerTeam)continue;
    const chosen=attackCandidate(team,terrain,ahead);
    if(!chosen||readiness(team,chosen.rider)<.12)continue;
    attackers.push({teamId:team.id,riderId:chosen.rider.id,pressure:chosen.pressure});
    energyCosts.push({teamId:team.id,riderId:chosen.rider.id,cost:order.attack==='repeated'?TUNING.attack.repeatedCost:TUNING.attack.selectiveCost,reason:'attack'});
  }
  const attackPower=attackers.reduce((sum,a)=>sum+a.pressure,0);
  const attackingTeams=new Set([...breakawayTeamIds,...attackers.map(a=>a.teamId)]);
  const chasers=[];
  for(const team of sorted){
    if(attackingTeams.has(team.id))continue;
    const order=orderAt(team.orders,km-1);
    if(order.chase==='ignore'||attackPower===0&&gapSeconds===0)continue;
    const leadership=value(team.riders.find(r=>r.id===team.orders.roadCaptainId),'leadership',35);
    const threshold=TUNING.chase.awarenessThreshold-leadership*TUNING.chase.leadershipAwareness;
    const aware=order.chase==='all'||attackPower+gapSeconds*.5>=threshold;
    if(!aware)continue;
    const {helpers,capacity}=chaseCapacity(team,terrain);
    if(!helpers.length)continue;
    const commitment=order.chase==='all'?1:TUNING.chase.selectiveCommitment;
    chasers.push({teamId:team.id,capacity:capacity*commitment,riderIds:helpers.map(h=>h.rider.id)});
    for(const helper of helpers)energyCosts.push({teamId:team.id,riderId:helper.rider.id,
      cost:order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost,reason:'chase'});
  }
  const chasePower=chasers.reduce((sum,c)=>sum+c.capacity,0);
  const gapDelta=attackPower>0?clamp((attackPower-chasePower)*TUNING.attack.pressureToSeconds,-15,35)
    :gapSeconds>0?-Math.min(gapSeconds,chasePower*TUNING.chase.recoverySecondsPerCapacity):0;
  return {km,attackers,chasers,attackPower,chasePower,energyCosts,
    gapSeconds:+Math.max(0,gapSeconds+gapDelta).toFixed(2)};
}
