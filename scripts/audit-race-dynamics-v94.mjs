// Read-only diagnostic for the opt-in candidate. It neither validates a
// recording nor treats provisional crossings as official race results.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';

const seeds=['sample-flat-finish','race-dynamics-1','race-dynamics-2'];
function run({seed,terrain,fatigue,format,breakTeams,controlTeams}){
  const teamCount=20;
  const managerTactics=Array.from({length:teamCount-1},(_,index)=>{
    const number=index+1;
    return number<=breakTeams?
      {effort:'steady',attack:'repeated',chase:'ignore'}:
      number<=breakTeams+controlTeams?
        {effort:'steady',attack:'none',chase:'selective'}:
        {effort:'steady',attack:'none',chase:'selective'};
  });
  const prepared=prepareV91Playtest({distanceKm:260,terrain,teamCount,
    fatigue,attack:'none',chase:'ignore',seed,managerTactics});
  const teamRoles=Object.fromEntries(prepared.teams.map((team,index)=>[
    team.id,index===0?'protect':index<=breakTeams?'break':
      index<=breakTeams+controlTeams?'control':'protect']));
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format,...(format==='stage'?{stageNumber:8}:{}),teamRoles}});
  const frames=recording.frames;
  const gaps=frames.map(frame=>frame.gapSeconds);
  const withFront=frames.filter(frame=>frame.breakawayRiderIds?.length>0);
  const finale=frames.filter(frame=>frame.km>210);
  const finalFrame=frames.at(-1);
  const frontIds=new Set(finalFrame.breakawayRiderIds);
  const average=(rows,field)=>+(rows.reduce((sum,row)=>sum+row[field],0)/rows.length)
    .toFixed(2);
  return {seed,terrain,fatigue,format,breakTeams,controlTeams,
    attacks:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    maxFrontRiders:Math.max(...frames.map(frame=>frame.breakawayRiderIds?.length??0)),
    maxGapSeconds:Math.max(...gaps),
    kilometresOverOneMinute:gaps.filter(gap=>gap>=60).length,
    kilometresOverFiveMinutes:gaps.filter(gap=>gap>=300).length,
    firstFiveMinuteKm:frames.find(frame=>frame.gapSeconds>=300)?.km??null,
    firstChaseKm:frames.find(frame=>frame.chasers.length>0)?.km??null,
    chasedTeamKilometres:frames.reduce((sum,frame)=>sum+frame.chasers.length,0),
    finaleMeanChasePower:average(finale,'chasePower'),
    finaleMeanPassiveGapDelta:average(finale,'passiveGapDelta'),
    easedTeamKilometres:frames.reduce((sum,frame)=>sum+frame.bunchEaseTeamIds.length,0),
    finalGapSeconds:gaps.at(-1),
    finalFrontRiders:finalFrame.breakawayRiderIds.length,
    finalFrontMeanEnergy:frontIds.size?average(finalFrame.riderGroups.filter(row=>
      frontIds.has(row.id)),'energy'):null,
    finalBunchMeanEnergy:average(finalFrame.riderGroups.filter(row=>
      row.group==='peloton'),'energy'),
    caughtRiders:frames.reduce((sum,frame)=>
      sum+frame.caughtBreakawayRiderIds.length,0),
    frontPresentKm:withFront.length};
}

const rows=[];
for(const terrain of ['flat','mountain'])for(const fatigue of [0,30])
  for(const format of ['one_day','stage'])for(const seed of seeds)
    for(const [breakTeams,controlTeams] of [[3,2],[5,2],[5,4],[5,6]])
      rows.push(run({seed,terrain,fatigue,format,breakTeams,controlTeams}));
console.log(JSON.stringify({version:MOTOR_RACE_DYNAMICS_VERSION,
  note:'Internal opt-in role scenarios, not observed race calibration or official results.',
  rows},null,2));
