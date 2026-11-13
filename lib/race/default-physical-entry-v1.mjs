import {normalizeRoute,routeAdvice} from './route.mjs';

export const DEFAULT_PHYSICAL_ENTRY_POLICY_VERSION=
  'default-physical-entry-v1';

const TACTIC_VALUES=Object.freeze({
  effort:['conserve','steady','hard'],
  chase:['ignore','selective','all'],
  attack:['none','selective','repeated'],
  front_work:['rotate','sit_in'],
  sporting_goal:['none','sprint_finish','summit_attack','break_stage'],
});

export function validateDefaultTacticsV1(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).sort().join(',')!==
      Object.keys(TACTIC_VALUES).sort().join(',')||
    Object.entries(TACTIC_VALUES).some(([key,allowed])=>
      !allowed.includes(value[key])))
    throw new Error('Choose a complete default race tactic.');
  return {...value};
}

function eligible(rider,gender,gameDate){
  return rider?.gender===gender&&
    (!rider.injury_until||rider.injury_until<=gameDate);
}

function score(rider,primary,secondary){
  return 4*Number(rider[primary]??0)+
    2*Number(rider[secondary]??0)+
    Number(rider.endurance??0)+Number(rider.form??0)-
    Number(rider.fatigue??0);
}

function validLineup(ids,captain,roster,gender,gameDate){
  return Array.isArray(ids)&&ids.length===8&&
    new Set(ids).size===8&&ids.includes(captain)&&
    ids.every(id=>eligible(roster.get(id),gender,gameDate));
}

export function planDefaultPhysicalEntryV1({team,event,stage,
  gameDate,savedLineup=null,savedTactics=null}){
  if(!team?.id||!Array.isArray(team.riders)||
    !['M','F'].includes(event?.gender)||
    typeof gameDate!=='string')
    throw new Error('Default entry needs an entered team and race date.');
  const route=normalizeRoute(stage);
  const {primary,secondary}=routeAdvice(route);
  const roster=new Map(team.riders.map(rider=>[rider.id,rider]));
  const entered=team.entry??{};
  let selected=entered.selected_riders;
  let captain=entered.captain_id;
  let lineupSource='entered';
  if(!validLineup(selected,captain,roster,event.gender,gameDate)){
    if(Array.isArray(selected)&&selected.length===8&&captain)
      throw new Error('A manager-selected lineup became ineligible.');
    selected=savedLineup?.selected_riders;
    captain=savedLineup?.captain_id;
    lineupSource='manager_default';
    if(!validLineup(selected,captain,roster,event.gender,gameDate)){
      const available=team.riders.filter(rider=>
        eligible(rider,event.gender,gameDate)&&
        [primary,secondary,'endurance','form','fatigue']
          .every(key=>Number.isFinite(rider[key])));
      available.sort((a,b)=>score(b,primary,secondary)-
        score(a,primary,secondary)||a.id.localeCompare(b.id));
      if(available.length<8)
        throw new Error('This entered team has fewer than eight eligible riders.');
      selected=available.slice(0,8).map(rider=>rider.id);
      captain=selected[0];
      lineupSource='game_ai';
    }
  }
  const captainRider=roster.get(captain);
  const support=selected.filter(id=>id!==captain)
    .map(id=>roster.get(id));
  support.sort((a,b)=>
    (2*b.leadership+b.endurance+b.flat)-
      (2*a.leadership+a.endurance+a.flat)||
    a.id.localeCompare(b.id));
  const roadCaptain=support[0].id;
  const tactic=savedTactics?
    validateDefaultTacticsV1(savedTactics):{
      effort:'conserve',chase:'selective',attack:'none',
      front_work:'rotate',sporting_goal:'none'};
  const orders={version:2,captainId:captain,
    roadCaptainId:roadCaptain,
    helperIds:selected.filter(id=>
      id!==captain&&id!==roadCaptain),
    baseline:{effort:tactic.effort,chase:tactic.chase,
      attack:tactic.attack,
      ...(tactic.attack==='none'?{}:{attackRiderId:captain}),
      frontWork:tactic.front_work},phases:[]};
  if(!captainRider)throw new Error('The entered captain is missing.');
  return {version:DEFAULT_PHYSICAL_ENTRY_POLICY_VERSION,
    lineupSource,tacticsSource:savedTactics?
      'manager_default':'game_ai',
    selectedRiders:[...selected],captainId:captain,orders,
    stake:{sportingGoal:tactic.sporting_goal,
      sportingCaptainId:captain}};
}
