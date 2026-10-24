import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_DISSOLVED_SURVIVOR_PASS_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const patterns=[
  {effort:'hard',attack:'repeated',chase:'all'},
  {effort:'conserve',attack:'none',chase:'ignore'},
  {effort:'steady',attack:'selective',chase:'selective'}];
function settings(gender='M',terrain='rolling',fatigue=30,index=0){
  return {distanceKm:260,teamCount:4,gender,terrain,fatigue,
    seed:`v93-mixed-late-4-${gender}-${terrain}-${fatigue}-${index}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
    chase:'all',managerTactics:Array.from({length:3},(_,rival)=>
      patterns[(rival+index)%3]),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:index?'conserve':'hard'},
      {teamId:'rival-1',atKm:255,
        effort:index?'hard':'conserve'}]};
}

test('a dissolved front is passed unassisted in four paid outside lanes',()=>{
  for(const gender of ['M','F']){
    const selected=settings(gender);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,V93_DISSOLVED_SURVIVOR_PASS_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.deepEqual(race.clock.line.bands.map(row=>
      [row.id,row.riderIds.length]),[
      ['road-2',1],['passed_isolated_front',4],['peloton',27]]);
    assert.equal(race.clock.survivorPasses.length,4);
    assert.deepEqual(summary.dissolvedLeadingFront.survivorPasses,
      race.clock.survivorPasses);
    for(const pass of race.clock.survivorPasses){
      assert.equal(pass.status,'survivor_passed_unassisted');
      assert.ok(pass.atDistanceM>259600&&pass.atDistanceM<259800);
      assert.ok(pass.outsideLane>=8);
    }
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.bandReplays.length,6);
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
    const at500=new Map(race.clock.trace.frames.find(row=>
      row.endDistanceM===259500).riders.map(row=>[row.riderId,row.energy]));
    const seen=new Set();
    for(const band of summary.bandReplays){
      for(const row of band.frames[0].riders)
        assert.ok(Math.abs(row.energyAtDecision-
          at500.get(row.riderId))<1e-7);
      for(const row of band.frames.at(-1).riders){
        assert.equal(seen.has(row.riderId),false);
        seen.add(row.riderId);
        assert.equal(lines.get(row.riderId).roadBandId,band.id);
        assert.ok(Math.abs(lines.get(row.riderId).energyAtLine-
          row.energyAfter)<1e-7);
      }
    }
    assert.equal(seen.size,32);
    assert.throws(()=>createV93PlayableTest(selected,{},
      {resolveDissolvedFront:false}),/recorded group dissolution/);
    assert.throws(()=>createV93PlayableTest(selected,{},
      {resolveDissolvedSurvivorPass:false}),/recorded group dissolution/);
  }
});

test('a third surviving front still refuses without a paid crossing rule',()=>{
  const selected=settings('M','mountain',0,0);
  assert.throws(()=>createV93PlayableTest(selected),
    /recorded group dissolution/);
});
