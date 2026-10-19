import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {runV91TestDrive,runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {prepareLastKmRotationFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-catch.mjs';
import {recordFinaleDepletedIndividualLine,
  recordFinaleAuditedDroppedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';
import {validateFinaleSingletonFrontIndividualLine} from
  '../../lib/engine/v2/finale-singleton-front-individual-line.mjs';
import {validateFinaleNamedDroppedSurvivorLine} from
  '../../lib/engine/v2/finale-named-dropped-survivor-line.mjs';
import {validateFinaleNamedDroppedLateCatchLine} from
  '../../lib/engine/v2/finale-named-dropped-late-catch-line.mjs';
import {projectV91ProvisionalNamedDroppedLateCatchPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';
import {createV91ConditionalRaceFinalFromLockedRace} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleConditionalCrossingBounds,
  validateFinaleConditionalCrossingBounds} from
  '../../lib/engine/v2/finale-conditional-crossing-bounds.mjs';
import {assertConcurrentDoubleCatchLeadOutWheels} from
  '../../lib/engine/v2/finale-concurrent-double-catch-line.mjs';

const example=JSON.parse(readFileSync(new URL(
  '../../docs/design/engine-v2-test-drive-example.json',import.meta.url),
'utf8'));

test('integrated drive keeps two manager attacks on the locked road when the finish is open',()=>{
  const ids=['you',...Array.from({length:14},(_,index)=>
    `rival-${index+1}`)];
  const managerFinaleOrders=ids.map(teamId=>({teamId,attack:'none',
    chase:'ignore',frontWork:'sit_in'}));
  for(const teamId of ['you','rival-2']){
    const row=managerFinaleOrders.find(order=>order.teamId===teamId);
    row.attack='selective';
    row.attackRiderId=`${teamId}-5`;
  }
  for(const teamId of ['rival-1','rival-3'])
    managerFinaleOrders.find(row=>row.teamId===teamId).chase='selective';
  managerFinaleOrders.find(row=>row.teamId==='rival-4').frontWork='rotate';
  const scenario={settings:{distanceKm:40,teamCount:15,
    seed:'paired-final-orders',attack:'none',chase:'ignore',
    defaultRivalPlan:'neutral',
    teamOverrides:ids.map(teamId=>({teamId,level:80})),
    managerFinaleOrders}};
  const output=runV91IntegratedTestDrive(scenario,{full:true});
  assert.equal(output.summary.status,'unsupported');
  assert.equal(output.summary.roadStatus,'concurrent_road_unresolved');
  assert.match(output.summary.reason,/distinct paid attacker arrivals/);
  assert.deepEqual(new Set(output.summary.request.namedAttacks.map(row=>
    row.riderId)),new Set(['you-5','rival-2-5']));
  assert.equal(output.summary.lastKmSource.roadGroups.length,0);
  assert.equal(output.summary.lastKmSource.riderEnergy.length,120);
  assert.equal(output.summary.firstPaidEvent.event,
    'first_attacker_at_slice_boundary');
  assert.equal(output.summary.firstPaidEvent.riders.length,120);
  assert.equal(output.summary.firstPaidEvent.roadRelationshipStatus,
    'unresolved');
  assert.equal(output.summary.firstPaidEvent.attackerPositions[0].positionM,
    output.summary.firstPaidEvent.attackerPositions[1].positionM);
  assert.ok(output.summary.firstPaidEvent.riders.filter(row=>
    row.role==='attack').every(row=>row.energySpentToEvent>0&&
      row.energyAtEvent<row.energyAtDecision));
  assert.equal(output.summary.pointsStatus,'withheld');
  assert.equal(output.summary.canCommitAwards,false);
  assert.equal(output.recording.recording.frames.length,40);
  assert.deepEqual(runV91IntegratedTestDrive(scenario),output.summary);
  assert.deepEqual(runV91TestDrive(scenario),output.summary);
  assert.throws(()=>runV91IntegratedTestDrive({...scenario,
    pointContext:{tier:1}}),/valid optional preview point context/);
});

test('a double-catch lead-out cannot jump across an inferred source lane',()=>{
  const source={wheelSpacingM:2.5,slots:[
    {riderId:'helper',lane:0,positionM:39500},
    {riderId:'finisher',lane:1,positionM:39497.58}]};
  const plan={decisions:[{teamId:'you',finisherId:'finisher',
    leadOutRiderId:'helper'}]};
  assert.doesNotThrow(()=>assertConcurrentDoubleCatchLeadOutWheels(
    source,plan));
  assert.throws(()=>assertConcurrentDoubleCatchLeadOutWheels({
    ...source,slots:[source.slots[0],
      {...source.slots[1],lane:3}]},plan),/source wheel/);
  assert.throws(()=>assertConcurrentDoubleCatchLeadOutWheels({
    ...source,slots:[{...source.slots[0],positionM:39496},
      source.slots[1]]},plan),/source wheel/);
});

test('partial solo contact exposes only replayable crossing bounds',()=>{
  const output=runV91IntegratedTestDrive({settings:{distanceKm:40,
    fatigue:0,terrain:'custom',
    profileHeightsM:[100,300,150,400,180,100],gender:'M',
    teamCount:4,seed:'test-drive-acceptance-1',attack:'none',
    chase:'all',defaultRivalPlan:'chase'},
  attack:{teamId:'you',riderId:'you-4'},
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
  {full:true});
  const {summary,recording}=output;
  const bounds=summary.finale.conditionalCrossingBounds;
  assert.equal(summary.finale.individualFinishStatus,
    'conditional_crossing_bounds_only');
  assert.equal(summary.finale.provisionalLineOrder,null);
  assert.deepEqual(bounds.bands.map(band=>[
    band.firstPossiblePlace,band.lastPossiblePlace]),
  [[1,1],[2,2],[3,3],[4,4],[5,32]]);
  assert.equal(bounds.riders.length,32);
  assert.equal(bounds.resultStatus,'conditional_bounds_only');
  assert.equal(bounds.pointsStatus,'withheld');
  assert.equal(bounds.canCommitAwards,false);
  assert.equal(summary.provisionalPointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  assert.deepEqual(recordFinaleConditionalCrossingBounds(
    recording.paidFinale),bounds);
  assert.equal(validateFinaleConditionalCrossingBounds(
    recording.paidFinale,bounds),true);
  const changed=structuredClone(bounds);
  changed.bands.at(-1).lastPossiblePlace=31;
  assert.throws(()=>validateFinaleConditionalCrossingBounds(
    recording.paidFinale,changed),/do not replay/);
  const unearned=structuredClone(recording.paidFinale);
  unearned.finishers[0].elapsedSecondsFromLastKmStart+=1;
  assert.throws(()=>recordFinaleConditionalCrossingBounds(unearned),
    /lost a paid rider/);
});

test('separated multiband line reports its recorded contact status',()=>{
  const output=runV91IntegratedTestDrive({settings:{distanceKm:260,
    terrain:'mountain',fatigue:30,gender:'M',teamCount:15,
    seed:'test-drive-acceptance-1',attack:'repeated',chase:'ignore',
    defaultRivalPlan:'attack'},
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
  {full:true});
  assert.equal(output.summary.version,'v91-offline-test-drive-13');
  assert.equal(output.summary.roadStatus,'conditional_multiband_line');
  assert.equal(output.individualLine.pre500Audit.firstPotentialOverlap,
    null);
  assert.equal(output.individualLine.overlapAudit.firstPotentialOverlap,
    null);
  assert.equal(output.summary.finale.individualFinishStatus,
    'conditional_separated_inferred_wheels');
  assert.equal(output.summary.finale.provisionalLineOrder.length,120);
  assert.equal(output.summary.provisionalPointPreview.riders.length,120);
  assert.equal(output.summary.pointsStatus,'withheld');
  assert.equal(output.summary.canCommitAwards,false);
});

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
  assert.deepEqual(base.summary.finale.pre500Audit,
    base.individualLine.pre500Audit);
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

test('integrated drive selects paid group and late-catch lines on one race',()=>{
  const groupSettings={distanceKm:120,terrain:'rolling',fatigue:15,
    teamCount:15,gender:'F',seed:'test-drive-acceptance-1',
    attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'};
  const pointContext={tier:3,divisionIndex:1,divisionCount:1};
  const groupInput={settings:groupSettings,pointContext};
  const group=runV91IntegratedTestDrive(groupInput,{full:true});
  const explicitGroup=runV91TestDrive({...groupInput,
    individualGroupLine:true},{full:true});
  assert.deepEqual(group.recording,explicitGroup.recording);
  assert.deepEqual(group.individualLine,explicitGroup.individualLine);
  assert.equal(group.summary.integrationVersion,
    'v91-integrated-test-drive-1');
  assert.equal(group.summary.roadStatus,'conditional_multiband_line');
  assert.equal(group.summary.finale.lineTimes.length,120);
  assert.equal(group.summary.canCommitAwards,false);
  const cli=spawnSync(process.execPath,
    ['scripts/engine-v2-test-drive.mjs','-','--integrated'],{
      cwd:new URL('../..',import.meta.url),
      input:JSON.stringify(groupInput),encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout),group.summary);

  for(const gender of ['M','F']){
    const settings={distanceKm:260,terrain:'mountain',fatigue:30,
      teamCount:4,gender,seed:'test-drive-acceptance-1',
      attack:'none',chase:'all',defaultRivalPlan:'chase'};
    const input={settings,attack:{teamId:'you',riderId:'you-4'},
      pointContext};
    const integrated=runV91IntegratedTestDrive(input,{full:true});
    const explicit=runV91TestDrive({...input,
      individualGroupLine:true,namedDroppedRoad:true,
      lateCatchLine:true},{full:true});
    assert.deepEqual(integrated.recording,explicit.recording);
    assert.deepEqual(integrated.paidRoad,explicit.paidRoad);
    assert.deepEqual(integrated.individualLine,explicit.individualLine);
    assert.equal(integrated.summary.status,'conditional_line');
    assert.equal(integrated.summary.roadStatus,
      'conditional_named_late_catch_lines_separated');
    assert.equal(integrated.summary.finale.lineTimes.length,32);
    assert.equal(integrated.summary.pointsStatus,'withheld');
    assert.equal(integrated.summary.canCommitAwards,false);
  }
});

test('integrated drive keeps unpayable energy and awards unavailable',()=>{
  const output=runV91IntegratedTestDrive({settings:{distanceKm:260,
    terrain:'mountain',fatigue:30,teamCount:4,gender:'M',
    seed:'test-drive-acceptance-1',attack:'selective',
    chase:'selective',defaultRivalPlan:'mixed'},
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}});
  assert.equal(output.roadStatus,'recorded_depleted_bands');
  assert.equal(output.provisionalPointPreview.status,'unavailable');
  assert.ok(output.finale.totalUnmetEnergyDemand>0);
  assert.equal(output.canCommitAwards,false);
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

test('one selected rival tactic reaches the paid finale on the same roster',()=>{
  const shared={settings:example.settings,
    finalePlans:example.finalePlans};
  const defaultRun=runV91TestDrive(shared,{full:true});
  const changed=runV91TestDrive({...shared,settings:{...shared.settings,
    managerTacticOverrides:[{teamId:'rival-3',effort:'conserve',
      attack:'none',chase:'ignore'}]}},{full:true});
  assert.equal(changed.summary.roadStatus,'paid_conditional_line');
  assert.deepEqual(defaultRun.recording.recording.committedInputs.teams.map(
    team=>team.riders),changed.recording.recording.committedInputs.teams.map(
    team=>team.riders));
  const decisions=output=>new Map(output.summary.managerDecisions.map(row=>
    [row.teamId,row]));
  for(const id of ['you','rival-1','rival-2'])
    assert.deepEqual(decisions(changed).get(id),decisions(defaultRun).get(id));
  assert.equal(decisions(changed).get('rival-3').baseline.effort,'conserve');
  const sourceEnergy=output=>output.recording.recording.frames.at(-2)
    .teamEnergy.find(row=>row.teamId==='rival-3').mean;
  assert.ok(sourceEnergy(changed)>sourceEnergy(defaultRun));
  const lineTime=output=>output.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-3-7').elapsedSecondsFromLastKmStart;
  assert.notEqual(lineTime(changed),lineTime(defaultRun));
  assert.equal(changed.summary.finale.lineTimes.length,32);
  assert.equal(changed.summary.pointsStatus,'withheld');
  assert.equal(changed.summary.canCommitAwards,false);
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
  const base=runV91TestDrive({settings,individualGroupLine:true,
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
    {full:true});
  const helped=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-0'}]},{full:true});
  assert.equal(base.summary.roadStatus,'conditional_depleted_line');
  assert.equal(base.summary.finale.lineTimes.length,32);
  assert.equal(base.summary.finale.pre500ContactStatus,
    'provisional_separated');
  assert.equal(base.summary.finale.pre500Audit.firstPotentialOverlap,null);
  assert.equal(base.summary.finale.overlapAudit.firstPotentialOverlap,null);
  assert.equal(base.summary.finale.provisionalLineOrder.length,32);
  assert.equal(base.summary.finale.provisionalLineOrder.at(-1).riderId,
    'rival-2-0');
  assert.equal(base.summary.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.deepEqual(base.summary.provisionalPointPreview.awardRows,[]);
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
  const legacy=recordFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,{plans:null});
  assert.equal(legacy.version,'v2-finale-depleted-individual-line-lab-1');
  assert.equal(legacy.provisionalLineOrder,null);
  assert.equal(validateFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,
    {plans:null},legacy),true);
  const previous=recordFinaleAuditedDroppedIndividualLine(
    base.recording.recording,base.recording.paidFinale,{plans:null});
  assert.equal(previous.version,
    'v2-finale-depleted-individual-line-lab-2');
  assert.equal(validateFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,
    {plans:null},previous),true);
  const tampered=structuredClone(base.individualLine);
  tampered.conditionalCrossings.find(row=>
    row.riderId==='rival-2-0').energyAtLine+=1;
  assert.throws(()=>validateFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,
    {plans:null},tampered),/does not replay/);
  const forgedContact=structuredClone(base.individualLine);
  forgedContact.pre500Audit.status='potential_longitudinal_overlap';
  assert.throws(()=>validateFinaleDepletedIndividualLine(
    base.recording.recording,base.recording.paidFinale,
    {plans:null},forgedContact),/does not replay/);
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

test('the women dropped-rider road has a replayed provisional line without awards',()=>{
  const settings={distanceKm:260,terrain:'mountain',fatigue:30,
    teamCount:4,gender:'F',seed:'test-drive-acceptance-1',
    attack:'none',chase:'all',defaultRivalPlan:'chase'};
  const out=runV91TestDrive({settings,individualGroupLine:true,
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
  {full:true});
  assert.equal(out.individualLine.pre500Audit.firstPotentialOverlap,null);
  assert.equal(out.individualLine.overlapAudit.firstPotentialOverlap,null);
  assert.equal(out.summary.finale.provisionalLineOrder.length,32);
  assert.equal(out.summary.finale.provisionalLineOrder.at(-1).riderId,
    'rival-2-0');
  assert.equal(out.summary.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.deepEqual(out.summary.provisionalPointPreview.awardRows,[]);
  assert.equal(out.summary.pointsStatus,'withheld');
  assert.equal(out.summary.canCommitAwards,false);
  const isolatedPlan=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'rival-2',finisherId:'rival-2-0'}],
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}});
  assert.equal(isolatedPlan.status,'unsupported');
  assert.equal(isolatedPlan.reason,
    'An isolated rider cannot be a paid finisher.');
  assert.equal(isolatedPlan.provisionalPointPreview.status,'unavailable');
  assert.equal(isolatedPlan.pointsStatus,'withheld');
  assert.equal(isolatedPlan.canCommitAwards,false);
});

test('independent dropped roads do not invent contact from rider ID order',()=>{
  const base={gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'mixed'};
  const settings=(distanceKm,terrain,fatigue,orders)=>({
    ...base,distanceKm,terrain,fatigue,...orders,
    teamOverrides:[{teamId:'you',level:74,fatigue},
      {teamId:'rival-1',level:88,fatigue:0},
      {teamId:'rival-2',level:66,fatigue:30}]});
  const pointContext={tier:3,divisionIndex:1,divisionCount:1};
  const contact=runV91TestDrive({settings:settings(40,'flat',0,{
    attack:'none',chase:'all',managerTactics:[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'conserve',attack:'none',chase:'ignore'},
      {effort:'hard',attack:'none',chase:'all'}]}),
  individualGroupLine:true,pointContext},{full:true});
  assert.equal(contact.individualLine.version,
    'v2-finale-depleted-individual-line-lab-3');
  assert.equal(contact.individualLine.pre500Audit.firstPotentialOverlap,null);
  assert.equal(contact.individualLine.overlapAudit.firstPotentialOverlap,null);
  assert.equal(contact.summary.finale.provisionalLineOrder.length,32);
  assert.equal(contact.summary.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.equal(contact.summary.pointsStatus,'withheld');
  const previousContact=recordFinaleAuditedDroppedIndividualLine(
    contact.recording.recording,contact.recording.paidFinale,{plans:null});
  assert.equal(previousContact.pre500Audit.status,
    'potential_longitudinal_overlap');
  assert.equal(validateFinaleDepletedIndividualLine(
    contact.recording.recording,contact.recording.paidFinale,
    {plans:null},previousContact),true);
  const separated=runV91TestDrive({settings:settings(260,'mountain',30,{
    attack:'repeated',chase:'ignore',managerTactics:[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'repeated',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'}]}),
  individualGroupLine:true,pointContext});
  assert.equal(separated.lastKmSource.roadGroups.length,1);
  assert.equal(separated.lastKmSource.droppedRiderIds.length,2);
  assert.equal(separated.finale.pre500Audit.firstPotentialOverlap,null);
  assert.equal(separated.finale.overlapAudit.firstPotentialOverlap,null);
  assert.equal(separated.finale.provisionalLineOrder.length,32);
  assert.equal(separated.provisionalPointPreview.pointsStatus,
    'experimental_preview_only');
  assert.deepEqual(separated.provisionalPointPreview.awardRows,[]);
  assert.equal(separated.canCommitAwards,false);
});

test('a singleton front keeps its paid solo crossing beside a nominated bunch finale',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:0,
    gender:'M',teamCount:4,seed:'flat-length-boundary-1',
    defaultRivalPlan:'chase',attack:'repeated',chase:'all'};
  const singleton=runV91TestDrive({settings,individualGroupLine:true},
    {full:true});
  assert.equal(singleton.summary.roadStatus,'conditional_multiband_line');
  assert.equal(singleton.individualLine.version,
    'v2-finale-singleton-front-individual-line-lab-1');
  assert.equal(singleton.summary.finale.lineTimes.length,32);
  assert.equal(singleton.summary.finale.provisionalLineOrder[0].riderId,
    'you-4');
  assert.equal(singleton.individualLine.overlapAudit.firstPotentialOverlap,
    null);
  assert.equal(singleton.individualLine.pre500Audit.firstPotentialOverlap,
    null);
  assert.equal(singleton.recording.chaseAvailability.unavailableTeamIds
    .length,3);
  assert.equal(singleton.summary.pointsStatus,'withheld');
  assert.equal(singleton.summary.canCommitAwards,false);
  assert.ok(Math.abs(singleton.summary.finale.lineTimes.find(row=>
    row.riderId==='you-4').elapsedSecondsFromLastKmStart-
    singleton.recording.paidFinale.frontLineTime)<1e-8);
  const altered=structuredClone(singleton.individualLine);
  altered.bandRunners[0].runner.frames[0].riders[0].energySpent+=1;
  assert.throws(()=>validateFinaleSingletonFrontIndividualLine(
    singleton.recording.recording,singleton.recording.paidFinale,
    {plans:null},altered),/does not replay/);
  const ordered=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:null}]});
  assert.equal(ordered.roadStatus,'conditional_multiband_line');
  const frontPlan=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-4',
      leadOutRiderId:null}],pointContext:{tier:4,divisionCount:1,
      divisionIndex:1}},{full:true});
  assert.equal(frontPlan.summary.roadStatus,'conditional_multiband_line');
  assert.equal(frontPlan.individualLine.version,
    'v2-finale-singleton-front-individual-line-lab-2');
  assert.deepEqual(frontPlan.recording.recording,
    singleton.recording.recording);
  const solo=frontPlan.individualLine.bandRunners[0].runner;
  assert.equal(solo.frames.filter(frame=>
    frame.riders[0].role==='solo_sprint').length,3);
  assert.ok(solo.frames.filter(frame=>
    frame.riders[0].role==='solo_sprint').every(frame=>
    frame.riders[0].energySpent>0&&
    frame.riders[0].shelteredDistanceM===0));
  assert.ok(solo.finishers[0].elapsedSecondsFromLastKmStart<
    singleton.individualLine.bandRunners[0].runner.finishers[0]
      .elapsedSecondsFromLastKmStart);
  assert.ok(solo.finishers[0].energyAtLine<
    singleton.individualLine.bandRunners[0].runner.finishers[0]
      .energyAtLine);
  assert.equal(frontPlan.summary.finale.lineTimes.length,32);
  assert.equal(frontPlan.summary.provisionalPointPreview
    .riders[0].riderId,'you-4');
  assert.equal(frontPlan.summary.provisionalPointPreview
    .riders[0].previewPoints,400);
  assert.deepEqual(frontPlan.summary.provisionalPointPreview.awardRows,[]);
  const alteredSprint=structuredClone(frontPlan.individualLine);
  alteredSprint.bandRunners[0].runner.frames[2].riders[0]
    .energySpent+=1;
  assert.throws(()=>validateFinaleSingletonFrontIndividualLine(
    frontPlan.recording.recording,frontPlan.recording.paidFinale,
    {plans:frontPlan.summary.request.plans},alteredSprint),
  /does not replay/);
  assert.equal(frontPlan.summary.pointsStatus,'withheld');
  assert.equal(frontPlan.summary.canCommitAwards,false);
  const unpaid=runV91TestDrive({settings:{...settings,fatigue:30},
    individualGroupLine:true});
  assert.equal(unpaid.status,'unsupported');
  assert.match(unpaid.reason,/unpaid last-kilometre rider travel/);
  assert.equal(unpaid.lastKmSource.roadGroups.length,1);
  assert.equal(unpaid.pointsStatus,'withheld');
});

