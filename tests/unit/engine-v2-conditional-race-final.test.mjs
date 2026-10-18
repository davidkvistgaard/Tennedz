import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal,
  validateV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};
const named=id=>({attackTeamId:'you',attackRiderId:`you-${id}`});

test('one opt-in entry chooses existing paid full-field race branches',()=>{
  for(const [request,version] of [
    [{},'v2-finale-early-bunch-runner-lab-5'],
    [named(0),'v2-finale-paid-bunch-runner-1'],
    [named(1),'v2-finale-paid-one-clock-lead-out-contact-runner-2'],
    [named(7),'v2-finale-one-clock-solo-lead-out-2']]){
    const trial=createV91ConditionalRaceFinal(settings,request);
    assert.equal(trial.version,'v91-conditional-race-final-1');
    assert.equal(trial.paidFinale.version,version);
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.paidFinale.finishers.length,32);
    assert.equal(new Set(trial.paidFinale.finishers.map(row=>
      row.riderId)).size,32);
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91ConditionalRaceFinal(
      settings,request,trial),true);
  }
});

test('whole-bunch contact preserves its paid pre-contact source',()=>{
  const trial=createV91ConditionalRaceFinal(settings,named(1));
  const contact=trial.preContactFinale.contact;
  const atContact=trial.preContactFinale.frames.at(-1);
  const next=trial.paidFinale.frames[0];
  assert.equal(trial.paidFinale.sourceCatchVersion,
    trial.preContactFinale.version);
  assert.equal(next.startDistanceM,contact.distanceM);
  assert.equal(next.elapsedSecondsAtStart,contact.elapsedSeconds);
  for(const row of next.riders){
    const prior=atContact.riders.find(rider=>
      rider.riderId===row.riderId);
    assert.ok(Math.abs(row.positionBeforeM-prior.positionM)<1e-8);
    assert.ok(Math.abs(row.energyAtDecision-prior.energyAfter)<1e-8);
  }
  assert.throws(()=>validateV91ConditionalRaceFinal(settings,
    named(1),{...trial,pointsStatus:'awarded'}),
  /does not replay/);
});

test('the shared contact path retains all riders in varied fields',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:15,gender:'F'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'M'},
    {distanceKm:120,terrain:'mountain',teamCount:20,gender:'F'}]){
    const input={...settings,...variation};
    const trial=createV91ConditionalRaceFinal(input,named(1));
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.paidFinale.finishers.length,
      variation.teamCount*8);
    assert.equal(trial.paidFinale.startDistanceM,
      trial.preContactFinale.contact.distanceM);
    assert.equal(validateV91ConditionalRaceFinal(
      input,named(1),trial),true);
  }
});

test('a partial solo catch remains unclassified and cannot award points',()=>{
  const trial=createV91ConditionalRaceFinal(settings,named(4));
  assert.equal(trial.roadStatus,'unsupported_partial_contact');
  assert.equal(trial.paidFinale.outcome,'contact_uncontinued');
  assert.equal(trial.paidFinale.finishers,null);
  assert.equal(trial.classifiedResults,null);
  assert.equal(trial.pointsStatus,'withheld');
  assert.equal(validateV91ConditionalRaceFinal(
    settings,named(4),trial),true);
  assert.throws(()=>createV91ConditionalRaceFinal(settings,
    {attackTeamId:'you'}),/both a team and rider/);
  assert.throws(()=>createV91ConditionalRaceFinal(settings,
    {leadOutTiming:'early'}),/supported conditional race orders/);
});

test('passive partial contact pays the same field to each individual line',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:4,gender:'M'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},
    {distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'}]){
    const input={...settings,...variation,
      managerTactics:Array.from({length:variation.teamCount-1},()=>({
        effort:'steady',attack:'none',chase:'ignore'}))};
    const trial=createV91ConditionalRaceFinal(input,named(0));
    const source=trial.preContactFinale.frames.at(-1);
    const continuation=trial.paidFinale;
    assert.equal(continuation.version,
      'v2-finale-passive-partial-contact-runner-1');
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(continuation.pointsStatus,'withheld');
    assert.equal(continuation.canCommitAwards,false);
    assert.equal(continuation.finishers.length,
      variation.teamCount*8);
    assert.equal(new Set(continuation.finishers.map(row=>
      row.riderId)).size,variation.teamCount*8);
    assert.ok(continuation.finishers.every(row=>
      Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
      Number.isFinite(row.energyAtLine)&&row.energyAtLine>=0));
    const first=continuation.frames[0];
    assert.equal(first.startDistanceM,source.bunchPositionM);
    assert.equal(first.elapsedSecondsAtStart,
      trial.preContactFinale.contact.elapsedSeconds);
    assert.ok(first.durationSeconds>0);
    for(const row of first.riders){
      const prior=source.riders.find(rider=>
        rider.riderId===row.riderId);
      assert.ok(Math.abs(row.positionBeforeM-prior.positionM)<1e-8);
      assert.ok(Math.abs(row.energyAtDecision-prior.energyAfter)<1e-8);
    }
    for(const frame of continuation.frames){
      assert.equal(frame.riders.length,variation.teamCount*8);
      for(const row of frame.riders){
        assert.ok(row.energySpent>=0);
        assert.ok(row.energyAfter>=0);
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-8);
        assert.ok(row.positionM>=row.positionBeforeM);
        assert.ok(row.positionM<=variation.distanceKm*1000);
      }
    }
    assert.equal(validateV91ConditionalRaceFinal(
      input,named(0),trial),true);
  }
});

test('a player finisher and two manager lead-outs affect one locked race',()=>{
  const input={...settings,teamCount:15,gender:'F',seed:'early-test'};
  const defaultTrial=createV91ConditionalRaceFinal(input);
  const finisherPlans=defaultTrial.finalePlans.map(row=>({...row,
    finisherId:row.teamId==='you'?'you-6':row.finisherId}));
  const nominated=createV91ConditionalRaceFinal(input,{
    plans:finisherPlans});
  const helperPlans=finisherPlans.map(row=>({...row,
    leadOutRiderId:row.teamId==='you'?'you-5':
      row.teamId==='rival-1'?'rival-1-6':null}));
  const helped=createV91ConditionalRaceFinal(input,{plans:helperPlans});
  assert.deepEqual(helped.recording,nominated.recording);
  assert.deepEqual(helped.paidFinale.positionedSource.slots,
    nominated.paidFinale.positionedSource.slots);
  assert.equal(helped.finalePlans.find(row=>row.teamId==='you')
    .finisherId,'you-6');
  for(const [finisherId,helperId] of [
    ['you-6','you-5'],['rival-1-7','rival-1-6']]){
    assert.ok(helped.paidFinale.frames.some(frame=>
      frame.riders.some(row=>row.riderId===helperId&&
        row.role==='lead_out'&&row.energySpent>0)));
    assert.ok(helped.paidFinale.finishers.find(row=>
      row.riderId===finisherId).elapsedSecondsFromLastKmStart<
      nominated.paidFinale.finishers.find(row=>
        row.riderId===finisherId).elapsedSecondsFromLastKmStart);
  }
  assert.equal(helped.paidFinale.finishers.length,120);
  assert.equal(helped.classifiedResults,null);
  assert.equal(helped.pointsStatus,'withheld');
  assert.equal(validateV91ConditionalRaceFinal(
    input,{plans:helperPlans},helped),true);
});
