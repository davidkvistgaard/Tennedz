// Internal v94 workbench input. Resolve rival intent before the race, then
// commit both the roles and matching baseline orders to the recording.
// These probabilities are synthetic game choices, not measured race rates.
import seedrandom from 'seedrandom';
import {normalizeRaceContext} from './race-context-v1.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const BASELINES={
  break:{effort:'steady',attack:'repeated',chase:'ignore'},
  control:{effort:'steady',attack:'none',chase:'selective'},
  protect:{effort:'steady',attack:'none',chase:'selective'},
  opportunistic:{effort:'steady',attack:'selective',chase:'ignore'},
};

function roleForCommittedOrder(order){
  // An explicit attack remains eligible even if the same manager also orders
  // a chase; a protective/control role would suppress its ordinary cadence.
  if(order.attack!=='none')return order.chase==='ignore'?'break':'opportunistic';
  if(order.chase==='all')return 'control';
  if(order.chase==='selective')return 'protect';
  return 'opportunistic';
}

export function prepareV94RivalIntent({prepared,format,stageNumber}){
  const {settings,teams,seed,stage}=prepared??{};
  if(!settings||!Array.isArray(teams)||teams.length<2||teams[0].id!=='you'||
    typeof seed!=='string'||!seed||!stage)
    throw new Error('Invalid v94 rival intent inputs.');
  const context=normalizeRaceContext({format,stageNumber});
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
  const userRole=roleForCommittedOrder(teams[0].orders.baseline);
  const teamRoles={you:userRole},intent=[{teamId:'you',role:userRole,
    source:'manager',baseline:{...teams[0].orders.baseline}}];
  const committedTeams=teams.map((team,index)=>{
    if(index===0)return team;
    const source=customIds.has(team.id)?'manager':'generated';
    const baseline=team.orders.baseline;
    const leaderAdvantage=leaderAbility(team)-median;
    const roll=seedrandom(`v94-rival-intent:${seed}:${team.id}`)();
    const controlChance=clamp(.15+leaderAdvantage/150,.04,.30);
    const breakChance=clamp(.28-leaderAdvantage/120,.12,.45);
    const role=source==='manager'?roleForCommittedOrder(baseline):
      roll<controlChance?'control':
        roll<controlChance+breakChance?'break':
          roll<controlChance+breakChance+.12?'opportunistic':'protect';
    const selected=source==='manager'?{...baseline}:{...BASELINES[role]};
    teamRoles[team.id]=role;
    intent.push({teamId:team.id,role,source,baseline:selected});
    return {...team,orders:{...team.orders,baseline:selected}};
  });
  return {teams:committedTeams,raceContext:normalizeRaceContext({...context,
    teamRoles}),intent};
}