test('an unpaid group remains an explicit refusal with a valid nominated finale',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'flat-length-boundary-1',
    defaultRivalPlan:'chase',attack:'repeated',chase:'all'};
  const base=runV91TestDrive({settings,individualGroupLine:true});
  const planned=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-5'}],pointContext:{tier:4,
      divisionCount:1,divisionIndex:1}});
  assert.equal(base.status,'unsupported');
  assert.equal(planned.status,'unsupported');
  assert.equal(planned.reason,
    'The cooperative group has unpaid last-kilometre rider travel.');
  assert.deepEqual(planned.lastKmSource,base.lastKmSource);
  assert.equal(planned.request.plans.find(row=>row.teamId==='you')
    .leadOutRiderId,'you-5');
  assert.equal(planned.provisionalPointPreview.status,'unavailable');
  assert.equal(planned.pointsStatus,'withheld');
  assert.equal(planned.canCommitAwards,false);
});

test('a nonadjacent helper is visible while other paid orders continue',()=>{
  const settings={distanceKm:40,terrain:'flat',fatigue:0,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'chase',attack:'none',chase:'all'};
  const plans=[{teamId:'you',finisherId:'you-7',
    leadOutRiderId:'you-5'},
  {teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-5'}];
  const base=runV91TestDrive({settings,individualGroupLine:true});
  const continued=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:plans},{full:true});
  const applied=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[plans[0],{...plans[1],leadOutRiderId:null}]},
  {full:true});
  assert.equal(continued.summary.roadStatus,'paid_conditional_line');
  assert.equal(continued.summary.version,'v91-offline-test-drive-12');
  assert.deepEqual(continued.recording,applied.recording);
  assert.deepEqual(continued.summary.lastKmSource,base.lastKmSource);
  assert.deepEqual(continued.summary.unavailableLeadOuts,[{
    teamId:'rival-1',helperId:'rival-1-5',
    finisherId:'rival-1-7',status:'unavailable_source_lane',
    helperEnergySpent:0}]);
  assert.equal(continued.summary.request.plans.find(row=>
    row.teamId==='rival-1').leadOutRiderId,'rival-1-5');
  assert.equal(continued.summary.appliedRequest.plans.find(row=>
    row.teamId==='rival-1').leadOutRiderId,null);
  assert.equal(continued.summary.finale.leadOutWork.some(row=>
    row.riderId==='rival-1-5'),false);
  assert.ok(continued.summary.finale.leadOutWork.some(row=>
    row.riderId==='you-5'&&row.energySpent>0));
  assert.equal(continued.summary.pointsStatus,'withheld');
  assert.equal(continued.summary.canCommitAwards,false);

  const mountain=runV91TestDrive({settings:{...settings,distanceKm:260,
    terrain:'mountain',fatigue:30,teamCount:15},
  individualGroupLine:true,finalePlans:plans});
  assert.equal(mountain.status,'unsupported');
  assert.equal(mountain.reason,
    'The nominated lead-out cannot work beside the finisher.');
  assert.equal(mountain.lastKmSource.roadGroups.length,0);
  assert.equal(mountain.pointsStatus,'withheld');
  assert.equal(mountain.canCommitAwards,false);
});

