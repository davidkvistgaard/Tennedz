import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION,MOTOR_RACE_DYNAMICS_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

test('v94 recording replays its locked stage, weather and paid race',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:40,
    teamCount:4,seed:'source-replay-94',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive'});
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,'protect']));
  const input={stage,weather,teams,seed,raceContext:{format:'one_day',teamRoles}};
  const recording=simulateTacticalTour({...input,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION});
  const saved=JSON.parse(JSON.stringify(recording));
  assert.deepEqual(replayRaceDynamicsRecording(saved),recording);
  const differentStage=structuredClone(saved);
  differentStage.committedInputs.stageSource.profile_points[1][1]+=200;
  assert.throws(()=>replayRaceDynamicsRecording(differentStage),/replay route/);
  const differentFrame=structuredClone(saved);
  differentFrame.frames[9].teamPace[0].meanAbility+=1;
  assert.throws(()=>replayRaceDynamicsRecording(differentFrame),/replay differs at km 10/);
  const older=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(Object.hasOwn(older.committedInputs,'stageSource'),false);
  assert.throws(()=>replayRaceDynamicsRecording(older),/requires v94/);
});
