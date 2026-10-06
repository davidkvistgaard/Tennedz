import {orderAt} from './orders.mjs';
import {TUNING,TUNING_VERSION,MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
  MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION,MOTOR_CANDIDATE,MOTOR_FINALE} from './tuning.mjs';
import {projectNetChaseGap} from './chase-gap-candidate.mjs';
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

export function attackCandidate(team,segment,excluded,preferredId=null){
  const skill=terrainSkill(segment.terrain);
  const tune=TUNING.attack;
  return team.riders.filter(rider=>(preferredId===null||rider.id===preferredId)&&!excluded.has(rider.id)&&
    readiness(team,rider)>=tune.minEnergyFraction).map(rider=>{
    const skills=sportingSkills(rider);
    const repeatLoad=Number(team.attackLoad?.[rider.id]??0);
    if(!Number.isFinite(repeatLoad)||repeatLoad<0)throw new Error('Invalid repeated attack load.');
    const loadPenalty=Math.min(tune.maxLoadPenalty,repeatLoad*tune.pressurePenaltyPerLoad*
      (1-skills.repeatability/100*tune.repeatabilityProtection));
    return {rider,repeatLoad,pressure:(skills.acceleration*tune.accelerationWeight+
      skills.strength*tune.strengthWeight+skills[skill]*tune.terrainWeight)*(.3+.7*readiness(team,rider))*
      environmentalFactor(rider,segment,'attack',Number(team.energy?.[rider.id]??100))*(1-loadPenalty)};
  })
    .sort((a,b)=>b.pressure-a.pressure||String(a.rider.id).localeCompare(String(b.rider.id)))[0];
}