test('wide bunches replay every unavailable source helper without a free pull',()=>{
  for(const teamCount of [15,20]){
    const settings={distanceKm:40,terrain:'flat',fatigue:0,
      gender:'M',teamCount,seed:'test-drive-acceptance-1',
      defaultRivalPlan:'chase',attack:'none',chase:'all'};
    const plans=[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-5'},
    {teamId:'rival-1',finisherId:'rival-1-7',
      leadOutRiderId:'rival-1-4'}];
    const input={settings,finalePlans:plans,
      pointContext:{tier:3,divisionCount:1,divisionIndex:1}};
    const continued=runV91TestDrive(input,{full:true});
    const lockedRace={settings:continued.recording.settings,
      recording:continued.recording.recording};
    const fromLocked=createV91ConditionalRaceFinalFromLockedRace(
      settings,continued.summary.appliedRequest,lockedRace);
    assert.strictEqual(fromLocked.recording,lockedRace.recording);
    assert.deepEqual(fromLocked,continued.recording);
    const applied=runV91TestDrive({...input,finalePlans:
      continued.summary.appliedRequest.plans},{full:true});
    assert.equal(continued.summary.roadStatus,'paid_conditional_line');
    assert.deepEqual(continued.recording,applied.recording);
    assert.equal(continued.summary.unavailableLeadOuts.length,
      teamCount===15?1:2);
    for(const row of continued.summary.unavailableLeadOuts){
      assert.equal(row.helperEnergySpent,0);
      assert.equal(continued.summary.finale.leadOutWork.some(work=>
        work.riderId===row.helperId),false);
    }
    assert.equal(continued.summary.finale.lineTimes.length,teamCount*8);
    assert.deepEqual(continued.summary.provisionalPointPreview,
      applied.summary.provisionalPointPreview);
    assert.equal(continued.summary.canCommitAwards,false);
    assert.throws(()=>createV91ConditionalRaceFinalFromLockedRace(
      {...settings,distanceKm:120},continued.summary.appliedRequest,
      lockedRace),/differs from its request/);
  }
});

