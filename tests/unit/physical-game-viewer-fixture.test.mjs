import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {physicalGameViewerFixture} from
  '../support/physical-game-viewer-fixture.mjs';
import {verifyPhysicalFirstRaceDocument} from
  '../../lib/viewer/physical-first-race-document-v3.mjs';

test('browser fixture is a paid complete game-shaped race',()=>{
  const document=physicalGameViewerFixture();
  assert.equal(verifyPhysicalFirstRaceDocument(document),document);
  const tampered=structuredClone(document);
  tampered.input.seedProvenance='changed-after-save';
  assert.throws(()=>verifyPhysicalFirstRaceDocument(tampered),
    /changed after recording/);
  assert.deepEqual(validateFeed(document.feed),document.feed);
  assert.equal(document.feed.riders.length,16);
  assert.equal(document.source.validatedRiderKilometres,320);
  assert.equal(document.coverage.officialResults,false);
});

test('game-shaped fields retain complete paid riders in both categories',()=>{
  for(const category of ['men','women'])
    for(const teamCount of [4,18]){
      const document=physicalGameViewerFixture({category,teamCount});
      assert.deepEqual(validateFeed(document.feed),document.feed);
      assert.equal(document.feed.riderCategory,category);
      assert.equal(document.feed.riders.length,teamCount*8);
      assert.equal(document.source.validatedRiderKilometres,
        teamCount*8*20);
      assert.equal(document.finishEvidence.entries.length,teamCount*8);
      assert.equal(document.coverage.officialResults,false);
    }
});
