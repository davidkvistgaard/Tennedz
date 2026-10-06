import test from 'node:test';
import assert from 'node:assert/strict';
import {assertV2SettlementAttemptPhase} from
  '../../lib/race/v2-settlement-phase.mjs';

const now=Date.parse('2026-10-06T15:00:00Z');
const event={kind:'one_day',status:'OPEN',
  registration_deadline:'2026-10-06T12:00:00Z',
  tactics_deadline:'2026-10-06T13:00:00Z',
  scheduled_at:'2026-10-06T14:00:00Z'};

test('v2 settlement rejects unavailable phases before the expensive replay',()=>{
  assert.doesNotThrow(()=>assertV2SettlementAttemptPhase(event,{now}));
  for(const field of ['registration_deadline','tactics_deadline','scheduled_at']){
    assert.throws(()=>assertV2SettlementAttemptPhase(
      {...event,[field]:'2026-10-06T16:00:00Z'},{now}),/not ready/);
    assert.throws(()=>assertV2SettlementAttemptPhase(
      {...event,[field]:'invalid'},{now}),/not ready/);
  }
  for(const status of ['CANCELLED','PREPARING',null])
    assert.throws(()=>assertV2SettlementAttemptPhase({...event,status},{now}),
      /not ready/);
  assert.throws(()=>assertV2SettlementAttemptPhase({...event,kind:'stage'},{now}),
    /not ready/);
  assert.throws(()=>assertV2SettlementAttemptPhase(event,{now:NaN}),/not ready/);
});

test('finished v2 races may retry through the locked idempotency check',()=>{
  assert.doesNotThrow(()=>assertV2SettlementAttemptPhase(
    {...event,status:'FINISHED'},{now}));
});
