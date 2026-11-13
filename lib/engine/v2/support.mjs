import {sportingSkills} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

// A protected leader can save effort behind available helpers in the same
// group. A helper currently working in a chase cannot provide shelter too.
export function selectShelter({team,leaderId,segment,previousGroups,workingRiderIds}){
  if(team.orders.preset!=='protect'||previousGroups.get(leaderId)!=='peloton')
    return {helperIds:[],reduction:0};
  const tune=TUNING.shelter;
  const candidates=team.riders.filter(rider=>rider.id!==leaderId&&
    team.orders.helperIds.includes(rider.id)&&
    !workingRiderIds.has(rider.id)&&
    previousGroups.get(rider.id)==='peloton'&&
    team.energy[rider.id]>tune.energyFloor).map(rider=>{
    const skills=sportingSkills(rider);
    const score=segment.exposed ? .35*skills.strength+.35*skills.positioning+.30*skills.wind
      :.4*skills.strength+.4*skills.positioning+.2*skills.handling;
    return {id:rider.id,score};
  }).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)))
    .slice(0,tune.maxHelpers);
  return {helperIds:candidates.map(r=>r.id),
    reduction:Math.min(tune.maxReduction,candidates.reduce((sum,r)=>sum+r.score*tune.protectionPerSkillPoint,0))};
}
