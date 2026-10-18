import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithAssembledBunch,
  validateV91FinaleTrialWithAssembledBunch} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {validateFinaleAssembledBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};

function request(teamCount,helper=null){
  const teams=['you',...Array.from({length:teamCount-1},
    (_,index)=>`rival-${index+1}`)];
  return {attackTeamId:'you',attackRiderId:'you-0',
    plans:teams.map(teamId=>({teamId,finisherId:`${teamId}-7`,
      leadOutRiderId:teamId==='rival-1'?helper:null}))};
}

test('a rear helper pays to form a later lead-out on the same source',()=>{
  for(const gender of ['M','F']){
    const input={...settings,gender};
    const withoutRequest=request(4);
    const withRequest=request(4,'rival-1-6');
    const without=createV91FinaleTrialWithAssembledBunch(
      input,withoutRequest);
    const withLead=createV91FinaleTrialWithAssembledBunch(
      input,withRequest);
    assert.equal(withLead.version,'v91-finale-trial-14');
    assert.equal(withLead.paidFinale.version,
      'v2-finale-assembled-bunch-runner-lab-4');
    assert.deepEqual(withLead.recording,without.recording);
    assert.deepEqual(withLead.paidFinale.positionedSource.slots,
      without.paidFinale.positionedSource.slots);
    const frames=withLead.paidFinale.frames;
    const helperAt=index=>frames[index].riders.find(row=>
      row.riderId==='rival-1-6');
    const finisherAt=index=>frames[index].riders.find(row=>
      row.riderId==='rival-1-7');
    assert.ok(helperAt(0).positionBeforeM<
      finisherAt(0).positionBeforeM);
    assert.equal(helperAt(0).role,'lead_out_assembly');
    assert.deepEqual(frames[0].assemblyAttempts.map(row=>row.status),
      ['ready_next_boundary']);
    assert.equal(helperAt(1).role,'lead_out');
    assert.equal(finisherAt(1).role,'lead_out_finisher');
    assert.ok(helperAt(0).positionM>=finisherAt(0).positionM);
    assert.ok(helperAt(0).positionM-finisherAt(0).positionM<=
      withLead.paidFinale.positionedSource.wheelSpacingM+1e-8);
    assert.ok(helperAt(0).energySpent>0);
    const before=without.paidFinale.lineOrder.find(row=>
      row.riderId==='rival-1-7');
    const after=withLead.paidFinale.lineOrder.find(row=>
      row.riderId==='rival-1-7');
    assert.ok(after.elapsedSecondsFromLastKmStart<
      before.elapsedSecondsFromLastKmStart);
    assert.equal(withLead.paidFinale.finishers.length,32);
    assert.equal(withLead.classifiedResults,null);
    assert.equal(withLead.pointsStatus,'withheld');
    for(const frame of frames)for(const row of frame.riders){
      assert.ok(Math.abs(row.positionM-row.positionBeforeM-
        row.distanceTravelledM)<1e-7);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAfter)<1e-7);
    }
    assert.equal(validateV91FinaleTrialWithAssembledBunch(
      input,withRequest,withLead),true);
    assert.equal(validateFinaleAssembledBunchRunnerFromTour(
      withLead.recording,{attackTeamId:'you',plans:withRequest.plans},
      withLead.paidFinale),true);
    assert.throws(()=>validateV91FinaleTrialWithAssembledBunch(
      input,withRequest,{...withLead,pointsStatus:'awarded'}),
    /does not replay/);
  }
});

test('a distant same-lane helper spends work but earns no free pull',()=>{
  const input={...settings,teamCount:15,
    seed:'position-audit:40:M:15'};
  const order=request(15,'rival-1-4');
  const trial=createV91FinaleTrialWithAssembledBunch(input,order);
  const roles=trial.paidFinale.frames.map(frame=>frame.riders
    .find(row=>row.riderId==='rival-1-4').role);
  assert.deepEqual(roles.slice(0,2),
    ['lead_out_assembly','lead_out_assembly']);
  assert.deepEqual(trial.paidFinale.frames.slice(0,2).map(frame=>
    frame.assemblyAttempts[0].status),
  ['still_separated','still_separated']);
  assert.ok(!roles.includes('lead_out'));
  assert.equal(trial.paidFinale.finishers.length,120);
  assert.equal(trial.pointsStatus,'withheld');
});

test('a nonadjacent lane cannot grant a helper position',()=>{
  const order=request(4,'rival-1-4');
  assert.throws(()=>createV91FinaleTrialWithAssembledBunch(
    settings,order),/adjacent source lane/);
});

test('large varied fields and a solo retain their guarded road branch',()=>{
  for(const input of [
    {...settings,distanceKm:120,terrain:'rolling',fatigue:15,
      teamCount:4,gender:'F'},
    {...settings,distanceKm:120,terrain:'mountain',fatigue:15,
      teamCount:20,gender:'F'}]){
    const order=request(input.teamCount);
    const trial=createV91FinaleTrialWithAssembledBunch(input,order);
    assert.equal(trial.paidFinale.finishers.length,
      input.teamCount*8);
    assert.equal(trial.paidFinale.lineOrder.length,
      input.teamCount*8);
    assert.equal(new Set(trial.paidFinale.lineOrder.map(row=>
      row.riderId)).size,input.teamCount*8);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(validateV91FinaleTrialWithAssembledBunch(
      input,order,trial),true);
  }
  const soloRequest={...request(4),attackRiderId:'you-7'};
  const solo=createV91FinaleTrialWithAssembledBunch(
    settings,soloRequest);
  assert.equal(solo.decision.branch,'solo');
  assert.equal(solo.paidFinale.version,
    'v2-finale-one-clock-solo-lead-out-2');
  assert.equal(solo.pointsStatus,'withheld');
});
