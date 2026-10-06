// Read-only comparison with the P03 legacy balance probe. No game path or data writes.
// Run: node tests/support/p03-v2-balance-probe.mjs
import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';
import {previewRecordedDivisions} from '../../lib/race/v2-candidate.mjs';
import {gzipSync} from 'node:zlib';

const skills=['sprint','flat','hills','mountain','cobbles',
  'timetrial','endurance','strength','wind'];
function snapshot(level,opponentLevel=level,seed='fixed',options={}){
  const teams=['a','b'].map(id=>{
    const teamLevel=id==='a'?level:opponentLevel;
    const selected=Array.from({length:8},(_,index)=>`${id}${index}`);
    return {id,name:id,riders:selected.map((riderId,index)=>({id:riderId,name:riderId,gender:'M',
      ...Object.fromEntries(skills.map(skill=>[skill,Math.min(100,teamLevel+
        (options.varied?[-8,-6,-4,-2,2,4,6,8][index]:0))])),form:70,fatigue:10})),
      entry:{selected_riders:selected,captain_id:selected[0]}};
  });
  return {event:{id:'balance-probe',seed,kind:'one_day',gender:'M',
    scheduled_at:'2026-01-01T12:00:00Z',weather_locked:{temp_c:18,wind_kph:5,
      precipitation_mm:0}},game_date:'2026-01-01',
    stage:{distance_km:140,tags:[options.hilly?'HILLY':'FLAT'],
      profile_points:options.hilly?[[0,0],[35,0],[45,600],[55,0],[90,0],[100,600],
        [110,0],[140,0]]:[[0,0],[140,0]]},teams,
    locked_division_reveal:assignPointDivisions({eventId:'balance-probe',seasonYear:2026,
      gender:'M',entrants:teams.map(team=>({teamId:team.id,earnedPoints:0}))})};
}

function divisionSnapshot(seed='fixed',hilly=false,count=15){
  const spread=[-8,-6,-4,-2,2,4,6,8];
  const teams=Array.from({length:count},(_,teamIndex)=>{
    const id=`team-${String(teamIndex+1).padStart(2,'0')}`;
    const level=count===15?65+teamIndex*2.5:65+teamIndex*.7;
    const selected=spread.map((_,riderIndex)=>`${id}-r${riderIndex+1}`);
    return {id,name:id,riders:selected.map((riderId,riderIndex)=>({
      id:riderId,name:riderId,gender:'M',
      ...Object.fromEntries(skills.map(skill=>[skill,
        Math.min(100,level+spread[riderIndex])])),form:70,fatigue:10,
    })),entry:{selected_riders:selected,captain_id:selected[0]}};
  });
  return {event:{id:'division-balance-probe',seed,kind:'one_day',gender:'M',
    scheduled_at:'2026-01-01T12:00:00Z',weather_locked:{temp_c:18,wind_kph:5,
      precipitation_mm:0}},game_date:'2026-01-01',
    stage:{distance_km:140,tags:[hilly?'HILLY':'FLAT'],
      profile_points:hilly?[[0,0],[35,0],[45,600],[55,0],[90,0],[100,600],
        [110,0],[140,0]]:[[0,0],[140,0]]},teams,
    locked_division_reveal:assignPointDivisions({eventId:'division-balance-probe',
      seasonYear:2026,gender:'M',entrants:teams.map((team,index)=>({
        teamId:team.id,earnedPoints:index}))})};
}

function specialistSnapshot(route,skillDelta=15,seed='fixed'){
  const teams=['flat-specialists','climbers'].map(id=>{
    const selected=Array.from({length:8},(_,index)=>`${id}-${index}`);
    const flat=id==='flat-specialists';
    return {id,name:id,riders:selected.map((riderId,index)=>({
      id:riderId,name:riderId,gender:'M',
      ...Object.fromEntries(skills.map(skill=>[skill,skill==='flat'?80+(flat?skillDelta:-skillDelta):
        skill==='hills'||skill==='mountain'?80+(flat?-skillDelta:skillDelta):80])),
      form:70,fatigue:10,
    })),entry:{selected_riders:selected,captain_id:selected[0]}};
  });
  const profile=route==='mountain'?[[0,0],[20,1200],[40,0],[60,1200],
    [80,0],[100,1200],[120,0],[140,0]]:[[0,0],[140,0]];
  return {event:{id:'specialist-balance-probe',seed,kind:'one_day',gender:'M',
    scheduled_at:'2026-01-01T12:00:00Z',weather_locked:{temp_c:18,wind_kph:5,
      precipitation_mm:0}},game_date:'2026-01-01',
    stage:{distance_km:140,tags:[route==='mountain'?'MOUNTAIN':'FLAT'],
      profile_points:profile},teams,
    locked_division_reveal:assignPointDivisions({eventId:'specialist-balance-probe',
      seasonYear:2026,gender:'M',entrants:teams.map(team=>({
        teamId:team.id,earnedPoints:0}))})};
}

