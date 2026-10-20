import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DYNAMIC_FRONT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleCoastDroppedLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(gender,terrain)=>({distanceKm:260,teamCount:4,
  fatigue:30,seed:'multi-manager-audit-1',
  defaultRivalPlan:'neutral',effort:'conserve',attack:'repeated',
  chase:'ignore',gender,terrain,managerTactics:[
    {effort:'hard',attack:'repeated',chase:'ignore'},
    {effort:'conserve',attack:'none',chase:'all'}]});

test('exhausted front riders pass through the bunch on a paid solo road',()=>{
  for(const gender of ['M','F'])
    for(const terrain of ['flat','mountain']){
      const input=settings(gender,terrain);
      const opts={pointContext:context};
      const race=createV93PlayableTest(input,opts);
      const summary=summarizeV93CoastedPlaytest(race);
      const source=race.recording.frames.at(-2);
      const first=race.clock.trace.frames[0];
      const contacts=race.individualLine.pre500Audit.contactEvents;
      assert.equal(race.version,V93_DYNAMIC_FRONT_PLAYTEST_VERSION);
      assert.throws(()=>recordFinaleCoastDroppedLastKmClock(
        race.recording),/cannot pay for travel/);
      assert.equal(source.roadGroups.length,1);
      assert.equal(source.roadGroups[0].riderIds.length,4);
      assert.equal(first.roadGroups[0].riderIds.length,2);
      assert.deepEqual(first.frontExhaustionDrops.map(row=>
        row.riderId),['rival-1-7','rival-1-5']);
      assert.equal(race.clock.trace.sourceDroppedRiderIds.length,1);
      assert.equal(race.clock.trace.finalDroppedRiderIds.length,3);
      assert.equal(contacts.length,2);
      assert.ok(contacts.every(row=>row.distanceM>259000&&
        row.distanceM<259250&&
        row.status==='bunch_passed_unassisted'));
      assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
      assert.equal(summary.lastKmRoad.at(-1).droppedPassages.length,3);
      assert.equal(summary.bandReplays.length,5);
      assert.equal(summary.lineTimes.length,32);
      assert.deepEqual(summary.managerOrders,
        race.recording.committedInputs.teams.map(team=>({
          teamId:team.id,...team.orders.baseline,
          phaseOrders:team.orders.phases})));
      assert.equal(race.individualLine.provisionalLineOrder,null);
      assert.equal(race.pointPreview.status,'unavailable');
      assert.equal(race.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      assert.equal(validateV93CoastedPlaytest(input,opts,race),true);
    }
});

test('a front lead-out works while a zero-reserve nominee finishes alone',()=>{
  const input=settings('M','flat');
  const base=createV93PlayableTest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,
    finisherId:team.id==='you'?'you-7':
      team.id==='rival-1'?'rival-1-7':team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':null}));
  const assisted=createV93PlayableTest(input,{plans});
  const crossing=(race,id)=>race.individualLine.conditionalCrossings
    .find(row=>row.riderId===id);
  assert.deepEqual(assisted.recording,base.recording);
  assert.deepEqual(assisted.clock,base.clock);
  assert.ok(summarizeV93CoastedPlaytest(assisted).leadOutWork
    .some(row=>row.riderId==='you-5'&&row.energySpent>0));
  assert.ok(crossing(assisted,'you-7').elapsedSecondsFromLastKmStart<
    crossing(base,'you-7').elapsedSecondsFromLastKmStart);
  assert.equal(crossing(assisted,'rival-1-7').energyAtLine,0);
  assert.equal(crossing(assisted,'rival-1-7').roadBandId,
    'isolated:rival-1-7');
  assert.equal(validateV93CoastedPlaytest(input,{plans},assisted),true);
});
