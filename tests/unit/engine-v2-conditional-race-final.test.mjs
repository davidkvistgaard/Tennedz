import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal,
  validateV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleChasedPartialContactFromTour,
  validateFinaleChasedPartialContactFromTour,
  validateFinaleChasedPartialAfterLeadOutFromTour,
  validateFinalePassivePartialAfterLeadOutFromTour,
  validateFinaleChasedPartialActiveLeadOutFromTour} from
  '../../lib/engine/v2/finale-partial-contact-runner.mjs';
import {prepareV91FinaleTrial} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {recordFinaleOneClockSoloWithLeadOutFromTour} from
  '../../lib/engine/v2/finale-one-clock-solo.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {recordFinaleInactiveIntentsSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {simulateFinaleCooperativeGroupCommonClock} from
  '../../lib/engine/v2/finale-group-common-clock.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  '../../lib/engine/v2/finale-worker.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};
const named=id=>({attackTeamId:'you',attackRiderId:`you-${id}`});

test('one opt-in entry chooses existing paid full-field race branches',()=>{
  for(const [request,version] of [
    [{},'v2-finale-verified-assembly-bunch-runner-lab-7'],
    [named(0),'v2-finale-paid-bunch-runner-1'],
    [named(1),'v2-finale-paid-one-clock-lead-out-contact-runner-2'],
    [named(7),'v2-finale-one-clock-solo-lead-out-2']]){
    const trial=createV91ConditionalRaceFinal(settings,request);
    assert.equal(trial.version,request.attackTeamId?
      'v91-conditional-race-final-1':'v91-conditional-race-final-10');
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

test('active chase continues a partial solo catch with paid work',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:4,gender:'M'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},
    {distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'}]){
    const input={...settings,...variation};
    const trial=createV91ConditionalRaceFinal(input,named(4));
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.preContactFinale.outcome,'contact_uncontinued');
    assert.equal(trial.paidFinale.version,
      'v2-finale-chased-partial-contact-runner-2');
    assert.equal(trial.paidFinale.finishers.length,
      variation.teamCount*8);
    const source=trial.preContactFinale.frames.at(-1);
    const first=trial.paidFinale.frames[0];
    assert.equal(first.elapsedSecondsAtStart,
      trial.preContactFinale.contact.elapsedSeconds);
    assert.equal(first.chaseRiderId,source.chaseRiderId);
    for(const row of first.riders){
      const prior=source.riders.find(rider=>
        rider.riderId===row.riderId);
      assert.ok(Math.abs(row.positionBeforeM-prior.positionM)<1e-8);
      assert.ok(Math.abs(row.energyAtDecision-prior.energyAfter)<1e-8);
    }
    assert.ok(trial.paidFinale.frames.some(frame=>
      frame.riders.some(row=>row.riderId===source.chaseRiderId&&
        row.role==='chase'&&row.energySpent>0)));
    for(const frame of trial.paidFinale.frames){
      assert.equal(frame.riders.length,variation.teamCount*8);
      const chaser=frame.riders.find(row=>row.riderId===
        frame.chaseRiderId);
      if(chaser){
        assert.equal(chaser.role,'chase');
        assert.ok(chaser.energySpent>0);
      }
      for(const row of frame.riders){
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-8);
        assert.ok(Math.abs(row.positionM-row.positionBeforeM-
          row.distanceTravelledM)<1e-7);
      }
    }
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(validateFinaleChasedPartialContactFromTour(
      trial.recording,{attackTeamId:'you',plans:trial.finalePlans},
      trial.preContactFinale,trial.paidFinale),true);
    assert.equal(validateV91ConditionalRaceFinal(
      input,named(4),trial),true);
  }
  assert.throws(()=>createV91ConditionalRaceFinal(settings,
    {attackTeamId:'you'}),/both a team and rider/);
  assert.throws(()=>createV91ConditionalRaceFinal(settings,
    {leadOutTiming:'early'}),/supported conditional race orders/);
});

