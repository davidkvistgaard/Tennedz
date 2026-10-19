import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runV91LaneQueuedTestDrive,runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleLaneQueuedEarlyBunchRunnerFromTour,
  validateFinaleLaneQueuedCaughtBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';
import {projectFinaleLaneQueuedPointPreview,
  validateFinaleLaneQueuedPointPreview} from
  '../../lib/engine/v2/finale-lane-queued-point-preview.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';

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

test('unpayable source roads and solo attack outcomes stay explicit',()=>{
  const separated={settings:{...example.settings,
    distanceKm:260,terrain:'mountain',teamCount:4,
    fatigue:30,seed:'early-matrix'},finalePlans:[]};
  const summary=runV91LaneQueuedTestDrive(separated);
  assert.equal(summary.status,'unsupported');
  assert.match(summary.reason,/one inactive-attack bunch/);
  assert.equal(summary.conditionalLine,undefined);
  assert.equal(summary.pointsStatus,'withheld');
  const solo=runV91LaneQueuedTestDrive({settings:{...example.settings,
    seed:'trial'},attack:{teamId:'you',riderId:'you-7'}});
  assert.equal(solo.status,'unsupported');
  assert.equal(solo.attackRoadOutcome,'solo');
  assert.match(solo.reason,/complete bunch at 500 m/);
  assert.throws(()=>runV91LaneQueuedTestDrive({...example,
    individualGroupLine:true}),
  /without other finale branch flags/);
});

test('a tired but correctly placed helper reports its energy refusal',()=>{
  const settings={...example.settings,distanceKm:260,
    terrain:'mountain',teamCount:20,gender:'M',fatigue:30,
    attack:'none',chase:'ignore',seed:'tired-queue'};
  const baseline=runV91LaneQueuedTestDrive({settings});
  const attempted=runV91LaneQueuedTestDrive({settings,finalePlans:[{
    teamId:'rival-1',finisherId:'rival-1-5',
    leadOutRiderId:'rival-1-6'}]});
  assert.equal(baseline.status,'conditional');
  assert.equal(baseline.conditionalLine.length,160);
  assert.equal(attempted.status,'unsupported');
  assert.deepEqual(attempted.leadOutUnavailable,{
    teamId:'rival-1',helperId:'rival-1-6',reason:'exhausted'});
  assert.deepEqual(attempted.lastKmSource,baseline.lastKmSource);
  assert.equal(attempted.conditionalLine,undefined);
  assert.equal(attempted.pointsStatus,'withheld');
});

test('one caught named attack pays a lane-queued finish and helper on its locked tour',()=>{
  const scenario={settings:{...example.settings,seed:'trial'},
    attack:{teamId:'you',riderId:'you-0'},
    finalePlans:[{teamId:'rival-1',finisherId:'rival-1-7',
      leadOutRiderId:'rival-1-5'}]};
  const {summary,recording,paidFinale}=
    runV91LaneQueuedTestDrive(scenario,{full:true});
  assert.equal(summary.status,'conditional');
  assert.equal(summary.attackRoadOutcome,'caught');
  assert.equal(paidFinale.startDistanceM,39500);
  assert.equal(summary.conditionalLine.length,32);
  assert.ok(summary.leadOutWork.some(row=>
    row.riderId==='rival-1-5'&&row.energySpent>0));
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(validateFinaleLaneQueuedCaughtBunchRunnerFromTour(
    recording,{attackTeamId:'you',plans:summary.request.plans},
    paidFinale),true);
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

test('complete lane-queued lines illustrate existing points without awarding them',()=>{
  const pointContext={tier:3,divisionIndex:1,divisionCount:2};
  for(const scenario of [
    {settings:{...example.settings,seed:'early-matrix',
      distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},
    finalePlans:[],pointContext},
    {settings:{...example.settings,seed:'trial'},
    attack:{teamId:'you',riderId:'you-0'},
    finalePlans:[],pointContext}]){
    const {summary,recording,paidFinale}=
      runV91LaneQueuedTestDrive(scenario,{full:true});
    const preview=summary.provisionalPointPreview;
    assert.equal(summary.status,'conditional');
    assert.equal(preview.pointsPolicyVersion,POINT_POLICY_VERSION);
    assert.equal(preview.pointsStatus,'experimental_preview_only');
    assert.equal(preview.canCommitAwards,false);
    assert.deepEqual(preview.awardRows,[]);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(preview.riders.length,summary.conditionalLine.length);
    for(const [index,row] of preview.riders.entries()){
      const line=summary.conditionalLine[index];
      assert.equal(row.riderId,line.riderId);
      assert.equal(row.provisionalPlace,line.position);
      assert.equal(row.energyAtLine,line.energyAtLine);
      assert.equal(row.previewPoints,pointsForDivisionResult({
        tier:pointContext.tier,resultType:'ONE_DAY',
        placing:index+1,multiplier:preview.multiplier}));
    }
    assert.equal(validateFinaleLaneQueuedPointPreview(recording,
      summary.request,pointContext,preview),true);
    assert.throws(()=>validateFinaleLaneQueuedPointPreview(recording,
      summary.request,pointContext,{...preview,awardRows:[{}]}),
    /do not replay/);
    assert.throws(()=>projectFinaleLaneQueuedPointPreview(recording,
      {...paidFinale,lineOrder:[{...paidFinale.lineOrder[0],
        position:null},...paidFinale.lineOrder.slice(1)]},
      pointContext),/unambiguous line/);
  }
});

test('a later two-attack catch is refused by the 500 m queue entry',()=>{
  const teamCount=15;
  const ids=['you',...Array.from({length:teamCount-1},(_,index)=>
    `rival-${index+1}`)];
  const scenario={settings:{distanceKm:40,teamCount,terrain:'flat',
    gender:'M',fatigue:0,seed:'paired-final-orders',attack:'none',
    chase:'ignore',defaultRivalPlan:'neutral',
    managerFinaleOrders:ids.map(teamId=>({teamId,
      attack:['you','rival-2'].includes(teamId)?'selective':'none',
      ...(['you','rival-2'].includes(teamId)?{
        attackRiderId:`${teamId}-2`}:{}),
      chase:['rival-1','rival-4'].includes(teamId)?'selective':'ignore',
      frontWork:teamId==='rival-3'?'rotate':'sit_in'})),
    teamOverrides:ids.map(teamId=>({teamId,
      level:teamId==='rival-2'?81:teamId==='you'?80:85}))},
  pointContext:{tier:3,divisionIndex:1,divisionCount:2}};
  const summary=runV91LaneQueuedTestDrive(scenario);
  assert.equal(summary.status,'unsupported');
  assert.equal(summary.individualFinishStatus,'unavailable');
  assert.equal(summary.provisionalPointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
});
