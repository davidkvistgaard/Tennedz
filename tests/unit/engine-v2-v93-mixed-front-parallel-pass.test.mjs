import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_MIXED_FRONT_PARALLEL_PASS_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender){
  const seedIndex=2;
  return {distanceKm:260,teamCount:4,gender,terrain:'mountain',
    fatigue:30,
    seed:`v93-next-contact-four-mixed-4-${gender}-mountain-30-2`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:3},(_,index)=>({
      effort:['hard','conserve','steady'][(index+seedIndex)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

test('two simultaneous rear-leaver passes pay one whole conditional race',()=>{
  for(const gender of ['M','F']){
    const selected=settings(gender);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,
      V93_MIXED_FRONT_PARALLEL_PASS_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.equal(race.clock.line.outcome,
      'mixed_front_parallel_rear_bunch_pass');
    assert.deepEqual(race.clock.line.bands.map(row=>
      [row.id,row.riderIds.length]),[
      ['front_with_leavers',3],['road-3',2],
      ['peloton',25],['rear_isolated',2]]);
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.mixedFrontLeavers.rearStayedAhead,false);
    assert.deepEqual(summary.mixedFrontLeavers.bunchPasses.map(row=>
      row.riderId),['rival-2-7','you-6']);
    const [first,second]=summary.mixedFrontLeavers.bunchPasses;
    assert.equal(first.distanceM,second.distanceM);
    assert.ok(first.distanceM>259600&&first.distanceM<259700);
    assert.equal(first.status,'bunch_passed_unassisted');
    assert.equal(second.status,'bunch_passed_unassisted');
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(race.individualLine.pre500ContactStatus,
      'paid_parallel_rear_bunch_pass');
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
      {resolveMixedFrontParallelPass:false}),
    /The depleted line bands crossed without contact/);
  }
});
