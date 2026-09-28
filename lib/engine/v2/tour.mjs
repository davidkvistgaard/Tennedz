import {buildKilometreRoute} from './route.mjs';
import {normalizeOrders,orderAt} from './orders.mjs';
import {resolveTacticalKilometre} from './tactics.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {updateRiderGroups} from './groups.mjs';
import {provisionalFinish} from './finish.mjs';
import {selectShelter} from './support.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

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
    const riders=[...team.riders].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
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
    return {id:team.id,riders,orders,energy,activeLeaderId:orders.captainId,troubleAt:null};
  });
  if(genders.size!==1)throw new Error('Men and women must race in separate categories.');
  const frames=[];let gapSeconds=0,breakawayTeamIds=[],breakawayRiderIds=[],engagedChaseTeamIds=[];
  let groupStates=prepared.flatMap(team=>team.riders.map(rider=>({id:rider.id,teamId:team.id,
    energy:team.energy[rider.id],ability:0,deficitSeconds:0,lowKilometres:0,group:'peloton'})));
  for(const segment of route.kilometres){
    const isKeypoint=(stage.keypoints??[]).some(point=>Number(point.km)===segment.km);
    const contest=resolveTacticalKilometre({teams:prepared,km:segment.km,terrain:segment.terrain,
      gapSeconds,isKeypoint,breakawayTeamIds,breakawayRiderIds,engagedChaseTeamIds,
      distanceKm:route.distanceKm});
    gapSeconds=contest.gapSeconds;
    engagedChaseTeamIds=gapSeconds>0?contest.engagedChaseTeamIds:[];
    breakawayRiderIds=gapSeconds>0?[...new Set([...breakawayRiderIds,...contest.attackers.map(a=>a.riderId)])]:[];
    breakawayTeamIds=gapSeconds>0?[...new Set([...breakawayTeamIds,...contest.attackers.map(a=>a.teamId)])]:[];
    const ahead=new Set(breakawayRiderIds);
    const extra=new Map(contest.energyCosts.map(cost=>[cost.riderId,cost]));
    const teamPace=[],decisions=[],riderStates=[],shelterEvents=[];
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
        const effect=riderKilometreEffect(rider,segment,{phase:action?.reason??'cruise',
          energy:team.energy[rider.id],exposed:segment.exposed});
        abilityTotal+=effect.ability;
        const baselineWork=TUNING.effortCost[order.effort]*terrainLoad;
        const work=(baselineWork*(rider.id===team.activeLeaderId?1-shelter.reduction:1)+
          (sheltering.has(rider.id)?TUNING.shelter.helperCostPerKm:0)+(action?.cost??0)+
          (ahead.has(rider.id)?TUNING.breakaway.extraCostPerKm:0))*effect.energyCostMultiplier;
        team.energy[rider.id]=+clamp(team.energy[rider.id]-work,0,100).toFixed(3);
        riderStates.push({...previousStates.get(rider.id),energy:team.energy[rider.id],ability:effect.ability});
      }
      teamPace.push({teamId:team.id,meanAbility:+(abilityTotal/8).toFixed(2)});
      if(team.orders.contingency==='backup_if_captain_exhausted'&&team.activeLeaderId===team.orders.captainId){
        const captainEnergy=team.energy[team.orders.captainId],backupEnergy=team.energy[team.orders.backupId];
        if(captainEnergy<=TUNING.contingency.captainEnergyThreshold&&backupEnergy>=captainEnergy+TUNING.contingency.backupEnergyLead){
          team.troubleAt??=segment.km;
          const roadCaptain=team.riders.find(r=>r.id===team.orders.roadCaptainId);
          const leadership=Number(roadCaptain.leadership??35);
          if(!Number.isFinite(leadership)||leadership<0||leadership>100)throw new Error('Invalid road captain leadership.');
          const responseKm=Math.max(1,Math.ceil((100-leadership)/TUNING.contingency.responseKmPerLeadershipBand));
          if(segment.km-team.troubleAt>=responseKm){
            team.activeLeaderId=team.orders.backupId;
            decisions.push({teamId:team.id,kind:'backup_leader',riderId:team.activeLeaderId});
          }
        }else team.troubleAt=null;
      }
    }
    groupStates=updateRiderGroups(riderStates,breakawayRiderIds);
    frames.push({km:segment.km,terrain:segment.terrain,surface:segment.surface,exposed:segment.exposed,
      gapSeconds,breakawayTeamIds:[...breakawayTeamIds],breakawayRiderIds:[...breakawayRiderIds],attackers:contest.attackers.map(a=>a.riderId),
      chasers:contest.chasers.map(c=>c.teamId),engagedChaseTeamIds:[...engagedChaseTeamIds],
      shelterEvents,teamPace,decisions,
      activeLeaders:prepared.map(team=>({teamId:team.id,riderId:team.activeLeaderId})),
      teamEnergy:prepared.map(team=>({teamId:team.id,mean:+(Object.values(team.energy).reduce((sum,n)=>sum+n,0)/8).toFixed(2)})),
      riderGroups:groupStates.map(({id,teamId,energy,deficitSeconds,group})=>({id,teamId,energy,deficitSeconds,group}))});
  }
  const provisionalResults=provisionalFinish({route,teams:prepared,states:groupStates,
    breakawayRiderIds,gapSeconds,seed});
  return {version:2,tuningVersion:TUNING_VERSION,route,frames,provisionalResults};
}
