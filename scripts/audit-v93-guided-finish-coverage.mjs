// Read-only coverage audit for the guided v93 final kilometre. A refusal is
// counted only after its attached kilometre road validates in full.
import {createV93CoastedPlaytest,validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';
import {resolveRandomRivalTactics} from
  '../lib/engine/v2/playtest-rival-random.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {generatePlaytestStageProfile} from
  '../lib/engine/v2/playtest-stage-generator.mjs';
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../lib/engine/v2/tuning.mjs';

const countArg=process.argv.find(value=>value.startsWith('--seeds='));
const count=countArg?Number(countArg.slice('--seeds='.length)):12;
const namedFrontWork=process.argv.includes('--named-front-work');
if(!Number.isInteger(count)||count<1||count>48)
  throw new Error('Use --seeds=1 through 48.');

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

const rows=[];
for(const terrain of namedFrontWork?['rolling','mountain']:
  ['flat','mountain'])for(const fatigue of [0,30])
  for(let index=0;index<count;index++){
    const seed=`guided-finish-coverage-${index+1}`;
    const managerTactics=resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
    const settings={distanceKm:260,
      terrain:namedFrontWork?'custom':terrain,
      ...(namedFrontWork?{profileHeightsM:generatePlaytestStageProfile({
        distanceKm:260,style:terrain,seed})}:{}),
      teamCount:20,fatigue,attack:'none',
      chase:namedFrontWork?'selective':'ignore',seed,managerTactics,
      ...(namedFrontWork?{managerTacticalOrdersV8:[
        {teamId:'you',atKm:5,attack:'selective',attackRiderId:'you-2',
          chaseTarget:'rival-1-2',frontWork:'rotate',
          frontWorkRiderId:'you-5'},
        {teamId:'you',atKm:25,attack:'none'}]}:{})};
    const input={plans:Array.from({length:20},(_,teamIndex)=>{
      const teamId=teamIndex?`rival-${teamIndex}`:'you';
      return {teamId,finisherId:`${teamId}-7`,leadOutRiderId:null};
    })};
    try{
      const race=createV93CoastedPlaytest(settings,input);
      validateV93CoastedPlaytest(settings,input,race);
      rows.push({seed,terrain,fatigue,status:'paid_finish',
        version:race.version,roadKm:race.recording.frames.length});
    }catch(error){
      const road=error.cause?.playtestSource?.recording??
        simulateTacticalTour({...prepareV91Playtest(settings),
          motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
      validateRecordedTour(road);
      const handoff=road.frames.at(-2);
      rows.push({seed,terrain,fatigue,status:'validated_refusal',
        reason:error.message,roadKm:road.frames.length,
        handoffKm:handoff?.km??null,
        handoffRoadGroups:handoff?.roadGroups.length??null,
        handoffDroppedRiders:handoff?.riderGroups.filter(row=>
          row.group==='dropped').length??null});
    }
  }

const counts=Object.groupBy(rows,row=>row.status==='paid_finish'?
  row.status:row.reason);
console.log(JSON.stringify({version:'v93-guided-finish-coverage-audit-1',
  note:'Synthetic seeded 20-team, 260 km guided-random inputs. No official awards.',
  namedFrontWork,
  cases:rows.length,counts:Object.fromEntries(Object.entries(counts).map(
    ([key,items])=>[key,items.length])),rows},null,2));
