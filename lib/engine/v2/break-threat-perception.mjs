// Isolated V94 information model. The source road keeps exact rider values;
// this deterministic observer view is only for a future tactical decision.
import {SPORTING_SKILLS} from './skills.mjs';
import {assertRoadGroups} from './road-groups.mjs';
import {assessBreakThreatRange} from './break-threat-matrix.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function hash(value){
  let state=2166136261;
  for(const character of value)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return state;
}
function bias(seed,observer,rider,field,range){
  return hash(`${seed}:${observer}:${rider}:${field}`)%(range*2+1)-range;
}
function interval(estimate,radius){
  return [clamp(estimate-radius,0,100),clamp(estimate+radius,0,100)];
}

export function perceiveRivalStrength({teams,observerTeamId,raceSeed}){
  if(!Array.isArray(teams)||!teams.length||
    typeof observerTeamId!=='string'||!teams.some(team=>team.id===observerTeamId)||
    typeof raceSeed!=='string'||!raceSeed.length||
    new Set(teams.map(team=>team.id)).size!==teams.length||
    new Set(teams.flatMap(team=>team.riders.map(rider=>rider.id))).size!==
      teams.reduce((count,team)=>count+team.riders.length,0))
    throw new Error('Invalid threat observer.');
  const estimates={};
  const perceivedTeams=teams.map(team=>{
    const own=team.id===observerTeamId;
    const energy={};
    const riders=team.riders.map(rider=>{
      const actualEnergy=Number(team.energy?.[rider.id]??100);
      if(!Number.isFinite(actualEnergy)||actualEnergy<0||actualEnergy>100)
        throw new Error('Invalid threat source energy.');
      const perceived={...rider};
      const skillIntervals={};
      for(const skill of SPORTING_SKILLS){
        const actual=Number(rider[skill]);
        if(!Number.isFinite(actual)||actual<0||actual>100)
          throw new Error('Invalid threat source skill.');
        perceived[skill]=own?actual:clamp(actual+
          bias(raceSeed,observerTeamId,rider.id,skill,5),0,100);
        skillIntervals[skill]=interval(perceived[skill],own?0:5);
      }
      for(const field of ['form','fatigue']){
        const actual=Number(rider[field]??(field==='form'?50:0));
        if(!Number.isFinite(actual)||actual<0||actual>100)
          throw new Error('Invalid threat source condition.');
        perceived[field]=own?actual:clamp(actual+
          bias(raceSeed,observerTeamId,rider.id,field,5),0,100);
        skillIntervals[field]=interval(perceived[field],own?0:5);
      }
      const perceivedEnergy=own?actualEnergy:clamp(
        Math.round(actualEnergy/10)*10+
        bias(raceSeed,observerTeamId,rider.id,'energy',1)*5,0,100);
      energy[rider.id]=perceivedEnergy;
      estimates[rider.id]={teamId:team.id,own,
        skillIntervals,energyInterval:interval(perceivedEnergy,own?0:10)};
      return perceived;
    });
    return {...team,riders,energy};
  });
  return {version:1,observerTeamId,teams:perceivedTeams,
    intervalsByRiderId:estimates};
}

// Judge each recorded road group against the bunch separately. A new attack
// creates another assessment; it does not erase the older front group.
export function assessRoadGroupsForObserver({teams,roadGroups,
  observerTeamId,raceSeed,nominatedChaseTeamIds,
  conditionalChaseTeamIds=[],unavailableRiderIds=[],remainingSegments,
  rotationVersion=1}){
  assertRoadGroups(roadGroups);
  if(!Array.isArray(nominatedChaseTeamIds)||
    !Array.isArray(conditionalChaseTeamIds)||
    !Array.isArray(unavailableRiderIds))
    throw new Error('Invalid road-group threat coalition.');
  const perception=perceiveRivalStrength({teams,observerTeamId,raceSeed});
  // The physical threat candidate may see rival riders but not their private
  // future work orders or which helpers the manager reserved. Treat every
  // non-captain as a possible helper and coalition membership as willingness.
  const forecastTeams=rotationVersion===3?perception.teams.map(team=>
    team.id===observerTeamId?team:{...team,orders:{...team.orders,
      helperIds:team.riders.filter(rider=>
        rider.id!==team.orders.captainId).map(rider=>rider.id),
      baseline:{effort:'steady',chase:'selective',breakWork:'cooperate'},
      phases:[]}}):perception.teams;
  if(!roadGroups.length)return {version:1,observerTeamId,groups:[],
    intervalsByRiderId:perception.intervalsByRiderId};
  const forwardRiders=new Set(roadGroups.flatMap(group=>group.riderIds));
  const unavailable=new Set(unavailableRiderIds);
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const coalition=[...nominatedChaseTeamIds,...conditionalChaseTeamIds];
  if(roadGroups.some(group=>{
    const actualTeamIds=new Set(group.riderIds.map(id=>teamByRider.get(id)));
    return actualTeamIds.has(undefined)||actualTeamIds.size!==group.teamIds.length||
      group.teamIds.some(id=>!actualTeamIds.has(id));
  })||coalition.some(teamId=>roadGroups.some(group=>group.teamIds.includes(teamId)))||
    unavailableRiderIds.some(id=>forwardRiders.has(id)||
      !teamByRider.has(id))||unavailable.size!==unavailableRiderIds.length)
    throw new Error('Invalid road-group threat coalition.');
  const groups=roadGroups.map(group=>{
    const otherForward=roadGroups.filter(row=>row.id!==group.id)
      .flatMap(row=>row.riderIds);
    const assessment=assessBreakThreatRange({teams:forecastTeams,
      frontRiderIds:group.riderIds,
      unavailableRiderIds:[...unavailableRiderIds,...otherForward],
      nominatedChaseTeamIds,conditionalChaseTeamIds,
      remainingSegments,gapSeconds:group.gapSeconds,rotationVersion});
    return {roadGroupId:group.id,gapSeconds:group.gapSeconds,
      riderIds:[...group.riderIds],assessment};
  });
  return {version:1,observerTeamId,groups,
    intervalsByRiderId:perception.intervalsByRiderId};
}
