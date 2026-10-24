import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const patterns=[
  {effort:'hard',attack:'repeated',chase:'all'},
  {effort:'conserve',attack:'none',chase:'ignore'},
  {effort:'steady',attack:'selective',chase:'selective'}];
function settings(gender,terrain,fatigue,index){
  return {distanceKm:260,teamCount:4,gender,terrain,fatigue,
    seed:`v93-mixed-late-4-${gender}-${terrain}-${fatigue}-${index}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
    chase:'all',managerTactics:Array.from({length:3},(_,rival)=>
      patterns[(rival+index)%3]),managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:index?'conserve':'hard'},
      {teamId:'rival-1',atKm:255,
        effort:index?'hard':'conserve'}]};
}

test('three-front dissolved leaders retain paid road and line without contact',()=>{
  for(const gender of ['M','F'])for(const [terrain,index] of [
    ['rolling',1],['mountain',0],['mountain',1]]){
    const selected=settings(gender,terrain,0,index);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.equal(race.clock.line.outcome,'dissolved_three_front_clear');
    assert.deepEqual(race.clock.line.bands.map(row=>
      [row.id,row.riderIds.length]),[
      ['leading_isolated_front',4],['road-2',1],
      [race.clock.trace.frames.at(-1).roadGroups[1].id,1],
      ['peloton',26]]);
    assert.equal(summary.dissolvedLeadingFront.survivorPasses,undefined);
    assert.equal(summary.dissolvedLeadingFront.survivingGroupIds.length,2);
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.bandReplays.length,7);
    const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
    const seen=new Set();
    for(const band of summary.bandReplays)
      for(const row of band.frames.at(-1).riders){
        assert.equal(seen.has(row.riderId),false);
        seen.add(row.riderId);
        assert.equal(lines.get(row.riderId).roadBandId,band.id);
        assert.ok(Math.abs(lines.get(row.riderId).energyAtLine-
          row.energyAfter)<1e-7);
      }
    assert.equal(seen.size,32);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.canCommitAwards,false);
    assert.throws(()=>createV93PlayableTest(selected,{},
      {resolveDissolvedThreeFront:false}),/recorded group dissolution/);
  }
});

test('three-front survivor passes all four leaders outside with paid replay',()=>{
  for(const gender of ['M','F'])for(const [terrain,first,last] of [
    ['mountain',259500,259600],['exposed',259700,259800]]){
    const selected=settings(gender,terrain,30,0);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,V93_DISSOLVED_THREE_FRONT_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.equal(race.clock.line.outcome,
      'dissolved_three_front_survivor_passed_outside');
    const priorDropped=terrain==='mountain'?1:0;
    assert.deepEqual(race.clock.line.bands.map(row=>
      [row.id,row.riderIds.length]),[
      ['road-2',1],['passed_isolated_front',4],
      ['road-3',1],['peloton',26-priorDropped],
      ...(priorDropped?[['dropped',1]]:[])]);
    assert.equal(race.clock.survivorPasses.length,4);
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.bandReplays.length,7+priorDropped);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.canCommitAwards,false);
    for(const pass of race.clock.survivorPasses){
      assert.ok(pass.atDistanceM>first&&pass.atDistanceM<last);
      assert.ok(pass.outsideLane>=8);
      assert.equal(pass.groupId,'road-2');
    }
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
  }
});
