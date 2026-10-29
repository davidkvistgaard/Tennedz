import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {runRearRecordedBunchOriginV1,
  validateRearRecordedBunchOriginV1} from
  '../../lib/engine/v2/rear-recorded-bunch-origin-v1.mjs';

test('V94 paid bunch turn can anchor a separate physical start road',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    roadGroupPaceVersion:3,bunchFrontTurnVersion:1,
    chaseTurnVersion:1,pelotonFrontTurnVersion:1,
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,
      fatigue:30,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'}});
  const turn=recording.frames[0].pelotonFrontTurnPlan.turns[0];
  const riderId=turn.leaderRiderId;
  const team=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const choices=Array.from({length:5},(_,index)=>({riderId,
    km:index+1,effort:orderAt(team.orders,index).effort,
    action:'hold_wheel',reason:'follow_order'}));
  const input={recording,riderId,throughKm:5,choices};
  const source=runRearRecordedBunchOriginV1(input);
  assert.equal(source.road.steps.length,5);
  assert.equal(source.road.steps[0].slices[0].role,'leader');
  assert.equal(source.checkpointGroupIsPhysicalPosition,false);
  assert.equal(validateRearRecordedBunchOriginV1(input,source),true);
  const forged=structuredClone(source);
  forged.road.steps[0].slices[0].energySpent=0;
  assert.throws(()=>validateRearRecordedBunchOriginV1(input,forged),
    /differs/);
  const changed=structuredClone(recording);
  changed.frames[0].pelotonFrontTurnPlan.turns[0].ability+=1;
  assert.throws(()=>runRearRecordedBunchOriginV1({...input,
    recording:changed}),/differs|replay|recorded|turn/);
  const weakerId='rival-1-0';
  const weakerTeam=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===weakerId));
  assert.throws(()=>runRearRecordedBunchOriginV1({
    recording,riderId:weakerId,throughKm:1,
    choices:[{riderId:weakerId,km:1,
      effort:orderAt(weakerTeam.orders,0).effort,
      action:'hold_wheel',reason:'follow_order'}]}),
  /uncalibrated physical pace loss/);
});