test('a chase team can rotate only after its chase target is caught',()=>{
  const prepared=prepareV91FinaleTrial(settings,{
    attackTeamId:'you',attackRiderId:'you-3'});
  const teams=prepared.teams.map(team=>team.id==='rival-1'?{
    ...team,orders:{...team.orders,phases:[{
      atKm:settings.distanceKm-1,frontWork:'rotate'}]}}:team);
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams,seed:prepared.seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'you',plans:prepared.finalePlans};
  const source=recordFinaleOneClockSoloWithLeadOutFromTour(tour,input);
  assert.equal(source.outcome,'contact_uncontinued');
  assert.equal(source.frames.at(-1).rotation.selected,null);
  const continuation=recordFinaleChasedPartialContactFromTour(
    tour,input,source);
  assert.ok(continuation.frames.some(frame=>
    frame.rotation.selected?.teamId==='rival-1'));
  for(const frame of continuation.frames){
    const selected=frame.rotation.selected;
    if(!selected)continue;
    assert.notEqual(selected.teamId,frame.chaseRiderId&&
      teams.find(team=>team.riders.some(rider=>
        rider.id===frame.chaseRiderId))?.id);
    for(const work of selected.work){
      const rider=frame.riders.find(row=>row.riderId===work.riderId);
      assert.equal(rider.role,'front_rotation');
      assert.ok(Math.abs(rider.energySpent-work.energySpent)<1e-8);
    }
  }
  assert.equal(validateFinaleChasedPartialContactFromTour(
    tour,input,source,continuation),true);
});

test('a paid lead-out survives later partial solo contact to the line',()=>{
  const attack={attackTeamId:'you',attackRiderId:'you-4'};
  const prepared=prepareV91FinaleTrial(settings,attack);
  const plans=helper=>prepared.finalePlans.map(row=>row.teamId==='you'?{
    ...row,finisherId:'you-6',leadOutRiderId:helper}:row);
  const neutral=createV91ConditionalRaceFinal(settings,{
    ...attack,plans:plans(null)});
  const withLead=createV91ConditionalRaceFinal(settings,{
    ...attack,plans:plans('you-5')});
  assert.deepEqual(withLead.recording,neutral.recording);
  assert.equal(withLead.paidFinale.version,
    'v2-finale-chased-partial-after-lead-out-runner-3');
  assert.ok(withLead.preContactFinale.frames.some(frame=>
    frame.leadOutRiderIds.includes('you-5')&&
    frame.riders.some(row=>row.riderId==='you-5'&&
      row.role==='lead_out'&&row.energySpent>0)));
  assert.deepEqual(withLead.preContactFinale.frames.at(-1)
    .leadOutRiderIds,[]);
  const first=withLead.paidFinale.frames[0];
  const source=withLead.preContactFinale.frames.at(-1);
  for(const row of first.riders){
    const prior=source.riders.find(rider=>
      rider.riderId===row.riderId);
    assert.ok(Math.abs(row.positionBeforeM-prior.positionM)<1e-8);
    assert.ok(Math.abs(row.energyAtDecision-prior.energyAfter)<1e-8);
  }
  const line=trial=>trial.paidFinale.finishers.find(row=>
    row.riderId==='you-6').elapsedSecondsFromLastKmStart;
  assert.notEqual(line(withLead),line(neutral));
  assert.equal(withLead.paidFinale.finishers.length,32);
  assert.equal(withLead.classifiedResults,null);
  assert.equal(withLead.pointsStatus,'withheld');
  assert.equal(validateFinaleChasedPartialAfterLeadOutFromTour(
    withLead.recording,{attackTeamId:'you',plans:withLead.finalePlans},
    withLead.preContactFinale,withLead.paidFinale),true);
  assert.equal(validateV91ConditionalRaceFinal(settings,{
    ...attack,plans:plans('you-5')},withLead),true);
});

