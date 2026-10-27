// Internal v94 workbench input. Resolve rival intent before the race, then
// commit both the roles and matching baseline orders to the recording.
// These probabilities are synthetic game choices, not measured race rates.
import seedrandom from 'seedrandom';
import {normalizeRaceContext} from './race-context-v1.mjs';
import {sportingSkills} from './physiology.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const BASELINES={
  break:{effort:'steady',attack:'repeated',chase:'ignore'},
  control:{effort:'steady',attack:'none',chase:'selective'},
  protect:{effort:'steady',attack:'none',chase:'selective'},
  opportunistic:{effort:'steady',attack:'selective',chase:'ignore'},
};
const INTENT_SOURCES=new Set(['manager','manager_goal','generated']);

export function breakSpecialistFor(team){
  const candidates=team.riders.filter(rider=>rider.id!==team.orders.captainId);
  return candidates.map(rider=>{
    const skills=sportingSkills(rider);
    return {id:rider.id,score:skills.acceleration+skills.endurance+
      skills.repeatability};
  }).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))[0]?.id??null;
}

export function normalizeV94IntentManifest(intent,{teams,teamRoles,version=1}){
  if(![1,2,3,4].includes(version)||!Array.isArray(intent)||!Array.isArray(teams)||!teamRoles||
    intent.length!==teams.length||
    new Set(intent.map(row=>row?.teamId)).size!==teams.length)
    throw new Error('Invalid committed v94 intent manifest.');
  const byTeam=new Map(teams.map(team=>[team.id,team]));
  const normalized=intent.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row)||
      Object.keys(row).sort().join(',')!==(version===4?
        'baseline,role,source,specialistPolicyVersion,specialistRiderId,teamId':
        version>=2?'baseline,role,source,specialistRiderId,teamId':
        'baseline,role,source,teamId')||
      version===4&&row.specialistPolicyVersion!==2||
      !byTeam.has(row.teamId)||row.role!==teamRoles[row.teamId]||
      !INTENT_SOURCES.has(row.source)||
      row.teamId==='you'&&row.source!=='manager'||
      !row.baseline||typeof row.baseline!=='object'||
      Object.keys(row.baseline).sort().join(',')!==(version>=3?
        'attack,chase,effort,frontWork':'attack,chase,effort')||
      ['attack','chase','effort'].some(key=>
        row.baseline[key]!==byTeam.get(row.teamId).orders.baseline[key])||
      version>=3&&row.baseline.frontWork!==
        (byTeam.get(row.teamId).orders.baseline.frontWork??null)||
      version>=2&&row.specialistRiderId!==
        ((row.role==='break'||version===4&&row.role==='opportunistic')&&
          row.source!=='manager'?
          breakSpecialistFor(byTeam.get(row.teamId)):null))
      throw new Error('Invalid committed v94 intent manifest.');
    return {teamId:row.teamId,role:row.role,source:row.source,
      baseline:{...row.baseline},
      ...(version>=2?{specialistRiderId:row.specialistRiderId}:{}),
      ...(version===4?{specialistPolicyVersion:2}:{})};
  });
  return normalized.sort((a,b)=>a.teamId.localeCompare(b.teamId));
}

function roleForCommittedOrder(order){
  // An explicit attack remains eligible even if the same manager also orders
  // a chase; a protective/control role would suppress its ordinary cadence.
  if(order.attack!=='none')return order.chase==='ignore'?'break':'opportunistic';
  if(order.chase==='all')return 'control';
  // A directly chosen selective chase is an active control intention. The
  // generated/declared protect role has the same opening order but may still
  // withhold it according to its separately committed sporting goal.
  if(order.chase==='selective')return 'control';
  return 'opportunistic';
}