export function reservedAttackRiderIds(team,order,leaderDropped=false){
  const policy=order.helperAttackPolicy??'open';
  return policy==='hold_for_captain'||
    policy==='release_if_dropped'&&!leaderDropped?
    team.orders.helperIds:[];
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

function passiveBreakGapDelta(teams,ahead,rearGroup,dropped,segment,km,activePulls,paidPaceAbility=null){
  if(!ahead.size)return {delta:0,unpaidDelta:0,pullRiderIds:[]};
  const breakAbilities=[],pullAbilities=[],pullRiderIds=[],bunchAbilities=[];
  for(const team of teams)for(const rider of team.riders){
    const isAhead=ahead.has(rider.id);
    if(!isAhead&&dropped.has(rider.id))continue;
    const ability=riderKilometreEffect(rider,segment,{phase:isAhead?'solo':'cruise',
      energy:Number(team.energy?.[rider.id]??100),exposed:segment.exposed}).ability;
    if(isAhead){
      if(rearGroup.has(rider.id))breakAbilities.push(ability);
      if(activePulls?activePulls.has(rider.id):
        orderAt(team.orders,km-1).breakWork!=='sit_on'){
        if(rearGroup.has(rider.id))pullAbilities.push(ability+
          (orderAt(team.orders,km-1).breakWork==='drive'?
            TUNING.breakaway.driveAbilityBonusPoints:0));
        pullRiderIds.push(rider.id);
      }
    }else bunchAbilities.push(ability);
  }
  if(!breakAbilities.length||!bunchAbilities.length)
    return {delta:0,unpaidDelta:0,pullRiderIds};
  const tune=TUNING.breakaway;
  const cooperation=Math.min(Math.max(0,pullAbilities.length-1),tune.maxCooperatingRiders)*
    tune.cooperationPerExtraRider;
  const breakPace=pullAbilities.length?
    pullAbilities.reduce((sum,ability)=>sum+ability,0)/pullAbilities.length+cooperation:
    breakAbilities.reduce((sum,ability)=>sum+ability,0)/breakAbilities.length-tune.noWorkPenaltyPoints;
  const baselineBunchAbility=median(bunchAbilities);
  const bunchPace=Math.max(baselineBunchAbility,paidPaceAbility??0)+tune.bunchDraftAdvantage;
  const unpaidDelta=+clamp((breakPace-baselineBunchAbility-tune.bunchDraftAdvantage)*
    tune.driftSecondsPerAbilityPoint,-tune.maxPassiveLossSecondsPerKm,
    tune.maxPassiveGainSecondsPerKm).toFixed(2);
  return {delta:+clamp((breakPace-bunchPace)*tune.driftSecondsPerAbilityPoint,
    -tune.maxPassiveLossSecondsPerKm,tune.maxPassiveGainSecondsPerKm).toFixed(2),
  pullRiderIds,unpaidDelta};
}

function paidBunchPace(teams,ahead,unavailable,segment,km){
  const options=[];
  for(const team of teams){
    const order=orderAt(team.orders,km-1);
    if(!['hard','steady'].includes(order.effort)||order.attack!=='none'||
      order.chase!=='ignore'||team.riders.some(rider=>ahead.has(rider.id)))continue;
    const workers=team.riders.filter(rider=>team.orders.helperIds.includes(rider.id)&&
      !unavailable.has(rider.id)&&Number(team.energy?.[rider.id]??100)>TUNING.chase.minHelperEnergy)
      .map(rider=>({id:rider.id,ability:riderKilometreEffect(rider,segment,{phase:'cruise',
        energy:Number(team.energy?.[rider.id]??100),exposed:segment.exposed}).ability}))
      .sort((a,b)=>b.ability-a.ability||String(a.id).localeCompare(String(b.id)));
    if(workers.length<2)continue;
    const pair=workers.slice(0,2);
    options.push({teamId:team.id,effort:order.effort,riderIds:pair.map(rider=>rider.id),
      ability:(pair[0].ability+pair[1].ability)/2+
        TUNING.groups.frontPaceAdjustmentPoints[order.effort]});
  }
  return options.sort((a,b)=>b.ability-a.ability||String(a.teamId).localeCompare(String(b.teamId)))[0]??null;
}

// Resolves the contest between planned attacks and the finite capacity of
// teams willing to chase. This is an isolated v2 model, not live race scoring.
export function resolveTacticalKilometre({teams,km,terrain='flat',gapSeconds=0,
  leadingGapSeconds=gapSeconds,isKeypoint=false,
  breakawayTeamIds=[],breakawayRiderIds=[],droppedRiderIds=[],recentlyCaughtRiderIds=[],
  rearRoadGroupRiderIds=null,roadGroupPullRiderIds=null,supportingRiderIds=[],
  engagedChaseTeamIds=[],distanceKm=null,segment=null,resolutionVersion=TUNING_VERSION}){
  if(![TUNING_VERSION,MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
    MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION].includes(resolutionVersion))
    throw new Error('Unknown tactical resolution version.');
  const candidate=resolutionVersion!==TUNING_VERSION;
  const paidPaceCandidate=[MOTOR_PAID_PACE_VERSION,MOTOR_FINALE_VERSION,
    MOTOR_BRIDGE_FINALE_VERSION]
    .includes(resolutionVersion);
  const boundedFinale=[MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION]
    .includes(resolutionVersion);
  if(!Number.isInteger(km)||km<1||!Number.isFinite(gapSeconds)||gapSeconds<0||
    !Number.isFinite(leadingGapSeconds)||leadingGapSeconds<gapSeconds)
    throw new Error('Invalid tactical kilometre.');
  if(distanceKm!==null&&(!Number.isInteger(distanceKm)||distanceKm<km))throw new Error('Invalid finale distance.');
  const environment=segment??{terrain,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const sorted=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const attackers=[],blockedAttacks=[],energyCosts=[],releasedHelperAttackRiderIds=[],
    ahead=new Set(breakawayRiderIds),
    dropped=new Set(droppedRiderIds),recentlyCaught=new Set(recentlyCaughtRiderIds),
    unavailable=new Set([...ahead,...dropped,...recentlyCaught,...supportingRiderIds]);
  const rearGroup=new Set(rearRoadGroupRiderIds??breakawayRiderIds);
  if(rearRoadGroupRiderIds!==null&&(!Array.isArray(rearRoadGroupRiderIds)||
    rearGroup.size!==rearRoadGroupRiderIds.length||
    [...rearGroup].some(id=>!ahead.has(id))||
    gapSeconds>0&&ahead.size>0&&rearGroup.size===0))
    throw new Error('Invalid rear road-group riders.');
  const activePulls=roadGroupPullRiderIds===null?null:new Set(roadGroupPullRiderIds);
  if(roadGroupPullRiderIds!==null&&(!Array.isArray(roadGroupPullRiderIds)||
    activePulls.size!==roadGroupPullRiderIds.length||
    [...activePulls].some(id=>!ahead.has(id))))
    throw new Error('Invalid road-group workers.');
  for(const team of sorted){
    const planned=orderAt(team.orders,km-1);
    const order=team.gcTargetActive?{...planned,attack:'selective',
      attackRiderId:team.activeLeaderId??team.orders.captainId,effort:'hard'}:planned;
    const attempts=order.attack==='repeated'&&(km%TUNING.attack.repeatedEveryKm===0||isKeypoint)
      ||order.attack==='selective'&&(km%TUNING.attack.selectiveEveryKm===0||isKeypoint);
    // The coarse kilometre step cannot award a full-kilometre gap to a
    // preset-cadence move at the line. A committed phase remains valid.
    const committedFinale=order.attackRiderId!=null||team.orders.phases.some(phase=>
      phase.atKm<=km-1&&phase.attack===order.attack);
    if(!attempts||candidate&&distanceKm!==null&&km===distanceKm&&!committedFinale)continue;
    if(team.riders.filter(r=>ahead.has(r.id)).length>=TUNING.breakaway.maxRidersPerTeam){
      blockedAttacks.push({teamId:team.id,riderId:order.attackRiderId??null,reason:'team_break_limit'});
      continue;
    }
    const preferredId=order.attackRiderId??null;
    // An explicitly named attacker overrides the general helper policy.
    const leaderDropped=dropped.has(team.activeLeaderId??team.orders.captainId);
    const reserved=preferredId===null?[
      ...reservedAttackRiderIds(team,order,leaderDropped),
      ...(team.orders.gcObjective==='defend_top_ten'?
        [team.activeLeaderId??team.orders.captainId]:[]),
    ]:[];
    const chosen=attackCandidate(team,environment,
      new Set([...unavailable,...reserved]),preferredId);
    if(!chosen){
      const preferred=team.riders.find(rider=>rider.id===preferredId);
      const reason=preferredId===null?'no_available_rider':ahead.has(preferredId)?'already_ahead':
        dropped.has(preferredId)?'dropped':recentlyCaught.has(preferredId)?'recently_caught':
        preferred&&readiness(team,preferred)<TUNING.attack.minEnergyFraction?
          'exhausted':'rider_unavailable';
      blockedAttacks.push({teamId:team.id,riderId:preferredId,reason});
      continue;
    }
    attackers.push({teamId:team.id,riderId:chosen.rider.id,
      pressure:chosen.pressure*TUNING.effortPressure[order.effort],repeatLoad:chosen.repeatLoad,
      reason:team.gcTargetActive?'gc_target':preferredId!==null?'named_order':
        isKeypoint?'keypoint':'preset_cadence'});
    if(preferredId===null&&order.helperAttackPolicy==='release_if_dropped'&&
      leaderDropped&&team.orders.helperIds.includes(chosen.rider.id))
      releasedHelperAttackRiderIds.push(chosen.rider.id);
    energyCosts.push({teamId:team.id,riderId:chosen.rider.id,cost:order.attack==='repeated'?TUNING.attack.repeatedCost:TUNING.attack.selectiveCost,reason:'attack'});
  }
  const attackPower=attackers.reduce((sum,a)=>sum+a.pressure,0);
  const attackingTeams=new Set(attackers.map(a=>a.teamId));
  const chasers=[],engaged=[],heldChaseTeamIds=[],withheldChaseTeamIds=[],releasedForwardTeamIds=[],
    gcCounterTeamIds=[];
  const remainingKm=distanceKm===null?Infinity:distanceKm-km;
  const safeGap=!Number.isFinite(remainingKm)?0:Math.min(TUNING.chase.maxSafeGapSeconds,
    remainingKm*TUNING.chase.safeGapSecondsPerRemainingKm);
  for(const team of sorted){
    const planned=orderAt(team.orders,km-1);
    const ownAhead=team.riders.filter(rider=>ahead.has(rider.id));
    const fadingBreak=ownAhead.length>0&&
      team.orders.forwardResponse==='chase_if_fading'&&planned.chase!=='ignore'&&
      !ahead.has(team.activeLeaderId??team.orders.captainId)&&
      gapSeconds>0&&gapSeconds<=TUNING.teamIntent.maxFadingBreakGapSeconds&&
      ownAhead.every(rider=>rearGroup.has(rider.id)&&
        Number(team.energy?.[rider.id]??100)<=TUNING.teamIntent.fadingRiderEnergy);
    const gcEmergency=team.gcResponseActive&&
      !ahead.has(team.activeLeaderId??team.orders.captainId);
    if(attackingTeams.has(team.id)||
      (breakawayTeamIds.includes(team.id)||ownAhead.length)&&
      !fadingBreak&&!gcEmergency)continue;
    const gcCounter=attackers.some(attacker=>
      team.gcGuardRiderIds?.includes(attacker.riderId));
    const order=team.breakResponseActive||team.gcResponseActive||gcCounter||fadingBreak?
      {...planned,chase:'all'}:planned;
    if(order.chase==='ignore'){
      if(attackPower>0||gapSeconds>0)withheldChaseTeamIds.push(team.id);
      continue;
    }
    if(attackPower===0&&gapSeconds===0)continue;
    const leadership=value(team.riders.find(r=>r.id===team.orders.roadCaptainId),'leadership',35);
    const threshold=TUNING.chase.awarenessThreshold-leadership*TUNING.chase.leadershipAwareness;
    const aware=order.chase==='all'||engagedChaseTeamIds.includes(team.id)||attackPower+gapSeconds*.5>=threshold;
    if(!aware)continue;
    // A selective team with no fresh attack to answer lets a manageable gap
    // stand into the race. A bounded time guard keeps it from waiting so long
    // that the finish becomes uncatchable; an all-out order bypasses the wait.
    // The nearest chasing group can look safe while the race leader is
    // already escaping. A sprint team judges its wait against the front.
    if(order.chase==='selective'&&attackPower===0&&gapSeconds>0&&
      distanceKm!==null&&leadingGapSeconds<=safeGap){
      heldChaseTeamIds.push(team.id);
      continue;
    }
    const {helpers,capacity}=chaseCapacity(team,environment,unavailable);
    if(!helpers.length)continue;
    engaged.push(team.id);
    const commitment=order.chase==='all'?1:TUNING.chase.selectiveCommitment;
    const finale=TUNING.finale;
    const sprintTrainFactor=team.orders.preset==='protect'&&remainingKm<finale.sprintTrainWindowKm
      ?1+(finale.sprintTrainMaxFactor-1)*(finale.sprintTrainWindowKm-remainingKm)/finale.sprintTrainWindowKm:1;
    const reason=gcCounter?'gc_counter':gcEmergency?'gc_defense':
      team.breakResponseActive?'road_captain_response':fadingBreak?'fading_teammate':
        planned.chase==='all'?'ordered_all':attackPower>0?'fresh_attack':'gap_over_limit';
    chasers.push({teamId:team.id,reason,
      capacity:capacity*commitment*TUNING.effortPressure[order.effort]*sprintTrainFactor,
      riderIds:helpers.map(h=>h.rider.id)});
    if(gcCounter)gcCounterTeamIds.push(team.id);
    if(fadingBreak)releasedForwardTeamIds.push(team.id);
    for(const helper of helpers)energyCosts.push({teamId:team.id,riderId:helper.rider.id,
      cost:(order.chase==='all'?TUNING.chase.allCost:TUNING.chase.selectiveCost)*sprintTrainFactor,reason:'chase'});
  }
  const chasePower=chasers.reduce((sum,c)=>sum+c.capacity,0);
  const bridgeTooFar=gapSeconds>TUNING.breakaway.maxBridgeGapSeconds;
  // Gap and bridge pressure refer to the rearmost group; a fresh attacker
  // cannot instantly arrive in a distant group or lend it speed from the bunch.
  const effectiveAttackPower=bridgeTooFar?0:attackPower;
  const rawAttackGap=(effectiveAttackPower-chasePower)*TUNING.attack.pressureToSeconds;
  // The final kilometre includes the sprint: a fresh move cannot spend a
  // whole kilometre building a solo lead. Existing road gaps remain intact.
  const freshGap=boundedFinale&&distanceKm!==null&&km===distanceKm&&rawAttackGap>0?
    Math.min(rawAttackGap*MOTOR_FINALE.lastKilometreAttackSecondsFactor,
      MOTOR_FINALE.maxFreshGapSeconds):rawAttackGap;
  const gapDelta=effectiveAttackPower>0?clamp(freshGap,-15,35)
    :gapSeconds>0?-Math.min(gapSeconds,chasePower*TUNING.chase.recoverySecondsPerCapacity):0;
  const proposedPace=paidPaceCandidate&&gapSeconds>0?
    paidBunchPace(sorted,ahead,new Set([...unavailable,
      ...attackers.map(row=>row.riderId),...chasers.flatMap(row=>row.riderIds)]),
      environment,km):null;
  const {delta:passiveGapDelta,unpaidDelta,pullRiderIds}=gapSeconds>0?
    passiveBreakGapDelta(sorted,ahead,rearGroup,dropped,environment,km,activePulls,
      proposedPace?.ability??null):
    {delta:0,unpaidDelta:0,pullRiderIds:[]};
  const paidPace=proposedPace&&passiveGapDelta<unpaidDelta?proposedPace:null;
  if(paidPace)for(const riderId of paidPace.riderIds)energyCosts.push({
    teamId:paidPace.teamId,riderId,
    cost:paidPace.effort==='hard'?TUNING.groups.hardPaceWorkerExtraCostPerKm:
      TUNING.groups.steadyPaceWorkerExtraCostPerKm,reason:'cruise'});
  const nextGapSeconds=+(candidate&&effectiveAttackPower===0&&gapSeconds>0?
    projectNetChaseGap({priorGapSeconds:gapSeconds,passiveGapDelta,chasePower,
      recoverySecondsPerCapacity:MOTOR_CANDIDATE.chaseRecoverySecondsPerCapacity}).gapSeconds:
    Math.max(0,gapSeconds+gapDelta+passiveGapDelta)).toFixed(2);
  // An attempted attack cannot join an existing break merely because that
  // break remains ahead after the peloton neutralises this new move.
  const joinedBreakawayRiderIds=!bridgeTooFar&&nextGapSeconds>0&&attackPower>chasePower
    ?attackers.map(attacker=>attacker.riderId):[];
  const failedBridgeRiderIds=bridgeTooFar?attackers.map(attacker=>attacker.riderId):[];
  return {km,attackers,blockedAttacks,releasedHelperAttackRiderIds,
    chasers,engagedChaseTeamIds:engaged,
    selectiveChaseSafeGapSeconds:+safeGap.toFixed(2),
    releasedForwardTeamIds,gcCounterTeamIds,attackPower,chasePower,energyCosts,
    heldChaseTeamIds,withheldChaseTeamIds,joinedBreakawayRiderIds,failedBridgeRiderIds,
    pullRiderIds,passiveGapDelta,paidBunchPace:paidPace,
    gapSeconds:nextGapSeconds};
}