test('post-lead-out contact retains varied fields and route lengths',()=>{
  const attack={attackTeamId:'you',attackRiderId:'you-4'};
  for(const variation of [
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},
    {distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'}]){
    const input={...settings,...variation};
    const prepared=prepareV91FinaleTrial(input,attack);
    const plans=prepared.finalePlans.map(row=>row.teamId==='you'?{
      ...row,finisherId:'you-6',leadOutRiderId:'you-5'}:row);
    const trial=createV91ConditionalRaceFinal(input,{...attack,plans});
    assert.equal(trial.paidFinale.version,
      'v2-finale-chased-partial-after-lead-out-runner-3');
    assert.equal(trial.paidFinale.finishers.length,
      variation.teamCount*8);
    assert.equal(new Set(trial.paidFinale.finishers.map(row=>
      row.riderId)).size,variation.teamCount*8);
    assert.ok(trial.paidFinale.finishers.every(row=>
      Number.isFinite(row.elapsedSecondsFromLastKmStart)));
    assert.equal(validateV91ConditionalRaceFinal(
      input,{...attack,plans},trial),true);
  }
});

test('a helper still pulling at contact pays its remaining pull',()=>{
  const attack={attackTeamId:'you',attackRiderId:'you-3'};
  const prepared=prepareV91FinaleTrial(settings,attack);
  const plans=prepared.finalePlans.map(row=>row.teamId==='you'?{
    ...row,finisherId:'you-6',leadOutRiderId:'you-5'}:row);
  const trial=createV91ConditionalRaceFinal(settings,{...attack,plans});
  assert.equal(trial.roadStatus,'paid_conditional_line');
  assert.equal(trial.paidFinale.version,
    'v2-finale-chased-partial-active-lead-out-runner-5');
  assert.ok(trial.preContactFinale.frames.at(-1)
    .leadOutRiderIds.includes('you-5'));
  const source=trial.preContactFinale.frames.at(-1).riders
    .find(row=>row.riderId==='you-5');
  const first=trial.paidFinale.frames[0].riders
    .find(row=>row.riderId==='you-5');
  assert.equal(first.role,'lead_out');
  assert.ok(Math.abs(first.energyAtDecision-source.energyAfter)<1e-8);
  assert.ok(first.energySpent>0);
  assert.ok(first.positionM>source.positionM);
  assert.equal(trial.classifiedResults,null);
  assert.equal(trial.pointsStatus,'withheld');
});

test('spent lead-out survives passive partial contact across routes',()=>{
  for(const [variation,attacker] of [
    [{distanceKm:40,terrain:'flat',teamCount:4,gender:'M'},1],
    [{distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},1],
    [{distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'},2]]){
    const input={...settings,...variation,
      managerTactics:Array.from({length:variation.teamCount-1},()=>({
        effort:'steady',attack:'none',chase:'ignore'}))};
    const attack=named(attacker);
    const prepared=prepareV91FinaleTrial(input,attack);
    const plans=prepared.finalePlans.map(row=>row.teamId==='you'?{
      ...row,finisherId:'you-6',leadOutRiderId:'you-5'}:row);
    const trial=createV91ConditionalRaceFinal(input,{...attack,plans});
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.paidFinale.version,
      'v2-finale-passive-partial-after-lead-out-runner-4');
    assert.equal(trial.paidFinale.finishers.length,
      variation.teamCount*8);
    assert.ok(trial.preContactFinale.frames.some(frame=>
      frame.leadOutRiderIds.includes('you-5')&&
      frame.riders.some(row=>row.riderId==='you-5'&&
        row.role==='lead_out'&&row.energySpent>0)));
    assert.deepEqual(trial.preContactFinale.frames.at(-1)
      .leadOutRiderIds,[]);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(validateFinalePassivePartialAfterLeadOutFromTour(
      trial.recording,{attackTeamId:'you',plans:trial.finalePlans},
      trial.preContactFinale,trial.paidFinale),true);
    assert.equal(validateV91ConditionalRaceFinal(
      input,{...attack,plans},trial),true);
  }
});

test('active player lead-out crosses solo contact as a paid pair',()=>{
  for(const [variation,attacker] of [
    [{distanceKm:40,terrain:'flat',teamCount:4,gender:'M'},1],
    [{distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},1],
    [{distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'},2]]){
    const input={...settings,...variation};
    const attack=named(attacker);
    const prepared=prepareV91FinaleTrial(input,attack);
    const plans=helper=>prepared.finalePlans.map(row=>row.teamId==='you'?{
      ...row,finisherId:'you-6',leadOutRiderId:helper}:row);
    const trial=createV91ConditionalRaceFinal(input,{
      ...attack,plans:plans('you-5')});
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.paidFinale.version,
      'v2-finale-chased-partial-active-lead-out-runner-5');
    assert.deepEqual(trial.preContactFinale.contact.riderIds,
      ['you-5','you-6']);
    assert.equal(trial.paidFinale.finishers.length,
      variation.teamCount*8);
    assert.ok(trial.paidFinale.frames.some(frame=>
      frame.leadOutRiderIds.includes('you-5')&&
      frame.roadGroups.some(group=>group.id==='lead-out:you'&&
        group.riderIds.includes('you-5')&&
        group.riderIds.includes('you-6'))&&
      frame.riders.some(row=>row.riderId==='you-5'&&
        row.role==='lead_out'&&row.energySpent>0)));
    for(const frame of trial.paidFinale.frames){
      for(const row of frame.riders){
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-8);
      }
    }
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(validateFinaleChasedPartialActiveLeadOutFromTour(
      trial.recording,{attackTeamId:'you',plans:trial.finalePlans},
      trial.preContactFinale,trial.paidFinale),true);
    assert.equal(validateV91ConditionalRaceFinal(
      input,{...attack,plans:plans('you-5')},trial),true);
    if(variation.teamCount===4){
      const neutral=createV91ConditionalRaceFinal(input,{
        ...attack,plans:plans(null)});
      assert.deepEqual(trial.recording,neutral.recording);
      const finisherTime=recording=>recording.paidFinale.finishers
        .find(row=>row.riderId==='you-6')
        .elapsedSecondsFromLastKmStart;
      assert.ok(finisherTime(trial)<finisherTime(neutral));
    }
  }
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

test('mixed default orders reach a paid conditional line only when inactive',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:4,gender:'M'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'F'},
    {distanceKm:260,terrain:'mountain',teamCount:20,gender:'M'}]){
    const input={...variation,seed:'trial'};
    const trial=createV91ConditionalRaceFinal(input);
    assert.equal(trial.version,'v91-conditional-race-final-11');
    assert.equal(trial.paidFinale.version,
      'v2-finale-verified-inactive-assembly-bunch-runner-lab-8');
    assert.equal(trial.roadStatus,'paid_conditional_line');
    assert.equal(trial.paidFinale.finishers.length,variation.teamCount*8);
    assert.equal(new Set(trial.paidFinale.finishers.map(row=>
      row.riderId)).size,variation.teamCount*8);
    const ledger=trial.paidFinale.sourceIntentLedger;
    assert.ok(!ledger.named.some(row=>row.canEnterRoadContest));
    assert.ok(!ledger.unnamed.some(row=>row.canEnterRoadContest));
    assert.deepEqual(ledger.otherPendingActions,[]);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91ConditionalRaceFinal(input,{},trial),true);
  }
});

test('an eligible named attack cannot be treated as inactive',()=>{
  const prepared=prepareV91FinaleTrial(settings,named(1));
  const teams=prepared.teams.map(team=>team.id==='you'?{
    ...team,orders:{...team.orders,phases:[{
      atKm:settings.distanceKm-1,attack:'selective',
      attackRiderId:'you-1'}]}}:team);
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams,seed:prepared.seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.throws(()=>recordFinaleInactiveIntentsSprintPlanFromTour(tour,{
    plans:prepared.finalePlans}),/unresolved road action/);
});

test('one recorded cooperative group reaches a paid band line without awards',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',fatigue:0,gender:'M',teamCount:4},
    {distanceKm:40,terrain:'flat',fatigue:0,gender:'F',teamCount:20},
    {distanceKm:120,terrain:'rolling',fatigue:15,gender:'M',teamCount:15},
    {distanceKm:120,terrain:'rolling',fatigue:15,gender:'F',teamCount:20}]){
    const input={...variation,seed:'conditional-coverage-1',
      attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'};
    const trial=createV91ConditionalRaceFinal(input);
    assert.equal(trial.version,'v91-conditional-race-final-3');
    assert.equal(trial.roadStatus,'paid_group_bands');
    assert.equal(trial.paidFinale.version,
      'v2-finale-group-common-clock-1');
    assert.equal(trial.finalePlanStatus,'unapplied_group_band');
    assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
      variation.teamCount*8);
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91ConditionalRaceFinal(input,{},trial),true);
  }
});

