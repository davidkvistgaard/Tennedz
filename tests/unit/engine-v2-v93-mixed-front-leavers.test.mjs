import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const pointContext={tier:3,divisionCount:4,divisionIndex:2};
function settings(teamCount,gender,seedIndex){
  return {distanceKm:260,teamCount,gender,terrain:'rolling',fatigue:30,
    seed:`v93-contact-probe-${teamCount}-${gender}-rolling-${seedIndex}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:index%2?'hard':'steady',attack:'repeated',
      chase:index%2?'all':'selective'}))};
}

test('mixed front exits retain paid road, individual energy and every replay',()=>{
  const input={pointContext};
  const race=createV93PlayableTest(settings(4,'M',0),input);
  assert.equal(validateV93CoastedPlaytest(settings(4,'M',0),input,race),true);
  assert.equal(race.clock.line.outcome,
    'mixed_front_leavers_ahead_and_behind_bunch');
  assert.deepEqual(race.clock.line.bands.map(band=>
    [band.id,band.riderIds.length]),[
    ['front_with_leavers',4],['road-2',3],['peloton',24],['dropped',1]]);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
  assert.equal(summary.lineTimes.length,32);
  assert.equal(summary.bandReplays.length,6);
  assert.deepEqual(summary.mixedFrontLeavers.leadingRiderIds,
    ['rival-2-7','you-7']);
  assert.deepEqual(summary.mixedFrontLeavers.rearRiderIds,
    ['rival-2-6']);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.canCommitAwards,false);
  const at500=race.clock.trace.frames.find(frame=>
    frame.endDistanceM===259500);
  const energyAt500=new Map(at500.riders.map(row=>
    [row.riderId,row.energy]));
  const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const replayed=new Set();
  for(const band of summary.bandReplays){
    for(const row of band.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-
        energyAt500.get(row.riderId))<1e-7);
    for(const row of band.frames.at(-1).riders){
      assert.equal(replayed.has(row.riderId),false);
      replayed.add(row.riderId);
      const line=lines.get(row.riderId);
      assert.equal(line.roadBandId,band.id);
      assert.equal(row.elapsedToLineSeconds,
        line.elapsedSecondsFromLastKmStart);
      assert.ok(Math.abs(row.energyAfter-line.energyAtLine)<1e-7);
    }
  }
  assert.equal(replayed.size,32);
  const paidPass=race.clock.passageFrames[0].droppedPassages.find(row=>
    row.riderId==='rival-2-6');
  assert.equal(paidPass.contactStatus,'bunch_passed_unassisted');
  assert.ok(Math.abs(paidPass.contactDistanceM-259226.21003232556)<1e-7);
});

test('the same mixed-exit guard covers both genders and field sizes',()=>{
  for(const teamCount of [4,15])for(const gender of ['M','F'])
    for(const seedIndex of [0,1]){
      const selected=settings(teamCount,gender,seedIndex);
      const race=createV93PlayableTest(selected);
      assert.equal(race.clock.line.outcome,
        'mixed_front_leavers_ahead_and_behind_bunch');
      assert.equal(validateV93CoastedPlaytest(selected,{},race),true);
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lineTimes.length,teamCount*8);
      assert.equal(summary.canCommitAwards,false);
    }
});
