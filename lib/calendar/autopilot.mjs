const formats=new Set(['ONE_DAY','STAGE_RACE']);

export function validateDefaultLineup(value,roster,{teamSize}){
  if(!value||!['M','F'].includes(value.gender)||!formats.has(value.eventFormat)||
    !Number.isInteger(teamSize)||teamSize<1||teamSize>20||
    !Array.isArray(value.selectedRiders)||value.selectedRiders.length!==teamSize||
    new Set(value.selectedRiders).size!==teamSize||
    !value.selectedRiders.includes(value.captainId))
    throw new Error('Choose a full, unique default team and its captain.');
  const byId=new Map(roster.map(rider=>[rider.id,rider]));
  if(value.selectedRiders.some(id=>byId.get(id)?.gender!==value.gender))
    throw new Error('Default riders must belong to the matching squad.');
  return value;
}

// A deterministic fallback, not a second race-performance model. The current
// sporting rating breaks ties; the race engine remains responsible for outcomes.
export function resolveAutopilotLineup({event,roster,explicitSelection,defaultSelection,
  unavailableRiderIds=[],teamSize}){
  if(!event||!['M','F'].includes(event.gender)||!formats.has(event.format)||
    !Number.isInteger(teamSize)||teamSize<1||teamSize>20)
    throw new Error('Invalid autopilot event.');
  const unavailable=new Set(unavailableRiderIds);
  const date=event.scheduledDate??event.startDate;
  const eligible=roster.filter(rider=>rider.gender===event.gender&&
    !unavailable.has(rider.id)&&(!rider.injury_until||!date||rider.injury_until<date));
  const byId=new Map(eligible.map(rider=>[rider.id,rider]));
  const selection=explicitSelection??defaultSelection;
  if(!selection)return {ready:false,reason:'DEFAULT_NOT_CONFIGURED',
    selectedRiders:[],missing:teamSize};
  const initial=selection?.selectedRiders??[];
  const selected=[...new Set(initial)].filter(id=>byId.has(id)).slice(0,teamSize);
  const replacements=eligible.filter(rider=>!selected.includes(rider.id))
    .sort((a,b)=>Number(b.rating??0)-Number(a.rating??0)||a.id.localeCompare(b.id));
  for(const rider of replacements){
    if(selected.length===teamSize)break;
    selected.push(rider.id);
  }
  if(selected.length<teamSize)return {ready:false,reason:'NOT_ENOUGH_ELIGIBLE_RIDERS',
    selectedRiders:selected,missing:teamSize-selected.length};
  const captain=selected.includes(selection?.captainId)?selection.captainId:
    [...selected].sort((a,b)=>Number(byId.get(b).rating??0)-Number(byId.get(a).rating??0)||
      a.localeCompare(b))[0];
  return {ready:true,source:explicitSelection?'EXPLICIT':'DEFAULT',
    selectedRiders:selected,captainId:captain,
    replacements:selected.filter(id=>!initial.includes(id))};
}
