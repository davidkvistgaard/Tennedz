import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed,createSampler,commentaryAt} from
  '@pelotonia/race-viewer/data';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7} from
  '../../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {adaptPhysicalFirstPositionRaceV1,
  adaptPhysicalFirstPositionRaceV3,
  PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V3_VERSION} from
  '../../lib/viewer/physical-first-position-adapter-v1.mjs';

const makeRecord=(category='men',riderCount=16,
  {attack=false}={})=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:Math.ceil(riderCount/8),riderCount,
    kmCount:20,profile:'hill_then_mountain',
    oneTimeAttack:attack});
  request.input.positionPassingCorridorCount=1;
  if(!attack)
    request.input.teams[0].orders.baseline.attack='none';
  request.input.stakes[0].sportingGoal='sprint_finish';
  for(const team of request.input.teams)
    for(const rider of team.riders){
      rider.name=`Fixture rider ${rider.id}`;
      rider.gender=category==='men'?'M':'F';
    }
  for(const segment of request.input.kilometres){
    segment.startM=0;
    segment.endM=0;
  }
  const teamStyles=request.input.teams.map((team,index)=>({
    id:team.id,name:`Fixture team ${index+1}`,
    color:index?'#226688':'#aa4433',
    accent:'#ffffff',pattern:'band'}));
  const riderNumbers=Object.fromEntries(request.input.teams
    .flatMap((team,teamIndex)=>team.riders.map((rider,index)=>
      [rider.id,teamIndex*8+index+1])));
  return {request,
    race:recordPhysicalFirstPositionGeneralRaceV7(request),
    category,teamStyles,riderNumbers,
    raceId:`synthetic-${category}-${riderCount}-20km`};
};

for(const category of ['men','women'])
for(const riderCount of [16,30,150])
  test(`V7 ${category} ${riderCount}-rider feed is complete`,()=>{
    const source=makeRecord(category,riderCount);
    const exported=adaptPhysicalFirstPositionRaceV1(source);
    const {feed,coverage,finishEvidence}=exported;
    assert.deepEqual(validateFeed(feed),feed);
    assert.equal(feed.riderCategory,category);
    assert.equal(feed.synthetic,true);
    assert.equal(feed.riders.length,riderCount);
    assert.equal(feed.frames.length,
      1+20+source.race.tail.positionFrames.length-1);
    assert.ok(feed.frames.every(frame=>
      frame.positions.length===riderCount));
    assert.ok(feed.frames.every((frame,index)=>
      index===0||frame.time>feed.frames[index-1].time));
    assert.equal(feed.duration,
      source.race.tail.lastClockSeconds);
    assert.equal(finishEvidence.publishedAt,feed.duration);
    assert.equal(finishEvidence.entries.length,riderCount);
    assert.equal(feed.results,undefined);
    assert.equal(coverage.exactBetweenKilometrePositions,false);
    assert.equal(coverage.canonicalGeography,false);
    assert.equal(coverage.officialResults,false);
    const sampler=createSampler(feed);
    assert.equal(sampler(0).positions.length,riderCount);
    assert.equal(sampler(feed.duration).positions.length,riderCount);
    assert.ok(commentaryAt(feed,0).every(event=>event.time<=0));
    if(riderCount===150){
      const v3=adaptPhysicalFirstPositionRaceV3({
        ...source,fixtureKind:'synthetic_motor_lab'});
      const recordedTimes=new Set([
        0,...source.race.steps.map(step=>
          step.sharedRoad.clockSeconds),
        ...source.race.tail.positionFrames.map(row=>
          row.clockSeconds)]);
      assert.equal(v3.version,
        PHYSICAL_FIRST_POSITION_VIEWER_ADAPTER_V3_VERSION);
      assert.ok(v3.feed.frames.every(frame=>
        recordedTimes.has(frame.time)));
      const finaleRows=source.race.tail.positionFrames.slice(1);
      const displayedTimes=new Set(v3.feed.frames.map(frame=>
        frame.time));
      for(const crossing of source.race.finishCrossings){
        const milestone=finaleRows.find(row=>
          row.clockSeconds>=crossing.clockSeconds);
        assert.ok(milestone);
        assert.ok(displayedTimes.has(milestone.clockSeconds));
      }
      assert.equal(v3.feed.frames.at(-1).time,
        v3.feed.duration);
      assert.ok(v3.feed.frames.every(frame=>
        frame.positions.length===riderCount));
      assert.ok(v3.coverage.viewerFeedBytes<=3_500_000);
      assert.equal(v3.coverage.viewerFeedBytes,
        Buffer.byteLength(JSON.stringify(v3.feed)));
      assert.equal(v3.coverage.renderedFinaleFrames,
        v3.feed.frames.length-21);
      assert.equal(v3.coverage.exactFinalePositionSamples,
        v3.coverage.renderedFinaleFrames===
        source.race.tail.positionFrames.length-1);
    }
  });

test('V7 export rejects forged motor movement and missing identity',()=>{
  const source=makeRecord();
  const forged=structuredClone(source.race);
  forged.tail.positionFrames[1].positions[0].distanceM+=1;
  assert.throws(()=>adaptPhysicalFirstPositionRaceV1({
    ...source,race:forged}),/differs from paid movement/);
  const missing=structuredClone(source);
  delete missing.request.input.teams[0].riders[0].name;
  assert.throws(()=>adaptPhysicalFirstPositionRaceV1(missing),
    /committed, complete field/);
});

test('commentary waits for a paid departure, not its order',()=>{
  const source=makeRecord('men',16,{attack:true});
  assert.equal(source.race.attackDepartureEvents.length,1);
  const {feed}=adaptPhysicalFirstPositionRaceV1(source);
  const paid=source.race.steps[1].sharedRoad.positions.find(row=>
    row.riderId==='team-0-7');
  const projected=feed.frames[2].positions.find(row=>
    row.riderId==='team-0-7');
  assert.equal(projected.distance,paid.distanceM);
  assert.equal(projected.groupId,paid.roadId);
  assert.equal(feed.frames[2].gaps,undefined);
  const departure=source.race.attackDepartureEvents[0];
  const event=feed.events.find(row=>
    row.type==='paid_attack_departure');
  assert.equal(event.time,departure.observedAtClockSeconds);
  assert.equal(event.riderId,departure.toRiderId);
  assert.equal(commentaryAt(feed,event.time-.001)
    .some(row=>row.text===event.label),false);
  assert.equal(commentaryAt(feed,event.time)
    .some(row=>row.text===event.label),true);
});
