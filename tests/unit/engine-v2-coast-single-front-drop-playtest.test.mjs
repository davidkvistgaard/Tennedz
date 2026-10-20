import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DYNAMIC_SINGLE_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleSingleGroupLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(gender,terrain)=>({distanceKm:260,teamCount:20,
  gender,terrain,fatigue:15,seed:'v93-diversity-2',
  defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
  effort:'hard',profileHeightsM:[100,350,150,500,180,100]});

test('zero-reserve front members get separate coasted crossings',()=>{
  for(const gender of ['M','F'])
    for(const terrain of ['flat','rolling','mountain','exposed','custom']){
      const input=settings(gender,terrain);
      const options={pointContext:context};
      const race=createV93PlayableTest(input,options);
      const summary=summarizeV93CoastedPlaytest(race);
      const front=race.clock.trace.frames[0].roadGroups[0];
      const solo=race.clock.passageFrames.at(-1).droppedPassages;
      const bunch=race.clock.passageFrames.at(-1)
        .bunchPassageSecondsFromBunchMarker;
      assert.equal(race.version,V93_DYNAMIC_SINGLE_PLAYTEST_VERSION);
      assert.throws(()=>recordFinaleSingleGroupLastKmClock(
        race.recording),/cannot pay for travel/);
      assert.equal(race.clock.trace.sourceDroppedRiderIds.length,0);
      assert.deepEqual(race.clock.trace.finalDroppedRiderIds,
        ['you-6','you-7']);
      assert.equal(front.riderIds.length,38);
      assert.equal(solo.length,2);
      assert.ok(solo.every(row=>row.passageSecondsFromBunchMarker<
        bunch&&row.contactDistanceM===null));
      assert.equal(race.clock.line.bands.length,1);
      assert.equal(race.clock.line.bands[0].kind,
        'unresolved_contact');
      assert.equal(summary.bandReplays.length,4);
      assert.equal(summary.lineTimes.length,160);
      assert.ok(['you-6','you-7'].every(id=>summary.lineTimes
        .find(row=>row.riderId===id)?.energyAtLine===0));
      assert.equal(race.individualLine.provisionalLineOrder,null);
      assert.equal(race.pointPreview.status,'unavailable');
      assert.equal(race.canCommitAwards,false);
      assert.equal(validateV93CoastedPlaytest(input,options,race),true);
    }
});

test('an isolated nominee remains unassisted while a bunch helper can work',()=>{
  const input=settings('M','rolling');
  const base=createV93PlayableTest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.id==='you'?'you-6':
      team.orders.captainId,leadOutRiderId:null}));
  const solo=createV93PlayableTest(input,{plans});
  const bunchPlans=plans.map(row=>row.teamId==='you'?{
    ...row,finisherId:'you-4',leadOutRiderId:'you-5'}:row);
  const helped=createV93PlayableTest(input,{plans:bunchPlans});
  assert.deepEqual(solo.recording,base.recording);
  assert.deepEqual(helped.clock,base.clock);
  assert.equal(solo.individualLine.conditionalCrossings
    .find(row=>row.riderId==='you-6').roadBandId,
  'isolated:you-6');
  assert.ok(summarizeV93CoastedPlaytest(helped).leadOutWork
    .some(row=>row.riderId==='you-5'&&row.energySpent>0));
  assert.equal(validateV93CoastedPlaytest(input,{plans},solo),true);
});
