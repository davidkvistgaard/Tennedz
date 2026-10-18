import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runV91TestDrive} from '../../scripts/engine-v2-test-drive.mjs';

const example=JSON.parse(readFileSync(new URL(
  '../../docs/design/engine-v2-test-drive-example.json',import.meta.url),
'utf8'));

test('offline test drive pays a manager lead-out on one replayed race',()=>{
  const assisted=runV91TestDrive(example,{full:true});
  const neutral=runV91TestDrive({...example,finalePlans:[]},{full:true});
  assert.equal(assisted.summary.roadStatus,'paid_conditional_line');
  assert.equal(assisted.summary.finale.lineTimes.length,32);
  assert.deepEqual(assisted.recording.recording,
    neutral.recording.recording);
  assert.ok(assisted.summary.finale.leadOutWork.some(row=>
    row.riderId==='rival-3-5'&&row.role==='lead_out'&&
    row.energySpent>0));
  const time=output=>output.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-3-7').elapsedSecondsFromLastKmStart;
  assert.ok(time(assisted)<time(neutral));
  assert.equal(assisted.summary.resultStatus,'unclassified');
  assert.equal(assisted.summary.pointsStatus,'withheld');
  assert.equal(assisted.summary.canCommitAwards,false);
});

test('offline test drive exposes a paid break without inventing an order',()=>{
  const scenario={settings:{distanceKm:40,terrain:'flat',teamCount:4,
    gender:'F',seed:'conditional-coverage-1',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'attack'}};
  const output=runV91TestDrive(scenario);
  assert.equal(output.roadStatus,'paid_group_bands');
  assert.equal(output.finale.individualFinishStatus,
    'unresolved_within_road_bands');
  assert.equal(output.finale.finalRiderEnergy.length,32);
  assert.ok(output.finale.roadFrames.length>1);
  assert.equal(output.pointsStatus,'withheld');
  assert.equal(output.canCommitAwards,false);
  const refused=runV91TestDrive({...scenario,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:null}]});
  assert.equal(refused.status,'unsupported');
  assert.match(refused.reason,/not paid for a road group/);
});

test('offline test drive rejects unknown managers and accepts stdin JSON',()=>{
  assert.throws(()=>runV91TestDrive({...example,finalePlans:[{
    teamId:'other',finisherId:'other-7',leadOutRiderId:null}]}),
  /known manager/);
  const processResult=spawnSync(process.execPath,
    ['scripts/engine-v2-test-drive.mjs','-'],{
      cwd:new URL('../..',import.meta.url),
      input:JSON.stringify(example),encoding:'utf8'});
  assert.equal(processResult.status,0,processResult.stderr);
  assert.equal(JSON.parse(processResult.stdout).roadStatus,
    'paid_conditional_line');
});

test('offline test drive keeps multiple manager orders and visible defaults',()=>{
  const scenario={settings:{...example.settings,gender:'F',
    seed:'test-drive-managers-1',managerTactics:[
      {effort:'conserve',attack:'none',chase:'ignore'},
      {effort:'hard',attack:'none',chase:'all'}]},finalePlans:[]};
  const output=runV91TestDrive(scenario);
  assert.equal(output.roadStatus,'paid_conditional_line');
  const decisions=new Map(output.managerDecisions.map(row=>
    [row.teamId,row]));
  assert.equal(decisions.get('rival-1').baseline.effort,'conserve');
  assert.equal(decisions.get('rival-1').baseline.chase,'ignore');
  assert.equal(decisions.get('rival-2').baseline.effort,'hard');
  assert.equal(decisions.get('rival-3').baseline.chase,'all');
  assert.equal(output.finale.lineTimes.length,32);
});
