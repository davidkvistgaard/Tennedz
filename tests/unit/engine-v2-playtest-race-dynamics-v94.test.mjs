import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';

test('experimental race preview exposes committed intent and paid road only',()=>{
  const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,fatigue:30,
      attack:'none',chase:'selective',seed:'preview-recorded-road-1'}});
  assert.equal(preview.frames.length,120);
  assert.equal(preview.teamPlans.length,20);
  assert.equal(preview.resultStatus,'provisional_road_groups_only');
  assert.equal(preview.policy.rivalIntentVersion,4);
  assert.equal(preview.policy.frontRotationVersion,3);
  assert.equal(preview.policy.controlPursuitVersion,2);
  assert.equal(preview.policy.frontExhaustionVersion,3);
  assert.equal(preview.policy.controlWithdrawalVersion,undefined);
  assert.equal(preview.story.widestRecordedLead.gapSeconds,
    Math.max(...recording.frames.map(frame=>frame.gapSeconds)));
  assert.equal(preview.story.kilometresAtOrAboveOneMinute,
    recording.frames.filter(frame=>frame.gapSeconds>=60).length);
  assert.ok(preview.frames.every((frame,index)=>{
    const source=recording.frames[index];
    return frame.gapSeconds===source.gapSeconds&&
      frame.ownRiders.length===8&&
      frame.ownRiders.every(row=>source.riderGroups.some(rider=>
        rider.id===row.id&&rider.energy===row.energy))&&
      frame.roadGroups.every(group=>source.roadGroups.some(recorded=>
        recorded.id===group.id&&recorded.gapSeconds===group.gapSeconds));
  }));
  assert.ok(preview.teamPlans.every(row=>row.role&&row.source&&row.baseline));
  assert.equal(Object.hasOwn(preview,'provisionalResults'),false);
  assert.equal(Object.hasOwn(preview,'officialAwards'),false);
});

test('experimental preview rejects unsupported settings before simulation',()=>{
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    controlWithdrawalVersion:3,settings:{distanceKm:40}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'classic',
    settings:{distanceKm:40}}),/valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,unknown:true}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,managerTactics:[]}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,teamCount:4},
    rivalGoals:[{teamId:'rival-20',role:'break'}]}),
  /valid rival goals/);
});

test('declared preview goal changes only its rival opening intent',()=>{
  const input={format:'one_day',settings:{distanceKm:40,teamCount:4,
    seed:'preview-goal-pair'}};
  const seeded=createV94RaceDynamicsPreview(input).preview;
  const declared=createV94RaceDynamicsPreview({...input,rivalGoals:[{
    teamId:'rival-1',role:'break'}]}).preview;
  const selected=declared.teamPlans.find(row=>row.teamId==='rival-1');
  assert.equal(selected.source,'manager_goal');
  assert.equal(selected.role,'break');
  assert.equal(selected.baseline.attack,'repeated');
  assert.equal(selected.baseline.chase,'ignore');
  assert.deepEqual(declared.teamPlans.filter(row=>row.teamId!=='rival-1'),
    seeded.teamPlans.filter(row=>row.teamId!=='rival-1'));
  assert.equal(declared.resultStatus,'provisional_road_groups_only');
});

test('withdrawal comparison is explicit and remains a provisional road preview',()=>{
  const input={format:'stage',settings:{distanceKm:40,teamCount:4,
    seed:'preview-withdrawal-option'}};
  const current=createV94RaceDynamicsPreview(input).preview;
  const experimental=createV94RaceDynamicsPreview({...input,
    controlWithdrawalVersion:2}).preview;
  assert.equal(current.policy.controlWithdrawalVersion,undefined);
  assert.equal(experimental.policy.controlWithdrawalVersion,2);
  assert.deepEqual(experimental.teamPlans,current.teamPlans);
  assert.equal(experimental.resultStatus,'provisional_road_groups_only');
  assert.equal(Object.hasOwn(experimental,'provisionalResults'),false);
});
