import {sportingSkills} from './physiology.mjs';
import {normalizeOrders} from './orders.mjs';
import {TUNING,isExplicitFrontVersion} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Canonical race participants contain no route, terrain or weather data.
// Stage-specific markers are checked only when their orders are committed.
export function prepareRaceParticipants(teams){
  if(!Array.isArray(teams)||teams.length<2||teams.length>20)
    throw new Error('A tactical tour requires 2–20 teams.');
  const used=new Set(),teamIds=new Set(),genders=new Set();
  const participants=[...teams].sort((a,b)=>String(a.id).localeCompare(String(b.id)))
    .map(team=>{
      if(!team?.id||teamIds.has(team.id)||!Array.isArray(team.riders)||
        team.riders.length!==8)
        throw new Error('Each team needs a unique ID and eight riders.');
      teamIds.add(team.id);
      const riders=[...team.riders].sort((a,b)=>String(a.id).localeCompare(String(b.id)))
        .map(rider=>{
          const form=Number(rider.form??50),fatigue=Number(rider.fatigue??0);
          const leadership=Number(rider.leadership??35);
          if(![form,fatigue,leadership].every(value=>Number.isFinite(value)&&
            value>=0&&value<=100))
            throw new Error('Invalid rider condition or leadership.');
          return {id:rider.id,name:rider.name??rider.id,gender:rider.gender,
            ...sportingSkills(rider),form,fatigue,leadership};
        });
      for(const rider of riders){
        if(!rider?.id||used.has(rider.id))
          throw new Error('Rider IDs must be unique across the race.');
        used.add(rider.id);
        if(!['M','F'].includes(rider.gender)||
          !Number.isFinite(Number(rider.fatigue??0))||
          Number(rider.fatigue??0)<0||Number(rider.fatigue??0)>100)
          throw new Error('Riders need one race category and valid fatigue.');
        genders.add(rider.gender);
      }
      const name=typeof team.name==='string'&&team.name.trim()?
        team.name.trim():String(team.id);
      if(name.length>100)throw new Error('Team names must be at most 100 characters.');
      return {id:team.id,name,riders,orders:structuredClone(team.orders)};
    });
  if(genders.size!==1)throw new Error('Men and women must race in separate categories.');
  return {raceCategory:[...genders][0],teams:participants};
}

export function commitParticipantsToStage(participants,{distanceKm,keypoints=[],motorVersion}){
  return participants.teams.map(team=>{
    const riderIds=team.riders.map(rider=>rider.id);
    const orders=normalizeOrders(team.orders,{riderIds,distanceKm,keypoints,
      allowFrontWork:isExplicitFrontVersion(motorVersion)});
    const energy=Object.fromEntries(team.riders.map(rider=>[rider.id,
      clamp(100-rider.fatigue*TUNING.stageRace.initialEnergyFatigueFactor,0,100)]));
    return {id:team.id,name:team.name,riders:team.riders,orders,energy,
      energyCap:{...energy},
      attackLoad:Object.fromEntries(team.riders.map(rider=>[rider.id,0])),
      quietKm:Object.fromEntries(team.riders.map(rider=>[rider.id,0])),
      activeLeaderId:orders.captainId,
      troubleAt:null,breakThreatAt:null,breakResponseActive:false,
      gcThreatAt:null,gcResponseActive:false,gcTargetActive:false,
      gcGuardRiderIds:[],supportingHelperId:null};
  });
}
