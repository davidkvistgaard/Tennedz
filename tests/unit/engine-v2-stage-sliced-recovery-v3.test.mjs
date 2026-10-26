import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {projectStageRecoveryKilometreV3,
  settleStageRecoveryKilometreV3} from
  '../../lib/engine/v2/stage-sliced-recovery-v3.mjs';
import {recoveryForKilometre} from '../../lib/engine/v2/recovery.mjs';

const rider={id:'r',gender:'M',flat:60,strength:60,endurance:60,
  sprint:60,leadership:60};
const calm={surface:'road',exposed:false,source:'illustrative',
  weather:{temperatureC:16,windKph:8,rainMm:0}};
function overlay(features=[],conditionSpans=[]){
  return normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions:calm})),
    features,conditionSpans});
}
function project(stage,extra={}){
  return projectStageRecoveryKilometreV3({overlay:stage,
    kilometreIndex:10,rider,effort:'conserve',group:'peloton',
    quietKm:2,baseTerrain:'flat',baseGradientPct:0,...extra});
}

test('homogeneous calm kilometre matches existing once-per-km recovery',()=>{
  const expected=recoveryForKilometre({rider,
    segment:{terrain:'flat',gradientPct:0,surface:'road',
      exposed:false,weather:calm.weather},effort:'conserve',
    group:'peloton',quietKm:2});
  const paid=project(overlay());
  assert.equal(paid.quietKmAfter,expected.quietKm);
  assert.equal(paid.recoveryPotential,expected.recovery);
  assert.equal(paid.blockingSpan,null);
});

test('a fractional steep climb cancels the full quiet-kilometre award',()=>{
  const result=project(overlay([{id:'short-climb',kind:'climb',
    fromKm:10.2,toKm:10.4,gradientPct:8}]));
  assert.equal(result.quietKmAfter,0);
  assert.equal(result.recoveryPotential,0);
  assert.deepEqual([result.blockingSpan.fromKm,
    result.blockingSpan.toKm],[10.2,10.4]);
  assert.deepEqual(result.blockingSpan.featureIds,['short-climb']);
});

test('fractional rough weather and declared work each cancel quiet recovery',()=>{
  const stage=overlay([], [{id:'rough',fromKm:10.3,toKm:10.6,
    conditions:{surface:'gravel',exposed:true,source:'illustrative',
      weather:{temperatureC:16,windKph:25,rainMm:1}}}]);
  const rough=project(stage);
  assert.equal(rough.quietKmAfter,0);
  assert.equal(rough.blockingSpan.conditionSpanId,'rough');
  assert.equal(project(overlay(),{working:true}).recoveryPotential,0);
  assert.equal(project(overlay(),{group:'dropped'}).recoveryPotential,0);
});

test('recovery projection refuses unresolved topography and bad baseline',()=>{
  const stage=overlay([{id:'a',kind:'climb',fromKm:10.2,toKm:10.4,
    gradientPct:8},{id:'b',kind:'climb',fromKm:10.3,toKm:10.5,
    gradientPct:9}]);
  assert.throws(()=>project(stage),/resolved slice topography/);
  assert.throws(()=>project(overlay(),{baseTerrain:'unknown'}),
    /baseline terrain/);
});

test('recovery settles after paid work under the supplied race capacity',()=>{
  const projection=project(overlay());
  const full=settleStageRecoveryKilometreV3({projection,
    energyAfterPaidWork:50,energyCap:60});
  assert.equal(full.recoveryApplied,projection.recoveryPotential);
  assert.equal(full.capAdjustment,0);
  assert.equal(full.energyAfter,50+projection.recoveryPotential);
  const capped=settleStageRecoveryKilometreV3({projection,
    energyAfterPaidWork:59.9,energyCap:60});
  assert.equal(capped.recoveryApplied,
    Math.min(projection.recoveryPotential,.1));
  assert.equal(capped.energyAfter,60);
  assert.ok(capped.capAdjustment>=0);
  const blocked=settleStageRecoveryKilometreV3({projection:
    project(overlay([{id:'climb',kind:'climb',fromKm:10.2,
      toKm:10.4,gradientPct:8}])),
  energyAfterPaidWork:50,energyCap:60});
  assert.equal(blocked.energyAfter,50);
  assert.equal(blocked.recoveryApplied,0);
});

test('recovery settlement refuses unearned energy or an invalid cap',()=>{
  const projection=project(overlay());
  assert.throws(()=>settleStageRecoveryKilometreV3({projection,
    energyAfterPaidWork:61,energyCap:60}),/capacity/);
  assert.throws(()=>settleStageRecoveryKilometreV3({projection,
    energyAfterPaidWork:50,energyCap:101}),/capacity/);
  assert.throws(()=>settleStageRecoveryKilometreV3({projection:{},
    energyAfterPaidWork:50,energyCap:60}),/projection/);
});
