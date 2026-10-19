import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runV91TestDrive} from '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleDepletedIndividualLine} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';

const example=JSON.parse(readFileSync(new URL(
  '../../docs/design/engine-v2-test-drive-example.json',import.meta.url),
'utf8'));

test('offline test drive pays a manager lead-out on one replayed race',()=>{
  const assisted=runV91TestDrive(example,{full:true});
  const neutral=runV91TestDrive({...example,finalePlans:[]},{full:true});
  assert.equal(assisted.summary.roadStatus,'paid_conditional_line');
  assert.equal(assisted.summary.finale.lineTimes.length,32);
  assert.deepEqual(assisted.summary.finale.provisionalLineOrder,
    assisted.recording.paidFinale.lineOrder);
  assert.deepEqual(assisted.summary.finale.roadEvents,
    assisted.recording.paidFinale.frames.flatMap(frame=>
      frame.roadEvents??[]));
  assert.equal(assisted.summary.finale.positionSourceStatus,
    'provisional_inferred_independent_wheels');
  assert.equal(assisted.summary.finale.passingRule,'open-road-lab-1');
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
  assert.equal(refused.lastKmSource.roadGroups.length,1);
});

test('opt-in group line pays an individual finish and same-band lead-out',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:4,
    gender:'M',seed:'test-drive-acceptance-1',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'attack'};
  const base=runV91TestDrive({settings,individualGroupLine:true},
    {full:true});
  const helped=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-6'}],pointContext:{tier:3,
      divisionCount:1,divisionIndex:1}},{full:true});
  assert.equal(base.summary.roadStatus,'conditional_multiband_line');
  assert.deepEqual(base.summary.finale.overlapAudit,
    base.individualLine.overlapAudit);
  assert.equal(helped.summary.finale.lineTimes.length,32);
  assert.deepEqual(helped.summary.finale.paidPassagesTo500
    .map(row=>row.endDistanceM),[39250,39500]);
  assert.equal(helped.summary.finale.roadFrames,undefined);
  assert.deepEqual(base.recording.recording,
    helped.recording.recording);
  assert.deepEqual(base.individualLine.positionedSource,
    helped.individualLine.positionedSource);
  assert.ok(helped.summary.finale.leadOutWork.some(row=>
    row.riderId==='you-6'&&row.role==='lead_out'&&
    row.energySpent>0));
  const time=output=>output.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7').elapsedSecondsFromLastKmStart;
  assert.ok(time(helped)<time(base));
  assert.equal(helped.summary.finale.provisionalLineOrder.length,32);
  assert.deepEqual(helped.summary.finale.provisionalLineOrder.map(row=>
    row.position),Array.from({length:32},(_,index)=>index+1));
  assert.equal(helped.summary.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.equal(helped.summary.provisionalPointPreview.riders.length,32);
  assert.deepEqual(helped.summary.provisionalPointPreview.awardRows,[]);
  assert.equal(helped.summary.provisionalPointPreview.canCommitAwards,false);
  assert.equal(helped.summary.resultStatus,'unclassified');
  assert.equal(helped.summary.pointsStatus,'withheld');
  assert.equal(helped.summary.canCommitAwards,false);
});

test('opt-in mountain road retains several groups on one locked race',()=>{
  const settings={distanceKm:260,terrain:'mountain',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'};
  const base=runV91TestDrive({settings,individualGroupLine:true},
    {full:true});
  const helped=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-4',
      leadOutRiderId:'you-5'}],
    pointContext:{tier:3,divisionCount:1,divisionIndex:1}},
  {full:true});
  assert.equal(base.summary.roadStatus,'conditional_multiband_line');
  assert.equal(helped.individualLine.bandRunners.length,3);
  assert.equal(helped.summary.finale.lineTimes.length,32);
  assert.deepEqual(base.recording.recording,
    helped.recording.recording);
  assert.deepEqual(helped.summary.finale.paidPassagesTo500.map(row=>
    row.endDistanceM),[259250,259500]);
  assert.equal(helped.summary.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.equal(helped.summary.canCommitAwards,false);
});