test('two payable manager lead-outs change one recorded finale',()=>{
  const settings={distanceKm:40,terrain:'flat',fatigue:0,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'chase',attack:'none',chase:'all'};
  const player={teamId:'you',finisherId:'you-7',
    leadOutRiderId:'you-5'};
  const rival={teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-4'};
  const one=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[player]},{full:true});
  const two=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[player,rival]},{full:true});
  assert.equal(two.summary.roadStatus,'paid_conditional_line');
  assert.equal(two.summary.version,'v91-offline-test-drive-5');
  assert.deepEqual(two.recording.recording,one.recording.recording);
  const frames=two.recording.paidFinale.frames;
  for(const helper of ['you-5','rival-1-4']){
    assert.ok(frames.some(frame=>frame.riders.some(row=>
      row.riderId===helper&&row.role==='lead_out'&&
      row.energySpent>0&&row.distanceTravelledM>0)));
    assert.ok(frames.flatMap(frame=>frame.assemblyAttempts??[])
      .some(row=>row.helperId===helper&&
        row.status==='paid_pull_next_boundary'));
    assert.ok(two.summary.finale.leadOutAttempts.some(row=>
      row.helperId===helper&&row.status==='paid_pull_next_boundary'&&
      row.helperEnergySpent>0));
  }
  const time=(trial,id)=>trial.summary.finale.lineTimes.find(row=>
    row.riderId===id).elapsedSecondsFromLastKmStart;
  assert.ok(time(two,'rival-1-7')<time(one,'rival-1-7'));
  const unreached=runV91TestDrive({settings,individualGroupLine:true,
    finalePlans:[player,{...rival,leadOutRiderId:'rival-1-0'}]});
  assert.equal(unreached.roadStatus,'paid_conditional_line');
  assert.ok(unreached.finale.leadOutAttempts.some(row=>
    row.helperId==='rival-1-0'&&row.status==='still_separated'&&
    row.helperEnergySpent>0));
  assert.equal(unreached.finale.leadOutAttempts.some(row=>
    row.helperId==='rival-1-0'&&
    row.status==='paid_pull_next_boundary'),false);
  assert.equal(unreached.finale.lineTimes.find(row=>
    row.riderId==='rival-1-7').elapsedSecondsFromLastKmStart,
  time(one,'rival-1-7'));
  assert.equal(two.summary.pointsStatus,'withheld');
  assert.equal(two.summary.canCommitAwards,false);
});