test('an unengaged order to chase ones own break leaves paid road unchanged',()=>{
  for(const distanceKm of [40,120])for(const gender of ['M','F'])
    for(const teamCount of [4,15,20]){
      const base={distanceKm,terrain:distanceKm===40?'flat':'rolling',
        fatigue:distanceKm===40?0:15,gender,teamCount,
        seed:'conditional-coverage-1',attack:'repeated',
        defaultRivalPlan:'attack'};
      const ignored=createV91ConditionalRaceFinal({...base,chase:'ignore'});
      const ordered=createV91ConditionalRaceFinal({...base,chase:'all'});
      assert.equal(ordered.version,'v91-conditional-race-final-4');
      assert.deepEqual(ordered.recording.frames[distanceKm-2].chasers,[]);
      assert.deepEqual(ordered.paidFinale,ignored.paidFinale);
      assert.deepEqual(ordered.roadPlaceBounds,ignored.roadPlaceBounds);
      assert.equal(ordered.pointsStatus,'withheld');
      assert.equal(ordered.canCommitAwards,false);
    }
});

test('one recorded all-out chase pays a helper and changes the shared clock',()=>{
  for(const distanceKm of [40,120])for(const gender of ['M','F'])
    for(const teamCount of distanceKm===40?[4,15,20]:[4]){
      const input={distanceKm,terrain:distanceKm===40?'flat':'rolling',
        fatigue:distanceKm===40?0:15,gender,teamCount,
        seed:'conditional-coverage-1',attack:'repeated',chase:'ignore',
        defaultRivalPlan:'attack',managerTactics:[
          {effort:'steady',attack:'none',chase:'all'}]};
      const trial=createV91ConditionalRaceFinal(input);
      assert.equal(trial.version,'v91-conditional-race-final-5');
      assert.equal(trial.roadStatus,'paid_group_bands');
      assert.deepEqual(trial.recording.frames[distanceKm-2].chasers,
        ['rival-1']);
      assert.equal(trial.paidFinale.line.chasePullRiderId,'rival-1-5');
      assert.equal(trial.roadPlaceBounds.version,
        'v2-finale-group-result-bounds-2');
      const snapshot=finaleSnapshotFromTour(trial.recording,{
        remainingKm:1,includeAttackLoad:true});
      const passive=simulateFinaleCooperativeGroupCommonClock({
        route:trial.recording.route,snapshot,
        teams:trial.recording.committedInputs.teams,
        frontPullRiderId:null,chasePullRiderId:null,passiveChase:true,
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
        cooperativeFront:true});
      const energy=clock=>clock.line.finalRiderEnergy.find(row=>
        row.riderId==='rival-1-5').energy;
      assert.ok(trial.paidFinale.bunchLineTime<passive.bunchLineTime);
      assert.ok(energy(trial.paidFinale)<energy(passive));
      assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
        teamCount*8);
      assert.equal(trial.pointsStatus,'withheld');
      assert.equal(validateV91ConditionalRaceFinal(input,{},trial),true);
    }
});

