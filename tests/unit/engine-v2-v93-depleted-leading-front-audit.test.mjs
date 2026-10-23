import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DISSOLVED_LEADING_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const settings={distanceKm:260,teamCount:4,gender:'M',
  terrain:'rolling',fatigue:30,
  seed:'v93-contact-audit-4-M-rolling-30-0',
  defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
  managerTactics:Array.from({length:3},()=>({
    effort:'hard',attack:'repeated',chase:'all'}))};

test('a dissolved leading front and rear leaver retain paid road without a false finish',()=>{
  const prepared=prepareV91Playtest(settings);
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const source=recording.frames.at(-2);
  assert.equal(source.km,259);
  assert.deepEqual(source.roadGroups.map(row=>row.riderIds.length),[4,4]);
  assert.ok(source.roadGroups[0].riderIds.every(id=>
    source.riderGroups.find(row=>row.id===id)?.energy===0));
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:FINALE_COAST_DISSOLVED_FRONT_LAST_KM_VERSION});
  assert.deepEqual(trace.frames.map(row=>row.endDistanceM),
    [259250,259500,259600,259700,259800,259900,260000]);
  assert.equal(trace.frames[0].frontGroupDissolutions[0].groupId,'road-1');
  assert.deepEqual(trace.frames[0].frontExhaustionDrops.map(row=>
    row.riderId),['rival-1-7','rival-2-7','rival-3-7','you-7',
    'rival-2-6']);
  assert.equal(trace.contactAudit.encounters.length,1);
  assert.equal(trace.contactAudit.encounters[0].riderId,'rival-2-6');
  assert.ok(Math.abs(trace.contactAudit.encounters[0].distanceM-
    259209.78196355206)<1e-7);
  const final=trace.frames.at(-1);
  assert.equal(final.roadGroups[0].id,'road-2');
  assert.equal(final.pelotonRiderIds.length,24);
  assert.equal(final.droppedTravel.riders.length,5);
  for(const row of final.droppedTravel.riders){
    if(row.riderId==='rival-2-6')assert.ok(row.deficitSecondsAfter>39);
    else assert.ok(row.deficitSecondsAfter< -186);
    assert.equal(row.energyAfter,0);
  }
  assert.throws(()=>createV93PlayableTest(settings,{},
    {resolveDissolvedFront:false}),error=>{
    assert.match(error.message,/recorded group dissolution/);
    assert.equal(error.roadPreview?.unsupportedReason,
      'depleted_front_dissolution');
    assert.equal(error.roadPreview?.lineTimes,null);
    assert.equal(error.roadPreview?.canCommitAwards,false);
    return true;
  });
});

test('the dissolved leading front reaches conditional individual lines and replay',()=>{
  const input={pointContext:{tier:3,divisionCount:4,divisionIndex:2}};
  const race=createV93PlayableTest(settings,input);
  assert.equal(race.version,V93_DISSOLVED_LEADING_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
  assert.equal(race.clock.line.outcome,
    'dissolved_leading_front_with_rear_bunch_pass');
  assert.deepEqual(race.clock.line.bands.map(row=>
    [row.id,row.riderIds.length]),[
    ['leading_isolated_front',4],['road-2',3],
    ['peloton',24],['dropped',1]]);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
  assert.equal(summary.lineTimes.length,32);
  assert.equal(summary.bandReplays.length,7);
  assert.deepEqual(summary.dissolvedLeadingFront.leadingRiderIds,
    ['rival-1-7','rival-2-7','rival-3-7','you-7']);
  assert.deepEqual(summary.dissolvedLeadingFront.rearRiderIds,
    ['rival-2-6']);
  assert.ok(Math.abs(summary.dissolvedLeadingFront.bunchPasses[0]
    .distanceM-259209.78196355206)<1e-7);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  const at500=new Map(race.clock.trace.frames.find(row=>
    row.endDistanceM===259500).riders.map(row=>
    [row.riderId,row.energy]));
  const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const replayed=new Set();
  for(const band of summary.bandReplays){
    for(const row of band.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-at500.get(row.riderId))<1e-7);
    for(const row of band.frames.at(-1).riders){
      assert.equal(replayed.has(row.riderId),false);
      replayed.add(row.riderId);
      assert.equal(lines.get(row.riderId).roadBandId,band.id);
      assert.equal(lines.get(row.riderId).elapsedSecondsFromLastKmStart,
        row.elapsedToLineSeconds);
      assert.ok(Math.abs(lines.get(row.riderId).energyAtLine-
        row.energyAfter)<1e-7);
    }
  }
  assert.equal(replayed.size,32);
});

test('dissolved leading fronts finish or refuse explicitly across gender and terrain',()=>{
  for(const gender of ['M','F'])for(const terrain of
    ['rolling','mountain','exposed']){
    const selected={...settings,gender,terrain,
      seed:`v93-contact-audit-4-${gender}-${terrain}-30-0`};
    if(terrain==='rolling'){
      const race=createV93PlayableTest(selected);
      assert.equal(race.version,V93_DISSOLVED_LEADING_PLAYTEST_VERSION);
      assert.equal(validateV93CoastedPlaytest(selected,{},race),true);
      assert.equal(summarizeV93CoastedPlaytest(race).lineTimes.length,32);
    }else assert.throws(()=>createV93PlayableTest(selected),error=>{
      assert.match(error.message,/recorded group dissolution/);
      assert.equal(error.roadPreview?.unsupportedReason,
        'depleted_front_dissolution');
      assert.equal(error.roadPreview?.canCommitAwards,false);
      return true;
    });
  }
});