test('two manager lead-outs pay across short and medium route profiles',()=>{
  const plans=[
    {teamId:'you',finisherId:'you-7',leadOutRiderId:'you-5'},
    {teamId:'rival-1',finisherId:'rival-1-7',
      leadOutRiderId:'rival-1-4'}];
  for(const distanceKm of [40,120])for(const terrain of [
    'flat','rolling','mountain'])for(const gender of ['M','F']){
    const settings={distanceKm,terrain,gender,teamCount:4,
      fatigue:distanceKm===40?0:15,
      seed:'test-drive-acceptance-1',defaultRivalPlan:'chase',
      attack:'none',chase:'all'};
    const input={settings,individualGroupLine:true,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
    const ordinary=runV91TestDrive(input,{full:true});
    const planned=runV91TestDrive({...input,finalePlans:plans},
      {full:true});
    assert.equal(planned.summary.roadStatus,'paid_conditional_line');
    assert.deepEqual(planned.recording.recording,
      ordinary.recording.recording);
    assert.equal(planned.summary.finale.lineTimes.length,32);
    for(const [helperId,finisherId] of [
      ['you-5','you-7'],['rival-1-4','rival-1-7']]){
      assert.ok(planned.recording.paidFinale.frames.some(frame=>
        frame.riders.some(row=>row.riderId===helperId&&
          row.role==='lead_out'&&row.energySpent>0)));
      assert.ok(planned.summary.finale.leadOutAttempts.some(row=>
        row.helperId===helperId&&
          row.status==='paid_pull_next_boundary'));
      const crossing=trial=>trial.summary.finale.lineTimes.find(row=>
        row.riderId===finisherId);
      assert.ok(crossing(planned).elapsedSecondsFromLastKmStart<
        crossing(ordinary).elapsedSecondsFromLastKmStart);
    }
    assert.equal(planned.summary.pointsStatus,'withheld');
    assert.equal(planned.summary.canCommitAwards,false);
    assert.equal(planned.summary.provisionalPointPreview.riders.length,32);
    assert.deepEqual(planned.summary.provisionalPointPreview.awardRows,[]);
    for(const row of planned.summary.provisionalPointPreview.riders){
      const crossing=planned.summary.finale.lineTimes.find(value=>
        value.riderId===row.riderId);
      assert.equal(row.elapsedSecondsFromLastKmStart,
        crossing.elapsedSecondsFromLastKmStart);
    }
  }
});

test('a named attack on an already separated mountain road refuses visibly',()=>{
  for(const gender of ['M','F']){
    const settings={distanceKm:260,terrain:'mountain',fatigue:30,
      gender,teamCount:4,seed:'test-drive-acceptance-1',
      defaultRivalPlan:'chase',attack:'none',chase:'all'};
    const output=runV91TestDrive({settings,individualGroupLine:true,
      attack:{teamId:'you',riderId:'you-4'}});
    assert.equal(output.version,'v91-offline-test-drive-6');
    assert.equal(output.status,'unsupported');
    assert.equal(output.reason,
      'The controlled finale trial needs one complete source bunch.');
    assert.ok(output.lastKmSource.roadGroups.length+
      output.lastKmSource.droppedRiderIds.length>0);
    assert.equal(output.request.attackRiderId,'you-4');
    assert.equal(output.pointsStatus,'withheld');
    assert.equal(output.canCommitAwards,false);
  }
});

test('a named attack and existing dropped rider retain one paid road',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  const request={settings,attack:{teamId:'you',riderId:'you-4'},
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
  const old=runV91TestDrive(request);
  assert.equal(old.status,'unsupported');
  assert.equal(old.version,'v91-offline-test-drive-6');
  assert.throws(()=>runV91TestDrive({settings,
    namedDroppedRoad:true}),/named attack for the dropped-road trial/);
  const paid=runV91TestDrive({...request,namedDroppedRoad:true},
    {full:true});
  assert.equal(paid.summary.version,'v91-offline-test-drive-7');
  assert.equal(paid.summary.status,'road_only');
  assert.equal(paid.summary.roadStatus,
    'paid_named_attack_dropped_bands');
  assert.equal(paid.summary.finale.roadFrames.length,7);
  assert.ok(paid.summary.finale.roadFrames.some(frame=>
    frame.catchDistanceM>259700&&frame.catchDistanceM<259800));
  assert.deepEqual(paid.summary.finale.bands.map(row=>[
    row.id,row.firstPossiblePlace,row.lastPossiblePlace]),
  [['peloton',1,31],['dropped',32,32]]);
  assert.equal(paid.summary.finale.finalePlanStatus,'unapplied');
  assert.equal(paid.summary.provisionalPointPreview.status,'unavailable');
  assert.equal(paid.summary.pointsStatus,'withheld');
  assert.equal(paid.summary.canCommitAwards,false);
  const planned=runV91TestDrive({...request,namedDroppedRoad:true,
    finalePlans:[{teamId:'you',finisherId:'you-7',
      leadOutRiderId:'you-6'}]},{full:true});
  assert.deepEqual(planned.paidRoad,paid.paidRoad);
  assert.equal(planned.summary.managerDecisions.find(row=>
    row.teamId==='you').leadOutRiderId,'you-6');
  assert.equal(planned.summary.finale.finalePlanStatus,'unapplied');
  const withoutNamed=runV91TestDrive({settings,individualGroupLine:true},
    {full:true});
  assert.deepEqual(paid.recording.recording.frames.slice(0,-1),
    withoutNamed.recording.recording.frames.slice(0,-1));
});

test('an early caught named attack feeds paid nominated and isolated lines',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  const base={settings,namedDroppedRoad:true,
    attack:{teamId:'you',riderId:'you-0'}};
  const without=runV91TestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:null}]},{
    full:true});
  const withLead=runV91TestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'}]},
  {full:true});
  for(const trial of [without,withLead]){
    assert.equal(trial.summary.version,'v91-offline-test-drive-8');
    assert.equal(trial.summary.status,'conditional_line');
    assert.equal(trial.summary.finale.roadFrames.length,2);
    assert.equal(trial.summary.finale.lineTimes.length,32);
    assert.equal(new Set(trial.summary.finale.lineTimes.map(row=>
      row.riderId)).size,32);
    assert.equal(trial.summary.finale.finalePlanStatus,'paid_at_500m');
    assert.equal(trial.summary.finale.overlapAudit.firstPotentialOverlap,
      null);
    assert.equal(trial.summary.finale.provisionalLineOrder.length,32);
    assert.equal(trial.summary.pointsStatus,'withheld');
    assert.equal(trial.summary.canCommitAwards,false);
    assert.deepEqual(trial.individualLine.bandRunners[1].runner.frames
      .map(frame=>frame.riders[0].energySpent>0),
    [true,true,true,true,true]);
  }
  assert.deepEqual(without.summary.finale.roadFrames,
    withLead.summary.finale.roadFrames);
  assert.deepEqual(without.individualLine.positionedSource,
    withLead.individualLine.positionedSource);
  assert.equal(without.summary.finale.leadOutWork.length,0);
  assert.ok(withLead.summary.finale.leadOutWork.length>0);
  const crossing=trial=>trial.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7').elapsedSecondsFromLastKmStart;
  assert.ok(crossing(withLead)<crossing(without));
  assert.equal(withLead.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-2-0').elapsedSecondsFromLastKmStart,
  without.summary.finale.lineTimes.find(row=>
    row.riderId==='rival-2-0').elapsedSecondsFromLastKmStart);
});

