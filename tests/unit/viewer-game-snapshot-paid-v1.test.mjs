import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createGameSnapshotPaidViewerDocumentV1,
  GAME_SNAPSHOT_PAID_VIEWER_VERSION} from
  '../../lib/viewer/game-snapshot-paid-viewer-v1.mjs';

const skills={sprint:65,flat:65,hills:65,mountain:65,
  cobbles:65,timetrial:65,endurance:65,strength:65,
  wind:65,leadership:65,form:50,fatigue:0};
function fixture(category='M'){
  const event={id:'game-fixture-race',kind:'one_day',
    gender:category,seed:'committed-game-seed',
    weather_locked:{temp_c:16,wind_kph:0,
      precipitation_mm:0}};
  const stage={distance_km:20,profile_points:[[0,100],[20,100]],
    keypoints:[]};
  const teams=['a','b'].map(id=>{
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
});
