import {buildKilometreRoute} from './route.mjs';
import {normalizeOrders,orderAt,breakAttackAt} from './orders.mjs';
import {resolveTacticalKilometre} from './tactics.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';
import {riderKilometreEffect,sportingSkills} from './physiology.mjs';
import {updateRiderGroups} from './groups.mjs';
import {provisionalFinish,provisionalRoadGroupFinish,resolveFinishingSprint} from './finish.mjs';
import {selectShelter} from './support.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {selectCaptainSupport,applyCaptainSupport} from './captain-support.mjs';
import {advanceRoadGroups,splitFrontRoadGroup,formChasingRoadGroup,
  relativeRoadGroupPace} from './road-groups.mjs';
import {evaluateBreakAttack} from './break-attack.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// Interim full-race cap while tactics and recording are calibrated for more groups.
const MAX_ROAD_GROUPS=3;
function responseKmForRoadCaptain(team){
  const roadCaptain=team.riders.find(rider=>rider.id===team.orders.roadCaptainId);
  const leadership=Number(roadCaptain.leadership??35);
  if(!Number.isFinite(leadership)||leadership<0||leadership>100)
    throw new Error('Invalid road captain leadership.');
  return Math.max(1,Math.ceil((100-leadership)/TUNING.contingency.responseKmPerLeadershipBand));
}