test('a late named catch starts individual sprint work after paid contact',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  const base={settings,namedDroppedRoad:true,lateCatchLine:true,
    attack:{teamId:'you',riderId:'you-2'},
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
  const ordinary=runV91TestDrive({...base,lateCatchLine:false},
    {full:true});
  assert.equal(ordinary.summary.version,'v91-offline-test-drive-7');
  assert.equal(ordinary.summary.status,'road_only');
  const nominated=runV91TestDrive(base,{full:true});
  const other=runV91TestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-4',leadOutRiderId:null}]},{full:true});
  assert.equal(nominated.summary.version,'v91-offline-test-drive-9');
  assert.equal(nominated.summary.status,'conditional_line');
  assert.deepEqual(nominated.paidRoad,ordinary.paidRoad);
  assert.deepEqual(nominated.paidRoad,other.paidRoad);
  assert.equal(nominated.individualLine.catchDistanceM,
    nominated.paidRoad.frames.find(frame=>
      frame.active.catchDistanceM).active.catchDistanceM);
  assert.equal(nominated.individualLine.startDistanceM,259600);
  assert.equal(nominated.summary.finale.roadFrames.at(-1).distanceM,
    nominated.individualLine.startDistanceM);
  assert.equal(nominated.summary.finale.bandsAtContactBoundary[0].id,
    'peloton');
  assert.equal(nominated.summary.finale.lineTimes.length,32);
  assert.equal(nominated.summary.finale.provisionalLineOrder.length,32);
  assert.equal(nominated.summary.provisionalPointPreview.version,
    'v91-provisional-named-dropped-point-preview-3');
  assert.equal(nominated.summary.provisionalPointPreview.riders.length,32);
  assert.deepEqual(nominated.summary.provisionalPointPreview.awardRows,[]);
  assert.equal(nominated.summary.pointsStatus,'withheld');
  assert.equal(nominated.summary.canCommitAwards,false);
  const crossing=trial=>trial.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7');
  assert.ok(crossing(nominated).elapsedSecondsFromLastKmStart<
    crossing(other).elapsedSecondsFromLastKmStart);
  assert.ok(crossing(nominated).energyAtLine<
    crossing(other).energyAtLine);
  assert.ok(nominated.summary.finale.sprintWork.some(row=>
    row.riderId==='you-7'&&row.energySpent>0));
  assert.equal(validateFinaleNamedDroppedLateCatchLine(
    nominated.recording.recording,nominated.paidRoad,
    {plans:nominated.summary.request.plans},nominated.individualLine),
  true);
  const altered=structuredClone(nominated.individualLine);
  altered.bandRunners[0].runner.frames[1].riders[0].energySpent+=1;
  assert.throws(()=>validateFinaleNamedDroppedLateCatchLine(
    nominated.recording.recording,nominated.paidRoad,
    {plans:nominated.summary.request.plans},altered),/does not replay/);
  assert.throws(()=>projectV91ProvisionalNamedDroppedLateCatchPointPreview(
    nominated.recording.recording,nominated.paidRoad,altered,
    base.pointContext),/does not replay/);
  const unearnedLead=runV91TestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'}]});
  assert.equal(unearnedLead.status,'unsupported');
  assert.match(unearnedLead.reason,/pre-contact lead-out/);
  assert.throws(()=>runV91TestDrive({...base,
    namedDroppedRoad:false}),/Choose settings/);
  for(const [riderId,boundary] of [['you-3',259700],
    ['you-4',259800]]){
    const later=runV91TestDrive({...base,
      attack:{teamId:'you',riderId}},{full:true});
    assert.equal(later.summary.status,'conditional_line');
    assert.equal(later.individualLine.startDistanceM,boundary);
    assert.equal(later.summary.finale.lineTimes.length,32);
    assert.equal(later.summary.provisionalPointPreview.riders.length,32);
    assert.equal(later.summary.canCommitAwards,false);
  }
  const caughtBeforeSoloSprint=runV91TestDrive({...base,
    attack:{teamId:'you',riderId:'you-3'},
    finalePlans:[{teamId:'you',finisherId:'you-3'}]});
  assert.equal(caughtBeforeSoloSprint.status,'conditional_line');
  const unpaidSoloSprint=runV91TestDrive({...base,
    attack:{teamId:'you',riderId:'you-4'},
    finalePlans:[{teamId:'you',finisherId:'you-4'}]});
  assert.equal(unpaidSoloSprint.status,'unsupported');
  assert.equal(unpaidSoloSprint.reason,
    'A nominated solo sprint before contact needs paid road work.');
  assert.equal(unpaidSoloSprint.provisionalPointPreview.status,'unavailable');
  assert.equal(unpaidSoloSprint.pointsStatus,'withheld');
  assert.equal(unpaidSoloSprint.canCommitAwards,false);
});