const readings=[30,40,50,60,80,100].map(skill=>{
  const results=previewRecordedDivisions(snapshot(skill)).divisions[0].recording.provisionalResults;
  return {skill,winnerTimeSeconds:results[0].timeSeconds,
    fieldSpreadSeconds:+(results.at(-1).timeSeconds-results[0].timeSeconds).toFixed(2)};
});
const mixed=[[60,55],[70,60],[80,70],[90,80],[100,80],[100,30]].map(([strongSkill,opponentSkill])=>{
  const results=previewRecordedDivisions(snapshot(strongSkill,opponentSkill)).divisions[0]
    .recording.provisionalResults;
  return {strongSkill,opponentSkill,winnerTeamId:results[0].teamId,
    topEightStrong:results.slice(0,8).filter(row=>row.teamId==='a').length,
    firstOpponentGapSeconds:results.find(row=>row.teamId==='b').gapSeconds};
});
const threshold=[90,92,94,96,98,100].map(strongSkill=>{
  const seeds=['fixed','alternate-1','alternate-2'];
  return {strongSkill,opponentSkill:80,gapsSeconds:seeds.map(seed=>{
    const recording=previewRecordedDivisions(snapshot(strongSkill,80,seed)).divisions[0]
      .recording;
    return recording.provisionalResults.find(row=>row.teamId==='b').gapSeconds;
  })};
});
const cliffRecording=previewRecordedDivisions(snapshot(96,80)).divisions[0].recording;
const firstOpponentDrop=cliffRecording.frames.find(frame=>
  frame.riderGroups.some(row=>row.teamId==='b'&&row.group==='dropped'));
const cliff={firstOpponentDropKm:firstOpponentDrop?.km??null,
  finalOpponentDeficitSeconds:cliffRecording.frames.at(-1).riderGroups
    .find(row=>row.teamId==='b')?.deficitSeconds??null};
const variedFields=[false,true].flatMap(hilly=>[90,94,96,98,100].map(strongSkill=>({
  route:hilly?'hilly':'flat',strongSkill,opponentSkill:80,
  gapsSeconds:['fixed','alternate-1','alternate-2'].map(seed=>{
    const results=previewRecordedDivisions(snapshot(strongSkill,80,seed,
      {varied:true,hilly})).divisions[0].recording.provisionalResults;
    return results.find(row=>row.teamId==='b').gapSeconds;
  }),
})));
const rankedDivision=[false,true].map(hilly=>{
  const recording=previewRecordedDivisions(divisionSnapshot('fixed',hilly)).divisions[0]
    .recording;
  const firstByTeam=Object.fromEntries(recording.committedInputs.teams.map(team=>[
    team.id,recording.provisionalResults.find(result=>result.teamId===team.id),
  ]));
  const serialized=JSON.stringify(recording);
  return {route:hilly?'hilly':'flat',recordingSize:{
    jsonBytes:Buffer.byteLength(serialized),gzipBytes:gzipSync(serialized).byteLength,
    frames:recording.frames.length,riders:recording.provisionalResults.length,
  },firstRiderByTeam:recording.committedInputs.teams
    .map((team,index)=>({teamId:team.id,skillLevel:65+index*2.5,
      position:firstByTeam[team.id].position,
      gapSeconds:+firstByTeam[team.id].gapSeconds.toFixed(2)})),
    droppedAtKm70:recording.frames[69].riderGroups.filter(row=>
      row.group==='dropped').length};
});
const fullFieldStarted=performance.now();
const fullField=previewRecordedDivisions(divisionSnapshot('fixed',false,45));
const fullFieldMs=Math.round(performance.now()-fullFieldStarted);
const fullFieldPayload=fullField.divisions.map(division=>{
  const serialized=JSON.stringify(division.recording);
  return {division:division.index,teams:division.teamIds.length,
    jsonBytes:Buffer.byteLength(serialized),gzipBytes:gzipSync(serialized).byteLength};
});
const specialists=['flat','mountain'].flatMap(route=>[5,10,15].flatMap(skillDelta=>
  ['fixed','alternate-1','alternate-2'].map(seed=>{
  const recording=previewRecordedDivisions(specialistSnapshot(route,skillDelta,seed)).divisions[0]
    .recording;
  return {route,skillDelta,seed,firstFinisherByTeam:['flat-specialists','climbers'].map(teamId=>{
    const first=recording.provisionalResults.find(result=>result.teamId===teamId);
    return {teamId,position:first.position,gapSeconds:+first.gapSeconds.toFixed(2)};
  }),droppedAtKm70:recording.frames[69].riderGroups.filter(row=>
    row.group==='dropped').length};
})));
console.log(JSON.stringify({simulator:'P03 v2 candidate',route:'140 km flat and hilly',
  seed:'fixed',uniformSkills:readings,mixedSkills:mixed,threshold,cliff,variedFields,
  rankedDivision,fullField:{elapsedMs:fullFieldMs,divisions:fullFieldPayload,
    totalJsonBytes:fullFieldPayload.reduce((sum,row)=>sum+row.jsonBytes,0),
    totalGzipBytes:fullFieldPayload.reduce((sum,row)=>sum+row.gzipBytes,0)},
  specialists},null,2));
