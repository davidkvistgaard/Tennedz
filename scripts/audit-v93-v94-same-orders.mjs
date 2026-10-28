// Read-only paired motor audit. Teams, riders, route and committed orders are
// identical across versions; V94 receives only a declared role map/format.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {resolveRandomRivalTactics} from
  '../lib/engine/v2/playtest-rival-random.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION,
  MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

const seedArg=process.argv.find(value=>value.startsWith('--seeds='));
const seedCount=seedArg?Number(seedArg.slice('--seeds='.length)):3;
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>12)
  throw new Error('Use --seeds=1 through 12.');
const seeds=['sample-flat-finish',...Array.from({length:seedCount-1},
  (_,index)=>`race-dynamics-${index+1}`)];
const rows=[];
for(const seed of seeds)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const managerTactics=resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
    const prepared=prepareV91Playtest({distanceKm:260,terrain,
      teamCount:20,fatigue,attack:'none',seed,managerTactics});
    const teamRoles=Object.fromEntries(prepared.teams.map(team=>{
      const order=team.orders.baseline;
      const role=team.id==='you'?'protect':order.chase==='all'?'control':
        order.attack!=='none'&&order.chase==='ignore'?'break':
          order.chase==='selective'?'protect':'opportunistic';
      return [team.id,role];
    }));
    const source={stage:prepared.stage,weather:prepared.weather,
      teams:prepared.teams,seed:prepared.seed};
    const old=simulateTacticalTour({...source,
      motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
    validateRecordedTour(old);
    for(const format of ['one_day','stage']){
      const next=simulateTacticalTour({...source,
        motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
        raceContext:{format,teamRoles,
          ...(format==='stage'?{stageNumber:8}:{})}});
      validateRecordedTour(next);
      replayRaceDynamicsRecording(next);
      const summarize=recording=>{
        const frames=recording.frames;
        const at210=frames[209];
        const controlIds=new Set(recording.committedInputs.teams.filter(
          team=>teamRoles[team.id]==='control').map(team=>team.id));
        const helperIds=new Set(recording.committedInputs.teams.filter(
          team=>controlIds.has(team.id)).flatMap(team=>team.orders.helperIds));
        const controlHelpers=at210.riderGroups.filter(row=>
          helperIds.has(row.id));
        const meanHelperEnergy=controlHelpers.length?
          controlHelpers.reduce((sum,row)=>sum+row.energy,0)/
            controlHelpers.length:null;
        return {maxGapSeconds:Math.max(...frames.map(frame=>frame.gapSeconds)),
          kmOver60:frames.filter(frame=>frame.gapSeconds>=60).length,
          frontKm:frames.filter(frame=>frame.roadGroups.length).length,
          paidChaseTeamKm:frames.reduce((sum,frame)=>
            sum+frame.chasers.length,0),
          paidControlChaseTeamKm:frames.reduce((sum,frame)=>sum+
            frame.chasers.filter(teamId=>controlIds.has(teamId)).length,0),
          paidBunchFrontKm:frames.filter(frame=>frame.paidBunchPace).length,
          controlHelperEnergyKm210:meanHelperEnergy};
      };
      rows.push({seed,terrain,fatigue,format,
        controlTeams:Object.values(teamRoles).filter(role=>
          role==='control').length,
        v93:summarize(old),v94:summarize(next)});
    }
  }

const mean=(items,field,version)=>{
  const values=items.map(row=>row[version][field]).filter(Number.isFinite);
  return values.length?+(values.reduce((sum,value)=>sum+value,0)/
    values.length).toFixed(2):null;
};
const summary=['one_day','stage'].flatMap(format=>[0,30].map(fatigue=>{
  const group=rows.filter(row=>row.format===format&&row.fatigue===fatigue);
  return {format,fatigue,cases:group.length,
    ...Object.fromEntries(['maxGapSeconds','kmOver60','frontKm',
      'paidChaseTeamKm','paidControlChaseTeamKm','paidBunchFrontKm',
      'controlHelperEnergyKm210'].map(field=>[
      field,{v93:mean(group,field,'v93'),v94:mean(group,field,'v94')}]))};
}));
console.log(JSON.stringify({version:'v93-v94-same-orders-audit-1',
  note:'Synthetic paired motors with identical source teams, riders, route and orders; V94 includes its versioned road and decision policy. No empirical calibration.',
  cases:rows.length,summary,...(process.argv.includes('--rows')?{rows}:{})},
null,2));
