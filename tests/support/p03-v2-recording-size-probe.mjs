// Read-only storage feasibility probe. It does not use a database or write
// the large recording to disk; it measures a realistic serialized contract.
import {performance} from 'node:perf_hooks';
import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';
import {previewLockedV2RecordedDivisions} from '../../lib/race/v2-candidate.mjs';
import {buildV2OneDayResultContract,validateV2OneDayResultContract}
  from '../../lib/race/v2-result-contract.mjs';
import {projectV2RecordedDivisionForTeam} from '../../lib/race/v2-viewer.mjs';

const count=Number(process.argv[2]??45);
const distance=Number(process.argv[3]??140);
if(!Number.isInteger(count)||count<2||count>400||
  !Number.isInteger(distance)||distance<20||distance>400)
  throw new Error('Usage: node p03-v2-recording-size-probe.mjs [2-400 teams] [20-400 km]');
const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const teams=Array.from({length:count},(_,teamIndex)=>{
  const id=`team-${teamIndex}`;
  const riders=Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-r${riderIndex}`,name:`Rider ${teamIndex}-${riderIndex}`,
    gender:'M',form:65,fatigue:10,leadership:50,
    ...Object.fromEntries(skills.map(skill=>[skill,55+(teamIndex%15)])),
  }));
  return {id,name:`Team ${teamIndex}`,riders,entry:{
    selected_riders:riders.map(rider=>rider.id),captain_id:riders[0].id}};
});
const eventId='recording-size-probe';
const reveal=assignPointDivisions({eventId,seasonYear:2026,gender:'M',
  entrants:teams.map((team,index)=>({teamId:team.id,earnedPoints:count-index}))});
const lock={v2_input_version:1,event:{id:eventId,kind:'one_day',gender:'M',
  calendar_source:'PELOTONIA',race_tier:3,scheduled_at:'2026-10-08T12:00:00Z',
  weather_locked:{temp_c:15,wind_kph:10,precipitation_mm:0}},
stage:{distance_km:distance,profile_points:[[0,25],[distance,25]],keypoints:[]},
game_date:'2026-10-08',teams,locked_division_reveal:reveal,
v2_orders_by_team_id:Object.fromEntries(teams.map(team=>[team.id,{
  captainId:team.entry.captain_id,preset:'balanced'}]))};
const start=performance.now();
const candidate=previewLockedV2RecordedDivisions(lock);
const simulatedMs=Math.round(performance.now()-start);
const contract=buildV2OneDayResultContract(candidate,{tier:3});
const builtMs=Math.round(performance.now()-start);
validateV2OneDayResultContract(contract);
const validatedMs=Math.round(performance.now()-start);
const divisionBytes=contract.divisions.map(division=>
  Buffer.byteLength(JSON.stringify(division)));
const contractBytes=Buffer.byteLength(JSON.stringify(contract));
const viewerStart=performance.now();
const viewer=projectV2RecordedDivisionForTeam(contract,teams[0].id);
const viewerMs=Math.round(performance.now()-viewerStart);
const viewerBytes=Buffer.byteLength(JSON.stringify(viewer));
console.log(JSON.stringify({teams:count,distanceKm:distance,divisions:divisionBytes.length,
  divisionBytes,contractBytes,contractMiB:+(contractBytes/1048576).toFixed(2),
  viewerBytes,viewerMiB:+(viewerBytes/1048576).toFixed(2),viewerMs,
  simulatedMs,builtMs,validatedMs,frames:contract.divisions.reduce((total,division)=>
    total+division.recording.frames.length,0)}));
