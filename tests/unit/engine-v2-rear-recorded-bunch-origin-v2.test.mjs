import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {runRearRecordedBunchOriginV1} from
  '../../lib/engine/v2/rear-recorded-bunch-origin-v1.mjs';
import {auditRearRecordedBunchOriginV2,
  requireRearRecordedBunchOriginEnergyV2,
  validateRearRecordedBunchOriginV2} from
  '../../lib/engine/v2/rear-recorded-bunch-origin-v2.mjs';

test('replayed V94 front worker cannot pass a different paid energy road',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    roadGroupPaceVersion:3,bunchFrontTurnVersion:1,
    chaseTurnVersion:1,pelotonFrontTurnVersion:1,
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,
      fatigue:30,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'}});
  const riderId=recording.frames[0].pelotonFrontTurnPlan.
    turns[0].leaderRiderId;
  const team=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const choices=Array.from({length:5},(_,index)=>({riderId,
    km:index+1,effort:orderAt(team.orders,index).effort,
    action:'hold_wheel',reason:'follow_order'}));
  const input={recording,riderId,throughKm:5,choices};
  const projected=runRearRecordedBunchOriginV1(input);
  assert.equal(projected.road.status,'bunch');
  const audit=auditRearRecordedBunchOriginV2(input);
  assert.equal(audit.sourceEnergyReconciled,false);
  assert.equal(audit.physicalClockReconciled,false);
  assert.ok(audit.mismatches.some(row=>row.km===1&&
    row.field==='paidFromReserve'));
  assert.ok(audit.mismatches.some(row=>row.km===5&&
    row.field==='energyAfter'));
  assert.equal(validateRearRecordedBunchOriginV2(input,audit),true);
  assert.throws(()=>requireRearRecordedBunchOriginEnergyV2(input),
    /energy differs from paid V94 source/);
  const forged=structuredClone(audit);
  forged.mismatches=[];
  assert.throws(()=>validateRearRecordedBunchOriginV2(input,forged),
    /differs/);
});
