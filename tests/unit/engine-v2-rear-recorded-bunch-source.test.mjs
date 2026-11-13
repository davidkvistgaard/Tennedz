import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {rearRecordedBunchSourceV1} from
  '../../lib/engine/v2/rear-recorded-bunch-source-v1.mjs';

test('rear counterfactual reads only a replayed paid bunch leader',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({
    distanceKm:40,teamCount:4,seed:'rear-bunch-source-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'passive'});
  teams[0].orders.baseline.frontWork='rotate';
  teams[0].orders.baseline.effort='steady';
  const teamRoles=Object.fromEntries(teams.map(team=>
    [team.id,'protect']));
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    raceContext:{format:'one_day',teamRoles,
      chaseTurnVersion:1,bunchFrontTurnVersion:1,
      pelotonFrontTurnVersion:1},
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION});
  const km=recording.frames.findIndex(frame=>
    frame.pelotonFrontTurnPlan?.status==='worked')+1;
  assert.ok(km>0);
  const source=rearRecordedBunchSourceV1({recording,km});
  assert.equal(source.sourceKm,km);
  assert.equal(source.turnPlan.status,'worked');
  assert.equal(source.turnPlan.turns[0].startM,0);
  assert.equal(source.turnPlan.turns.at(-1).endM,1000);
  assert.throws(()=>rearRecordedBunchSourceV1({recording,km,
    rearRiderIds:[source.turnPlan.turns[0].leaderRiderId]}),
  /distinct paid bunch leaders/);
  const forged=structuredClone(recording);
  forged.frames[km-1].pelotonFrontTurnPlan.turns[0].ability+=1;
  assert.throws(()=>rearRecordedBunchSourceV1({recording:forged,km}),
    /differ|Invalid|inconsistent/);
});
