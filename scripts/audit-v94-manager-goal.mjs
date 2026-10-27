// Read-only paired audit: one declared rival goal changes, all race inputs stay.
// Provisional road outcomes here are not official placements or awards.
import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from '../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';

const seeds=process.argv.includes('--extended-seeds')?
  Array.from({length:12},(_,index)=>`manager-goal-holdout-${index+1}`):
  ['manager-goal-1','manager-goal-2','manager-goal-3'];
const selectedTeamId='rival-1';
const rows=[];
const average=(rows,key)=>{
  const values=rows.map(row=>row[key]).filter(Number.isFinite);
  return values.length?
    +(values.reduce((sum,value)=>sum+value,0)/values.length).toFixed(2):null;
};

for(const seed of seeds)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30])for(const format of ['one_day','stage']){
    const prepared=prepareV91Playtest({distanceKm:260,terrain,teamCount:20,
      fatigue,attack:'none',chase:'ignore',seed,
      defaultRivalPlan:'passive'});
    const races={};
    for(const role of ['break','control']){
      const plan=prepareV94RivalIntent({prepared,format,
        ...(format==='stage'?{stageNumber:8}:{}),
        rivalGoals:[{teamId:selectedTeamId,role}]});
      try{
        const race=simulateTacticalTour({stage:prepared.stage,
          weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
          motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
          raceContext:plan.raceContext,rivalIntent:plan.intent});
        validateRecordedTour(race);
        if(process.argv.includes('--replay'))replayRaceDynamicsRecording(race);
        races[role]=race;
      }catch(error){
        if(!String(error.message).startsWith('Unresolved front exhaustion'))throw error;
        races[role]={refusal:String(error.message)};
      }
    }
    if(races.break.refusal||races.control.refusal){
      rows.push({seed,terrain,fatigue,format,
        breakRefusal:races.break.refusal??null,
        controlRefusal:races.control.refusal??null});
      continue;
    }
    const one=races.break,two=races.control;
    if(!isDeepStrictEqual(one.route,two.route)||
      !isDeepStrictEqual(one.committedInputs.teams.flatMap(team=>team.riders),
        two.committedInputs.teams.flatMap(team=>team.riders))||
      one.committedInputs.teams.some((team,index)=>
        team.id!==selectedTeamId&&
        !isDeepStrictEqual(team.orders,two.committedInputs.teams[index].orders)))
      throw new Error('Paired manager-goal input changed beyond the selected team.');
    const measure=race=>({
      attackAttempts:race.frames.reduce((sum,frame)=>sum+
        frame.attackers.filter(id=>id.startsWith(selectedTeamId+'-')).length,0),
      chaseTeamKm:race.frames.filter(frame=>frame.chasers.includes(selectedTeamId)).length,
      firstChaseKm:race.frames.find(frame=>frame.chasers.includes(selectedTeamId))?.km??null,
      earlyChaseTeamKm:race.frames.filter(frame=>frame.km<=210&&
        frame.chasers.includes(selectedTeamId)).length,
      frontRiderKm:race.frames.reduce((sum,frame)=>sum+
        frame.breakawayRiderIds.filter(id=>id.startsWith(selectedTeamId+'-')).length,0),
      teamEnergyAt200:race.frames[199].teamEnergy.find(row=>
        row.teamId===selectedTeamId).mean,
      maxGapSeconds:Math.max(...race.frames.map(frame=>frame.gapSeconds)),
    });
    rows.push({seed,terrain,fatigue,format,
      break:measure(one),control:measure(two)});
  }

const summary=['one_day','stage'].map(format=>{
  const sample=rows.filter(row=>row.format===format);
  const completed=sample.filter(row=>row.break&&row.control);
  const measured=role=>completed.map(row=>row[role]);
  return {format,cases:sample.length,completed:completed.length,
    breakAttackAttempts:average(measured('break'),'attackAttempts'),
    controlAttackAttempts:average(measured('control'),'attackAttempts'),
    breakChaseTeamKm:average(measured('break'),'chaseTeamKm'),
    controlChaseTeamKm:average(measured('control'),'chaseTeamKm'),
    controlMeanFirstChaseKm:average(measured('control'),'firstChaseKm'),
    controlEarlyChaseTeamKm:average(measured('control'),'earlyChaseTeamKm'),
    breakFrontRiderKm:average(measured('break'),'frontRiderKm'),
    controlFrontRiderKm:average(measured('control'),'frontRiderKm'),
    breakTeamEnergyAt200:average(measured('break'),'teamEnergyAt200'),
    controlTeamEnergyAt200:average(measured('control'),'teamEnergyAt200'),
    breakMeanMaxGapSeconds:average(measured('break'),'maxGapSeconds'),
    controlMeanMaxGapSeconds:average(measured('control'),'maxGapSeconds'),
    refusals:sample.length-completed.length};
});
console.log(JSON.stringify({note:'Internal paired synthetic manager-goal audit, not official results.',
  summary,...(process.argv.includes('--rows')?{rows}:{})},null,2));