export function prepareV94RivalIntent({prepared,format,stageNumber,rivalGoals=[],
  frontRotationVersion=1,controlTempoVersion=1,
  opportunisticSpecialistVersion=1}){
  const {settings,teams,seed,stage}=prepared??{};
  if(![1,2].includes(controlTempoVersion)||
    ![1,2].includes(opportunisticSpecialistVersion)||
    !settings||!Array.isArray(teams)||teams.length<2||teams[0].id!=='you'||
    typeof seed!=='string'||!seed||!stage)
    throw new Error('Invalid v94 rival intent inputs.');
  const context=normalizeRaceContext({format,stageNumber,
    ...(frontRotationVersion===1?{}:{frontRotationVersion})});
  const mountain=stage.tags?.includes('MOUNTAIN');
  const leaderAbility=team=>{
    const leader=team.riders.find(rider=>rider.id===team.orders.captainId);
    if(!leader)throw new Error('Missing committed team captain.');
    return Number(mountain?leader.mountain:leader.sprint);
  };
  const abilities=teams.slice(1).map(leaderAbility).sort((a,b)=>a-b);
  if(abilities.some(value=>!Number.isFinite(value)||value<0||value>100))
    throw new Error('Invalid committed captain ability.');
  const median=abilities[Math.floor(abilities.length/2)];
  const customIds=new Set([
    ...teams.slice(1,1+settings.managerTactics.length).map(team=>team.id),
    ...(settings.managerTacticOverrides??[]).map(row=>row.teamId),
  ]);
  const rivalIds=new Set(teams.slice(1).map(team=>team.id));
  if(!Array.isArray(rivalGoals)||
    new Set(rivalGoals.map(row=>row?.teamId)).size!==rivalGoals.length||
    rivalGoals.some(row=>!row||typeof row!=='object'||Array.isArray(row)||
      Object.keys(row).sort().join(',')!=='role,teamId'||
      !rivalIds.has(row.teamId)||!Object.hasOwn(BASELINES,row.role)||
      customIds.has(row.teamId)))
    throw new Error('Invalid or conflicting v94 rival goal.');
  const goals=new Map(rivalGoals.map(row=>[row.teamId,row.role]));
  const userRole=roleForCommittedOrder(teams[0].orders.baseline);
  const teamRoles={you:userRole},intent=[{teamId:'you',role:userRole,
    source:'manager',baseline:{...teams[0].orders.baseline,
      ...(controlTempoVersion===2||opportunisticSpecialistVersion===2?{
        frontWork:teams[0].orders.baseline.frontWork??null}:{})},
    specialistRiderId:null,
    ...(opportunisticSpecialistVersion===2?{specialistPolicyVersion:2}:{})}];
  const committedTeams=teams.map((team,index)=>{
    if(index===0)return team;
    const source=customIds.has(team.id)?'manager':
      goals.has(team.id)?'manager_goal':'generated';
    const baseline=team.orders.baseline;
    const leaderAdvantage=leaderAbility(team)-median;
    const roll=seedrandom(`v94-rival-intent:${seed}:${team.id}`)();
    const controlChance=clamp(.15+leaderAdvantage/150,.04,.30);
    const breakChance=clamp(.28-leaderAdvantage/120,.12,.45);
    const role=source==='manager'?roleForCommittedOrder(baseline):
      source==='manager_goal'?goals.get(team.id):
      roll<controlChance?'control':
        roll<controlChance+breakChance?'break':
          roll<controlChance+breakChance+.12?'opportunistic':'protect';
    const selected=source==='manager'?{...baseline}:{...BASELINES[role],
      ...(controlTempoVersion===2&&role==='control'?{frontWork:'rotate'}:{})};
    teamRoles[team.id]=role;
    intent.push({teamId:team.id,role,source,baseline:{...selected,
      ...(controlTempoVersion===2||opportunisticSpecialistVersion===2?
        {frontWork:selected.frontWork??null}:{})},
      specialistRiderId:(role==='break'||
        opportunisticSpecialistVersion===2&&role==='opportunistic')&&
        source!=='manager'?breakSpecialistFor(team):null,
      ...(opportunisticSpecialistVersion===2?
        {specialistPolicyVersion:2}:{})});
    return {...team,orders:{...team.orders,baseline:selected}};
  });
  return {teams:committedTeams,raceContext:normalizeRaceContext({...context,
    teamRoles}),intent};
}
