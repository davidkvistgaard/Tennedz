// Read-only same-source accounting for the optional control-withdrawal rule.
// Group gaps and work come from validated, replayed recorded frames.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../lib/engine/v2/tuning.mjs';

const prepared=prepareV91Playtest({distanceKm:260,terrain:'mountain',
  teamCount:20,gender:'M',fatigue:30,attack:'none',chase:'selective',
  seed:'preview-boundary-6'});
const results=[];
for(const format of ['one_day','stage']){
  const plan=prepareV94RivalIntent({prepared,format,stageNumber:format==='stage'?8:
    undefined,controlTempoVersion:2,opportunisticSpecialistVersion:2,
  frontRotationVersion:3});
  const base={stage:prepared.stage,weather:prepared.weather,teams:plan.teams,
    seed:prepared.seed,motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    rivalIntent:plan.intent};
  const context={...plan.raceContext,controlPursuitVersion:2,
    frontObservationVersion:2,frontExhaustionVersion:3};
  for(const version of [1,2]){
    const recording=simulateTacticalTour({...base,raceContext:{...context,
      controlWithdrawalVersion:version}});
    validateRecordedTour(recording);
    replayRaceDynamicsRecording(recording);
    const window=recording.frames.filter(frame=>frame.km>=100&&frame.km<=200);
    const controlId='rival-14';
    const sum=predicate=>window.filter(predicate).length;
    const mean=values=>values.reduce((a,b)=>a+b,0)/values.length;
    results.push({format,version,
      widestLeadSeconds:Math.max(...recording.frames.map(frame=>
        frame.gapSeconds)),
      controlChaseKm100to200:sum(frame=>frame.chasers.includes(controlId)),
      controlFrontKm100to200:sum(frame=>
        frame.paidBunchPace?.teamId===controlId),
      controlWithdrawalKm100to200:sum(frame=>
        frame.disengagedControlTeamIds?.includes(controlId)),
      bunchEaseKm100to200:sum(frame=>frame.bunchEaseTeamIds.length>0),
      meanPassiveGapDeltaKm100to200:mean(window.map(frame=>
        frame.passiveGapDelta)),
      meanControlEnergyKm200:mean(recording.frames[199].riderGroups.filter(
        row=>row.teamId===controlId).map(row=>row.energy)),
      gapKm100:recording.frames[99].gapSeconds,
      gapKm200:recording.frames[199].gapSeconds});
  }
}
process.stdout.write(`${JSON.stringify(results,null,2)}\n`);
