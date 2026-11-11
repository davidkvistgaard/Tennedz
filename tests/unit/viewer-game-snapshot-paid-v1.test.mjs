import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createGameSnapshotPaidViewerDocumentV1,
  GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  '../../lib/viewer/game-snapshot-paid-viewer-v1.mjs';
import {createGameSnapshotPositionViewerDocumentV1,
  verifyGameSnapshotPositionViewerDocumentV1,
  loadGameSnapshotPositionViewerDocumentV1,
  createGameSnapshotPositionRaceBundleV1,
  verifyGameSnapshotPositionRaceBundleV1,
  loadGameSnapshotPositionRaceRecordingV1} from
  '../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {manifestFromCommittedPhysicalEntriesV1} from
  '../../lib/viewer/committed-physical-manifest-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV1,
  decodeGameSnapshotPositionRaceArchiveV1} from
  '../../lib/viewer/game-snapshot-position-archive-v1.mjs';
import {createPhysicalGameRaceDocumentV1,
  loadPhysicalGameRaceDocumentV1} from
  '../../lib/viewer/physical-game-race-source-v1.mjs';
import {adaptPhysicalFirstPositionRaceV2} from
  '../../lib/viewer/physical-first-position-adapter-v1.mjs';

const skills={sprint:65,flat:65,hills:65,mountain:65,
  cobbles:65,timetrial:65,endurance:65,strength:65,
  wind:65,leadership:65,form:50,fatigue:0};
function fixture(category='M',teamCount=2,distanceKm=20){
  const event={id:'game-fixture-race',kind:'one_day',
    gender:category,seed:'committed-game-seed',
    weather_locked:{temp_c:16,wind_kph:0,
      precipitation_mm:0}};
  const stage={distance_km:distanceKm,
    profile_points:[[0,100],[distanceKm,100]],
    keypoints:[]};
  const teams=Array.from({length:teamCount},(_,index)=>
    index===0?'a':index===1?'b':`team-${index+1}`).map(id=>{
    const riders=Array.from({length:8},(_,index)=>({
      ...skills,id:`${id}-${index+1}`,
      name:`Rider ${id} ${index+1}`,gender:category}));
    return {id,name:`Team ${id}`,riders,
      entry:{selected_riders:riders.map(row=>row.id),
        captain_id:`${id}-7`}};
  });
  const manifest={version:GAME_SNAPSHOT_PAID_VIEWER_VERSION,
    eventId:event.id,entries:teams.map((team,index)=>({
      teamId:team.id,
      orders:{version:2,captainId:`${team.id}-7`,
        roadCaptainId:`${team.id}-1`,
        helperIds:[2,3,4,5,6,8].map(n=>`${team.id}-${n}`),
        baseline:{effort:'steady',attack:'none',chase:'selective',
          frontWork:index===0?'rotate':'sit_in',
          frontWorkRiderId:index===0?`${team.id}-2`:null}},
      stake:{sportingGoal:'sprint_finish',
        sportingCaptainId:`${team.id}-7`},
      riderNumbers:Object.fromEntries(team.riders.map((rider,n)=>
        [rider.id,index*8+n+1])),
      style:{id:team.id,name:team.name,
        color:index===0?'#224466':'#664422',
        accent:'#ffffff',pattern:'band'}}))};
  return {snapshot:{event,stage,teams,
    game_date:'2026-11-09'},manifest};
}

for(const category of ['M','F'])
  test(`${category} committed game-shaped race exports paid viewer data`,()=>{
    const {snapshot,manifest}=fixture(category);
    const document=createGameSnapshotPaidViewerDocumentV1(
      snapshot,manifest);
    assert.deepEqual(validateFeed(document.feed),document.feed);
    assert.equal(document.feed.riderCategory,
      category==='M'?'men':'women');
    assert.equal(document.source.validatedKm,20);
    assert.equal(document.source.validatedRiderKilometres,320);
    assert.equal(document.coverage.officialResults,false);
    assert.equal(document.feed.riders.length,16);
    assert.equal(document.finishEvidence.entries.length,16);
    assert.equal(document.input.officialResults,false);
  });

