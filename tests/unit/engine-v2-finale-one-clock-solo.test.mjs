import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithOneClockSolo,
  validateV91FinaleTrialWithOneClockSolo} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};
const request=riderId=>({attackTeamId:'you',attackRiderId:riderId});

function assertPaidTrace(runner,riderCount=32){
  assert.equal(runner.version,'v2-finale-one-clock-solo-1');
  assert.ok(runner.frames.length>0);
  let elapsed=runner.alignment.elapsedSecondsAtBunch500M;
  const priorEnergy=new Map();
  for(const frame of runner.frames){
    assert.ok(frame.durationSeconds>0);
    assert.ok(Math.abs(frame.elapsedSecondsAtStart-elapsed)<1e-8);
    elapsed+=frame.durationSeconds;
    assert.equal(frame.riders.length,riderCount);
    assert.equal(new Set(frame.riders.map(row=>row.riderId)).size,
      riderCount);
    for(const row of frame.riders){
      assert.ok(row.distanceTravelledM>=0);
      assert.ok(row.energySpent>=0);
      assert.ok(Math.abs(row.positionM-row.positionBeforeM-
        row.distanceTravelledM)<1e-7);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAfter)<1e-7);
      if(priorEnergy.has(row.riderId))
        assert.ok(Math.abs(row.energyAtDecision-
          priorEnergy.get(row.riderId))<1e-7);
      priorEnergy.set(row.riderId,row.energyAfter);
    }
    for(const contact of frame.bunchRecontacts){
      assert.ok(contact.elapsedSeconds>=frame.elapsedSecondsAtStart);
      assert.ok(contact.elapsedSeconds<=elapsed+1e-8);
      const rider=frame.riders.find(row=>
        row.riderId===contact.riderId);
      assert.ok(rider.shelteredDistanceM>=0);
      assert.ok(contact.positionM<=frame.bunchPositionM+1e-8);
    }
  }
}

test('one-clock solo reaches a paid, individual conditional line',()=>{
  for(const gender of ['M','F']){
    const input={...settings,gender};
    const plan=request('you-7');
    const trial=createV91FinaleTrialWithOneClockSolo(input,plan);
    const runner=trial.oneClockSolo;
    assert.equal(trial.version,'v91-finale-trial-8');
    assert.equal(runner.outcome,'separated_line');
    assertPaidTrace(runner);
    assert.equal(runner.frames.length,5);
    assert.equal(runner.finishers.length,32);
    assert.ok(runner.finishers.every(row=>Number.isFinite(
      row.elapsedSecondsFromLastKmStart)));
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91FinaleTrialWithOneClockSolo(input,
      plan,trial),true);
    assert.throws(()=>validateV91FinaleTrialWithOneClockSolo(input,
      plan,{...trial,pointsStatus:'awarded'}),/does not replay/);
  }
});

test('varied field size and route retain every paid rider',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:15,gender:'F'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'M'},
    {distanceKm:120,terrain:'mountain',teamCount:20,gender:'F'},
    {distanceKm:260,terrain:'rolling',teamCount:20,gender:'F'}]){
    const trial=createV91FinaleTrialWithOneClockSolo(
      {...settings,...variation},request('you-7'));
    assert.equal(trial.oneClockSoloStatus,'separated_line');
    assertPaidTrace(trial.oneClockSolo,variation.teamCount*8);
    assert.equal(trial.oneClockSolo.finishers.length,
      variation.teamCount*8);
    assert.equal(trial.pointsStatus,'withheld');
  }
});

test('a nominated rival sprint changes exact solo contact on one clock',()=>{
  const plans=finisher=>['you','rival-1','rival-2','rival-3']
    .map(teamId=>({teamId,finisherId:teamId+'-'+
      (teamId==='rival-1'?finisher:7),
      leadOutRiderId:null}));
  const before=createV91FinaleTrialWithOneClockSolo(settings,{
    ...request('you-4'),plans:plans(7)});
  const after=createV91FinaleTrialWithOneClockSolo(settings,{
    ...request('you-4'),plans:plans(6)});
  assert.deepEqual(before.recording,after.recording);
  assert.equal(before.oneClockSolo.outcome,'contact_uncontinued');
  assert.equal(after.oneClockSolo.outcome,'contact_uncontinued');
  assertPaidTrace(before.oneClockSolo);
  assertPaidTrace(after.oneClockSolo);
  assert.notEqual(before.oneClockSolo.contact.distanceM,
    after.oneClockSolo.contact.distanceM);
  for(const trial of [before,after]){
    const frame=trial.oneClockSolo.frames.at(-1);
    const solo=frame.riders.find(row=>row.riderId==='you-4');
    for(const id of trial.oneClockSolo.contact.riderIds){
      const other=frame.riders.find(row=>row.riderId===id);
      assert.ok(Math.abs(other.positionM-solo.positionM)<1e-7);
    }
    assert.equal(trial.oneClockSolo.finishers,null);
    assert.equal(trial.canCommitAwards,false);
  }
});

test('pre-contact lead-out stays outside this one-clock version',()=>{
  const plans=['you','rival-1','rival-2','rival-3']
    .map(teamId=>({teamId,finisherId:`${teamId}-7`,
      leadOutRiderId:teamId==='you'?'you-6':null}));
  const trial=createV91FinaleTrialWithOneClockSolo(settings,{
    ...request('you-7'),plans});
  assert.equal(trial.oneClockSolo,null);
  assert.equal(trial.oneClockSoloStatus,
    'unsupported_pre_contact_lead_out');
  assert.equal(trial.pointsStatus,'withheld');
});
