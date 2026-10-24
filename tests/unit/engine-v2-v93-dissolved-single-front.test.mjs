import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DISSOLVED_SINGLE_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender='M',index=0,fatigue=15){
  return {distanceKm:260,teamCount:15,gender,terrain:'mountain',fatigue,
    seed:`v93-next-contact-15-${gender}-mountain-${fatigue}-${index}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:14},()=>({
      effort:'hard',attack:'repeated',chase:'all'}))};
}

test('the single dissolved front has paid road, energy, line and replay for the whole field',()=>{
  const selected=settings();
  const input={pointContext:{tier:3,divisionCount:4,divisionIndex:2}};
  const race=createV93PlayableTest(selected,input);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(race.version,V93_DISSOLVED_SINGLE_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
  assert.deepEqual(race.clock.line.bands.map(row=>
    [row.id,row.riderIds.length]),[
    ['leading_isolated_front',15],['peloton',105]]);
  assert.deepEqual(race.clock.trace.frames.map(row=>row.endDistanceM),
    [259250,259500,259600,259700,259800,259900,260000]);
  assert.equal(race.clock.trace.contactAudit.encounters.length,0);
  assert.equal(summary.dissolvedSingle.leadingRiderIds.length,15);
  assert.equal(summary.lineTimes.length,120);
  assert.equal(summary.bandReplays.length,16);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  const line=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const at500=new Map(race.clock.trace.frames.find(row=>
    row.endDistanceM===259500).riders.map(row=>[row.riderId,row.energy]));
  const seen=new Set();
  for(const band of summary.bandReplays){
    for(const row of band.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-at500.get(row.riderId))<1e-7);
    for(const row of band.frames.at(-1).riders){
      assert.equal(seen.has(row.riderId),false);
      seen.add(row.riderId);
      assert.equal(line.get(row.riderId).roadBandId,band.id);
      assert.ok(Math.abs(line.get(row.riderId).energyAtLine-
        row.energyAfter)<1e-7);
    }
  }
  assert.equal(seen.size,120);
  assert.throws(()=>createV93PlayableTest(selected,{},
    {resolveDissolvedFront:false}),/recorded group dissolution/);
});

test('both genders and nearby seeds retain separate paid leading lanes',()=>{
  for(const gender of ['M','F'])for(const index of [0,1,2]){
    const selected=settings(gender,index);
    const race=createV93PlayableTest(selected);
    assert.equal(race.version,V93_DISSOLVED_SINGLE_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,{},race),true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.dissolvedSingle.leadingRiderIds.length,15);
    assert.ok(race.clock.passageFrames.every(frame=>
      frame.groups.length===0&&frame.droppedPassages.every(row=>
        row.contactDistanceM===null&&row.deficitSeconds<0)));
  }
});

test('the neighboring lower-fatigue source keeps the prior playable path',()=>{
  const selected=settings('M',0,0);
  assert.notEqual(createV93PlayableTest(selected).version,
    V93_DISSOLVED_SINGLE_PLAYTEST_VERSION);
});
