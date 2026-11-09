import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateFeed,createSampler,createRaceExportLoader} from
  '@pelotonia/race-viewer/data';
import {createPhysicalFirstRaceDocumentV1,
  PHYSICAL_FIRST_RACE_DOCUMENT_VERSION} from
  '../../lib/viewer/physical-first-race-document-v1.mjs';
import {VIEWER_PREVIEW_CYCLE_MS,previewBroadcastClockV1,
  previewRacePublishedV1,
  previewVisibleEventsV1} from
  '../../lib/viewer/preview-clock-v1.mjs';

for(const category of ['men','women'])
  test(`versioned ${category} Motor Lab document reaches paid finish`,()=>{
    const document=createPhysicalFirstRaceDocumentV1(category);
    assert.equal(document.schemaVersion,
      PHYSICAL_FIRST_RACE_DOCUMENT_VERSION);
    assert.equal(document.raceId,document.feed.raceId);
    assert.equal(document.input.category,category);
    assert.deepEqual(validateFeed(document.feed),document.feed);
    assert.equal(document.feed.results,undefined);
    assert.equal(document.coverage.paidRiderKilometres,14400);
    assert.equal(document.finishEvidence.entries.length,120);
    assert.equal(createSampler(document.feed)(document.feed.duration)
      .positions.length,120);
    const {feed,finishEvidence,coverage}=document;
    assert.equal(document.sha256,
      createHash('sha256').update(JSON.stringify(
        {feed,finishEvidence,coverage})).digest('hex'));
    assert.equal(createPhysicalFirstRaceDocumentV1(category).sha256,
      document.sha256);
  });

test('distinct seed changes document identity and refuses invented inputs',()=>{
  const original=createPhysicalFirstRaceDocumentV1('men');
  const other=createPhysicalFirstRaceDocumentV1('men',
    {terrain:'flat',seed:'document-seed-2'});
  assert.notEqual(other.raceId,original.raceId);
  assert.notEqual(other.sha256,original.sha256);
  assert.throws(()=>createPhysicalFirstRaceDocumentV1('men',
    {winner:'you-1'}),/Choose valid/);
});

test('complete document is released only after the shared paid finish',()=>{
  const duration=createPhysicalFirstRaceDocumentV1('men').feed.duration;
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
    const document=createPhysicalFirstRaceDocumentV1('women');
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
