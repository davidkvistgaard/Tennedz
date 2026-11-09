import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {physicalGameViewerFixture} from
  '../support/physical-game-viewer-fixture.mjs';
import {verifyPhysicalFirstRaceDocumentV2} from
  '../../lib/viewer/physical-first-race-document-v2.mjs';

test('browser fixture is a paid complete game-shaped race',()=>{
  const document=physicalGameViewerFixture();
  assert.equal(verifyPhysicalFirstRaceDocumentV2(document),document);
  assert.deepEqual(validateFeed(document.feed),document.feed);
  assert.equal(document.feed.riders.length,16);
  assert.equal(document.source.validatedRiderKilometres,320);
  assert.equal(document.coverage.officialResults,false);
});
