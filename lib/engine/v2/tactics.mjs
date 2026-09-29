import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';
import {riderKilometreEffect,sportingSkills} from './physiology.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function median(values){
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function value(rider,key,fallback=40){
  const number=Number(rider?.[key]??fallback);
  if(!Number.isFinite(number)||number<0||number>100)throw new Error(`Invalid rider ${key}.`);
  return number;
}
const terrainSkill=terrain=>({climb:'mountain',hill:'hills',descent:'descending',flat:'flat'})[terrain]??'flat';

function environmentalFactor(rider,segment,phase,energy){
  const neutral={...segment,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const reference=riderKilometreEffect(rider,neutral,{phase,energy,exposed:false}).ability;
  if(reference<=0)return 1;
  return riderKilometreEffect(rider,segment,{phase,energy,exposed:segment.exposed}).ability/reference;
}

function readiness(team,rider){
  return clamp(Number(team.energy?.[rider.id]??100),0,100)/100;
}

function attackCandidate(team,segment,excluded,preferredId=null){
  const skill=terrainSkill(segment.terrain);
  const tune=TUNING.attack;
  return team.riders.filter(rider=>(preferredId===null||rider.id===preferredId)&&!excluded.has(rider.id)&&
    readiness(team,rider)>=tune.minEnergyFraction).map(rider=>{
    const skills=sportingSkills(rider);
    return {rider,pressure:(skills.acceleration*tune.accelerationWeight+
      skills.strength*tune.strengthWeight+skills[skill]*tune.terrainWeight)*(.3+.7*readiness(team,rider))*
      environmentalFactor(rider,segment,'attack',Number(team.energy?.[rider.id]??100))};
  })
    .sort((a,b)=>b.pressure-a.pressure||String(a.rider.id).localeCompare(String(b.rider.id)))[0];
}

function chaseCapacity(team,segment,unavailable){
  const skill=terrainSkill(segment.terrain);
  const tune=TUNING.chase;
  const helpers=team.riders.filter(rider=>team.orders.helperIds.includes(rider.id)&&
    !unavailable.has(rider.id)&&Number(team.energy?.[rider.id]??100)>tune.minHelperEnergy)
    .map(rider=>{
      const skills=sportingSkills(rider);
      return {rider,capacity:(skills.strength*tune.strengthWeight+skills.endurance*tune.enduranceWeight+
        skills[skill]*tune.terrainWeight)*(.25+.75*readiness(team,rider))*
        environmentalFactor(rider,segment,'chase',Number(team.energy?.[rider.id]??100))};
    })
    .sort((a,b)=>b.capacity-a.capacity||String(a.rider.id).localeCompare(String(b.rider.id))).slice(0,2);
  return {helpers,capacity:helpers.reduce((sum,h)=>sum+h.capacity,0)*tune.helperCapacityFactor};
}

function passiveBreakGapDelta(teams,ahead,dropped,segment,km){
  if(!ahead.size)return {delta:0,pullRiderIds:[]};
  const breakAbilities=[],pullAbilities=[],pullRiderIds=[],bunchAbilities=[];
  for(const team of teams)for(const rider of team.riders){
    const isAhead=ahead.has(rider.id);
    if(!isAhead&&dropped.has(rider.id))continue;
    const ability=riderKilometreEffect(rider,segment,{phase:isAhead?'solo':'cruise',
      energy:Number(team.energy?.[rider.id]??100),exposed:segment.exposed}).ability;
    if(isAhead){
      breakAbilities.push(ability);
      if(orderAt(team.orders,km-1).breakWork==='cooperate'){
        pullAbilities.push(ability);pullRiderIds.push(rider.id);
      }
    }else bunchAbilities.push(ability);
  }
  if(!breakAbilities.length||!bunchAbilities.length)return {delta:0,pullRiderIds};
  const tune=TUNING.breakaway;
  const cooperation=Math.min(Math.max(0,pullAbilities.length-1),tune.maxCooperatingRiders)*
    tune.cooperationPerExtraRider;
  const breakPace=pullAbilities.length?
    pullAbilities.reduce((sum,ability)=>sum+ability,0)/pullAbilities.length+cooperation:
    breakAbilities.reduce((sum,ability)=>sum+ability,0)/breakAbilities.length-tune.noWorkPenaltyPoints;
  const bunchPace=median(bunchAbilities)+tune.bunchDraftAdvantage;
  return {delta:+clamp((breakPace-bunchPace)*tune.driftSecondsPerAbilityPoint,
    -tune.maxPassiveLossSecondsPerKm,tune.maxPassiveGainSecondsPerKm).toFixed(2),pullRiderIds};
}

// Resolves the contest between planned attacks and the finite capacity of
// teams willing to chase. This is an isolated v2 model, not live race scoring.
export function resolveTacticalKilometre({teams,km,terrain='flat',gapSeconds=0,isKeypoint=false,
  breakawayTeamIds=[],breakawayRiderIds=[],droppedRiderIds=[],engagedChaseTeamIds=[],distanceKm=null,segment=null}){
  if(!Number.isInteger(km)||km<1||!Number.isFinite(gapSeconds)||gapSeconds<0)
    throw new Error('Invalid tactical kilometre.');
  if(distanceKm!==null&&(!Number.isInteger(distanceKm)||distanceKm<km))throw new Error('Invalid finale distance.');
  const environment=segment??{terrain,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const sorted=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const attackers=[],blockedAttacks=[],energyCosts=[],ahead=new Set(breakawayRiderIds),
    dropped=new Set(droppedRiderIds),unavailable=new Set([...ahead,...dropped]);
  for(const team of sorted){
    const order=orderAt(team.orders,km-1);
    const attempts=order.attack==='repeated'&&(km%TUNING.attack.repeatedEveryKm===0||isKeypoint)
      ||order.attack==='selective'&&(km%TUNING.attack.selectiveEveryKm===0||isKeypoint);
    if(!attempts)continue;
    if(team.riders.filter(r=>ahead.has(r.id)).length>=TUNING.breakaway.maxRidersPerTeam){
      blockedAttacks.push({teamId:team.id,riderId:order.attackRiderId??null,reason:'team_break_limit'});
      continue;
    }
    const preferredId=order.attackRiderId??null;
    const chosen=attackCandidate(team,environment,unavailable,preferredId);
    if(!chosen){
      const preferred=team.riders.find(rider=>rider.id===preferredId);
      const reason=preferredId===null?'no_available_rider':ahead.has(preferredId)?'already_ahead':
        dropped.has(preferredId)?'dropped':preferred&&readiness(team,preferred)<TUNING.attack.minEnergyFraction?
          'exhausted':'rider_unavailable';
      blockedAttacks.push({teamId:team.id,riderId:preferredId,reason});
      continue;
    }
    attackers.push({teamId:team.id,riderId:chosen.rider.id,
      pressure:chosen.pressure*TUNING.effortPressure[order.effort]});
    energyCosts.push({teamId:team.id,riderId:chosen.rider.id,cost:order.attack==='repeated'?TUNING.attack.repeatedCost:TUNING.attack.selectiveCost,reason:'attack'});
  }
  const attackPower=attackers.reduce((sum,a)=>sum+a.pressure,0);
  const attackingTeams=new Set([...breakawayTeamIds,...attackers.map(a=>a.teamId)]);
  const chasers=[],engaged=[];
  for(const team of sorted){
    if(attackingTeams.has(team.id))continue;
    const planned=orderAt(team.orders,km-1);
    const order=team.breakResponseActive?{...planned,chase:'all'}:planned;
    if(order.chase==='ignore'||attackPower===0&&gapSeconds===0)continue;
    const leadership=value(team.riders.find(r=>r.id===team.orders.roadCaptainId),'leadership',35);
    const threshold=TUNING.chase.awarenessThreshold-leadership*TUNING.chase.leadershipAwareness;
    const aware=order.chase==='all'||engagedChaseTeamIds.includes(team.id)||attackPower+gapSeconds*.5>=threshold;
    if(!aware)continue;
    const {helpers,capacity}=chaseCapacity(team,environment,unavailable);
    if(!helpers.length)continue;
    engaged.push(team.id);
    const commitment=order.chase==='all'?1:TUNING.chase.selectiveCommitment;
    const remainingKm=distanceKm===null?Infinity:distanceKm-km;
    const finale=TUNING.finale;
    const sprintTrainFactor=team.orders.preset==='protect'&&remainingKm<finale.sprintTrainWindowKm
      ?1+(finale.sprintTrainMaxFactor-1)*(finale.sprintTrainWindowKm-remainingKm)/finale.sprintTrainWindowKm:1;
    chasers.push({teamId:team.id,capacity:capacity*commitment*TUNING.effortPressure[order.effort]*sprintTrainFactor,
      riderIds:helpers.map(h=>h.rider.id)});
    for(const helper of helpers)energyCosts.push({teamId:team.id,riderId:helper.rider.id,
      cost:(order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost)*sprintTrainFactor,reason:'chase'});
  }
  const chasePower=chasers.reduce((sum,c)=>sum+c.capacity,0);
  const bridgeTooFar=gapSeconds>TUNING.breakaway.maxBridgeGapSeconds;
  // The prototype tracks one break group. A fresh attacker cannot instantly
  // arrive in a distant break or lend that group speed from the bunch.
  const effectiveAttackPower=bridgeTooFar?0:attackPower;
  const gapDelta=effectiveAttackPower>0?clamp((effectiveAttackPower-chasePower)*TUNING.attack.pressureToSeconds,-15,35)
    :gapSeconds>0?-Math.min(gapSeconds,chasePower*TUNING.chase.recoverySecondsPerCapacity):0;
  const {delta:passiveGapDelta,pullRiderIds}=gapSeconds>0?
    passiveBreakGapDelta(sorted,ahead,dropped,environment,km):{delta:0,pullRiderIds:[]};
  const nextGapSeconds=+Math.max(0,gapSeconds+gapDelta+passiveGapDelta).toFixed(2);
  // An attempted attack cannot join an existing break merely because that
  // break remains ahead after the peloton neutralises this new move.
  const joinedBreakawayRiderIds=!bridgeTooFar&&nextGapSeconds>0&&attackPower>chasePower
    ?attackers.map(attacker=>attacker.riderId):[];
  const failedBridgeRiderIds=bridgeTooFar?attackers.map(attacker=>attacker.riderId):[];
  return {km,attackers,blockedAttacks,chasers,engagedChaseTeamIds:engaged,attackPower,chasePower,energyCosts,
    joinedBreakawayRiderIds,failedBridgeRiderIds,pullRiderIds,passiveGapDelta,gapSeconds:nextGapSeconds};
}
