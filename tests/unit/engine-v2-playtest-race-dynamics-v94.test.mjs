import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';

test('experimental race preview exposes committed intent and paid road only',()=>{
  const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,fatigue:30,
      attack:'none',chase:'selective',seed:'preview-recorded-road-1'}});
  assert.equal(preview.frames.length,120);
  assert.equal(preview.teamPlans.length,20);
  assert.equal(preview.resultStatus,'provisional_road_groups_only');
  assert.equal(preview.policy.rivalIntentVersion,4);
  assert.equal(preview.policy.frontRotationVersion,3);
  assert.equal(preview.policy.controlPursuitVersion,2);
  assert.equal(preview.policy.frontExhaustionVersion,4);
  assert.equal(preview.policy.controlWithdrawalVersion,undefined);
  assert.equal(preview.story.widestRecordedLead.gapSeconds,
    Math.max(...recording.frames.map(frame=>frame.gapSeconds)));
  assert.equal(preview.story.kilometresAtOrAboveOneMinute,
    recording.frames.filter(frame=>frame.gapSeconds>=60).length);
  assert.ok(preview.frames.every((frame,index)=>{
    const source=recording.frames[index];
    return frame.gapSeconds===source.gapSeconds&&
      frame.teamEnergy.length===source.teamEnergy.length&&
      frame.teamEnergy.every(row=>source.teamEnergy.some(recorded=>
        recorded.teamId===row.teamId&&recorded.mean===row.mean))&&
      frame.ownRiders.length===8&&
      frame.ownRiders.every(row=>source.riderGroups.some(rider=>
        rider.id===row.id&&rider.energy===row.energy))&&
      frame.roadGroups.every(group=>source.roadGroups.some(recorded=>
        recorded.id===group.id&&recorded.gapSeconds===group.gapSeconds));
  }));
  assert.ok(preview.teamPlans.every(row=>row.role&&row.source&&row.baseline));
  assert.equal(Object.hasOwn(preview,'provisionalResults'),false);
  assert.equal(Object.hasOwn(preview,'officialAwards'),false);
  const earlier=createV94RaceDynamicsPreview({format:'one_day',
    frontExhaustionVersion:3,settings:{distanceKm:120,terrain:'mountain',
      teamCount:20,fatigue:30,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'}}).recording;
  assert.deepEqual(recording.frames,earlier.frames);
});

test('experimental preview shows paid contact for an exhausted front sitter',()=>{
  const {recording,preview}=createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:260,terrain:'flat',teamCount:20,gender:'M',
      fatigue:30,seed:'preview-orders-stage-flat-30',effort:'hard',
      attack:'repeated',chase:'all'}});
  const coast=preview.frames[221].frontCoast[0];
  assert.equal(preview.policy.frontExhaustionVersion,4);
  assert.equal(coast.riderId,'you-7');
  assert.ok(coast.delaySeconds>0);
  assert.equal(coast.joinedGroupId,'road-2');
  assert.equal(coast.detachedGroupId,null);
  assert.deepEqual(preview.frames[221].caughtRiders,
    [...recording.frames[221].caughtBreakawayRiderIds].sort());
  assert.equal(preview.resultStatus,'provisional_road_groups_only');
  assert.equal(Object.hasOwn(preview,'officialAwards'),false);
});

test('rounded work ledger preserves an exact paid mountain coast',()=>{
  const settings={distanceKm:260,terrain:'mountain',teamCount:20,
    gender:'M',fatigue:30,seed:'preview-cross-2',effort:'hard',
    attack:'repeated',chase:'all'};
  const seeded=createV94RaceDynamicsPreview({format:'one_day',
    settings:{...settings,effort:'steady',attack:'none',
      chase:'selective'}}).preview;
  const rivalGoals=seeded.teamPlans.filter(plan=>plan.teamId!=='you')
    .map(plan=>({teamId:plan.teamId,
      role:plan.role==='control'?'protect':plan.role}));
  const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
    settings,rivalGoals});
  assert.equal(preview.frames[225].frontCoast[0].riderId,'you-7');
  assert.equal(preview.frames[225].frontCoast[0].delaySeconds,18.624);
  const forged=structuredClone(recording);
  forged.frames[225].frontCoast[0].delaySeconds+=.001;
  forged.frames[225].energyLedger.find(row=>row.riderId==='you-7')
    .coastDelaySeconds+=.001;
  assert.throws(()=>validateRecordedTour(forged),
    /Invalid recorded front coast at km 226/);
});

test('experimental preview rejects unsupported settings before simulation',()=>{
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    ownFrontWork:'free',settings:{distanceKm:40}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    controlWithdrawalVersion:3,settings:{distanceKm:40}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'classic',
    settings:{distanceKm:40}}),/valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,unknown:true}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,managerTactics:[]}}),
  /valid experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({format:'stage',
    settings:{distanceKm:40,teamCount:4},
    rivalGoals:[{teamId:'rival-20',role:'break'}]}),
  /valid rival goals/);
});

