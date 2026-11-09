import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalFirstRaceDocumentV2,
  sealPhysicalFirstRaceDocumentV2} from
  '../../lib/viewer/physical-first-race-document-v2.mjs';
import {physicalSpectatorFeedV1,
  physicalSpectatorFramesV1,
  physicalSpectatorFinishV1,
  PHYSICAL_SPECTATOR_PROJECTION_VERSION} from
  '../../lib/viewer/physical-spectator-projection-v1.mjs';

const eventId='89af7f2d-f405-4c92-8215-ffb752b4a5ca';
const fixture=createPhysicalFirstRaceDocumentV2('women');
const document=sealPhysicalFirstRaceDocumentV2({
  feed:fixture.feed,finishEvidence:fixture.finishEvidence,
  coverage:{...fixture.coverage,officialResults:false},
  source:fixture.source,version:fixture.adapterVersion},
  {...fixture.input,eventId,officialResults:false});

test('spectator projection excludes private race inputs and future events',
  ()=>{
    const projection=physicalSpectatorFeedV1(document,eventId,0);
    assert.equal(projection.version,
      PHYSICAL_SPECTATOR_PROJECTION_VERSION);
    assert.equal(projection.raceId,document.raceId);
    assert.equal(projection.sha256,document.sha256);
    assert.equal(projection.feed.synthetic,true);
    assert.equal(projection.feed.streaming,true);
    assert.deepEqual(projection.feed.events,[]);
    assert.equal(projection.availableThrough,0);
    assert.equal(projection.feed.frames.length,2);
    assert.deepEqual(projection.feed.frames[1].positions,[]);
    assert.equal(projection.feed.riders.length,
      document.feed.riders.length);
    assert.equal(projection.feed.results,undefined);
    const serialized=JSON.stringify(projection);
    assert.equal(serialized.includes('"input"'),false);
    assert.equal(serialized.includes('"source"'),false);
    assert.equal(serialized.includes('"finishEvidence"'),false);
    assert.throws(()=>physicalSpectatorFeedV1(document,
      '4efc7fa5-4ff7-46ba-92d0-9422884eed79',0),/does not match/);
  });

test('frame increments contain reached physical checkpoints only',()=>{
  const first=document.feed.frames[1].time;
  const before=physicalSpectatorFramesV1(document,eventId,
    first-0.001,0);
  assert.deepEqual(before.frames,[]);
  const reached=physicalSpectatorFramesV1(document,eventId,first,0);
  assert.equal(reached.frames.length,1);
  assert.deepEqual(reached.frames[0],document.feed.frames[1]);
  assert.equal(reached.availableThrough,first);
  const end=physicalSpectatorFeedV1(document,eventId,
    document.feed.duration);
  assert.equal(end.feed.frames.length,document.feed.frames.length);
});

test('finish evidence is released only after shared finish publication',
  ()=>{
    assert.throws(()=>physicalSpectatorFinishV1(document,eventId,{
      raceId:document.raceId,recordingPublished:true,
      finishPublished:false}),/not been published/);
    const result=physicalSpectatorFinishV1(document,eventId,{
      raceId:document.raceId,recordingPublished:true,
      finishPublished:true});
    assert.equal(result.sha256,document.sha256);
    assert.equal(result.finishEvidence.publishedAt,
      document.feed.duration);
    assert.equal(result.finishEvidence.entries.length,
      document.feed.riders.length);
    assert.equal(JSON.stringify(result).includes('"input"'),false);
    assert.equal(JSON.stringify(result).includes('"source"'),false);
  });
