export const WINTER_AGENT_TACTICS_VERSION='winter-agent-tactics-v1';

function ranked(rows,score){
  return [...rows].sort((a,b)=>score(b)-score(a)||
    a.id.localeCompare(b.id));
}

// Explicit, reproducible manager choices for the one flat Sunday pilot.
// The selected captain and eight entered riders remain the manager's inputs.
export function planWinterAgentTacticsV1({entry,riders,stage}){
  if(!entry||!Array.isArray(entry.selected_riders)||
    entry.selected_riders.length!==8||
    new Set(entry.selected_riders).size!==8||
    !entry.selected_riders.includes(entry.captain_id)||
    !Number.isInteger(stage?.distance_km)||
    stage.distance_km<100||!stage.tags?.includes('FLAT'))
    throw new Error('The winter agent policy requires an entered flat race.');
  const byId=new Map(riders.map(rider=>[rider.id,rider]));
  const selected=entry.selected_riders.map(id=>byId.get(id));
  if(selected.some(rider=>!rider||
    !['sprint','flat','hills','endurance','leadership','strength']
      .every(key=>Number.isFinite(rider[key]))))
    throw new Error('The agent policy needs measured selected riders.');
  const captain=byId.get(entry.captain_id);
  const support=selected.filter(rider=>rider.id!==captain.id);
  const roadCaptain=ranked(support,rider=>
    rider.leadership*2+rider.endurance+rider.flat)[0];
  const helpers=support.filter(rider=>rider.id!==roadCaptain.id);
  const sprintPlan=captain.sprint>=captain.hills;
  const phases=sprintPlan?[
    {atKm:Math.floor((stage.distance_km-50)/5)*5,
      chase:'selective',frontWork:'rotate'},
    {atKm:stage.distance_km-5,effort:'steady'},
  ]:[
    {atKm:stage.distance_km-5,effort:'steady'},
  ];
  const orders={version:2,captainId:captain.id,
    roadCaptainId:roadCaptain.id,
    helperIds:helpers.map(rider=>rider.id),
    baseline:{effort:'conserve',chase:'ignore',
      attack:'none',frontWork:sprintPlan?'rotate':'sit_in'},phases};
  return {version:WINTER_AGENT_TACTICS_VERSION,
    reason:sprintPlan?'flat_route_sprint_captain':
      'flat_route_climb_captain_conserve',
    orders,stake:{sportingGoal:sprintPlan?'sprint_finish':'none',
      sportingCaptainId:captain.id}};
}
