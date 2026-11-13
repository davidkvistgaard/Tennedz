import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_MIXED_THREE_FRONT_CLEAR_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender,seedIndex){
  return {distanceKm:260,teamCount:4,gender,terrain:'mountain',
    fatigue:30,
    seed:`v93-next-contact-four-mixed-4-${gender}-mountain-30-${seedIndex}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:3},(_,index)=>({
      effort:['hard','conserve','steady'][(index+seedIndex)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

test('three surviving fronts retain paid leaver lanes to individual finish',()=>{
  for(const gender of ['M','F'])for(const seedIndex of [0,1,3,4]){
    const selected=settings(gender,seedIndex);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,
      V93_MIXED_THREE_FRONT_CLEAR_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.equal(race.clock.line.outcome,
      'mixed_three_front_leavers_clear');
    assert.equal(race.clock.line.bands.length,4);
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.mixedFrontLeavers.rearStayedAhead,true);
    assert.equal(summary.mixedFrontLeavers.thirdGroupId,
      race.recording.frames.at(-2).roadGroups[2].id);
    assert.deepEqual(summary.mixedFrontLeavers.bunchPasses,[]);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(race.individualLine.pre500ContactStatus,
      'paid_mixed_three_front_clear');
    const at500=new Map(race.clock.trace.frames.find(frame=>
      frame.endDistanceM===259500).riders.map(row=>
      [row.riderId,row.energy]));
    const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
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
      {resolveMixedThreeFrontClear:false}),
    /The depleted line bands crossed without contact/);
  }
});

test('simultaneous rear-leaver pass stays behind its separate option',()=>{
  assert.throws(()=>createV93PlayableTest(settings('M',2),{},
    {resolveMixedFrontParallelPass:false}),
    /The depleted line bands crossed without contact/);
});
