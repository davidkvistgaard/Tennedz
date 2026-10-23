import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_DISSOLVED_LEADING_DROPPED_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender='M',index=0,fatigue=30){
  return {distanceKm:260,teamCount:15,gender,terrain:'mountain',fatigue,
    seed:`v93-next-contact-15-${gender}-mountain-${fatigue}-${index}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:14},()=>({
      effort:'hard',attack:'repeated',chase:'all'}))};
}

test('a whole 15-team mountain road pays leading leavers and prior drops separately',()=>{
  const input={pointContext:{tier:3,divisionCount:4,divisionIndex:2}};
  const race=createV93PlayableTest(settings(),input);
  assert.equal(race.version,
    V93_DISSOLVED_LEADING_DROPPED_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings(),input,race),true);
  assert.deepEqual(race.clock.line.bands.map(row=>
    [row.id,row.riderIds.length]),[
    ['leading_isolated_front',15],['road-3',15],
    ['peloton',79],['dropped',11]]);
  assert.equal(race.clock.trace.contactAudit.encounters.length,0);
  assert.deepEqual(race.clock.trace.frames.map(row=>row.endDistanceM),
    [259250,259500,259600,259700,259800,259900,260000]);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,120);
  assert.equal(summary.bandReplays.length,28);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  const line=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const energyAt500=new Map(race.clock.trace.frames.find(row=>
    row.endDistanceM===259500).riders.map(row=>[row.riderId,row.energy]));
  const seen=new Set();
  for(const band of summary.bandReplays){
    for(const row of band.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-
        energyAt500.get(row.riderId))<1e-7);
    for(const row of band.frames.at(-1).riders){
      assert.equal(seen.has(row.riderId),false);
      seen.add(row.riderId);
      assert.equal(line.get(row.riderId).roadBandId,band.id);
      assert.ok(Math.abs(line.get(row.riderId).energyAtLine-
        row.energyAfter)<1e-7);
    }
  }
  assert.equal(seen.size,120);
  assert.throws(()=>createV93PlayableTest(settings(),{},
    {resolveDissolvedFront:false}),/recorded group dissolution/);
});

test('the guarded continuation covers both genders and three whole-race seeds',()=>{
  for(const gender of ['M','F'])for(const index of [0,1,2]){
    const selected=settings(gender,index);
    const race=createV93PlayableTest(selected);
    assert.equal(race.version,
      V93_DISSOLVED_LEADING_DROPPED_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,{},race),true);
    assert.equal(summarizeV93CoastedPlaytest(race).lineTimes.length,120);
  }
});

test('nearby lower-fatigue dissolution remains an explicit refusal',()=>{
  for(const gender of ['M','F'])
    assert.throws(()=>createV93PlayableTest(settings(gender,0,15)),
      /recorded group dissolution/);
});
