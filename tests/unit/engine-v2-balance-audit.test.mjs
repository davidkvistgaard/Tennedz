import test from 'node:test';
import assert from 'node:assert/strict';
import {hasResidualGapAfterSufficientChase} from
  '../../lib/engine/v2/balance-audit.mjs';

const previous={roadGroups:[{id:'road-1',gapSeconds:.5}]};
const current={roadGroups:[{id:'road-1',gapSeconds:.2}],attackPower:0,
  chasePower:10,passiveGapDelta:.4};

test('residual warning requires the same surviving group and sufficient chase',()=>{
  assert.equal(hasResidualGapAfterSufficientChase([previous,current],1),true);
  assert.equal(hasResidualGapAfterSufficientChase([previous,
    {...current,chasePower:1}],1),false);
  assert.equal(hasResidualGapAfterSufficientChase([previous,
    {...current,attackPower:1}],1),false);
  assert.equal(hasResidualGapAfterSufficientChase([previous,
    {...current,roadGroups:[{id:'road-2',gapSeconds:.2}]}],1),false);
  assert.equal(hasResidualGapAfterSufficientChase([previous,
    {...current,roadGroups:[]}],1),false);
  assert.throws(()=>hasResidualGapAfterSufficientChase([previous],0),
    /previous recorded frame/);
});

test('residual warning follows the rear group when several groups are ahead',()=>{
  const earlier={roadGroups:[{id:'road-1',gapSeconds:20},
    {id:'road-2',gapSeconds:.5}]};
  const later={...current,roadGroups:[{id:'road-1',gapSeconds:21},
    {id:'road-2',gapSeconds:.2}]};
  assert.equal(hasResidualGapAfterSufficientChase([earlier,later],1),true);
  assert.equal(hasResidualGapAfterSufficientChase([earlier,
    {...later,roadGroups:[later.roadGroups[0],{id:'road-3',gapSeconds:.2}]}],1),false);
  assert.equal(hasResidualGapAfterSufficientChase([earlier,
    {...later,chasePower:1}],1),false);
});
