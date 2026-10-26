import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {projectStageCapacityKilometreV3} from
  '../../lib/engine/v2/stage-sliced-capacity-v3.mjs';
import {MOTOR_RECOVERY_CEILING} from '../../lib/engine/v2/tuning.mjs';

const calm={surface:'road',exposed:false,source:'illustrative',
  weather:{temperatureC:16,windKph:8,rainMm:0}};
function overlay(features=[],conditionSpans=[]){
  return normalizeStageOverlayV3({version:3,distanceKm:170,
    tacticalIntervals:Array.from({length:34},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions:calm})),
    features,conditionSpans});
}
function project(stage,extra={}){
  return projectStageCapacityKilometreV3({overlay:stage,
    kilometreIndex:160,rider:{endurance:60},
    energyCapBefore:75,baseTerrain:'flat',baseGradientPct:0,...extra});
}

test('homogeneous post-160 kilometre matches existing cap decay',()=>{
  const result=project(overlay());
  const expected=(MOTOR_RECOVERY_CEILING.capDecayBasePerKm+
    40*MOTOR_RECOVERY_CEILING.enduranceDeficitPerPoint);
  assert.equal(result.active,true);
  assert.equal(result.decayDemand,expected);
  assert.equal(result.energyCapAfter,+(75-expected).toFixed(3));
  const before=projectStageCapacityKilometreV3({overlay:overlay(),
    kilometreIndex:159,rider:{endurance:60},energyCapBefore:75,
    baseTerrain:'flat',baseGradientPct:0});
  assert.equal(before.active,false);
  assert.equal(before.energyCapAfter,75);
});

test('a fractional steep climb and rough span increase only their share',()=>{
  const stage=overlay([{id:'climb',kind:'climb',fromKm:160.2,
    toKm:160.4,gradientPct:10}], [{id:'rough',fromKm:160.5,
    toKm:160.7,conditions:{...calm,surface:'gravel'}}]);
  const result=project(stage);
  const base=project(overlay());
  assert.deepEqual(result.frames.map(row=>[row.fromKm,row.toKm]),
    [[160,160.2],[160.2,160.4],[160.4,160.5],
      [160.5,160.7],[160.7,161]]);
  assert.ok(result.decayDemand>base.decayDemand);
  assert.ok(result.energyCapAfter<base.energyCapAfter);
  assert.equal(result.frames[1].featureIds[0],'climb');
  assert.equal(result.frames[3].conditionSpanId,'rough');
});

test('capacity floor holds and unresolved topography refuses',()=>{
  const floor=project(overlay(),{energyCapBefore:30});
  assert.equal(floor.energyCapAfter,30);
  const invalid=overlay([{id:'a',kind:'climb',fromKm:160.2,
    toKm:160.4,gradientPct:8},{id:'b',kind:'climb',fromKm:160.3,
    toKm:160.5,gradientPct:9}]);
  assert.throws(()=>project(invalid),/resolved slice topography/);
  assert.throws(()=>project(overlay(),{energyCapBefore:20}),/capacity/);
});
