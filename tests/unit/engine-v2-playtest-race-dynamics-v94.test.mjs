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
  assert.throws(()=>createV94RaceDynamicsPreview({format:'classic',
    settings:{distanceKm:40}}),/valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,unknown:true}}),
  /valid experimental race settings/);
});
