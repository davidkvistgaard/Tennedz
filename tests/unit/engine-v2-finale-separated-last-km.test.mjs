import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {recordFinaleSeparatedLastKmClock,
  validateFinaleSeparatedLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

test('two recorded road groups reach the line on the bunch marker clock',()=>{
  for(const teamCount of [15,20])for(const gender of ['M','F']){
    const {recording}=createV91Playtest({distanceKm:260,
      terrain:'mountain',teamCount,gender,fatigue:30,
      attack:'repeated',chase:'ignore',defaultRivalPlan:'attack',
      seed:'test-drive-acceptance-1'});
    const original=structuredClone(recording);
    const paid=recordFinaleSeparatedLastKmClock(recording);
    assert.equal(paid.sourceKm,259);
    assert.equal(paid.trace.frames.length,7);
    assert.equal(paid.passageFrames.at(-1).distanceM,260000);
    assert.equal(paid.line.bands.length,3);
    assert.equal(paid.line.riders.length,teamCount*8);
    assert.equal(paid.line.finalRiderEnergy.length,teamCount*8);
    assert.equal(paid.line.bands.at(-1).lastPossiblePlace,
      teamCount*8);
    const energy=new Map(recording.frames[258].riderGroups.map(row=>[
      row.id,row.energy]));
    for(const frame of paid.trace.frames){
      assert.equal(frame.riders.length,teamCount*8);
      for(const row of frame.riders){
        assert.ok(Math.abs(energy.get(row.riderId)-row.energy-
          row.energySpent)<1e-7);
        energy.set(row.riderId,row.energy);
      }
    }
    for(const frame of paid.passageFrames)
      for(const group of frame.groups)
        assert.ok(Math.abs(frame.bunchPassageSecondsFromBunchMarker-
          group.passageSecondsFromBunchMarker-
          group.gapSeconds)<1e-7);
    assert.equal(paid.pointsStatus,'withheld');
    assert.equal(paid.canCommitAwards,false);
    assert.equal(validateFinaleSeparatedLastKmClock(recording,paid),true);
    assert.deepEqual(recording,original);
  }
});

test('a forged group passage cannot replay as a paid finish',()=>{
  const {recording}=createV91Playtest({distanceKm:260,
    terrain:'mountain',teamCount:15,gender:'M',fatigue:30,
    attack:'repeated',chase:'ignore',defaultRivalPlan:'attack',
    seed:'test-drive-acceptance-1'});
  const forged=structuredClone(recordFinaleSeparatedLastKmClock(recording));
  forged.passageFrames[0].groups[0].passageSecondsFromBunchMarker+=1;
  assert.throws(()=>validateFinaleSeparatedLastKmClock(recording,forged),
    /does not replay/);
});
