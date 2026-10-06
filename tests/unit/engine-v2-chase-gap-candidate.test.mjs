import test from 'node:test';
import assert from 'node:assert/strict';
import {projectNetChaseGap} from
  '../../lib/engine/v2/chase-gap-candidate.mjs';

const project=(overrides={})=>projectNetChaseGap({priorGapSeconds:.5,
  passiveGapDelta:.4,chasePower:10,recoverySecondsPerCapacity:.12,
  ...overrides});

test('paid chase covers the old gap and the break movement in one kilometre',()=>{
  assert.deepEqual(project(),{gapBeforeChase:.9,recoveredSeconds:.9,
    gapSeconds:0,caught:true});
  const insufficient=project({chasePower:5});
  assert.ok(insufficient.gapSeconds>0);
  assert.equal(insufficient.caught,false);
  assert.equal(project({chasePower:0}).gapSeconds,.9);
});

test('a fading break can be caught without inventing chase capacity',()=>{
  assert.deepEqual(project({passiveGapDelta:-.7,chasePower:0}),
    {gapBeforeChase:0,recoveredSeconds:0,gapSeconds:0,caught:true});
  assert.equal(project({priorGapSeconds:0,passiveGapDelta:0}).caught,false);
});

test('net-chase projection rejects non-finite or negative sporting inputs',()=>{
  for(const [key,value] of [['priorGapSeconds',-1],['passiveGapDelta',NaN],
    ['chasePower',Infinity],['recoverySecondsPerCapacity',-.1]])
    assert.throws(()=>project({[key]:value}),/Invalid net-chase/);
});