test('an isolated finisher order never disappears inside a paid named finale',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  for(const attacker of ['you-0','you-2','you-5']){
    const scenario={settings,namedDroppedRoad:true,lateCatchLine:true,
      attack:{teamId:'you',riderId:attacker},
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
    const valid=runV91TestDrive(scenario);
    assert.equal(valid.status,'conditional_line');
    assert.ok(valid.finale.lineTimes.some(row=>
      row.riderId==='rival-2-0'));
    const invalid=runV91TestDrive({...scenario,finalePlans:[{
      teamId:'rival-2',finisherId:'rival-2-0'}]});
    assert.equal(invalid.status,'unsupported');
    assert.equal(invalid.reason,
      'An isolated rider cannot be a paid finisher.');
    assert.equal(invalid.provisionalPointPreview.status,'unavailable');
    assert.equal(invalid.pointsStatus,'withheld');
    assert.equal(invalid.canCommitAwards,false);
  }
});

test('a collapsed larger field withholds point preview without throwing',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:15,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  const summary=runV91TestDrive({settings,namedDroppedRoad:true,
    lateCatchLine:true,attack:{teamId:'you',riderId:'you-2'},
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}});
  assert.equal(summary.roadStatus,'paid_conditional_line');
  assert.equal(summary.provisionalPointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
});