for(const category of ['M','F'])
  test(`${category} future game snapshot exports V7 positions`,()=>{
    const {snapshot,manifest}=fixture(category);
    const document=createGameSnapshotPositionViewerDocumentV1(
      snapshot,manifest);
    assert.deepEqual(verifyGameSnapshotPositionViewerDocumentV1(
      document),document);
    assert.deepEqual(validateFeed(document.feed),document.feed);
    assert.equal(document.feed.synthetic,false);
    assert.equal(document.feed.results,undefined);
    assert.equal(document.feed.riders.length,16);
    assert.equal(document.feed.frames[0].positions.length,16);
    assert.equal(document.feed.frames.at(-1).positions.length,16);
    assert.equal(document.finishEvidence.entries.length,16);
    assert.equal(document.coverage.paidRiderKilometres,320);
    assert.equal(document.coverage.officialResults,false);
    assert.equal(document.input.positionGridVersion,
      'motor-lab-abstract-position-grid-1');
    assert.equal(document.source.replayed,true);
    assert.throws(()=>
      createGameSnapshotPositionViewerDocumentV1(
        {...snapshot,finished:true},manifest),
    /unfinished game race/);
    const changed=structuredClone(document);
    changed.feed.frames[1].positions[0].distance+=1;
    assert.throws(()=>
      verifyGameSnapshotPositionViewerDocumentV1(changed),
    /changed or lacks paid evidence/);
  });

test('120-rider committed-shape preview covers a whole race',()=>{
  const {snapshot,manifest}=fixture('F',15,120);
  const document=createGameSnapshotPositionViewerDocumentV1(
    snapshot,manifest);
  verifyGameSnapshotPositionViewerDocumentV1(document);
  assert.equal(document.feed.riders.length,120);
  assert.equal(document.source.validatedKm,120);
  assert.equal(document.source.validatedRiderKilometres,14400);
  assert.equal(document.coverage.recordedBoundaryFrames,121);
  assert.equal(document.finishEvidence.entries.length,120);
  assert.ok(document.feed.frames.every(frame=>
    frame.positions.length===120&&
    new Set(frame.positions.map(position=>
      position.riderId)).size===120));
});

test('saved position bundle retains a replayable motor record',()=>{
  const {snapshot,manifest}=fixture('M');
  const bundle=createGameSnapshotPositionRaceBundleV1(
    snapshot,manifest);
  assert.equal(verifyGameSnapshotPositionRaceBundleV1(
    bundle),bundle);
  assert.equal(bundle.race.decisionCount,320);
  assert.equal(bundle.document.source.inputHash,
    bundle.race.inputHash);
  const stored=JSON.parse(JSON.stringify(bundle));
  assert.deepEqual(verifyGameSnapshotPositionRaceBundleV1(
    stored),stored);
  const changed=structuredClone(bundle);
  changed.race.steps[0].sharedRoad.decisions[0]
    .energyAfter+=1;
  assert.throws(()=>
    verifyGameSnapshotPositionRaceBundleV1(changed));
  const wrongKit=structuredClone(bundle);
  wrongKit.presentation.teamStyles[0].color='#ff0000';
  assert.throws(()=>
    verifyGameSnapshotPositionRaceBundleV1(wrongKit),
  /changed its viewer projection/);
});

test('saved V2 position bundles still replay under the V3 exporter',()=>{
  const {snapshot,manifest}=fixture('M');
  const bundle=createGameSnapshotPositionRaceBundleV1(
    snapshot,manifest);
  const old=adaptPhysicalFirstPositionRaceV2({
    request:bundle.request,race:bundle.race,
    raceId:bundle.document.raceId,
    category:bundle.presentation.category,
    teamStyles:bundle.presentation.teamStyles,
    riderNumbers:bundle.presentation.riderNumbers,
    fixtureKind:'committed_game_snapshot',
    teamKitSource:'committed-game-manifest',
    riderNumberSource:'committed-game-manifest'});
  const payload={...bundle.document,
    adapterVersion:old.version,feed:old.feed,
    finishEvidence:old.finishEvidence,
    coverage:old.coverage,
    source:{...old.source,
      inputBridgeVersion:
        bundle.document.source.inputBridgeVersion,
      validatedKm:bundle.document.source.validatedKm,
      validatedRiderKilometres:
        bundle.document.source.validatedRiderKilometres}};
  delete payload.sha256;
  const canonical=value=>Array.isArray(value)?
    value.map(canonical):value&&typeof value==='object'?
      Object.fromEntries(Object.keys(value).sort().map(key=>
        [key,canonical(value[key])])):value;
  const sha256=createHash('sha256').update(
    JSON.stringify(canonical(payload))).digest('hex');
  const historical={...bundle,
    document:{...payload,sha256}};
  assert.equal(verifyGameSnapshotPositionRaceBundleV1(
    historical),historical);
});