test('two recorded chase teams rotate paid helpers on the group clock',()=>{
  for(const terrain of ['flat','rolling','mountain'])
    for(const gender of ['M','F'])for(const teamCount of [15,20]){
      const input={distanceKm:120,terrain,teamCount,gender,
        fatigue:terrain==='mountain'?0:15,
        seed:'two-chase-source-1',attack:'repeated',chase:'ignore',
        defaultRivalPlan:'attack',managerTactics:[
          {effort:'conserve',attack:'none',chase:'all'},
          {effort:'conserve',attack:'none',chase:'all'}]};
      const trial=createV91ConditionalRaceFinal(input);
      assert.equal(trial.version,'v91-conditional-race-final-6');
      assert.deepEqual(trial.recording.frames[118].chasers,
        ['rival-1','rival-2']);
      const rotation=trial.paidFinale.line.chaseRotationRiderIds;
      assert.equal(new Set(rotation).size,2);
      assert.deepEqual([...new Set(rotation)],
        ['rival-1-5','rival-2-5']);
      assert.equal(trial.roadPlaceBounds.version,
        'v2-finale-group-result-bounds-3');
      const snapshot=finaleSnapshotFromTour(trial.recording,{
        remainingKm:1,includeAttackLoad:true});
      const passive=simulateFinaleCooperativeGroupCommonClock({
        route:trial.recording.route,snapshot,
        teams:trial.recording.committedInputs.teams,
        frontPullRiderId:null,chasePullRiderId:null,passiveChase:true,
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
        cooperativeFront:true});
      assert.ok(trial.paidFinale.bunchLineTime<passive.bunchLineTime);
      const energy=(clock,id)=>clock.line.finalRiderEnergy.find(row=>
        row.riderId===id).energy;
      for(const id of new Set(rotation))
        assert.ok(energy(trial.paidFinale,id)<energy(passive,id));
      assert.equal(trial.paidFinale.line.finalRiderEnergy.length,
        teamCount*8);
      assert.equal(trial.pointsStatus,'withheld');
      assert.equal(validateV91ConditionalRaceFinal(input,{},trial),true);
    }
});

