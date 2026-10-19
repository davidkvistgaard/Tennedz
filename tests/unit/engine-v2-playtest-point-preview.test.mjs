import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';
import {createV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {projectV91ProvisionalPointPreview,
  validateV91ProvisionalPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';
import {runV91TestDrive} from '../../scripts/engine-v2-test-drive.mjs';

const example=JSON.parse(readFileSync(new URL(
  '../../docs/design/engine-v2-test-drive-example.json',import.meta.url),
'utf8'));
const context={tier:3,divisionIndex:1,divisionCount:1};

test('a paid lead-out changes only experimental preview places and policy points',()=>{
  const scenario={...example,pointContext:context};
  const assisted=runV91TestDrive(scenario,{full:true});
  const neutral=runV91TestDrive({...scenario,finalePlans:[]},{full:true});
  const first=assisted.summary.provisionalPointPreview;
  const second=neutral.summary.provisionalPointPreview;
  const rider=projection=>projection.riders.find(row=>
    row.riderId==='rival-3-7');
  assert.deepEqual(assisted.recording.recording,
    neutral.recording.recording);
  assert.ok(rider(first).elapsedSecondsFromLastKmStart<
    rider(second).elapsedSecondsFromLastKmStart);
  assert.ok(rider(first).provisionalPlace<rider(second).provisionalPlace);
  assert.equal(rider(first).previewPoints,
    pointsForDivisionResult({tier:3,resultType:'ONE_DAY',
      placing:rider(first).provisionalPlace,multiplier:1}));
  assert.equal(first.pointsPolicyVersion,POINT_POLICY_VERSION);
  assert.equal(first.riders.length,32);
  assert.deepEqual(first.awardRows,[]);
  assert.equal(first.canCommitAwards,false);
  assert.equal(assisted.summary.pointsStatus,'withheld');
  assert.equal(assisted.summary.resultStatus,'unclassified');
  assert.equal(assisted.recording.classifiedResults,null);
});

test('preview points replay a unique line and reject altered or ambiguous order',()=>{
  const trial=createV91ConditionalRaceFinal(example.settings,{});
  const projection=projectV91ProvisionalPointPreview(trial,context);
  assert.equal(validateV91ProvisionalPointPreview(example.settings,{},
    context,projection),true);
  assert.deepEqual(projection.riders.map(row=>row.riderId),
    trial.paidFinale.lineOrder.map(row=>row.riderId));
  const forged=structuredClone(projection);
  forged.riders[0].previewPoints+=1;
  assert.throws(()=>validateV91ProvisionalPointPreview(
    example.settings,{},context,forged),/do not replay/);
  const altered=structuredClone(trial);
  altered.paidFinale.lineOrder[0].position=2;
  assert.throws(()=>projectV91ProvisionalPointPreview(altered,context),
    /unambiguous replayed line order/);
  const tied=structuredClone(trial);
  tied.paidFinale.finishers[1].elapsedSecondsFromLastKmStart=
    tied.paidFinale.finishers[0].elapsedSecondsFromLastKmStart;
  assert.throws(()=>projectV91ProvisionalPointPreview(tied,context),
    /unambiguous replayed line order/);
});

test('group roads and invalid point contexts cannot become preview awards',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:4,
    gender:'F',seed:'conditional-coverage-1',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'attack'};
  const group=runV91TestDrive({settings,pointContext:context});
  assert.equal(group.roadStatus,'paid_group_bands');
  assert.equal(group.provisionalPointPreview.status,'unavailable');
  assert.equal(group.pointsStatus,'withheld');
  assert.throws(()=>projectV91ProvisionalPointPreview(
    createV91ConditionalRaceFinal(settings),context),
  /complete provisional bunch line/);
  assert.throws(()=>runV91TestDrive({...example,pointContext:{
    tier:7,divisionIndex:1,divisionCount:1}}),
  /valid optional preview point context/);
});
