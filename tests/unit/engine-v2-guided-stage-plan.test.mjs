import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeGuidedStagePlan} from
  '../../lib/engine/v2/playtest-stage-plan.mjs';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {summarizeRecordedStageTrace} from
  '../../lib/engine/v2/playtest-stage-trace.mjs';

test('the before-race stage plan matches the route actually recorded',()=>{
  for(const terrain of ['flat','rolling','mountain','exposed','custom']){
    const settings={distanceKm:40,terrain,seed:'stage-plan-evidence',
      ...(terrain==='custom'?{profileHeightsM:[100,130,300,120,200,100]}:{})};
    const before=summarizeGuidedStagePlan(settings);
    const race=createV91Playtest(settings);
    assert.deepEqual(before.stageTrace,
      summarizeRecordedStageTrace(race.recording));
    assert.equal(before.intervals.length,8);
    assert.deepEqual(before.intervals.map(row=>row.fromKm),
      [0,5,10,15,20,25,30,35]);
    assert.ok(before.intervals.every(row=>row.toKm-row.fromKm===5));
    assert.ok(before.intervals.every(row=>
      row.windKph[0]<=row.windKph[1]&&
      row.rainMm[0]<=row.rainMm[1]));
  }
});

test('stage plan keeps kilometre variation within each tactical interval',()=>{
  const plan=summarizeGuidedStagePlan({distanceKm:40,terrain:'mountain',
    seed:'stage-plan-variation'});
  const first=plan.stageTrace.kilometres.slice(0,5);
  assert.deepEqual(plan.intervals[0].terrains,
    [...new Set(first.map(row=>row.terrain))]);
  assert.deepEqual(plan.intervals[0].windKph,
    [Math.min(...first.map(row=>row.weather.windKph)),
      Math.max(...first.map(row=>row.weather.windKph))]);
  assert.equal(plan.version,'v93-guided-stage-plan-1');
  assert.equal(plan.source,'simulated');
});

test('stage plan refuses unsupported geometry',()=>{
  assert.throws(()=>summarizeGuidedStagePlan({distanceKm:45,
    terrain:'flat'}),/valid playtest settings/);
});
