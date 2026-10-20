import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_COAST_SINGLETON_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=gender=>({distanceKm:260,teamCount:15,gender,
  terrain:'flat',fatigue:15,seed:'v93-seed-audit-2',
  defaultRivalPlan:'chase',effort:'conserve',attack:'repeated',
  chase:'all',profileHeightsM:[100,350,150,500,180,100]});

test('two singleton fronts keep their paid road with fourteen coasted riders',()=>{
  for(const gender of ['M','F']){
    const input=settings(gender);
    const options={pointContext:context};
    const race=createV93PlayableTest(input,options);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,V93_COAST_SINGLETON_PLAYTEST_VERSION);
    assert.deepEqual(race.clock.trace.frames[0].roadGroups.map(group=>
      group.riderIds.length),[1,1]);
    assert.equal(race.clock.trace.sourceDroppedRiderIds.length,14);
    assert.equal(summary.lastKmRoad.at(-1).droppedPassages.length,14);
    assert.equal(summary.bandReplays.length,17);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.lineTimes.find(row=>row.riderId==='you-4')
      .roadBandId,race.clock.trace.frames[0].roadGroups[0].id);
    assert.equal(race.individualLine.pre500ContactStatus,
      'potential_longitudinal_overlap');
    assert.equal(race.individualLine.provisionalLineOrder,null);
    assert.equal(race.pointPreview.status,'unavailable');
    assert.equal(race.pointsStatus,'withheld');
    assert.equal(validateV93CoastedPlaytest(input,options,race),true);
  }
});

test('a singleton nominee and separate bunch lead-out respect their roads',()=>{
  const input=settings('M');
  const base=createV93PlayableTest(input);
  const planFor=finisherId=>base.recording.committedInputs.teams
    .map(team=>({teamId:team.id,
      finisherId:team.id==='you'?finisherId:team.orders.captainId,
      leadOutRiderId:team.id==='you'&&finisherId==='you-7'?
        'you-5':null}));
  const solo=createV93PlayableTest(input,{plans:planFor('you-4')});
  const helped=createV93PlayableTest(input,{plans:planFor('you-7')});
  assert.deepEqual(solo.recording,base.recording);
  assert.deepEqual(helped.clock,base.clock);
  assert.ok(summarizeV93CoastedPlaytest(helped).leadOutWork
    .some(row=>row.riderId==='you-5'&&row.energySpent>0));
  assert.equal(solo.individualLine.sprintPlan.decisions
    .find(row=>row.teamId==='you').leadOutRiderId,null);
  assert.equal(solo.individualLine.conditionalCrossings
    .find(row=>row.riderId==='you-4').roadBandId,
  base.clock.trace.frames[0].roadGroups[0].id);
  assert.equal(validateV93CoastedPlaytest(input,
    {plans:planFor('you-4')},solo),true);
});
