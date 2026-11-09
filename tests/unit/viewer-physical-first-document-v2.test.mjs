import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed,createSampler,createRaceExportLoader} from
  '@pelotonia/race-viewer/data';
import {createPhysicalFirstRaceDocumentV2,
  PHYSICAL_FIRST_RACE_DOCUMENT_VERSION,
  sealPhysicalFirstRaceDocumentV2,
  verifyPhysicalFirstRaceDocumentV2} from
  '../../lib/viewer/physical-first-race-document-v2.mjs';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {VIEWER_PREVIEW_CYCLE_MS,previewBroadcastClockV1,
  previewRacePublishedV1,
  previewVisibleEventsV1} from
  '../../lib/viewer/preview-clock-v1.mjs';

for(const category of ['men','women'])
  test(`versioned ${category} Motor Lab document reaches paid finish`,()=>{
    const document=createPhysicalFirstRaceDocumentV2(category);
    assert.equal(document.schemaVersion,
      PHYSICAL_FIRST_RACE_DOCUMENT_VERSION);
    assert.equal(document.raceId,document.feed.raceId);
    assert.equal(document.input.category,category);
    assert.deepEqual(validateFeed(document.feed),document.feed);
    assert.equal(document.feed.results,undefined);
    assert.equal(document.coverage.paidRiderKilometres,14400);
    assert.equal(document.source.validatedKm,120);
    assert.equal(document.source.validatedRiderKilometres,14400);
    assert.match(document.source.commitmentHash,/^[a-f0-9]{64}$/);
    assert.equal(document.finishEvidence.entries.length,120);
    assert.equal(createSampler(document.feed)(document.feed.duration)
      .positions.length,120);
    assert.equal(verifyPhysicalFirstRaceDocumentV2(document),document);
    assert.equal(createPhysicalFirstRaceDocumentV2(category).sha256,
      document.sha256);
  });

test('recording digest survives JSONB key order and rejects tampering',()=>{
  const document=createPhysicalFirstRaceDocumentV2('men');
  const reorder=value=>Array.isArray(value)?value.map(reorder):
    value&&typeof value==='object'?Object.fromEntries(
      Object.keys(value).reverse().map(key=>[key,reorder(value[key])])):
      value;
  const restored=reorder(JSON.parse(JSON.stringify(document)));
  assert.equal(verifyPhysicalFirstRaceDocumentV2(restored),restored);
  const changed=structuredClone(restored);
  changed.feed.riders[0].name='Tampered rider';
  assert.throws(()=>verifyPhysicalFirstRaceDocumentV2(changed),
    /changed after recording/);
});

test('distinct seed changes document identity and refuses invented inputs',()=>{
  const original=createPhysicalFirstRaceDocumentV2('men');
  const other=createPhysicalFirstRaceDocumentV2('men',
    {terrain:'flat',seed:'document-seed-2'});
  assert.notEqual(other.raceId,original.raceId);
  assert.notEqual(other.sha256,original.sha256);
  assert.throws(()=>createPhysicalFirstRaceDocumentV2('men',
    {winner:'you-1'}),/Choose valid/);
});

test('document seal rejects mismatched motor provenance and race length',()=>{
  const race=createPhysicalFirstSplitViewerTestRaceV1('men');
  const input={category:'men'};
  assert.throws(()=>sealPhysicalFirstRaceDocumentV2(
    {...race,source:{...race.source,validatedKm:119}},input),
  /lacks paid race evidence/);
  assert.throws(()=>sealPhysicalFirstRaceDocumentV2(
    {...race,source:{...race.source,commitmentHash:'0'.repeat(63)}},
    input),/lacks paid race evidence/);
  assert.throws(()=>sealPhysicalFirstRaceDocumentV2(race,
    {category:'women'}),/lacks paid race evidence/);
});

test('complete document is released only after the shared paid finish',()=>{
  const duration=createPhysicalFirstRaceDocumentV2('men').feed.duration;
  const at=previewBroadcastClockV1(duration,0).clock.serverEpochMs;
  assert.equal(previewRacePublishedV1(duration,at),false);
  assert.equal(previewRacePublishedV1(duration,
    at+duration*1000-1),false);
  assert.equal(previewRacePublishedV1(duration,
    at+duration*1000),true);
});

test('shared clock releases recorded events only when reached',()=>{
  const feed={duration:12,events:[
    {time:0,label:'Start'},
    {time:5,label:'Contact'},
    {time:12,label:'Finish'}]};
  const anchor=previewBroadcastClockV1(feed.duration,0)
    .clock.serverEpochMs;
  assert.deepEqual(previewVisibleEventsV1(feed,anchor)
    .map(row=>row.label),['Start']);
  assert.deepEqual(previewVisibleEventsV1(feed,anchor+4999)
    .map(row=>row.label),['Start']);
  assert.deepEqual(previewVisibleEventsV1(feed,anchor+5000)
    .map(row=>row.label),['Start','Contact']);
  assert.deepEqual(previewVisibleEventsV1(feed,anchor+12000)
    .map(row=>row.label),['Start','Contact','Finish']);
  assert.deepEqual(previewVisibleEventsV1(feed,
    anchor+VIEWER_PREVIEW_CYCLE_MS).map(row=>row.label),['Start']);
});

test('package-native HTTP loader accepts the completed Motor Lab export',
  async()=>{
    const document=createPhysicalFirstRaceDocumentV2('women');
    const clock=previewBroadcastClockV1(document.feed.duration,
      document.feed.duration*1000).clock;
    const load=createRaceExportLoader({
      urlForRace:()=>
        'https://example.test/api/motor-lab/viewer-race?category=women',
      fetchImpl:async()=>new Response(JSON.stringify(
        {...document,clock,revision:0}))});
    const imported=await load(document.raceId);
    assert.equal(imported.feed.raceId,document.raceId);
    assert.equal(imported.feed.riders.length,120);
    assert.equal(imported.clock.duration,document.feed.duration);
    assert.equal(imported.revision,0);
    assert.equal(createSampler(imported.feed)(imported.feed.duration)
      .positions.length,120);
  });
