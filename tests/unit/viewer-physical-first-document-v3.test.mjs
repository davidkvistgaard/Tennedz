import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalFirstRaceDocumentV2} from
  '../../lib/viewer/physical-first-race-document-v2.mjs';
import {createPhysicalFirstRaceDocumentV3,
  PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION,
  verifyPhysicalFirstRaceDocument} from
  '../../lib/viewer/physical-first-race-document-v3.mjs';

test('new document binds input metadata while historic v2 remains readable',()=>{
  const current=createPhysicalFirstRaceDocumentV3('men');
  assert.equal(current.schemaVersion,
    PHYSICAL_FIRST_RACE_DOCUMENT_V3_VERSION);
  assert.equal(verifyPhysicalFirstRaceDocument(current),current);
  const changed=structuredClone(current);
  changed.input.seed='altered-after-recording';
  assert.throws(()=>verifyPhysicalFirstRaceDocument(changed),
    /changed after recording/);
  const historic=createPhysicalFirstRaceDocumentV2('men');
  assert.equal(verifyPhysicalFirstRaceDocument(historic),historic);
  assert.notEqual(current.sha256,historic.sha256);
});
