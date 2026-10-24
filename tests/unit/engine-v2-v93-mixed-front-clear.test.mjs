import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender='M',terrain='flat',fatigue=0,seedIndex=2){
  return {distanceKm:260,teamCount:4,gender,terrain,fatigue,
    seed:`v93-next-contact-four-mixed-4-${gender}-${terrain}-${
      fatigue}-${seedIndex}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:3},(_,index)=>({
      effort:['hard','conserve','steady'][(index+seedIndex)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:seedIndex?'conserve':'hard'},
      {teamId:'rival-1',atKm:255,
        effort:seedIndex?'hard':'conserve'}]};
}

test('two fronts keep their leavers ahead through paid conditional finish',()=>{
  for(const gender of ['M','F'])for(const terrain of [
    'flat','rolling','mountain','exposed','custom']){
      const fatigue=0;
      const selected=settings(gender,terrain,fatigue);
      const input={pointContext:{tier:2,divisionCount:2,
        divisionIndex:1}};
      let race;
      try{race=createV93PlayableTest(selected,input);}
      catch(error){error.message=`${selected.seed}: ${error.message}`;
        throw error;}
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(race.version,V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION);
      assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
      assert.equal(race.clock.line.outcome,
        'mixed_front_leavers_clear_of_bunch');
      assert.deepEqual(race.clock.line.bands.map(row=>
        [row.id,row.riderIds.length]),[
        ['front_with_leavers',3],['rear_front_with_leavers',4],
        ['peloton',25]]);
      assert.equal(summary.lineTimes.length,32);
      assert.equal(summary.bandReplays.length,5);
      assert.equal(summary.mixedFrontLeavers.rearStayedAhead,true);
      assert.deepEqual(summary.mixedFrontLeavers.bunchPasses,[]);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.pointPreview.status,'unavailable');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(race.individualLine.pre500ContactStatus,
        'paid_mixed_front_clear');
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
        {resolveMixedFrontClear:false}),
      /The depleted line bands crossed without contact/);
    }
});

test('later bunch passes require their separate version; a third front refuses',()=>{
  assert.throws(()=>createV93PlayableTest(settings('M','flat',15),{},
    {resolveMixedFrontLatePass:false}),
    /The depleted line bands crossed without contact/);
  assert.throws(()=>createV93PlayableTest(settings('F','mountain',30,4)),
    /The depleted line bands crossed without contact/);
});
