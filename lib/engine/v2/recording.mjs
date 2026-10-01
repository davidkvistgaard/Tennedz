// Validate a completed v2 laboratory recording before storage or playback.
// This module deliberately has no simulator imports: playback reads the
// recorded frames and result instead of recalculating with today's tuning.
import {SPORTING_SKILLS} from './skills.mjs';
import {breakAttackAt,normalizeOrders,orderAt} from './orders.mjs';
import {MAX_ROAD_GROUPS,selectRoadGroupWork,validateRoadGroupTransition} from './road-groups.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';
import {identifyTopTenThreats,identifyTopTenOpportunities,gcGuardRiderIds,
  validateGeneralClassificationForRace} from './classification.mjs';
const BLOCK_REASONS=new Set(['team_break_limit','no_available_rider','already_ahead',
  'dropped','exhausted','recently_caught','rider_unavailable']);
const DECISION_KINDS=new Set(['backup_leader','chase_break','resume_plan','chase_gc','resume_gc',
  'target_gc','end_gc_target']);
const BREAK_ATTACK_STATUSES=new Set(['split','joined_group_ahead','contained','exhausted',
  'solo_break','not_in_break']);
const BLOCKED_BREAK_REASONS=new Set(['another_break_attack','not_selected',
  'not_in_break','not_leading_group','road_group_limit','group_formed_this_km']);
const CHASE_REASONS=new Set(['gc_counter','gc_defense','road_captain_response',
  'fading_teammate','ordered_all','fresh_attack','gap_over_limit']);
