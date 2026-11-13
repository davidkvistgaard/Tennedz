// Shared synthetic roster for the read-only Motor Lab. Keep the selector's
// attributes identical to the riders committed to the recorded race.
const SKILLS=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];

export function playtestTeamLevel(index){
  return index===0?78:index%4===1?82:index%4===2?76:80;
}

export function createPlaytestRider({teamId,teamName,gender,fatigue,level,
  riderIndex}){
  const value=Math.min(100,Math.max(0,level+(riderIndex-3)*2));
  return {id:`${teamId}-${riderIndex}`,
    name:`${teamName} rider ${riderIndex+1}`,
    gender,form:70,fatigue,leadership:50,
    ...Object.fromEntries(SKILLS.map(skill=>[skill,value])),
    sprint:Math.min(100,value+(riderIndex===7?14:0)),
    mountain:Math.min(100,value+(riderIndex===6?10:0)),
    endurance:Math.min(100,value+(riderIndex===5?10:0))};
}

export function playtestRiderCards(settings,teamId){
  const index=teamId==='you'?0:Number(teamId.slice(6));
  if(!Number.isInteger(index)||index<0||index>=settings.teamCount)
    return [];
  const name=index===0?'Your test team':`Fictional rival ${index}`;
  const override=settings.teamOverrides?.find(row=>row.teamId===teamId);
  return Array.from({length:8},(_,riderIndex)=>createPlaytestRider({
    teamId,teamName:name,gender:settings.gender,
    fatigue:override?.fatigue??settings.fatigue,
    level:override?.level??playtestTeamLevel(index),riderIndex}));
}
