import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {recordedGroupFinish} from
  '../../lib/engine/v2/race-group-finish-v94.mjs';

test('finish checkpoint preserves only recorded group membership and time',()=>{
  const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm:40,terrain:'flat',teamCount:4,
      seed:'finish-checkpoint-1'}});
  assert.equal(preview.finish.km,40);
  assert.deepEqual(preview.finish.groups.map(group=>group.secondsAheadOfBunch),
    recording.frames.at(-1).roadGroups.map(group=>group.gapSeconds));
  assert.equal(Object.hasOwn(preview.finish,'positions'),false);
  const forged=structuredClone(recording);
  forged.frames.at(-1).roadGroups[0].riderIds.push(
    forged.frames.at(-1).riderGroups.find(row=>row.group==='peloton').id);
  assert.throws(()=>recordedGroupFinish(forged),
    /Invalid finish road-group membership/);
});
