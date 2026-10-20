import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_ENERGY_LEDGER_VERSION,MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

const profileHeightsM=[100,350,150,500,180,100];
function run(settings,version){
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  return simulateTacticalTour({stage,weather,teams,seed,motorVersion:version});
}

test('exhausted riders coast at paid slower pace through ten whole races',()=>{
  for(const terrain of ['flat','rolling','mountain','exposed','custom'])
    for(const gender of ['M','F']){
      const settings={distanceKm:260,terrain,gender,teamCount:4,fatigue:30,
        seed:'cross-route-1',defaultRivalPlan:'mixed',attack:'selective',
        chase:'selective',...(terrain==='custom'?{profileHeightsM}:{})};
      const audit=run(settings,MOTOR_ENERGY_LEDGER_VERSION);
      const coast=run(settings,MOTOR_EXHAUSTION_COAST_VERSION);
      assert.equal(validateRecordedTour(coast),true);
      const unpaid=audit.frames.flatMap(frame=>frame.energyLedger
        .filter(row=>row.unmetEnergyDemand>.000001));
      const delayed=coast.frames.flatMap(frame=>frame.energyLedger
        .filter(row=>row.coastDelaySeconds>0));
      assert.ok(unpaid.length>0);
      assert.ok(delayed.length>=unpaid.length);
      assert.ok(coast.frames.every(frame=>frame.energyLedger.every(row=>
        row.unmetEnergyDemand===0)));
      assert.ok(delayed.every(row=>row.curtailedWorkDemand>0&&
        row.workDemand===row.paidFromReserve));
      assert.equal(coast.provisionalResults.length,32);
      const final=coast.frames.at(-1);
      assert.deepEqual(coast.provisionalResults.map(row=>row.riderId).sort(),
        final.riderGroups.map(row=>row.id).sort());
      for(const result of coast.provisionalResults){
        const state=final.riderGroups.find(row=>row.id===result.riderId);
        assert.equal(result.energy,state.energy);
        assert.equal(result.group,state.group);
      }
      const zeroRider=delayed.find(row=>row.energyBefore===0);
      assert.ok(zeroRider?.coastDelaySeconds>0);
    }
});

test('v93 leaves a well-funded field identical to the v92 road',()=>{
  const settings={distanceKm:120,terrain:'exposed',teamCount:15,gender:'F',
    fatigue:15,seed:'coast-not-needed',effort:'steady',attack:'none',
    chase:'selective'};
  const prior=run(settings,MOTOR_ENERGY_LEDGER_VERSION);
  const next=run(settings,MOTOR_EXHAUSTION_COAST_VERSION);
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(next),true);
  assert.ok(next.frames.every(frame=>frame.energyLedger.every(row=>
    row.coastDelaySeconds===0)));
  const normalized=structuredClone(next);
  normalized.tuningVersion=MOTOR_ENERGY_LEDGER_VERSION;
  for(const frame of normalized.frames)for(const row of frame.energyLedger){
    delete row.requestedWorkDemand;
    delete row.curtailedWorkDemand;
    delete row.coastDelaySeconds;
  }
  assert.deepEqual(normalized,prior);
});

test('large-field attack and chase plans retain paid road and complete results',()=>{
  for(const terrain of ['flat','rolling','mountain','exposed','custom'])
    for(const gender of ['M','F'])
      for(const teamCount of [15,20])
        for(const plan of ['chase','attack']){
          const race=run({distanceKm:260,terrain,teamCount,gender,
            fatigue:30,seed:'coast-matrix',defaultRivalPlan:plan,
            attack:plan==='attack'?'repeated':'none',
            chase:plan==='chase'?'all':'ignore',
            ...(terrain==='custom'?{profileHeightsM}:{})},
          MOTOR_EXHAUSTION_COAST_VERSION);
          assert.equal(validateRecordedTour(race),true);
          assert.equal(race.provisionalResults.length,teamCount*8);
          assert.ok(race.frames.every(frame=>frame.energyLedger.every(row=>
            row.unmetEnergyDemand===0)));
        }
});

test('a missing coast delay cannot validate as paid travel',()=>{
  const race=run({distanceKm:260,terrain:'flat',teamCount:4,gender:'M',
    fatigue:30,seed:'cross-route-1'},MOTOR_EXHAUSTION_COAST_VERSION);
  const tampered=structuredClone(race);
  const row=tampered.frames.flatMap(frame=>frame.energyLedger)
    .find(item=>item.coastDelaySeconds>0);
  assert.ok(row);
  row.coastDelaySeconds=0;
  assert.throws(()=>validateRecordedTour(tampered),/energy ledger/);
  const wrongDelay=structuredClone(race);
  wrongDelay.frames.flatMap(frame=>frame.energyLedger)
    .find(item=>item.coastDelaySeconds>0).coastDelaySeconds+=10;
  assert.throws(()=>validateRecordedTour(wrongDelay),/energy ledger/);
  const wrongRoad=structuredClone(race);
  const coastFrame=wrongRoad.frames.find(frame=>frame.energyLedger
    .some(item=>item.coastDelaySeconds>0));
  const coastingId=coastFrame.energyLedger.find(item=>
    item.coastDelaySeconds>0).riderId;
  coastFrame.riderGroups.find(item=>item.id===coastingId).deficitSeconds=0;
  assert.throws(()=>validateRecordedTour(wrongRoad),/coasting time/);
});