// A deterministic tactical trace and provisional finish for balancing. The
// live engine, saved race results and database remain unchanged.
export function simulateTacticalTour({stage,teams,seed,weather}){
  if(!Array.isArray(teams)||teams.length<2||teams.length>20)throw new Error('A tactical tour requires 2–20 teams.');
  if(typeof seed!=='string'||!seed.length||seed.length>160)throw new Error('A race seed must be 1–160 characters.');
  const route=buildKilometreRoute(stage,{seed,weather});
  const used=new Set(),teamIds=new Set(),genders=new Set();
  const prepared=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(team=>{
    if(!team?.id||teamIds.has(team.id)||!Array.isArray(team.riders)||team.riders.length!==8)throw new Error('Each team needs a unique ID and eight riders.');
    teamIds.add(team.id);
    // Race calculations use this canonical snapshot, not mutable caller data.
    const riders=[...team.riders].sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(rider=>{
      const form=Number(rider.form??50),fatigue=Number(rider.fatigue??0);
      const leadership=Number(rider.leadership??35);
      if(![form,fatigue,leadership].every(value=>Number.isFinite(value)&&value>=0&&value<=100))
        throw new Error('Invalid rider condition or leadership.');
      return {id:rider.id,name:rider.name??rider.id,gender:rider.gender,
        ...sportingSkills(rider),form,fatigue,leadership};
    });
    const riderIds=riders.map(r=>r.id);
    for(const rider of riders){
      if(!rider?.id||used.has(rider.id))throw new Error('Rider IDs must be unique across the race.');
      used.add(rider.id);
      if(!['M','F'].includes(rider.gender)||!Number.isFinite(Number(rider.fatigue??0))||Number(rider.fatigue??0)<0||Number(rider.fatigue??0)>100)
        throw new Error('Riders need one race category and valid fatigue.');
      genders.add(rider.gender);
    }
    const orders=normalizeOrders(team.orders,{riderIds,distanceKm:route.distanceKm,keypoints:stage.keypoints});
    const energy=Object.fromEntries(riders.map(r=>[r.id,clamp(100-Number(r.fatigue??0)*.4,0,100)]));
    return {id:team.id,riders,orders,energy,energyCap:{...energy},
      attackLoad:Object.fromEntries(riders.map(r=>[r.id,0])),
      quietKm:Object.fromEntries(riders.map(r=>[r.id,0])),activeLeaderId:orders.captainId,
      troubleAt:null,breakThreatAt:null,breakResponseActive:false,supportingHelperId:null};
  });
  if(genders.size!==1)throw new Error('Men and women must race in separate categories.');
  const frames=[];let roadGroups=[],nextRoadGroupId=1,engagedChaseTeamIds=[];
  const caughtAtKm=new Map();
  let groupStates=prepared.flatMap(team=>team.riders.map(rider=>({id:rider.id,teamId:team.id,
    energy:team.energy[rider.id],ability:0,deficitSeconds:0,lowKilometres:0,group:'peloton'})));
  for(const segment of route.kilometres){
    for(const team of prepared)for(const rider of team.riders)
      team.attackLoad[rider.id]=+Math.max(0,team.attackLoad[rider.id]-
        TUNING.attack.loadRecoveryPerKm).toFixed(3);
    const previousRearGroup=roadGroups.at(-1)??null;
    const gapSeconds=previousRearGroup?.gapSeconds??0;
    const breakawayRiderIds=roadGroups.flatMap(group=>group.riderIds);
    const breakawayTeamIds=[...new Set(roadGroups.flatMap(group=>group.teamIds))];
    for(const [riderId,caughtKm] of caughtAtKm)if(segment.km-caughtKm>
      TUNING.breakaway.reattackRecoveryKm)caughtAtKm.delete(riderId);
    const supportAssignments=[];
    for(const team of prepared){
      team.supportingHelperId=selectCaptainSupport(team,groupStates,segment.km);
      if(team.supportingHelperId)supportAssignments.push({team,leaderId:team.activeLeaderId,
        helperId:team.supportingHelperId});
    }
    const supportingRiderIds=new Set(supportAssignments.map(assignment=>assignment.helperId));
    const decisions=[];
    for(const team of prepared){
      if(team.orders.breakResponse!=='chase_if_threatened')continue;
      const ownRiderAhead=breakawayTeamIds.includes(team.id);
      const threatPersists=team.breakResponseActive&&gapSeconds>0;
      if(ownRiderAhead||!(threatPersists||gapSeconds>=TUNING.contingency.breakThreatSeconds)){
        if(team.breakResponseActive)decisions.push({teamId:team.id,kind:'resume_plan',
          riderId:team.orders.roadCaptainId});
        team.breakThreatAt=null;
        team.breakResponseActive=false;
        continue;
      }
      team.breakThreatAt??=segment.km;
      if(!team.breakResponseActive&&
        segment.km-team.breakThreatAt>=responseKmForRoadCaptain(team)){
        team.breakResponseActive=true;
        decisions.push({teamId:team.id,kind:'chase_break',riderId:team.orders.roadCaptainId});
      }
    }
    const isKeypoint=(stage.keypoints??[]).some(point=>Number(point.km)===segment.km);
    const contest=resolveTacticalKilometre({teams:prepared,km:segment.km,terrain:segment.terrain,
      gapSeconds,isKeypoint,breakawayTeamIds,breakawayRiderIds,
      droppedRiderIds:groupStates.filter(state=>state.group==='dropped').map(state=>state.id),
      recentlyCaughtRiderIds:[...caughtAtKm.keys()],
      supportingRiderIds:[...supportingRiderIds],
      engagedChaseTeamIds,
      distanceKm:route.distanceKm,segment});
    for(const attacker of contest.attackers){
      const team=prepared.find(candidate=>candidate.id===attacker.teamId);
      team.attackLoad[attacker.riderId]=+(team.attackLoad[attacker.riderId]+1).toFixed(3);
    }
    engagedChaseTeamIds=contest.gapSeconds>0?contest.engagedChaseTeamIds:[];
    let caughtBreakawayRiderIds=[];
    const joinedTeams=contest.attackers.filter(attacker=>contest.joinedBreakawayRiderIds.includes(attacker.riderId))
      .map(attacker=>attacker.teamId);
    let mergedRoadGroupIds=[];
    if(previousRearGroup){
      const rearDelta=contest.gapSeconds-gapSeconds;
      const changes={[previousRearGroup.id]:rearDelta};
      for(let index=roadGroups.length-2;index>=0;index--)
        changes[roadGroups[index].id]=changes[roadGroups[index+1].id]+
          relativeRoadGroupPace(roadGroups[index],roadGroups[index+1],prepared,segment);
      const movement=advanceRoadGroups(roadGroups,changes);
      roadGroups=movement.groups;
      caughtBreakawayRiderIds=movement.caughtRiderIds;
      mergedRoadGroupIds=movement.mergedGroupIds;
    }else if(contest.joinedBreakawayRiderIds.length&&contest.gapSeconds>0){
      roadGroups=[{id:`road-${nextRoadGroupId++}`,riderIds:[],teamIds:[],
        gapSeconds:contest.gapSeconds}];
    }
    if(roadGroups.length&&contest.joinedBreakawayRiderIds.length){
      const rear=roadGroups.at(-1);
      rear.riderIds=[...new Set([...rear.riderIds,...contest.joinedBreakawayRiderIds])];
      rear.teamIds=[...new Set([...rear.teamIds,...joinedTeams])];
    }
    let formedChaseGroupId=null;
    let newChaseRiderIds=[];
    let bridgedBreakRiderIds=[];
    if(previousRearGroup&&roadGroups.length>0&&
      roadGroups.at(-1).id===previousRearGroup.id&&
      contest.failedBridgeRiderIds.length&&contest.attackPower>contest.chasePower){
      // A move too far behind the existing break can still escape the peloton.
      // Its own gap is earned against the bunch, never borrowed from the leader.
      const earned=+clamp((contest.attackPower-contest.chasePower)*
        TUNING.attack.pressureToSeconds,0,35).toFixed(2);
      if(earned>=roadGroups.at(-1).gapSeconds-.01){
        bridgedBreakRiderIds=[...contest.failedBridgeRiderIds];
        roadGroups.at(-1).riderIds.push(...bridgedBreakRiderIds);
        roadGroups.at(-1).teamIds=[...new Set([...roadGroups.at(-1).teamIds,
          ...contest.attackers.filter(attacker=>bridgedBreakRiderIds.includes(attacker.riderId))
            .map(attacker=>attacker.teamId)])];
      }else if(earned>=.01&&roadGroups.length<MAX_ROAD_GROUPS){
        const teamByRiderId=Object.fromEntries(prepared.flatMap(team=>
          team.riders.map(rider=>[rider.id,team.id])));
        formedChaseGroupId=`road-${nextRoadGroupId++}`;
        newChaseRiderIds=[...contest.failedBridgeRiderIds];
        roadGroups=formChasingRoadGroup(roadGroups,{riderIds:newChaseRiderIds,
          teamByRiderId,newGroupId:formedChaseGroupId,gapSeconds:earned});
      }
    }
    let splitAttack=null;
    let blockedBreakAttacks=[];
    const plannedBreakAttacks=prepared.filter(team=>breakAttackAt(team.orders,segment.km));
    if(roadGroups.length>0&&roadGroups.length<MAX_ROAD_GROUPS&&!formedChaseGroupId){
      const eligible=plannedBreakAttacks.map(team=>evaluateBreakAttack({group:roadGroups[0],teams:prepared,
        teamId:team.id,km:segment.km,segment})).filter(Boolean);
      const chosen=eligible.find(attempt=>attempt.status==='split');
      splitAttack=chosen??eligible[0]??null;
      blockedBreakAttacks=eligible.filter(attempt=>attempt!==splitAttack).map(attempt=>({
        teamId:attempt.teamId,riderId:attempt.riderId,reason:chosen?'another_break_attack':'not_selected',
      }));
      if(chosen){
        const teamByRiderId=Object.fromEntries(prepared.flatMap(team=>
          team.riders.map(rider=>[rider.id,team.id])));
        roadGroups=splitFrontRoadGroup(roadGroups,{riderId:chosen.riderId,teamByRiderId,
          newGroupId:`road-${nextRoadGroupId++}`,attackSeconds:chosen.attackSeconds});
        const team=prepared.find(candidate=>candidate.id===chosen.teamId);
        team.attackLoad[chosen.riderId]=+(team.attackLoad[chosen.riderId]+1).toFixed(3);
      }
    }else{
      blockedBreakAttacks=plannedBreakAttacks.map(team=>({teamId:team.id,
        riderId:breakAttackAt(team.orders,segment.km),
        reason:roadGroups.length===0?'not_in_break':formedChaseGroupId?
          'group_formed_this_km':'road_group_limit'}));
    }
    for(const riderId of caughtBreakawayRiderIds)caughtAtKm.set(riderId,segment.km);
    const currentRiderIds=roadGroups.flatMap(group=>group.riderIds);
    const currentTeamIds=[...new Set(roadGroups.flatMap(group=>group.teamIds))];
    const joinedBreakawayRiderIds=[...contest.joinedBreakawayRiderIds,...newChaseRiderIds,
      ...bridgedBreakRiderIds];
    const ahead=new Set(currentRiderIds);
    const pulling=new Set(contest.pullRiderIds);
    const extra=new Map();
    for(const cost of [...contest.energyCosts,...(splitAttack?.energyCosts??[])]){
      const previous=extra.get(cost.riderId);
      extra.set(cost.riderId,{...cost,cost:cost.cost+(previous?.cost??0),
        reason:cost.reason==='attack'||previous?.reason==='attack'?'attack':cost.reason});
    }
    const teamPace=[],riderStates=[],shelterEvents=[],recoveredRiderIds=[];
    const previousStates=new Map(groupStates.map(state=>[state.id,state]));
    const previousGroups=new Map(groupStates.map(state=>[state.id,state.group]));
    for(const team of prepared){
      const order=orderAt(team.orders,segment.km-1);
      const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+(segment.surface==='road'?0:.15);
      const shelter=selectShelter({team,leaderId:team.activeLeaderId,segment,previousGroups,
        workingRiderIds:new Set(team.riders.filter(rider=>extra.has(rider.id)).map(rider=>rider.id))});
      const sheltering=new Set(shelter.helperIds);
      if(shelter.helperIds.length)shelterEvents.push({teamId:team.id,leaderId:team.activeLeaderId,
        helperIds:shelter.helperIds});
      let abilityTotal=0;
      for(const rider of team.riders){
        const action=extra.get(rider.id);
        const supporting=supportingRiderIds.has(rider.id);
        const effect=riderKilometreEffect(rider,segment,{phase:supporting?'chase':action?.reason??'cruise',
          energy:team.energy[rider.id],exposed:segment.exposed});
        abilityTotal+=effect.ability;
        const baselineWork=TUNING.effortCost[order.effort]*terrainLoad;
        const work=(baselineWork*(rider.id===team.activeLeaderId?1-shelter.reduction:1)+
          (sheltering.has(rider.id)?TUNING.shelter.helperCostPerKm:0)+(action?.cost??0)+
          (supporting?TUNING.captainSupport.helperExtraCostPerKm:0)+
          (ahead.has(rider.id)?pulling.has(rider.id)?TUNING.breakaway.extraCostPerKm:
            TUNING.breakaway.sitOnExtraCostPerKm:0))*effect.energyCostMultiplier;
        const rest=recoveryForKilometre({rider,segment,effort:order.effort,
          group:previousGroups.get(rider.id),working:Boolean(action)||supporting||
            sheltering.has(rider.id)||ahead.has(rider.id),
          quietKm:team.quietKm[rider.id]});
        team.quietKm[rider.id]=rest.quietKm;
        const spent=clamp(team.energy[rider.id]-work,0,team.energyCap[rider.id]);
        team.energy[rider.id]=+clamp(spent+rest.recovery,0,team.energyCap[rider.id]).toFixed(3);
        if(team.energy[rider.id]>+(spent.toFixed(3)))recoveredRiderIds.push(rider.id);
        riderStates.push({...previousStates.get(rider.id),energy:team.energy[rider.id],ability:effect.ability});
      }
      teamPace.push({teamId:team.id,meanAbility:+(abilityTotal/8).toFixed(2)});
      if(team.orders.contingency==='backup_if_captain_exhausted'&&team.activeLeaderId===team.orders.captainId){
        const captainEnergy=team.energy[team.orders.captainId],backupEnergy=team.energy[team.orders.backupId];
        if(captainEnergy<=TUNING.contingency.captainEnergyThreshold&&backupEnergy>=captainEnergy+TUNING.contingency.backupEnergyLead){
          team.troubleAt??=segment.km;
          const responseKm=responseKmForRoadCaptain(team);
          if(segment.km-team.troubleAt>=responseKm){
            team.activeLeaderId=team.orders.backupId;
            decisions.push({teamId:team.id,kind:'backup_leader',riderId:team.activeLeaderId});
          }
        }else team.troubleAt=null;
      }
    }
    groupStates=updateRiderGroups(riderStates,currentRiderIds);
    const supportEvents=[];
    for(const assignment of supportAssignments){
      const supported=applyCaptainSupport(groupStates,assignment);
      groupStates=supported.states;
      if(supported.event)supportEvents.push(supported.event);
    }
    frames.push({km:segment.km,terrain:segment.terrain,surface:segment.surface,exposed:segment.exposed,
      gapSeconds:roadGroups[0]?.gapSeconds??0,
      pelotonGapSeconds:formedChaseGroupId?roadGroups.at(-1).gapSeconds:contest.gapSeconds,
      attackPower:contest.attackPower,chasePower:contest.chasePower,
      passiveGapDelta:contest.passiveGapDelta,
      pullRiderIds:contest.pullRiderIds,
      roadGroups:roadGroups.map(group=>({...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds]})),
      breakawayTeamIds:[...currentTeamIds],breakawayRiderIds:[...currentRiderIds],
      caughtBreakawayRiderIds,mergedRoadGroupIds,formedChaseGroupId,bridgedBreakRiderIds,
      splitAttack,blockedBreakAttacks,
      finishLineCatch:false,
      attackers:contest.attackers.map(a=>a.riderId),joinedBreakawayRiderIds,
      fatiguedAttackRiderIds:contest.attackers.filter(a=>a.repeatLoad>=.5).map(a=>a.riderId),
      failedBridgeRiderIds:formedChaseGroupId||bridgedBreakRiderIds.length?
        []:contest.failedBridgeRiderIds,
      blockedAttacks:contest.blockedAttacks,
      chasers:contest.chasers.map(c=>c.teamId),heldChaseTeamIds:contest.heldChaseTeamIds,
      engagedChaseTeamIds:[...engagedChaseTeamIds],
      activeBreakResponseTeamIds:prepared.filter(team=>team.breakResponseActive).map(team=>team.id),
      shelterEvents,supportEvents,recoveredRiderIds,teamPace,decisions,
      activeLeaders:prepared.map(team=>({teamId:team.id,riderId:team.activeLeaderId})),
      teamEnergy:prepared.map(team=>({teamId:team.id,mean:+(Object.values(team.energy).reduce((sum,n)=>sum+n,0)/8).toFixed(2)})),
      riderGroups:groupStates.map(({id,teamId,energy,deficitSeconds,group})=>({id,teamId,energy,deficitSeconds,group}))});
  }
  const finishInput={route,teams:prepared,states:groupStates,
    breakawayRiderIds:roadGroups[0]?.riderIds??[],gapSeconds:roadGroups[0]?.gapSeconds??0,seed};
  const finalFrame=frames.at(-1);
  const multiGroupFinish=roadGroups.length>1;
  const finish=multiGroupFinish?null:resolveFinishingSprint(finishInput);
  if(finish?.caughtRiderIds.length>0){
    const caught=new Set(finish.caughtRiderIds);
    finalFrame.finishLineCatch=true;
    finalFrame.caughtBreakawayRiderIds=finish.caughtRiderIds;
    finalFrame.breakawayRiderIds=finish.remainingBreakawayRiderIds;
    finalFrame.breakawayTeamIds=[...new Set(prepared.filter(team=>team.riders.some(rider=>
      finish.remainingBreakawayRiderIds.includes(rider.id))).map(team=>team.id))];
    roadGroups=finish.remainingBreakawayRiderIds.length?[{id:roadGroups[0].id,
      riderIds:[...finish.remainingBreakawayRiderIds],teamIds:[...finalFrame.breakawayTeamIds],
      gapSeconds:finish.gapSeconds}]:[];
    finalFrame.roadGroups=roadGroups.map(group=>({...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds]}));
    if(finish.gapSeconds===0)finalFrame.engagedChaseTeamIds=[];
    finalFrame.gapSeconds=finish.gapSeconds;
    finalFrame.pelotonGapSeconds=finish.gapSeconds;
    groupStates=groupStates.map(state=>caught.has(state.id)?{...state,group:'peloton'}:state);
    finalFrame.riderGroups=groupStates.map(({id,teamId,energy,deficitSeconds,group})=>({
      id,teamId,energy,deficitSeconds,group}));
  }
  const provisionalResults=multiGroupFinish?
    provisionalRoadGroupFinish({route,teams:prepared,states:groupStates,roadGroups,seed}):
    finalFrame.finishLineCatch?finish.results:provisionalFinish(finishInput);
  const committedInputs={keypoints:structuredClone(stage.keypoints??[]),teams:prepared.map(team=>({
    id:team.id,riders:structuredClone(team.riders),orders:structuredClone(team.orders)}))};
  return {version:2,tuningVersion:TUNING_VERSION,raceCategory:[...genders][0],raceSeed:seed,
    committedInputs,
    route,frames,provisionalResults};
}
