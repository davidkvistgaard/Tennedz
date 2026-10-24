import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_MIXED_FRONT_LATE_PASS_PLAYTEST_VERSION,
  V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(gender='M',terrain='flat',fatigue=15){
  const seedIndex=2;
  return {distanceKm:260,teamCount:4,gender,terrain,fatigue,
    seed:`v93-next-contact-four-mixed-4-${gender}-${terrain}-${
      fatigue}-${seedIndex}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:3},(_,index)=>({
      effort:['hard','conserve','steady'][(index+seedIndex)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

test('late unassisted bunch pass pays whole mixed-front road and replay',()=>{
  for(const gender of ['M','F'])for(const terrain of [
    'flat','rolling','mountain','exposed','custom']){
      const selected=settings(gender,terrain);
      const input={pointContext:{tier:2,divisionCount:2,
        divisionIndex:1}};
      let race;
      try{race=createV93PlayableTest(selected,input);}
      catch(error){error.message=`${selected.seed}: ${error.message}`;
        throw error;}
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(race.version,
        V93_MIXED_FRONT_LATE_PASS_PLAYTEST_VERSION);
      assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
      assert.equal(race.clock.line.outcome,
        'mixed_front_rear_leaver_passed_late');
      assert.deepEqual(race.clock.line.bands.map(row=>
        [row.id,row.riderIds.length]),[
        ['front_with_leavers',3],['road-3',3],
        ['peloton',25],['rear_isolated',1]]);
      assert.equal(summary.lineTimes.length,32);
      assert.equal(summary.bandReplays.length,5);
      assert.equal(summary.mixedFrontLeavers.rearStayedAhead,false);
      assert.equal(summary.mixedFrontLeavers.bunchPasses.length,1);
      const pass=summary.mixedFrontLeavers.bunchPasses[0];
      assert.equal(pass.status,'bunch_passed_unassisted');
      assert.ok(pass.distanceM>259800&&pass.distanceM<259900);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.pointPreview.status,'unavailable');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(race.individualLine.pre500ContactStatus,
        'paid_mixed_front_late_bunch_pass');
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
        {resolveMixedFrontLatePass:false}),
      /The depleted line bands crossed without contact/);
    }
});

test('the fatigue-zero version and unpayable third front stay separate',()=>{
  assert.equal(createV93PlayableTest(settings('M','flat',0)).version,
    V93_MIXED_FRONT_CLEAR_PLAYTEST_VERSION);
  assert.throws(()=>createV93PlayableTest({
    ...settings('F','mountain',30),
    seed:'v93-next-contact-four-mixed-4-F-mountain-30-4',
    managerTactics:Array.from({length:3},(_,index)=>({
      effort:['hard','conserve','steady'][(index+4)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'}))}),
  /The depleted line bands crossed without contact/);
});
