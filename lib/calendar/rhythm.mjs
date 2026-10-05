export const STANDARD_RACE_DAYS=Object.freeze([3,0]); // UTC Wednesday, Sunday

function utcDate(value){
  const date=new Date(`${value}T12:00:00Z`);
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||
    !Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)
    throw new Error('Choose a valid source calendar date.');
  return date;
}

export function oneDaySlot(sourceDate,{preferredDay}={}){
  const date=utcDate(sourceDate);
  if(preferredDay!==undefined&&!['WEDNESDAY','SUNDAY'].includes(preferredDay))
    throw new Error('Choose Wednesday or Sunday.');
  const monday=new Date(date);
  monday.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  const wednesday=new Date(monday),sunday=new Date(monday);
  wednesday.setUTCDate(monday.getUTCDate()+2);
  sunday.setUTCDate(monday.getUTCDate()+6);
  const chosen=preferredDay==='WEDNESDAY'?wednesday:preferredDay==='SUNDAY'?sunday:
    Math.abs(date-wednesday)<=Math.abs(date-sunday)?wednesday:sunday;
  return chosen.toISOString().slice(0,10);
}

export function validCalendarPlacement(event){
  if(!event||!['M','F'].includes(event.gender)||
    !['ONE_DAY','STAGE_RACE'].includes(event.format)||
    !['UCI','PELOTONIA'].includes(event.source))return false;
  if(event.format==='ONE_DAY'){
    try{return STANDARD_RACE_DAYS.includes(utcDate(event.scheduledDate).getUTCDay());}
    catch{return false;}
  }
  try{return utcDate(event.startDate)<=utcDate(event.endDate);}
  catch{return false;}
}

export function entryReadiness(event,entry,now=new Date()){
  if(event.status==='FINISHED')return 'FINISHED';
  if(event.status==='LIVE')return 'LIVE';
  if(event.status==='OPEN'&&event.registration_deadline&&event.tactics_deadline&&
    new Date(event.deadline)<=now&&new Date(event.tactics_deadline)>now)
    return entry?'TACTICS_WINDOW':'REGISTRATION_CLOSED';
  if(event.status!=='OPEN'||new Date(event.deadline)<=now)return 'LOCKED';
  if(!entry||entry.selected_riders?.length!==event.teamSize||
    !entry.selected_riders.includes(entry.captain_id))return 'TEAM_INCOMPLETE';
  return entry.orders?'READY':'ORDERS_MISSING';
}