test('compressed V7 archive replays its original motor and viewer document',()=>{
  const {snapshot,manifest}=fixture('F');
  const bundle=createGameSnapshotPositionRaceBundleV1(
    snapshot,manifest);
  const archive=encodeGameSnapshotPositionRaceArchiveV1(bundle);
  const repeat=encodeGameSnapshotPositionRaceArchiveV1(bundle);
  assert.deepEqual(repeat.metadata,archive.metadata);
  assert.deepEqual(repeat.body,archive.body);
  assert.ok(archive.body.length<
    archive.metadata.uncompressedBytes);
  assert.equal(archive.metadata.eventId,
    snapshot.event.id);
  assert.deepEqual(decodeGameSnapshotPositionRaceArchiveV1(
    archive),bundle);
  const changed=Buffer.from(archive.body);
  changed[changed.length-1]^=1;
  assert.throws(()=>decodeGameSnapshotPositionRaceArchiveV1({
    metadata:archive.metadata,body:changed}),
  /metadata changed/);
  assert.throws(()=>decodeGameSnapshotPositionRaceArchiveV1({
    metadata:{...archive.metadata,
      viewerDocumentSha256:'0'.repeat(64)},
    body:archive.body}),/another document/);
  assert.throws(()=>decodeGameSnapshotPositionRaceArchiveV1({
    metadata:{...archive.metadata,
      uncompressedBytes:100*1024*1024},
    body:archive.body}),/metadata changed/);
});

test('saved race input remains fixed through V7 projection',async()=>{
  const {snapshot,manifest}=fixture('F');
  const rows=manifest.entries.map(entry=>{
    const team=snapshot.teams.find(item=>
      item.id===entry.teamId);
    return {event_id:snapshot.event.id,
      team_id:entry.teamId,
      schema_version:'physical-entry-input-v1',
      selected_riders:team.entry.selected_riders,
      captain_id:team.entry.captain_id,
      orders:entry.orders,stake:entry.stake,
      team_style:entry.style,
      rider_numbers:entry.riderNumbers};
  });
  let snapshotReads=0,entryReads=0;
  const stored=await loadGameSnapshotPositionRaceRecordingV1({
    readSnapshot:async()=>{snapshotReads++;return snapshot;},
    readEntries:async eventId=>{
      assert.equal(eventId,snapshot.event.id);
      entryReads++;return rows;}});
  const document=stored.bundle.document;
  assert.deepEqual(stored.snapshot,snapshot);
  assert.deepEqual(stored.entries,rows);
  assert.equal(snapshotReads,3);
  assert.equal(entryReads,2);
  assert.equal(document.feed.riderCategory,'women');
  assert.equal(document.source.validatedRiderKilometres,320);
  let changedReads=0;
  await assert.rejects(loadGameSnapshotPositionViewerDocumentV1({
    readSnapshot:async()=>++changedReads===3?
      {...snapshot,finished:true}:snapshot,
    readEntries:async()=>rows}),
  /changed during position simulation/);
  let changedEntries=0;
  await assert.rejects(loadGameSnapshotPositionViewerDocumentV1({
    readSnapshot:async()=>snapshot,
    readEntries:async()=>++changedEntries===2?
      rows.slice().reverse():rows}),
  /changed during position simulation/);
});