test('one extra manager chase closes the break before a paid lead-out line',()=>{
  const base={distanceKm:120,terrain:'flat',fatigue:15,teamCount:15,
    gender:'M',seed:'three-chase-source-1',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'attack'};
  const chase={effort:'conserve',attack:'none',chase:'all'};
  const two={...base,managerTactics:[chase,chase]};
  const three={...base,managerTactics:[chase,chase,chase]};
  const open=createV91ConditionalRaceFinal(two);
  assert.equal(open.version,'v91-conditional-race-final-6');
  assert.equal(open.recording.frames[118].chasers.length,2);
  assert.equal(open.recording.frames[118].roadGroups.length,1);
  assert.equal(open.roadStatus,'paid_group_bands');
  assert.equal(validateV91ConditionalRaceFinal(two,{},open),true);

  const plans=Array.from({length:15},(_,index)=>{
    const teamId=index===0?'you':`rival-${index}`;
    return {teamId,finisherId:`${teamId}-7`,
      leadOutRiderId:index===0?'you-5':null};
  });
  const request={plans};
  const closed=createV91ConditionalRaceFinal(three,request);
  const unassisted=createV91ConditionalRaceFinal(three,{plans:plans.map(
    row=>({...row,leadOutRiderId:null}))});
  assert.equal(closed.version,'v91-conditional-race-final-11');
  assert.equal(closed.recording.frames[118].chasers.length,0);
  assert.equal(closed.recording.frames[118].roadGroups.length,0);
  assert.equal(closed.roadStatus,'paid_conditional_line');
  assert.equal(closed.paidFinale.finishers.length,120);
  assert.deepEqual(closed.recording,unassisted.recording);
  assert.ok(closed.paidFinale.frames.some(frame=>frame.riders.some(row=>
    row.riderId==='you-5'&&row.role.startsWith('lead_out')&&
    row.energySpent>0)));
  const attempts=closed.paidFinale.frames.flatMap(frame=>
    frame.assemblyAttempts??[]).filter(row=>row.teamId==='you');
  assert.ok(attempts.length>0);
  assert.ok(attempts.every(row=>row.status==='still_separated'));
  const helper=trial=>trial.paidFinale.finishers.find(row=>
    row.riderId==='you-5');
  const finisher=trial=>trial.paidFinale.finishers.find(row=>
    row.riderId==='you-7');
  assert.ok(helper(closed).energyAtLine<helper(unassisted).energyAtLine);
  assert.equal(finisher(closed).elapsedSecondsFromLastKmStart,
    finisher(unassisted).elapsedSecondsFromLastKmStart);
  assert.equal(closed.classifiedResults,null);
  assert.equal(closed.pointsStatus,'withheld');
  assert.equal(closed.canCommitAwards,false);
  assert.equal(validateV91ConditionalRaceFinal(three,request,closed),true);
});

