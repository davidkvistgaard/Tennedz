import test from 'node:test';
import assert from 'node:assert/strict';
import {positionRaceTargetV1} from
  '../../lib/race/position-race-target-v1.mjs';

const eventId='109a9235-44e6-d390-1fa9-aec19b65cf3b';
test('only the enabled committed race uses V7 dispatch',()=>{
  const env={PELOTONIA_V7_RACE_ENABLED:'true',
    PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:eventId};
  assert.equal(positionRaceTargetV1(eventId,env),true);
  assert.equal(positionRaceTargetV1(
    '109a9235-44e6-d390-1fa9-aec19b65cf3c',env),false);
  assert.equal(positionRaceTargetV1(eventId,{...env,
    PELOTONIA_V7_RACE_ENABLED:'false'}),false);
  assert.equal(positionRaceTargetV1(eventId,{...env,
    PELOTONIA_PHYSICAL_ENTRY_EVENT_ID:undefined}),false);
});