test('an unavailable cross-band lead-out leaves the locked race visible',()=>{
  const settings={distanceKm:260,terrain:'mountain',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'};
  const refused=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-5'}]},{full:true});
  assert.equal(refused.summary.status,'unsupported');
  assert.equal(refused.summary.roadStatus,'paid_separated_bands');
  assert.equal(refused.summary.individualLineStatus,'unsupported_plan');
  assert.match(refused.summary.reason,/cannot work beside the finisher/);
  assert.equal(refused.summary.pointsStatus,'withheld');
  assert.equal(refused.summary.canCommitAwards,false);
  assert.equal(refused.individualLine,undefined);
  assert.ok(refused.recording.recording);
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

test('offline test drive rejects invalid finale riders before a group-road refusal',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:4,
    gender:'F',seed:'conditional-coverage-1',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'attack'};
  assert.throws(()=>runV91TestDrive({settings,finalePlans:[{
    teamId:'you',finisherId:'rival-1-7',leadOutRiderId:null}]}),
  /valid finale plan/);
  assert.throws(()=>runV91TestDrive({settings,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-7'}]}),
  /valid finale plan/);
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

test('long race records depleted reserve and separated groups without ranks',()=>{
  const base={distanceKm:260,terrain:'mountain',fatigue:30,
    teamCount:4,gender:'M',seed:'test-drive-acceptance-1'};
  const mixed=runV91TestDrive({settings:{...base,teamCount:4,
    attack:'selective',chase:'selective',defaultRivalPlan:'mixed'}});
  assert.equal(mixed.roadStatus,'recorded_depleted_bands');
  assert.equal(mixed.lastKmSource.roadGroups.length,1);
  assert.equal(mixed.lastKmSource.droppedRiderIds.length,6);
  assert.equal(mixed.finale.reserveStatus,
    'energy_demand_saturated_at_zero');
  assert.ok(mixed.finale.totalUnmetEnergyDemand>0);
  assert.equal(mixed.finale.bands.at(-1).lastPossiblePlace,32);
  assert.equal(mixed.pointsStatus,'withheld');
  const noFront=runV91TestDrive({settings:{...base,
    attack:'none',chase:'all',defaultRivalPlan:'chase'}});
  assert.equal(noFront.roadStatus,'recorded_dropped_bands');
  assert.equal(noFront.lastKmSource.roadGroups.length,0);
  assert.equal(noFront.lastKmSource.droppedRiderIds.length,1);
  assert.deepEqual(noFront.finale.bands.map(band=>[
    band.id,band.firstPossiblePlace,band.lastPossiblePlace]),
  [['peloton',1,31],['dropped',32,32]]);
  assert.equal(noFront.finale.reserveStatus,'energy_demand_paid');
  assert.equal(noFront.finale.totalUnmetEnergyDemand,0);
  assert.equal(noFront.pointsStatus,'withheld');
  const noFrontPlan=runV91TestDrive({settings:{...base,
    attack:'none',chase:'all',defaultRivalPlan:'chase'},
  finalePlans:[{teamId:'you',finisherId:'you-7',leadOutRiderId:null}]});
  assert.equal(noFrontPlan.status,'unsupported');
  assert.match(noFrontPlan.reason,/not paid for dropped road bands/);
  const split=runV91TestDrive({settings:{...base,teamCount:15,
    attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'}});
  assert.equal(split.roadStatus,'paid_separated_bands');
  assert.equal(split.lastKmSource.roadGroups.length,2);
  assert.equal(split.lastKmSource.droppedRiderIds.length,0);
  assert.equal(split.finale.bands.length,3);
  assert.equal(split.finale.finalRiderEnergy.length,120);
  assert.equal(split.finale.individualFinishStatus,
    'unresolved_within_road_bands');
  assert.equal(split.pointsStatus,'withheld');
  const unpaid=runV91TestDrive({settings:{...base,teamCount:15,
    attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'},
  finalePlans:[{teamId:'you',finisherId:'you-7',leadOutRiderId:null}]});
  assert.equal(unpaid.status,'unsupported');
  assert.match(unpaid.reason,/not paid for road groups/);
});

test('paid dropped travel joins an opt-in individual bunch line without inventing a dropped group',()=>{
  const settings={distanceKm:260,terrain:'mountain',fatigue:30,
    teamCount:4,gender:'M',seed:'test-drive-acceptance-1',
    attack:'none',chase:'all',defaultRivalPlan:'chase'};
  const base=runV91TestDrive({settings,individualGroupLine:true},
    {full:true});
  const helped=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-0'}]},{full:true});
  assert.equal(base.summary.roadStatus,'conditional_depleted_line');
  assert.equal(base.summary.finale.lineTimes.length,32);
  assert.equal(base.summary.finale.pre500ContactStatus,'unresolved');
  assert.equal(base.summary.finale.provisionalLineOrder,null);
  assert.equal(base.summary.pointsStatus,'withheld');
  assert.equal(base.summary.canCommitAwards,false);
  assert.equal(base.summary.finale.lineTimes.filter(row=>
    row.roadBandId.startsWith('isolated:')).length,1);
  assert.ok(helped.summary.finale.leadOutWork.some(row=>
    row.riderId==='you-0'&&row.energySpent>0));
  assert.notEqual(helped.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7').elapsedSecondsFromLastKmStart,
  base.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7').elapsedSecondsFromLastKmStart);
  assert.deepEqual(helped.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-2-0'),
  base.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-2-0'));
  const tampered=structuredClone(base.individualLine);
  tampered.conditionalCrossings.find(row=>
    row.riderId==='rival-2-0').energyAtLine+=1;
  assert.throws(()=>validateFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,
    {plans:null},tampered),/does not replay/);
  const refused=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'rival-2',finisherId:'rival-2-7',
      leadOutRiderId:'rival-2-0'}]});
  assert.equal(refused.status,'unsupported');
  assert.match(refused.reason,/cannot work beside/);
  const saturated=runV91TestDrive({settings:{...settings,
    attack:'selective',chase:'selective',defaultRivalPlan:'mixed'},
  individualGroupLine:true});
  assert.equal(saturated.roadStatus,'recorded_depleted_bands');
  assert.ok(saturated.finale.totalUnmetEnergyDemand>0);
  assert.equal(saturated.pointsStatus,'withheld');
  const unpaidPlan=runV91TestDrive({settings:{...settings,
    attack:'selective',chase:'selective',defaultRivalPlan:'mixed'},
  individualGroupLine:true,finalePlans:[{teamId:'you',
    finisherId:'you-7',leadOutRiderId:null}]});
  assert.equal(unpaidPlan.status,'unsupported');
  assert.equal(unpaidPlan.individualLineStatus,'unpaid_dropped_travel');
  assert.equal(unpaidPlan.finale.individualFinishStatus,
    'unresolved_within_road_bands');
  assert.equal(unpaidPlan.pointsStatus,'withheld');
});

test('paired field strength and fatigue reach the same conditional path with different paid lines',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:4,gender:'F',
    seed:'independent-field',attack:'none',chase:'ignore',
    defaultRivalPlan:'chase'};
  const baseline=runV91TestDrive({settings});
  const changed=runV91TestDrive({settings:{...settings,
    teamOverrides:[{teamId:'you',level:76,fatigue:15}]}});
  assert.equal(baseline.roadStatus,'paid_conditional_line');
  assert.equal(changed.roadStatus,'paid_conditional_line');
  assert.deepEqual(changed.managerDecisions,baseline.managerDecisions);
  assert.deepEqual(changed.input.teamOverrides,[
    {teamId:'you',level:76,fatigue:15}]);
  const finisherTime=output=>output.finale.lineTimes.find(row=>
    row.riderId==='you-7').elapsedSecondsFromLastKmStart;
  assert.ok(finisherTime(changed)>finisherTime(baseline));
  assert.equal(changed.pointsStatus,'withheld');
});