test('own paid front-work choice is committed without changing rival plans',()=>{
  const input={format:'one_day',settings:{distanceKm:120,teamCount:20,
    seed:'preview-own-front-work',attack:'none',chase:'ignore'}};
  const seated=createV94RaceDynamicsPreview(input).preview;
  const rotating=createV94RaceDynamicsPreview({...input,
    ownFrontWork:'rotate'}).preview;
  assert.equal(seated.teamPlans.find(plan=>plan.teamId==='you')
    .baseline.frontWork,null);
  assert.equal(rotating.teamPlans.find(plan=>plan.teamId==='you')
    .baseline.frontWork,'rotate');
  assert.deepEqual(rotating.teamPlans.filter(plan=>plan.teamId!=='you'),
    seated.teamPlans.filter(plan=>plan.teamId!=='you'));
  assert.ok(rotating.frames.some(frame=>frame.paidBunchPace?.teamId==='you'));
  assert.ok(rotating.frames.at(-1).teamEnergy.find(row=>row.teamId==='you')
    .mean<seated.frames.at(-1).teamEnergy.find(row=>row.teamId==='you')
    .mean);
  assert.notEqual(rotating.story.widestRecordedLead.gapSeconds,
    seated.story.widestRecordedLead.gapSeconds);
});

test('a manager-selected selective chase remains active in a stage',()=>{
  const base={format:'stage',settings:{distanceKm:260,teamCount:20,
    terrain:'flat',fatigue:0,seed:'preview-boundary-6',effort:'steady',
    attack:'none',chase:'selective'}};
  const selected=createV94RaceDynamicsPreview(base).preview;
  const ignored=createV94RaceDynamicsPreview({...base,
    settings:{...base.settings,chase:'ignore'}}).preview;
  assert.equal(selected.teamPlans.find(plan=>plan.teamId==='you').role,
    'control');
  assert.ok(selected.frames.some(frame=>frame.chasers.includes('you')));
  assert.ok(ignored.frames.every(frame=>!frame.chasers.includes('you')));
  assert.equal(selected.resultStatus,'provisional_road_groups_only');
});

test('a manager attack and chase each act only on paid eligible kilometres',()=>{
  const preview=createV94RaceDynamicsPreview({format:'stage',settings:{
    distanceKm:260,teamCount:20,terrain:'flat',fatigue:0,
    seed:'preview-boundary-6',effort:'steady',attack:'selective',
    chase:'selective'}}).preview;
  assert.equal(preview.teamPlans.find(plan=>plan.teamId==='you').role,
    'opportunistic');
  assert.ok(preview.frames.some(frame=>frame.attackers.some(id=>
    id.startsWith('you-'))));
  assert.ok(preview.frames.some(frame=>frame.chasers.includes('you')));
  assert.ok(preview.frames.every(frame=>!frame.chasers.includes('you')||
    !frame.attackers.some(id=>id.startsWith('you-'))));
});

test('declared preview goals change only those rival opening intents',()=>{
  const input={format:'one_day',settings:{distanceKm:40,teamCount:4,
    seed:'preview-goal-pair'}};
  const seeded=createV94RaceDynamicsPreview(input).preview;
  const declared=createV94RaceDynamicsPreview({...input,rivalGoals:[
    {teamId:'rival-1',role:'break'},
    {teamId:'rival-2',role:'control'}]}).preview;
  const selected=declared.teamPlans.find(row=>row.teamId==='rival-1');
  assert.equal(selected.source,'manager_goal');
  assert.equal(selected.role,'break');
  assert.equal(selected.baseline.attack,'repeated');
  assert.equal(selected.baseline.chase,'ignore');
  const second=declared.teamPlans.find(row=>row.teamId==='rival-2');
  assert.equal(second.source,'manager_goal');
  assert.equal(second.role,'control');
  assert.equal(second.baseline.chase,'selective');
  assert.deepEqual(declared.teamPlans.filter(row=>
    !['rival-1','rival-2'].includes(row.teamId)),seeded.teamPlans.filter(row=>
    !['rival-1','rival-2'].includes(row.teamId)));
  assert.equal(declared.resultStatus,'provisional_road_groups_only');
});

test('withdrawal comparison is explicit and remains a provisional road preview',()=>{
  const input={format:'stage',settings:{distanceKm:40,teamCount:4,
    seed:'preview-withdrawal-option'}};
  const current=createV94RaceDynamicsPreview(input).preview;
  const experimental=createV94RaceDynamicsPreview({...input,
    controlWithdrawalVersion:2}).preview;
  assert.equal(current.policy.controlWithdrawalVersion,undefined);
  assert.equal(experimental.policy.controlWithdrawalVersion,2);
  assert.ok(experimental.frames.every(frame=>
    Array.isArray(frame.controlWithheld)&&Array.isArray(frame.teamEnergy)));
  assert.deepEqual(experimental.teamPlans,current.teamPlans);
  assert.equal(experimental.resultStatus,'provisional_road_groups_only');
  assert.equal(Object.hasOwn(experimental,'provisionalResults'),false);
});
