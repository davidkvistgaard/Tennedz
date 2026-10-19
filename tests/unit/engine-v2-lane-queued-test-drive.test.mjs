import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runV91LaneQueuedTestDrive,runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleLaneQueuedEarlyBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

const example=JSON.parse(readFileSync(new URL(
  '../../docs/design/engine-v2-test-drive-example.json',import.meta.url),
'utf8'));

test('offline lane-queued choice pays a replayable finish from route and manager orders',()=>{
  for(const [distanceKm,terrain,teamCount,gender] of [
    [40,'flat',4,'M'],[120,'rolling',15,'F'],
    [260,'mountain',20,'M']]){
    const scenario={settings:{...example.settings,distanceKm,
      terrain,teamCount,gender,seed:'early-matrix'},
    finalePlans:[]};
    const {summary,recording,paidFinale}=
      runV91LaneQueuedTestDrive(scenario,{full:true});
    assert.equal(summary.status,'conditional');
    assert.equal(summary.input.distanceKm,distanceKm);
    assert.equal(summary.request.plans.length,teamCount);
    assert.equal(summary.conditionalLine.length,teamCount*8);
    assert.equal(summary.finalRiderEnergy.length,teamCount*8);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(validateFinaleLaneQueuedEarlyBunchRunnerFromTour(
      recording,{plans:summary.request.plans},paidFinale),true);
  }
});

test('unpayable source roads and attack requests stay explicit',()=>{
  const separated={settings:{...example.settings,
    distanceKm:260,terrain:'mountain',teamCount:4,
    fatigue:30,seed:'early-matrix'},finalePlans:[]};
  const summary=runV91LaneQueuedTestDrive(separated);
  assert.equal(summary.status,'unsupported');
  assert.match(summary.reason,/one inactive-attack bunch/);
  assert.equal(summary.conditionalLine,undefined);
  assert.equal(summary.pointsStatus,'withheld');
  assert.throws(()=>runV91LaneQueuedTestDrive({...example,
    attack:{teamId:'you',riderId:'you-0'}}),
  /named attack needs the integrated road test drive/);
  assert.throws(()=>runV91LaneQueuedTestDrive({...example,
    individualGroupLine:true}),
  /without other finale branch flags/);
});

test('several manager orders and a paid helper survive the offline request',()=>{
  const scenario={settings:{...example.settings,seed:'early-matrix',
    managerTacticOverrides:[{teamId:'rival-2',effort:'conserve',
      attack:'none',chase:'ignore'}]},finalePlans:[{
    teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-6'},{
    teamId:'rival-2',finisherId:'rival-2-7',
    leadOutRiderId:null}]};
  const result=runV91LaneQueuedTestDrive(scenario);
  assert.equal(result.status,'conditional');
  assert.equal(result.managerDecisions.find(row=>
    row.teamId==='rival-2').baseline.effort,'conserve');
  assert.equal(result.request.plans.length,4);
  assert.ok(result.leadOutAttempts.some(row=>
    row.helperId==='rival-1-6'&&row.helperEnergySpent>0));
  assert.equal(result.conditionalLine.length,32);
});

test('the CLI selects the opt-in version without changing integrated output',()=>{
  const script=new URL('../../scripts/engine-v2-test-drive.mjs',
    import.meta.url);
  const input=new URL('../../docs/design/engine-v2-test-drive-example.json',
    import.meta.url);
  const process=spawnSync(globalThis.process.execPath,
    [fileURLToPath(script),fileURLToPath(input),'--lane-queue'],{
      encoding:'utf8',timeout:30_000});
  assert.equal(process.status,0,process.stderr);
  const result=JSON.parse(process.stdout);
  assert.equal(result.version,'v91-offline-lane-queued-test-drive-1');
  assert.equal(result.status,'conditional');
  assert.equal(result.conditionalLine.length,32);
  const integrated=runV91IntegratedTestDrive(example);
  assert.equal(integrated.integrationVersion,
    'v91-integrated-test-drive-1');
});
