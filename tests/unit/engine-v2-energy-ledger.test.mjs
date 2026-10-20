import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,MOTOR_ENERGY_LEDGER_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

const run=(settings,version)=>{
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  return simulateTacticalTour({stage,weather,teams,seed,motorVersion:version});
};

test('v92 records every rider-kilometre without changing the v91 road or finish',()=>{
  const scenarios=[
    {distanceKm:40,terrain:'rolling',teamCount:4,gender:'F',fatigue:30,
      seed:'ledger-parity-short',attack:'repeated'},
    {distanceKm:120,terrain:'exposed',teamCount:15,gender:'M',fatigue:15,
      seed:'ledger-parity-mid',managerTactics:[
        {effort:'hard',attack:'none',chase:'all'},
        {effort:'conserve',attack:'repeated',chase:'ignore'}]},
    {distanceKm:260,terrain:'mountain',teamCount:20,gender:'F',fatigue:30,
      seed:'ledger-parity-long',attack:'repeated'}];
  for(const settings of scenarios){
    const old=run(settings,MOTOR_ATTACK_TRACE_VERSION);
    const next=run(settings,MOTOR_ENERGY_LEDGER_VERSION);
    assert.equal(validateRecordedTour(old),true);
    assert.equal(validateRecordedTour(next),true);
    assert.ok(old.frames.every(frame=>!('energyLedger' in frame)));
    const stripped=structuredClone(next);
    stripped.tuningVersion=MOTOR_ATTACK_TRACE_VERSION;
    for(const frame of stripped.frames)delete frame.energyLedger;
    assert.deepEqual(stripped,old);
    assert.ok(next.frames.every(frame=>
      frame.energyLedger.length===settings.teamCount*8));
  }
});

test('a long mixed-plan race exposes unpaid work from its first exhausted kilometre',()=>{
  const race=run({distanceKm:260,terrain:'mountain',teamCount:4,
    gender:'M',fatigue:30,seed:'ledger-long',effort:'hard',attack:'repeated',
    chase:'all'},MOTOR_ENERGY_LEDGER_VERSION);
  assert.equal(validateRecordedTour(race),true);
  const unpaid=race.frames.flatMap(frame=>frame.energyLedger
    .filter(row=>row.unmetEnergyDemand>.001).map(row=>({km:frame.km,...row})));
  assert.ok(unpaid.length>0);
  assert.ok(unpaid[0].km<259);
  assert.ok(unpaid.every(row=>row.workDemand>row.paidFromReserve));
  assert.ok(race.frames.every(frame=>frame.energyLedger.length===32));
  const last=race.frames.at(-1);
  for(const result of race.provisionalResults)
    assert.equal(result.energy,last.energyLedger.find(row=>
      row.riderId===result.riderId).energyAfter);
});

test('recorded energy ledger rejects tampered debt and missing riders',()=>{
  const race=run({distanceKm:40,teamCount:4,seed:'ledger-tamper'},
    MOTOR_ENERGY_LEDGER_VERSION);
  assert.equal(validateRecordedTour(race),true);
  const altered=structuredClone(race);
  altered.frames[0].energyLedger[0].unmetEnergyDemand+=1;
  assert.throws(()=>validateRecordedTour(altered),/energy ledger/);
  const missing=structuredClone(race);
  missing.frames[0].energyLedger.pop();
  assert.throws(()=>validateRecordedTour(missing),/energy ledger/);
});