test('saved physical entries become a complete paid viewer race',()=>{
  const {snapshot,manifest}=fixture('F');
  const rows=manifest.entries.map(entry=>{
    const team=snapshot.teams.find(item=>item.id===entry.teamId);
    return {event_id:snapshot.event.id,team_id:entry.teamId,
      schema_version:'physical-entry-input-v1',
      selected_riders:team.entry.selected_riders,
      captain_id:team.entry.captain_id,
      orders:entry.orders,stake:entry.stake,
      team_style:entry.style,rider_numbers:entry.riderNumbers};
  });
  const saved=manifestFromCommittedPhysicalEntriesV1(snapshot,rows);
  assert.deepEqual(saved,manifest);
  const document=createGameSnapshotPaidViewerDocumentV1(snapshot,saved);
  assert.equal(document.source.validatedRiderKilometres,320);
  assert.equal(document.feed.riderCategory,'women');
  assert.equal(document.coverage.officialResults,false);
  const direct=createPhysicalGameRaceDocumentV1(snapshot,rows);
  assert.equal(direct.sha256,document.sha256);
  assert.equal(direct.input.seedProvenance,'event-seed');
  assert.equal(direct.input.weatherProvenance,'event-locked-weather');
  assert.throws(()=>createPhysicalGameRaceDocumentV1(
    {...snapshot,finished:true},rows),/unfinished game race/);
  assert.throws(()=>manifestFromCommittedPhysicalEntriesV1(
    snapshot,rows.slice(1)),/Every participating team/);
  assert.throws(()=>manifestFromCommittedPhysicalEntriesV1(
    snapshot,[{...rows[0],selected_riders:[...rows[0].selected_riders]
      .reverse()},rows[1]]),/lineup changed/);
  assert.throws(()=>manifestFromCommittedPhysicalEntriesV1(
    snapshot,[{...rows[0],event_id:'different'},rows[1]]),
  /do not match/);
});

test('game snapshot refuses to infer tactical orders or race bibs',()=>{
  const {snapshot,manifest}=fixture();
  delete manifest.entries[0].orders.baseline;
  assert.throws(()=>createGameSnapshotPaidViewerDocumentV1(
    snapshot,manifest),/eight committed riders/);
  const other=fixture();
  delete other.manifest.entries[0].riderNumbers['a-1'];
  assert.throws(()=>createGameSnapshotPaidViewerDocumentV1(
    other.snapshot,other.manifest),/eight committed riders/);
  const injured=fixture();
  injured.snapshot.teams[0].riders[0].injury_until='2026-12-01';
  assert.throws(()=>createGameSnapshotPaidViewerDocumentV1(
    injured.snapshot,injured.manifest),/missing rider identity/);
  const missingAbility=fixture();
  delete missingAbility.snapshot.teams[0].riders[0].strength;
  assert.throws(()=>createGameSnapshotPaidViewerDocumentV1(
    missingAbility.snapshot,missingAbility.manifest),
  /missing rider identity/);
  const missingSeed=fixture();
  delete missingSeed.snapshot.event.seed;
  const seedFallback=createGameSnapshotPositionViewerDocumentV1(
    missingSeed.snapshot,missingSeed.manifest);
  assert.equal(seedFallback.input.seedProvenance,
    'official-engine-fallback');
  assert.match(seedFallback.source.raceSeed,
    /^game-fixture-race:/);
  const missingWeather=fixture();
  delete missingWeather.snapshot.event.weather_locked;
  const weatherFallback=createGameSnapshotPositionViewerDocumentV1(
    missingWeather.snapshot,missingWeather.manifest);
  assert.equal(weatherFallback.input.weatherProvenance,
    'official-engine-deterministic-fallback');
});

test('physical viewer loader refuses a changed source snapshot',async()=>{
  const {snapshot,manifest}=fixture();
  const rows=manifest.entries.map(entry=>{
    const team=snapshot.teams.find(item=>item.id===entry.teamId);
    return {event_id:snapshot.event.id,team_id:entry.teamId,
      schema_version:'physical-entry-input-v1',
      selected_riders:team.entry.selected_riders,
      captain_id:team.entry.captain_id,orders:entry.orders,
      stake:entry.stake,team_style:entry.style,
      rider_numbers:entry.riderNumbers};
  });
  let reads=0;
  const document=await loadPhysicalGameRaceDocumentV1({
    readSnapshot:async()=>{reads++;return snapshot;},
    readEntries:async id=>{
      assert.equal(id,snapshot.event.id);return rows;}});
  assert.equal(reads,2);
  assert.equal(document.source.validatedRiderKilometres,320);
  await assert.rejects(loadPhysicalGameRaceDocumentV1({
    readSnapshot:async()=>++reads%2?snapshot:{...snapshot,
      event:{...snapshot.event,seed:'changed'}},
    readEntries:async()=>rows}),/race changed/);
});
