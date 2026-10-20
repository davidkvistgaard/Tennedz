import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,V93_BUNCH_ONLY_PLAYTEST_VERSION,
  validateV93CoastedPlaytest,summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {recordFinaleBunchOnlyLastKmClock} from
  '../../lib/engine/v2/finale-bunch-only-last-km.mjs';

const profileHeightsM=[100,350,150,500,180,100];
const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(distanceKm,terrain,gender,teamCount=4)=>({
  distanceKm,terrain,gender,teamCount,fatigue:0,seed:'playtest-1',
  defaultRivalPlan:'mixed',attack:'selective',chase:'selective',
  ...(terrain==='custom'?{profileHeightsM}:{})});
const crossing=(race,id)=>race.individualLine.conditionalCrossings.find(
  row=>row.riderId===id);

test('default short and medium bunch roads replay individual results',()=>{
  for(const distanceKm of [40,120])
    for(const terrain of ['flat','rolling','mountain','exposed','custom'])
      for(const gender of ['M','F']){
        const input=settings(distanceKm,terrain,gender);
        const race=createV93PlayableTest(input,{pointContext:context});
        const summary=summarizeV93CoastedPlaytest(race);
        assert.equal(race.version,V93_BUNCH_ONLY_PLAYTEST_VERSION);
        assert.equal(race.recording.frames.at(-2).roadGroups.length,0);
        assert.equal(summary.kilometreFrames.length,distanceKm-1);
        assert.equal(summary.lastKmRoad.at(-1).distanceM,
          distanceKm*1000);
        assert.equal(summary.lastKmRoad.at(-1).groups.length,0);
        assert.equal(summary.lineTimes.length,32);
        assert.equal(summary.bandReplays.length,1);
        assert.equal(summary.bandReplays[0].id,'peloton');
        assert.equal(race.pointsStatus,'withheld');
        assert.equal(race.canCommitAwards,false);
        if(race.pointPreview.status==='unavailable')
          assert.equal(race.pointPreview.pointsStatus,'withheld');
        else{
          assert.equal(race.pointPreview.riders.length,32);
          assert.deepEqual(race.pointPreview.awardRows,[]);
          for(const [index,row] of race.pointPreview.riders.entries())
            assert.equal(row.previewPoints,pointsForDivisionResult({
              tier:3,resultType:'ONE_DAY',placing:index+1,multiplier:1}));
        }
        assert.equal(validateV93CoastedPlaytest(input,
          {pointContext:context},race),true);
      }
});

test('two bunch managers pay lead-outs on the same source road',()=>{
  const input=settings(40,'flat','M');
  const base=createV93PlayableTest(input);
  const plans=base.recording.committedInputs.teams.map(team=>({
    teamId:team.id,
    finisherId:team.id==='you'?'you-3':
      team.id==='rival-1'?'rival-1-3':team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':
      team.id==='rival-1'?'rival-1-5':null}));
  const race=createV93PlayableTest(input,{plans});
  const summary=summarizeV93CoastedPlaytest(race);
  assert.ok(summary.leadOutWork.some(row=>row.riderId==='you-5'));
  assert.ok(summary.leadOutWork.some(row=>row.riderId==='rival-1-5'));
  for(const id of ['you-3','rival-1-3'])
    assert.ok(crossing(race,id).elapsedSecondsFromLastKmStart<
      crossing(base,id).elapsedSecondsFromLastKmStart);
  assert.deepEqual(race.recording,base.recording);
  assert.deepEqual(race.clock,base.clock);
  assert.equal(validateV93CoastedPlaytest(input,{plans},race),true);
  const altered=structuredClone(race);
  altered.clock.passageFrames[0]
    .bunchPassageSecondsFromBunchMarker+=1;
  assert.throws(()=>validateV93CoastedPlaytest(input,{plans},altered),
    /does not replay/);
});

test('a catch recorded in kilometre 259 leaves a payable bunch at 1 km',()=>{
  const input={...settings(260,'flat','M'),
    seed:'coast-matrix',defaultRivalPlan:'mixed'};
  const race=createV93PlayableTest(input,{pointContext:context});
  const source=race.recording.frames.at(-2);
  assert.equal(source.roadGroups.length,0);
  assert.ok(source.chasers.length>0);
  assert.ok(source.caughtBreakawayRiderIds.length>0);
  assert.equal(race.version,V93_BUNCH_ONLY_PLAYTEST_VERSION);
  assert.equal(race.clock.passageFrames.length,7);
  assert.equal(race.individualLine.conditionalCrossings.length,32);
  assert.equal(validateV93CoastedPlaytest(input,
    {pointContext:context},race),true);
});

test('bunch-only clock rejects the old motor recording',()=>{
  const prepared=prepareV91Playtest(settings(40,'flat','M'));
  const older=simulateTacticalTour(prepared);
  assert.throws(()=>recordFinaleBunchOnlyLastKmClock(older),
    /needs a v93 source/);
});