export function validateRecordedTour(recording){
  if(recording?.version!==2||typeof recording.tuningVersion!=='string'||
    !['M','F'].includes(recording.raceCategory)||
    typeof recording.raceSeed!=='string'||!recording.raceSeed.length||recording.raceSeed.length>160||
    recording.route?.version!==2||
    !Number.isInteger(recording.route?.distanceKm)||
    !Number.isFinite(recording.route.lockedWeather?.temperatureC)||
    !Number.isFinite(recording.route.lockedWeather?.windKph)||
    recording.route.lockedWeather.windKph<0||
    !Number.isFinite(recording.route.lockedWeather?.rainMm)||
    recording.route.lockedWeather.rainMm<0||
    !Array.isArray(recording.route.kilometres)||recording.route.kilometres.length!==recording.route.distanceKm||
    !Array.isArray(recording.frames)||recording.frames.length!==recording.route.distanceKm||
    !Array.isArray(recording.provisionalResults)||recording.provisionalResults.length<16||
    recording.provisionalResults.length>160||recording.provisionalResults.length%8!==0)
    throw new Error('Incomplete race recording.');
  const resultIds=recording.provisionalResults.map(result=>result.riderId);
  const roster=new Set(resultIds);
  const teamByRider=new Map(recording.provisionalResults.map(result=>[result.riderId,result.teamId]));
  const teamIds=new Set(recording.provisionalResults.map(result=>result.teamId));
  if(roster.size!==resultIds.length)throw new Error('Duplicate rider in recorded results.');
  const teamCounts=new Map();
  for(const teamId of teamByRider.values())teamCounts.set(teamId,(teamCounts.get(teamId)??0)+1);
  if(teamIds.size<2||teamIds.size>20||[...teamCounts.values()].some(count=>count!==8))
    throw new Error('Invalid recorded team roster.');
  const inputs=recording.committedInputs;
  if(!inputs||!Array.isArray(inputs.keypoints)||!Array.isArray(inputs.teams)||
    inputs.teams.length!==teamIds.size||new Set(inputs.teams.map(team=>team.id)).size!==teamIds.size)
    throw new Error('Missing committed race inputs.');
  const inputRoster=new Set();
  for(const team of inputs.teams){
    if(!teamIds.has(team.id)||!Array.isArray(team.riders)||team.riders.length!==8||
      !team.orders||team.orders.version!==2||team.orders.captainId===undefined||
      team.orders.roadCaptainId===undefined||
      !['protect_forward','chase_if_fading'].includes(team.orders.forwardResponse))
      throw new Error('Invalid committed team input.');
    const lineup=new Set();
    for(const rider of team.riders){
      if(!rider||!roster.has(rider.id)||teamByRider.get(rider.id)!==team.id||
        rider.gender!==recording.raceCategory||lineup.has(rider.id)||
        SPORTING_SKILLS.some(skill=>!Number.isFinite(rider[skill])||rider[skill]<0||rider[skill]>100)||
        ['form','fatigue','leadership'].some(key=>!Number.isFinite(rider[key])||rider[key]<0||rider[key]>100))
        throw new Error('Invalid committed rider input.');
      lineup.add(rider.id);inputRoster.add(rider.id);
    }
    if(!lineup.has(team.orders.captainId)||!lineup.has(team.orders.roadCaptainId)||
      !Array.isArray(team.orders.helperIds)||team.orders.helperIds.some(id=>!lineup.has(id)))
      throw new Error('Invalid committed team orders.');
    try{
      normalizeOrders(team.orders,{riderIds:[...lineup],
        distanceKm:recording.route.distanceKm,keypoints:inputs.keypoints});
    }catch{
      throw new Error('Invalid committed team orders.');
    }
  }
  if(inputRoster.size!==roster.size)throw new Error('Incomplete committed race lineup.');
  const teamInputById=new Map(inputs.teams.map(team=>[team.id,team]));
  const energyCapByRider=new Map(inputs.teams.flatMap(team=>team.riders.map(rider=>[
    rider.id,100-rider.fatigue*TUNING.stageRace.initialEnergyFatigueFactor,
  ])));
  if(inputs.classification!==null&&inputs.classification!==undefined)
    validateGeneralClassificationForRace(inputs.classification,{
      raceCategory:recording.raceCategory,
      riders:[...teamByRider].map(([riderId,teamId])=>({riderId,teamId})),
    });
  if((inputs.classification===null||inputs.classification===undefined)&&
    inputs.teams.some(team=>team.orders.gcObjective!=='stage_result'&&
      team.orders.gcObjective!==undefined))
    throw new Error('Missing committed GC classification.');
  let previousAhead=new Set();
  let nextRoadGroupId=1;
  let previousRoadGroups=[];
  let previousResponses=new Set();
  let previousGcResponses=new Set();
  let previousGcTargets=new Set();
  const gcThreatAt=new Map();
  for(const [index,frame] of recording.frames.entries()){
    const priorRoadGroups=previousRoadGroups;
    const segment=recording.route.kilometres[index];
    const priorRiderStates=index===0?[...teamByRider].map(([id,teamId])=>({
      id,teamId,group:'peloton',deficitSeconds:0,
    })):recording.frames[index-1].riderGroups;
    const gcThreats=inputs.classification==null?[]:
      identifyTopTenThreats(inputs.classification,{roadGroups:priorRoadGroups,
        riderStates:priorRiderStates},{warningMarginSeconds:TUNING.gc.warningMarginSeconds});
    const threatenedRiders=new Set(gcThreats.map(threat=>threat.riderId));
    const gcOpportunities=inputs.classification==null?[]:
      identifyTopTenOpportunities(inputs.classification,{roadGroups:priorRoadGroups,
        riderStates:priorRiderStates});
    const eligibleTargetIds=new Set(gcOpportunities.filter(opportunity=>
      opportunity.gapToTopTenSeconds<=TUNING.gc.maxTopTenGapSeconds)
      .map(opportunity=>opportunity.riderId));
    const expectedGcDecisions=[];
    const expectedGcTargetDecisions=[];
    const gcResponses=new Set(previousGcResponses);
    const gcTargets=new Set(previousGcTargets);
    for(const team of inputs.teams){
      if(team.orders.gcObjective==='target_top_ten'){
        const leaderId=index===0?team.orders.captainId:
          recording.frames[index-1].activeLeaders.find(item=>item.teamId===team.id).riderId;
        const leaderEnergy=index===0?100-team.riders.find(rider=>rider.id===leaderId)
          .fatigue*TUNING.stageRace.initialEnergyFatigueFactor:
          priorRiderStates.find(rider=>rider.id===leaderId).energy;
        const shouldTarget=recording.route.distanceKm-index-1<=TUNING.gc.targetWindowKm&&
          eligibleTargetIds.has(leaderId)&&
          !priorRoadGroups.some(group=>group.riderIds.includes(leaderId))&&
          team.riders.filter(rider=>priorRoadGroups.some(group=>
            group.riderIds.includes(rider.id))).length<TUNING.breakaway.maxRidersPerTeam&&
          leaderEnergy>=TUNING.attack.minEnergyFraction*100&&
          !orderAt(team.orders,index).attackRiderId;
        if(shouldTarget!==gcTargets.has(team.id))expectedGcTargetDecisions.push({
          teamId:team.id,kind:shouldTarget?'target_gc':'end_gc_target',
          riderId:team.orders.roadCaptainId,
        });
        if(shouldTarget)gcTargets.add(team.id);
        else gcTargets.delete(team.id);
      }
      if(team.orders.gcObjective!=='defend_top_ten')continue;
      const leaderId=index===0?team.orders.captainId:
        recording.frames[index-1].activeLeaders.find(item=>item.teamId===team.id).riderId;
      const threatened=threatenedRiders.has(leaderId);
      if(!threatened){
        if(gcResponses.has(team.id))expectedGcDecisions.push({teamId:team.id,
          kind:'resume_gc',riderId:team.orders.roadCaptainId});
        gcThreatAt.delete(team.id);
        gcResponses.delete(team.id);
        continue;
      }
      if(!gcThreatAt.has(team.id))gcThreatAt.set(team.id,index+1);
      const roadCaptain=team.riders.find(rider=>rider.id===team.orders.roadCaptainId);
      const responseKm=Math.max(1,Math.ceil((100-roadCaptain.leadership)/
        TUNING.contingency.responseKmPerLeadershipBand));
      if(!gcResponses.has(team.id)&&index+1-gcThreatAt.get(team.id)>=responseKm){
        gcResponses.add(team.id);
        expectedGcDecisions.push({teamId:team.id,kind:'chase_gc',
          riderId:team.orders.roadCaptainId});
      }
    }
    if(frame?.km!==index+1||!Number.isFinite(frame.gapSeconds)||frame.gapSeconds<0||
      !Number.isFinite(frame.pelotonGapSeconds)||frame.pelotonGapSeconds<0||
      !Number.isFinite(frame.attackPower)||frame.attackPower<0||
      !Number.isFinite(frame.chasePower)||frame.chasePower<0||
      !Number.isFinite(frame.selectiveChaseSafeGapSeconds)||
      frame.selectiveChaseSafeGapSeconds<0||
      (recording.tuningVersion===TUNING_VERSION&&
        Math.abs(frame.selectiveChaseSafeGapSeconds-Math.min(TUNING.chase.maxSafeGapSeconds,
          (recording.route.distanceKm-frame.km)*TUNING.chase.safeGapSecondsPerRemainingKm))>.011)||
      !Number.isFinite(frame.passiveGapDelta)||
      !Array.isArray(frame.riderGroups)||frame.riderGroups.length!==roster.size||
      !Array.isArray(frame.roadGroups)||frame.roadGroups.length>MAX_ROAD_GROUPS||
      !Array.isArray(frame.mergedRoadGroupIds)||
      !Array.isArray(frame.finaleRoadGroupCatches)||
      (frame.finaleRoadGroupCatches.length>0&&index!==recording.frames.length-1)||
      (frame.formedChaseGroupId!==null&&typeof frame.formedChaseGroupId!=='string')||
      !Array.isArray(frame.bridgedBreakRiderIds)||
      !Array.isArray(frame.splitAttacks)||
      !Array.isArray(frame.blockedBreakAttacks)||
      !Array.isArray(frame.breakawayRiderIds)||!Array.isArray(frame.breakawayTeamIds)||
      !Array.isArray(frame.pullRiderIds)||!Array.isArray(frame.driveRiderIds)||
      !Array.isArray(frame.reciprocalHoldRiderIds)||
      !Array.isArray(frame.caughtBreakawayRiderIds)||
      !Array.isArray(frame.attackers)||!Array.isArray(frame.joinedBreakawayRiderIds)||
      !Array.isArray(frame.releasedHelperAttackRiderIds)||
      !Array.isArray(frame.fatiguedAttackRiderIds)||
      !Array.isArray(frame.failedBridgeRiderIds)||
      typeof frame.finishLineCatch!=='boolean'||
      (frame.finishLineCatch&&index!==recording.frames.length-1)||
      !Array.isArray(frame.chasers)||
      !Array.isArray(frame.chaseReasons)||
      !Array.isArray(frame.heldChaseTeamIds)||
      !Array.isArray(frame.engagedChaseTeamIds)||
      !Array.isArray(frame.releasedForwardTeamIds)||
      !Array.isArray(frame.gcCounterTeamIds)||
      !Array.isArray(frame.activeBreakResponseTeamIds)||
      !Array.isArray(frame.activeGcResponseTeamIds)||
      !Array.isArray(frame.activeGcTargetTeamIds)||
      !Array.isArray(frame.activeLeaders)||frame.activeLeaders.length!==teamIds.size||
      !Array.isArray(frame.blockedAttacks)||!Array.isArray(frame.decisions)||
      !Array.isArray(frame.supportEvents)||
      !Array.isArray(frame.recoveredRiderIds)||
      !Array.isArray(frame.teamEnergy)||frame.teamEnergy.length!==teamIds.size||
      !Array.isArray(frame.teamPace)||frame.teamPace.length!==teamIds.size||
      segment?.km!==frame.km||
      segment.terrain!==frame.terrain||segment.surface!==frame.surface||
      segment.exposed!==frame.exposed)throw new Error('Invalid recorded kilometre.');
    if(new Set(frame.activeLeaders.map(item=>item.teamId)).size!==teamIds.size||
      frame.activeLeaders.some(item=>!teamIds.has(item.teamId)||
        teamByRider.get(item.riderId)!==item.teamId))
      throw new Error('Invalid recorded active leader.');
    const ahead=new Set(frame.breakawayRiderIds),seen=new Set();
    if(new Set(frame.pullRiderIds).size!==frame.pullRiderIds.length||
      frame.pullRiderIds.some(id=>!previousAhead.has(id)))
      throw new Error('Invalid recorded break work.');
    const priorEnergy=new Map(priorRiderStates.map(state=>[state.id,state.energy]));
    const expectedWork=selectRoadGroupWork(priorRoadGroups,inputs.teams.map(team=>({
      ...team,energy:Object.fromEntries(team.riders.map(rider=>[rider.id,index===0?
        100-rider.fatigue*TUNING.stageRace.initialEnergyFatigueFactor:
        priorEnergy.get(rider.id)])),
    })),index+1,{holdTeamIds:[...gcResponses]});
    const expectedPulls=expectedWork.pullRiderIds;
    if(frame.pullRiderIds.length!==expectedPulls.length||
      frame.pullRiderIds.some(id=>!expectedPulls.includes(id)))
      throw new Error('Recorded break work differs from committed orders.');
    if(frame.reciprocalHoldRiderIds.length!==expectedWork.reciprocalHoldRiderIds.length||
      new Set(frame.reciprocalHoldRiderIds).size!==frame.reciprocalHoldRiderIds.length||
      frame.reciprocalHoldRiderIds.some(id=>
        !expectedWork.reciprocalHoldRiderIds.includes(id)))
      throw new Error('Recorded reciprocal break work differs from committed orders.');
    const expectedDrivers=expectedPulls.filter(id=>{
      const team=teamInputById.get(teamByRider.get(id));
      return orderAt(team.orders,index).breakWork==='drive';
    });
    if(frame.driveRiderIds.length!==expectedDrivers.length||
      new Set(frame.driveRiderIds).size!==frame.driveRiderIds.length||
      frame.driveRiderIds.some(id=>!expectedDrivers.includes(id)))
      throw new Error('Recorded break drive differs from committed orders.');
    if(ahead.size!==frame.breakawayRiderIds.length||
      [...ahead].some(id=>!roster.has(id))||
      (frame.gapSeconds===0)!==(ahead.size===0))throw new Error('Inconsistent recorded breakaway.');
    const joined=new Set(frame.joinedBreakawayRiderIds);
    const failedBridge=new Set(frame.failedBridgeRiderIds);
    const bridged=new Set(frame.bridgedBreakRiderIds);
    const attackSucceeded=(frame.pelotonGapSeconds>0||frame.finishLineCatch)&&
      frame.attackPower>frame.chasePower;
    if(joined.size!==frame.joinedBreakawayRiderIds.length||
      failedBridge.size!==frame.failedBridgeRiderIds.length||
      bridged.size!==frame.bridgedBreakRiderIds.length||
      (bridged.size>0&&(previousRoadGroups.length<1||
        frame.roadGroups.at(-1)?.id!==previousRoadGroups.at(-1).id||
        frame.formedChaseGroupId!==null||failedBridge.size>0||
        bridged.size!==joined.size||[...bridged].some(id=>!joined.has(id))))||
      (failedBridge.size>0&&(failedBridge.size!==frame.attackers.length||previousAhead.size===0))||
      [...failedBridge].some(id=>!frame.attackers.includes(id)||joined.has(id))||
      [...joined].some(id=>!frame.attackers.includes(id)||previousAhead.has(id))||
      (attackSucceeded&&failedBridge.size===0?joined.size!==frame.attackers.length:joined.size!==0))
      throw new Error('Invalid recorded breakaway admission.');
    const caught=new Set(frame.caughtBreakawayRiderIds);
    const expectedCaught=frame.finishLineCatch?caught:
      new Set([...previousAhead].filter(id=>!ahead.has(id)));
    const beforeFinishAhead=new Set([...previousAhead,...joined]);
    if(frame.finishLineCatch&&(caught.size===0||caught.size!==frame.caughtBreakawayRiderIds.length||
      [...caught].some(id=>!beforeFinishAhead.has(id))||
      (frame.gapSeconds===0&&caught.size!==beforeFinishAhead.size)))
      throw new Error('Invalid recorded finish-line catch.');
    const expectedAhead=new Set([...previousAhead,...joined].filter(id=>!caught.has(id)));
    if(frame.caughtBreakawayRiderIds.length!==expectedCaught.size||
      new Set(frame.caughtBreakawayRiderIds).size!==expectedCaught.size||
      frame.caughtBreakawayRiderIds.some(id=>!expectedCaught.has(id)))
      throw new Error('Invalid recorded catch event.');
    const expectedTeams=new Set([...ahead].map(id=>teamByRider.get(id)));
    if(ahead.size!==expectedAhead.size||[...ahead].some(id=>!expectedAhead.has(id))||
      frame.breakawayTeamIds.length!==expectedTeams.size||
      new Set(frame.breakawayTeamIds).size!==expectedTeams.size||
      frame.breakawayTeamIds.some(id=>!expectedTeams.has(id)))
      throw new Error('Discontinuous recorded breakaway.');
    const roadGroup=frame.roadGroups[0];
    const rearGroup=frame.roadGroups.at(-1);
    const projectedRiders=frame.roadGroups.flatMap(group=>group.riderIds);
    const projectedTeams=[...new Set(frame.roadGroups.flatMap(group=>group.teamIds))];
    for(const group of frame.roadGroups){
      const actualTeams=new Set(group.riderIds.map(id=>teamByRider.get(id)));
      if(actualTeams.has(undefined)||actualTeams.size!==group.teamIds.length||
        group.teamIds.some(id=>!actualTeams.has(id)))
        throw new Error('Recorded road-group teams differ from their riders.');
    }
    const rearCaught=previousRoadGroups.length>1&&
      !frame.roadGroups.some(group=>group.id===previousRoadGroups.at(-1).id)&&
      previousRoadGroups.at(-1).riderIds.every(id=>
        frame.caughtBreakawayRiderIds.includes(id));
    if((ahead.size>0)!==Boolean(roadGroup)||
      (roadGroup?.gapSeconds??0)!==frame.gapSeconds||
      (rearCaught&&!frame.finishLineCatch?frame.pelotonGapSeconds!==0:
        frame.pelotonGapSeconds!==(rearGroup?.gapSeconds??0))||
      projectedRiders.length!==frame.breakawayRiderIds.length||
      projectedRiders.some((id,position)=>id!==frame.breakawayRiderIds[position])||
      projectedTeams.length!==frame.breakawayTeamIds.length||
      projectedTeams.some((id,position)=>id!==frame.breakawayTeamIds[position]))
      throw new Error('Inconsistent recorded road group.');
    for(const group of frame.roadGroups.filter(candidate=>
      !previousRoadGroups.some(previous=>previous.id===candidate.id))
      .sort((a,b)=>Number(a.id.slice(5))-Number(b.id.slice(5)))){
      if(group.id!==`road-${nextRoadGroupId++}`)
        throw new Error('Inconsistent recorded road group identity.');
    }
    if(frame.finishLineCatch&&frame.formedChaseGroupId&&
      !frame.roadGroups.some(group=>group.id===frame.formedChaseGroupId)&&
      frame.formedChaseGroupId!==`road-${nextRoadGroupId++}`)
      throw new Error('Inconsistent caught road group identity.');
    validateRoadGroupTransition(previousRoadGroups,frame.roadGroups,{
      joinedRiderIds:frame.joinedBreakawayRiderIds,
      caughtRiderIds:frame.caughtBreakawayRiderIds,
      breakMoves:frame.splitAttacks.filter(attack=>
        ['split','joined_group_ahead'].includes(attack?.status)),
      formedChaseGroupId:frame.formedChaseGroupId,
      mergedGroupIds:frame.mergedRoadGroupIds,
      finaleCatchMoves:frame.finaleRoadGroupCatches,
      finishLineCatch:frame.finishLineCatch,
    });
    previousRoadGroups=frame.roadGroups;
    previousAhead=ahead;
    if(new Set(frame.attackers).size!==frame.attackers.length||
      frame.attackers.some(id=>!roster.has(id))||
      new Set(frame.fatiguedAttackRiderIds).size!==frame.fatiguedAttackRiderIds.length||
      frame.fatiguedAttackRiderIds.some(id=>!frame.attackers.includes(id))||
      frame.blockedAttacks.some(item=>!item||!teamIds.has(item.teamId)||!BLOCK_REASONS.has(item.reason)||
        (item.riderId!==null&&!roster.has(item.riderId))||
        (item.riderId!==null&&teamByRider.get(item.riderId)!==item.teamId)||
        (item.riderId!==null&&frame.attackers.includes(item.riderId))))
      throw new Error('Invalid recorded attack event.');
    if(JSON.stringify(frame.splitAttack)!==JSON.stringify(frame.splitAttacks[0]??null)||
      new Set(frame.splitAttacks.map(attack=>attack?.riderId)).size!==
        frame.splitAttacks.length||
      frame.splitAttacks.some(attack=>!attack||!BREAK_ATTACK_STATUSES.has(attack.status)||
        !['committed','automatic'].includes(attack.source)||
        teamByRider.get(attack.riderId)!==attack.teamId||
        frame.attackers.includes(attack.riderId))||
      frame.blockedBreakAttacks.some(event=>!BLOCKED_BREAK_REASONS.has(event.reason)||
        teamByRider.get(event.riderId)!==event.teamId||
        frame.splitAttacks.some(attack=>event.riderId===attack.riderId)))
      throw new Error('Invalid recorded break attack.');
    for(const attack of frame.splitAttacks){
      const orders=teamInputById.get(attack.teamId).orders;
      const committed=breakAttackAt(orders,frame.km);
      if(attack.source==='committed'?committed!==attack.riderId:
        committed!==null||
        orderAt(orders,frame.km-1).breakFinale!=='attack_if_outsprinted'||
        !TUNING.breakFinale.checkpointsRemainingKm.includes(
          recording.route.distanceKm-frame.km))
        throw new Error('Recorded break attack contradicts committed orders.');
    }
    if(new Set(frame.releasedHelperAttackRiderIds).size!==
      frame.releasedHelperAttackRiderIds.length||
      frame.releasedHelperAttackRiderIds.some(id=>{
        const teamId=teamByRider.get(id);
        const input=teamInputById.get(teamId);
        const prior=recording.frames[index-1];
        const leaderId=prior?.activeLeaders.find(item=>item.teamId===teamId)?.riderId;
        return !frame.attackers.includes(id)||!input?.orders.helperIds.includes(id)||
          orderAt(input.orders,frame.km-1).helperAttackPolicy!=='release_if_dropped'||
          orderAt(input.orders,frame.km-1).attackRiderId===id||
          prior?.riderGroups.find(rider=>rider.id===leaderId)?.group!=='dropped';
      }))throw new Error('Invalid recorded helper release.');
    for(const attack of frame.splitAttacks.filter(item=>
      ['split','joined_group_ahead'].includes(item.status))){
      const destinationIndex=frame.roadGroups.findIndex(group=>
        group.riderIds.includes(attack.riderId));
      const destination=frame.roadGroups[destinationIndex];
      const source=frame.roadGroups[destinationIndex+1];
      if(!source||source.id!==attack.sourceGroupId||
        !Number.isFinite(attack.attackSeconds)||attack.attackSeconds<.01||
        (attack.status==='split'&&
          (attack.targetGroupId!==null||
            Math.abs(destination.gapSeconds-source.gapSeconds-attack.attackSeconds)>.011))||
        (attack.status==='joined_group_ahead'&&
          (destination.id!==attack.targetGroupId||
            attack.attackSeconds+.011<destination.gapSeconds-source.gapSeconds)))
        throw new Error('Invalid recorded break attack route.');
    }
    const chasers=new Set(frame.chasers);
    const held=new Set(frame.heldChaseTeamIds);
    const released=new Set(frame.releasedForwardTeamIds);
    const previousFrame=index>0?recording.frames[index-1]:null;
    const previousRear=priorRoadGroups.at(-1);
    if(released.size!==frame.releasedForwardTeamIds.length||
      [...released].some(id=>{
        const ownAhead=priorRoadGroups.flatMap(group=>group.riderIds)
          .filter(riderId=>teamByRider.get(riderId)===id);
        const priorEnergy=new Map(previousFrame?.riderGroups.map(rider=>[rider.id,rider.energy]));
        const activeLeader=previousFrame?.activeLeaders.find(item=>item.teamId===id)?.riderId;
        return !chasers.has(id)||
          teamInputById.get(id)?.orders.forwardResponse!=='chase_if_fading'||
          !previousRear||previousRear.gapSeconds>
            TUNING.teamIntent.maxFadingBreakGapSeconds||ownAhead.length===0||
          ownAhead.includes(activeLeader)||
          ownAhead.some(riderId=>!previousRear.riderIds.includes(riderId)||
            priorEnergy.get(riderId)>TUNING.teamIntent.fadingRiderEnergy);
      }))throw new Error('Invalid recorded forward-rider response.');
    if(held.size!==frame.heldChaseTeamIds.length||
      [...held].some(id=>!teamIds.has(id)||chasers.has(id)||expectedTeams.has(id)||
        !previousRear||frame.attackPower>0||
        orderAt(teamInputById.get(id).orders,index).chase!=='selective'))
      throw new Error('Invalid recorded held chase.');
    if(chasers.size!==frame.chasers.length||[...chasers].some(id=>
      !teamIds.has(id)||expectedTeams.has(id)&&!released.has(id)&&
        !gcResponses.has(id))||
      frame.engagedChaseTeamIds.length!==(frame.pelotonGapSeconds>0?chasers.size:0)||
      frame.engagedChaseTeamIds.some(id=>!chasers.has(id)))
      throw new Error('Invalid recorded chase event.');
    const expectedGcCounters=inputs.classification==null?[]:inputs.teams.filter(team=>{
      if(team.orders.gcObjective!=='defend_top_ten'||!chasers.has(team.id)||
        priorRoadGroups.some(group=>group.teamIds.includes(team.id)))return false;
      const leaderId=index===0?team.orders.captainId:
        recording.frames[index-1].activeLeaders.find(item=>item.teamId===team.id).riderId;
      if(priorRiderStates.find(state=>state.id===leaderId)?.group!=='peloton')return false;
      return gcGuardRiderIds(inputs.classification,gcOpportunities,{
        leaderRiderId:leaderId,teamId:team.id,
        maxPriorGapSeconds:TUNING.gc.guardMaxPriorGapSeconds,
      }).some(id=>frame.attackers.includes(id));
    }).map(team=>team.id);
    if(JSON.stringify(frame.gcCounterTeamIds)!==JSON.stringify(expectedGcCounters))
      throw new Error('Inconsistent recorded GC attack counter.');
    if(frame.decisions.some(decision=>!decision||!DECISION_KINDS.has(decision.kind)||
      !teamIds.has(decision.teamId)||teamByRider.get(decision.riderId)!==decision.teamId))
      throw new Error('Invalid recorded tactical decision.');
    const actualGcDecisions=frame.decisions.filter(decision=>
      decision.kind==='chase_gc'||decision.kind==='resume_gc');
    if(JSON.stringify(actualGcDecisions)!==JSON.stringify(expectedGcDecisions)||
      frame.activeGcResponseTeamIds.length!==gcResponses.size||
      new Set(frame.activeGcResponseTeamIds).size!==gcResponses.size||
      frame.activeGcResponseTeamIds.some(id=>!gcResponses.has(id)))
      throw new Error('Inconsistent recorded GC response.');
    if(frame.chaseReasons.length!==frame.chasers.length||
      frame.chaseReasons.some((entry,i)=>!entry||entry.teamId!==frame.chasers[i]||
        !CHASE_REASONS.has(entry.reason)||
        (entry.reason==='gc_counter'&&!frame.gcCounterTeamIds.includes(entry.teamId))||
        (entry.reason==='gc_defense'&&!frame.activeGcResponseTeamIds.includes(entry.teamId))||
        (entry.reason==='road_captain_response'&&
          !frame.activeBreakResponseTeamIds.includes(entry.teamId))||
        (entry.reason==='fading_teammate'&&!released.has(entry.teamId))||
        (entry.reason==='ordered_all'&&
          orderAt(teamInputById.get(entry.teamId).orders,index).chase!=='all')||
        (entry.reason==='fresh_attack'&&frame.attackPower<=0)||
        (entry.reason==='gap_over_limit'&&
          (frame.attackPower>0||!priorRoadGroups.length||
            priorRoadGroups[0].gapSeconds<=frame.selectiveChaseSafeGapSeconds))))
      throw new Error('Invalid recorded chase reason.');
    previousGcResponses=gcResponses;
    const actualGcTargetDecisions=frame.decisions.filter(decision=>
      decision.kind==='target_gc'||decision.kind==='end_gc_target');
    if(JSON.stringify(actualGcTargetDecisions)!==JSON.stringify(expectedGcTargetDecisions)||
      frame.activeGcTargetTeamIds.length!==gcTargets.size||
      new Set(frame.activeGcTargetTeamIds).size!==gcTargets.size||
      frame.activeGcTargetTeamIds.some(id=>!gcTargets.has(id)))
      throw new Error('Inconsistent recorded GC target.');
    previousGcTargets=gcTargets;
    const supportHelpers=new Set();
    for(const event of frame.supportEvents){
      const previousLeader=index>0?recording.frames[index-1].riderGroups.find(rider=>
        rider.id===event?.leaderId):null;
      const previousHelper=index>0?recording.frames[index-1].riderGroups.find(rider=>
        rider.id===event?.helperId):null;
      const currentLeader=frame.riderGroups.find(rider=>rider.id===event?.leaderId);
      const currentHelper=frame.riderGroups.find(rider=>rider.id===event?.helperId);
      if(!event||!teamIds.has(event.teamId)||
        teamByRider.get(event.leaderId)!==event.teamId||
        teamByRider.get(event.helperId)!==event.teamId||
        !teamInputById.get(event.teamId).orders.helperIds.includes(event.helperId)||
        supportHelpers.has(event.helperId)||
        !Number.isFinite(event.recoveredSeconds)||event.recoveredSeconds<0||
        event.recoveredSeconds>1||frame.attackers.includes(event.helperId)||
        previousLeader?.group!=='dropped'||!['peloton','dropped'].includes(previousHelper?.group)||
        previousHelper.group==='dropped'&&
          previousHelper.deficitSeconds>previousLeader.deficitSeconds+1||
        currentLeader?.group==='dropped'&&
          (currentHelper?.group!=='dropped'||currentHelper.deficitSeconds<currentLeader.deficitSeconds))
        throw new Error('Invalid recorded captain support.');
      supportHelpers.add(event.helperId);
    }
    const responses=new Set(previousResponses);
    for(const decision of frame.decisions){
      if(decision.kind==='chase_break'){
        if(responses.has(decision.teamId))throw new Error('Repeated recorded break response.');
        responses.add(decision.teamId);
      }else if(decision.kind==='resume_plan'){
        if(!responses.has(decision.teamId))throw new Error('Unmatched recorded break response.');
        responses.delete(decision.teamId);
      }
    }
    if(frame.activeBreakResponseTeamIds.length!==responses.size||
      new Set(frame.activeBreakResponseTeamIds).size!==responses.size||
      frame.activeBreakResponseTeamIds.some(id=>!responses.has(id)))
      throw new Error('Inconsistent recorded break response.');
    previousResponses=responses;
    const priorEnergyByRider=new Map(index===0?energyCapByRider:
      recording.frames[index-1].riderGroups.map(rider=>[rider.id,rider.energy]));
    const recovered=new Set(frame.recoveredRiderIds);
    if(recovered.size!==frame.recoveredRiderIds.length||
      frame.recoveredRiderIds.some(id=>!roster.has(id)))
      throw new Error('Invalid recorded energy recovery.');
    const maxRecovery=TUNING.recovery.basePerKm+
      100*TUNING.recovery.endurancePerPoint;
    // A broad physical envelope catches forged one-kilometre energy losses
    // without replaying tactical choices. Historical tuning needs its own
    // rules, so this bound applies only to the currently simulated version.
    const temperatureStress=Math.max(0,TUNING.temperatureStress.comfortMinC-
      segment.weather.temperatureC,segment.weather.temperatureC-
      TUNING.temperatureStress.comfortMaxC);
    const maxMultiplier=1.2*(1+temperatureStress*
      TUNING.temperatureStress.costPerDegree);
    const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+
      (segment.surface==='road'?0:.15);
    const maxWork=(TUNING.effortCost.hard*terrainLoad+
      TUNING.attack.repeatedCost+TUNING.attack.selectiveCost+
      TUNING.chase.allCost*TUNING.finale.sprintTrainMaxFactor+
      TUNING.chase.selectiveCost+TUNING.captainSupport.helperExtraCostPerKm+
      TUNING.shelter.helperCostPerKm+TUNING.breakaway.extraCostPerKm)*maxMultiplier;
    for(const rider of frame.riderGroups){
      if(!roster.has(rider.id)||seen.has(rider.id)||rider.teamId!==teamByRider.get(rider.id)||
        !Number.isFinite(rider.energy)||rider.energy<0||rider.energy>100||
        rider.energy>energyCapByRider.get(rider.id)+.002||
        rider.energy-priorEnergyByRider.get(rider.id)>maxRecovery+.002||
        (recording.tuningVersion===TUNING_VERSION&&
          priorEnergyByRider.get(rider.id)-rider.energy>maxWork+.002)||
        (rider.energy>priorEnergyByRider.get(rider.id)+.002&&!recovered.has(rider.id))||
        !Number.isFinite(rider.deficitSeconds)||rider.deficitSeconds<0||
        !['peloton','breakaway','dropped'].includes(rider.group)||
        (rider.group==='breakaway')!==ahead.has(rider.id)||
        (rider.group==='breakaway'&&rider.deficitSeconds!==0))
        throw new Error('Inconsistent recorded rider state.');
      seen.add(rider.id);
    }
    const energyByTeam=new Map([...teamIds].map(id=>[id,[]]));
    for(const rider of frame.riderGroups)energyByTeam.get(rider.teamId).push(rider.energy);
    if(new Set(frame.teamEnergy.map(item=>item?.teamId)).size!==teamIds.size||
      frame.teamEnergy.some(item=>!teamIds.has(item?.teamId)||
        item.mean!==+(energyByTeam.get(item.teamId)
          .reduce((sum,energy)=>sum+energy,0)/8).toFixed(2))||
      new Set(frame.teamPace.map(item=>item?.teamId)).size!==teamIds.size||
      frame.teamPace.some(item=>!teamIds.has(item?.teamId)||
        !Number.isFinite(item.meanAbility)||item.meanAbility<0||item.meanAbility>150))
      throw new Error('Recorded team metrics differ from rider states.');
  }
  const final=new Map(recording.frames.at(-1).riderGroups.map(rider=>[rider.id,rider]));
  const finalFrame=recording.frames.at(-1);
  const roadPosition=new Map(finalFrame.roadGroups.flatMap((group,position)=>
    group.riderIds.map(id=>[id,position])));
  const firstTime=recording.provisionalResults[0].timeSeconds;
  const rankOf=result=>result.group==='breakaway'?roadPosition.get(result.riderId):
    finalFrame.roadGroups.length+(result.group==='dropped'?1:0);
  for(const [index,result] of recording.provisionalResults.entries()){
    const state=final.get(result.riderId);
    if(result.position!==index+1||!Number.isFinite(result.timeSeconds)||
      !Number.isFinite(result.gapSeconds)||result.gapSeconds<0||
      (index>0&&result.timeSeconds<recording.provisionalResults[index-1].timeSeconds)||
      Math.abs(result.timeSeconds-firstTime-result.gapSeconds)>.02||
      !state||result.group!==state.group||result.energy!==state.energy||
      result.teamId!==state.teamId||
      (finalFrame.roadGroups.length>1&&result.roadGroupId!==
        (result.group==='breakaway'?finalFrame.roadGroups[rankOf(result)].id:null))||
      (index>0&&rankOf(result)<rankOf(recording.provisionalResults[index-1])))
      throw new Error('Recorded finish does not match the final kilometre.');
  }
  for(const [index,group] of finalFrame.roadGroups.entries()){
    const last=recording.provisionalResults.filter(result=>roadPosition.get(result.riderId)===index).at(-1);
    const next=finalFrame.roadGroups[index+1];
    const first=recording.provisionalResults.find(result=>next?
      roadPosition.get(result.riderId)===index+1:result.group==='peloton');
    const requiredGap=group.gapSeconds-(next?.gapSeconds??0);
    if(first&&(!last||first.timeSeconds-last.timeSeconds<requiredGap-.02))
      throw new Error('Recorded finish contradicts the final breakaway gap.');
  }
  return true;
}

export function readRecordedKilometre(recording,index){
  if(!Number.isInteger(index)||index<0||index>=recording?.frames?.length)
    throw new Error('Recorded kilometre is out of range.');
  return structuredClone(recording.frames[index]);
}
