import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {createV93CoastedPlaytest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {raceViewerOwnRiderActionsAt} from
  '../../lib/engine/v2/playtest-viewer.mjs';

const base={distanceKm:40,terrain:'flat',teamCount:4,gender:'M',
  effort:'steady',attack:'none',chase:'ignore',
  defaultRivalPlan:'passive',seed:'front-work-4'};
const phases=[{teamId:'you',atKm:10,effort:'hard',frontWork:'rotate'},
  {teamId:'you',atKm:20,frontWork:'sit_in'}];

test('separate front-work phases pay actual bunch pace only after the marker',()=>{
  const baseline=createV93CoastedPlaytest(base);
  const input={...base,managerTacticalOrdersV4:phases};
  const result=createV93CoastedPlaytest(input);
  assert.equal(validateV93CoastedPlaytest(input,{},result),true);
  const own=result.recording.committedInputs.teams.find(team=>team.id==='you');
  assert.equal(orderAt(own.orders,9).frontWork,undefined);
  assert.equal(orderAt(own.orders,10).frontWork,'rotate');
  assert.equal(orderAt(own.orders,20).frontWork,'sit_in');
  assert.deepEqual(result.recording.frames.slice(0,10),
    baseline.recording.frames.slice(0,10));
  const frames=result.recording.frames;
  assert.equal(frames[9].paidBunchPace?.teamId??null,null);
  assert.equal(frames[10].paidBunchPace?.teamId,'you');
  assert.equal(frames[19].paidBunchPace?.teamId,'you');
  assert.equal(frames[20].paidBunchPace?.teamId??null,null);
  assert.equal(frames[10].paidBunchPace.riderIds.length,2);
  assert(frames[10].paidBunchPace.riderIds.every(id=>
    frames[10].energyLedger.some(row=>row.riderId===id&&
      row.paidFromReserve>0)));
  assert.equal(result.individualLine.conditionalCrossings.length,32);
  const summary=summarizeV93CoastedPlaytest(result);
  assert.deepEqual(summary.kilometreFrames[10].paidBunchPaceRiderIds,
    frames[10].paidBunchPace.riderIds);
  const named=raceViewerOwnRiderActionsAt(summary,
    summary.kilometreFrames[10]);
  assert.deepEqual(named.filter(row=>row.events.includes('set bunch-front pace'))
    .map(row=>row.riderId).sort(),
  [...frames[10].paidBunchPace.riderIds].sort());
});

test('front-work phases preserve old order contracts and refuse ambiguous markers',()=>{
  assert.equal(prepareV91Playtest(base).settings.managerTacticalOrdersV4,
    undefined);
  for(const invalid of [
    [{teamId:'you',atKm:11,frontWork:'rotate'}],
    [{teamId:'you',atKm:10,frontWork:'magic'}],
    [{teamId:'you',atKm:10}],
    [phases[0],{...phases[0]}],
  ])assert.throws(()=>prepareV91Playtest({...base,
    managerTacticalOrdersV4:invalid}),/valid playtest settings/);
  assert.throws(()=>prepareV91Playtest({...base,
    managerTacticalOrdersV4:phases,
    managerTacticalOrdersV3:[{teamId:'you',atKm:15,effort:'hard'}]}),
  /valid playtest settings/);
});

test('a front-work-only marker retains the starting team effort',()=>{
  const input={...base,managerTacticalOrdersV4:[
    {teamId:'you',atKm:10,frontWork:'rotate'}]};
  const prepared=prepareV91Playtest(input);
  const own=prepared.teams.find(team=>team.id==='you');
  assert.deepEqual(own.orders.phases,[{atKm:10,frontWork:'rotate'}]);
  assert.equal(orderAt(own.orders,10).effort,base.effort);
  assert.equal(orderAt(own.orders,10).frontWork,'rotate');
  assert.throws(()=>createV93CoastedPlaytest(input),
    /needs recorded response or front rotation/);
});

test('paid front helpers spend more reserve than an otherwise identical sit-in',()=>{
  const recorded=frontWork=>{
    const prepared=prepareV91Playtest({...base,managerTacticalOrdersV4:[
      {teamId:'you',atKm:10,effort:'hard',frontWork}]});
    return simulateTacticalTour({...prepared,
      motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  };
  const work=recorded('rotate'),sitIn=recorded('sit_in');
  assert.deepEqual(work.frames.slice(0,10),sitIn.frames.slice(0,10));
  const paid=work.frames[10].paidBunchPace;
  assert.equal(paid.teamId,'you');
  assert.equal(paid.riderIds.length,2);
  assert.equal(sitIn.frames[10].paidBunchPace,null);
  for(const riderId of paid.riderIds){
    const debit=frame=>frame.energyLedger.find(row=>row.riderId===riderId);
    assert.equal(debit(work.frames[10]).energyBefore,
      debit(sitIn.frames[10]).energyBefore);
    assert(debit(work.frames[10]).paidFromReserve>
      debit(sitIn.frames[10]).paidFromReserve);
    assert(debit(work.frames[10]).energyAfter<
      debit(sitIn.frames[10]).energyAfter);
  }
});