test('group branch refuses unpaid manager plans and unresolved road states',()=>{
  const group={distanceKm:40,terrain:'flat',teamCount:4,gender:'M',
    seed:'conditional-coverage-1',attack:'repeated',chase:'ignore',
    defaultRivalPlan:'attack'};
  const plans=Array.from({length:4},(_,index)=>{
    const teamId=index===0?'you':`rival-${index}`;
    return {teamId,finisherId:`${teamId}-7`,leadOutRiderId:null};
  });
  assert.throws(()=>createV91ConditionalRaceFinal(group,{plans}),
    /Finisher and lead-out plans are not paid/);
  const ownBreakChase=createV91ConditionalRaceFinal({...group,chase:'all'});
  assert.equal(ownBreakChase.version,'v91-conditional-race-final-4');
  assert.equal(ownBreakChase.roadStatus,'paid_group_bands');
  assert.equal(ownBreakChase.recording.frames[group.distanceKm-2].chasers.length,0);
  assert.equal(validateV91ConditionalRaceFinal(
    {...group,chase:'all'},{},ownBreakChase),true);
  assert.throws(()=>createV91ConditionalRaceFinal({...group,
    managerTactics:[{effort:'steady',attack:'none',chase:'selective'}]}),
  /unresolved last-kilometre road action/);
  const separated=createV91ConditionalRaceFinal({...group,
    distanceKm:260,terrain:'mountain',fatigue:30});
  assert.equal(separated.roadStatus,'paid_separated_bands');
  assert.equal(separated.paidFinale.line.riders.length,32);
  assert.equal(separated.pointsStatus,'withheld');
});

test('depleted group branch exposes reserve shortfall without classification',()=>{
  const settings={distanceKm:260,terrain:'mountain',fatigue:30,
    teamCount:4,gender:'M',seed:'test-drive-acceptance-1',
    attack:'selective',chase:'selective',defaultRivalPlan:'mixed'};
  const result=createV91ConditionalRaceFinal(settings);
  assert.equal(result.roadStatus,'recorded_depleted_bands');
  assert.equal(result.paidFinale.line.riders.length,32);
  assert.equal(result.paidFinale.line.bands.length,3);
  assert.equal(result.classifiedResults,null);
  assert.equal(result.pointsStatus,'withheld');
  assert.equal(result.canCommitAwards,false);
  assert.equal(validateV91ConditionalRaceFinal(settings,{},result),true);
  const plans=result.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  assert.throws(()=>createV91ConditionalRaceFinal(settings,{plans}),
    /not paid for depleted road bands/);
});