test('a surviving named solo keeps three paid bands and audits rival lead-out contact',()=>{
  const settings={distanceKm:260,terrain:'flat',fatigue:30,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase'};
  const base={settings,namedDroppedRoad:true,
    attack:{teamId:'you',riderId:'you-5'},
    pointContext:{tier:3,divisionIndex:1,divisionCount:1}};
  const solo=runV91TestDrive(base,{full:true});
  assert.equal(solo.summary.version,'v91-offline-test-drive-8');
  assert.equal(solo.summary.status,'conditional_line');
  assert.equal(solo.summary.finale.roadFrames.length,2);
  assert.equal(solo.summary.finale.bandsAt500M.length,3);
  assert.equal(solo.summary.finale.lineTimes.length,32);
  assert.equal(solo.summary.finale.separateBandTravel.length,10);
  assert.equal(solo.summary.finale.provisionalLineOrder.length,32);
  assert.equal(solo.summary.provisionalPointPreview.riders.length,32);
  assert.equal(solo.summary.provisionalPointPreview.version,
    'v91-provisional-named-dropped-point-preview-2');
  assert.equal(solo.summary.pointsStatus,'withheld');
  const lead=runV91TestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-4'}]},
  {full:true});
  assert.deepEqual(lead.summary.finale.roadFrames,
    solo.summary.finale.roadFrames);
  assert.deepEqual(lead.individualLine.positionedSource,
    solo.individualLine.positionedSource);
  assert.ok(lead.summary.finale.leadOutWork.length>0);
  assert.equal(lead.summary.finale.lineTimes.length,32);
  assert.equal(lead.summary.finale.overlapAudit.status,
    'potential_longitudinal_overlap');
  assert.equal(lead.summary.finale.individualFinishStatus,
    'conditional_crossings_contact_unresolved');
  assert.equal(lead.summary.finale.provisionalLineOrder,null);
  assert.equal(lead.summary.provisionalPointPreview.status,'unavailable');
  assert.equal(lead.summary.canCommitAwards,false);
  const soloAttack={...base,attack:{teamId:'you',riderId:'you-7'}};
  const unhurried=runV91TestDrive({...soloAttack,finalePlans:[{
    teamId:'you',finisherId:'you-4',leadOutRiderId:null}]},
  {full:true});
  const soloFinisher=runV91TestDrive(soloAttack,{full:true});
  assert.equal(soloFinisher.summary.status,'conditional_line');
  assert.deepEqual(soloFinisher.summary.finale.roadFrames,
    unhurried.summary.finale.roadFrames);
  const sprintRunner=soloFinisher.individualLine.bandRunners[0].runner;
  const plainRunner=unhurried.individualLine.bandRunners[0].runner;
  assert.deepEqual(sprintRunner.frames.slice(0,2),
    plainRunner.frames.slice(0,2));
  assert.deepEqual(sprintRunner.frames.map(frame=>
    frame.riders[0].role),['solo_front','solo_front',
    'solo_sprint','solo_sprint','solo_sprint']);
  assert.ok(sprintRunner.frames.slice(2).every(frame=>
    frame.riders[0].energySpent>0&&
    frame.riders[0].shelteredDistanceM===0));
  assert.ok(sprintRunner.finishers[0].elapsedSecondsFromLastKmStart<
    plainRunner.finishers[0].elapsedSecondsFromLastKmStart);
  assert.ok(sprintRunner.finishers[0].energyAtLine<
    plainRunner.finishers[0].energyAtLine);
  assert.equal(soloFinisher.summary.finale.sprintWork.filter(row=>
    row.riderId==='you-7').length,3);
  assert.equal(soloFinisher.summary.finale.lineTimes.length,32);
  assert.equal(soloFinisher.summary.finale.provisionalLineOrder.length,32);
  assert.equal(soloFinisher.summary.provisionalPointPreview.riders.length,32);
  assert.deepEqual(soloFinisher.summary.provisionalPointPreview.awardRows,[]);
  assert.equal(soloFinisher.summary.canCommitAwards,false);
  const alteredSprint=structuredClone(soloFinisher.individualLine);
  alteredSprint.bandRunners[0].runner.frames[2].riders[0]
    .energySpent+=1;
  assert.throws(()=>validateFinaleNamedDroppedSurvivorLine(
    soloFinisher.recording.recording,soloFinisher.paidRoad,
    {plans:soloFinisher.summary.request.plans},alteredSprint),
  /does not replay/);
});

test('an earlier player attack carries earned load into a paid named finale',()=>{
  const settings={distanceKm:40,terrain:'flat',fatigue:0,
    gender:'M',teamCount:4,seed:'test-drive-acceptance-1',
    chase:'ignore',defaultRivalPlan:'chase'};
  const request={individualGroupLine:true,
    attack:{teamId:'you',riderId:'you-4'}};
  const fresh=runV91TestDrive({settings:{...settings,attack:'none'},
    ...request},{full:true});
  const repeated=runV91TestDrive({settings:{...settings,
    attack:'repeated'},...request},{full:true});
  const handoff=prepareLastKmRotationFromTour(
    repeated.recording.recording,{teamId:'you'});
  assert.equal(fresh.summary.roadStatus,'paid_conditional_line');
  assert.equal(repeated.summary.roadStatus,'paid_conditional_line');
  assert.deepEqual(fresh.recording.recording.committedInputs.teams.map(
    team=>team.riders),repeated.recording.recording.committedInputs.teams.map(
    team=>team.riders));
  assert.equal(handoff.sourceRepeatLoad,0.82);
  assert.equal(handoff.repeatLoad,0.8);
  assert.equal(repeated.summary.finale.lineTimes.length,32);
  assert.notEqual(repeated.summary.finale.lineTimes.find(row=>
    row.riderId==='you-4').elapsedSecondsFromLastKmStart,
  fresh.summary.finale.lineTimes.find(row=>
    row.riderId==='you-4').elapsedSecondsFromLastKmStart);
  assert.equal(repeated.summary.pointsStatus,'withheld');
  assert.equal(repeated.summary.canCommitAwards,false);
  const separated=runV91TestDrive({settings:{...settings,
    distanceKm:260,terrain:'mountain',fatigue:30,
    attack:'repeated'},...request});
  assert.equal(separated.status,'unsupported');
  assert.equal(separated.reason,
    'The controlled finale trial needs one complete source bunch.');
  assert.ok(separated.lastKmSource.roadGroups.length>0);
  assert.equal(separated.canCommitAwards,false);
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
