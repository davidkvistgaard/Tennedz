import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DISSOLVED_FRONT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

// At the 259 km source all three leaders have zero reserve, while the next
// road group and bunch can still travel. The front cannot remain a group.
const settings={distanceKm:260,teamCount:4,gender:'M',terrain:'rolling',
  fatigue:30,seed:'v93-expanded-61-a',defaultRivalPlan:'passive',
  effort:'hard',attack:'repeated',chase:'selective',
  profileHeightsM:[900,700,300,500,200,100],
  managerTactics:[
    {effort:'steady',attack:'none',chase:'selective'},
    {effort:'hard',attack:'selective',chase:'all'},
    {effort:'hard',attack:'repeated',chase:'ignore'}]};

test('whole-race front dissolution keeps the earlier refusal when disabled',()=>{
  const prepared=prepareV91Playtest(settings);
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const source=tour.frames.at(-2);
  assert.equal(source.km,259);
  assert.equal(source.roadGroups.length,2);
  assert.deepEqual(source.roadGroups[0].riderIds,
    ['rival-2-7','rival-3-5','you-5']);
  assert.ok(source.roadGroups[0].riderIds.every(id=>
    source.riderGroups.find(row=>row.id===id).energy===0));
  assert.throws(()=>createV93PlayableTest(settings,{},
    {resolveDissolvedFront:false}),error=>{
    assert.match(error.message,/recorded group dissolution/);
    assert.equal(error.roadPreview?.unsupportedReason,
      'depleted_front_dissolution');
    assert.equal(error.roadPreview?.handoff.groupId,
      source.roadGroups[0].id);
    assert.deepEqual(error.roadPreview?.handoff.riderIds,
      source.roadGroups[0].riderIds);
    assert.equal(error.roadPreview?.lastKmRoad.length,0);
    assert.equal(error.roadPreview?.lineTimes,null);
    assert.equal(error.roadPreview?.bandReplays,null);
    assert.equal(error.roadPreview?.canCommitAwards,false);
    return true;
  });
});

test('whole-race dissolved front replays road, individual line and policy points',()=>{
  const input={pointContext:{tier:3,divisionIndex:2,divisionCount:4}};
  const race=createV93PlayableTest(settings,input);
  assert.equal(race.version,V93_DISSOLVED_FRONT_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
  assert.equal(summary.lineTimes.length,32);
  assert.equal(summary.provisionalLineOrder.length,32);
  assert.equal(summary.bandReplays.length,7);
  assert.equal(summary.pointPreview.riders.length,32);
  assert.deepEqual(summary.pointPreview.awardRows,[]);
  assert.equal(summary.canCommitAwards,false);
  for(const line of summary.lineTimes){
    const band=summary.bandReplays.find(row=>row.id===line.roadBandId);
    const finisher=band.frames.at(-1).riders.find(row=>
      row.riderId===line.riderId);
    assert.ok(finisher);
    assert.ok(Math.abs(finisher.energyAfter-line.energyAtLine)<1e-7);
    assert.ok(Math.abs(finisher.elapsedToLineSeconds-
      line.elapsedSecondsFromLastKmStart)<1e-7);
    const points=summary.pointPreview.riders.find(row=>
      row.riderId===line.riderId);
    const place=summary.provisionalLineOrder.find(row=>
      row.riderId===line.riderId);
    assert.equal(points.provisionalPlace,place.position);
  }
  assert.equal(summary.dissolvedFront.riderIds.length,3);
});
