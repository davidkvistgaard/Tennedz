import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithOneClockCatch,
  validateV91FinaleTrialWithOneClockCatch} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};
const request=id=>({attackTeamId:'you',attackRiderId:`you-${id}`});

test('an exact whole-bunch catch continues every paid rider to the line',()=>{
  for(const attacker of [1,2]){
    const input=request(attacker);
    const trial=createV91FinaleTrialWithOneClockCatch(settings,input);
    const contact=trial.oneClockSolo.contact;
    const catchFrame=trial.oneClockSolo.frames.at(-1);
    const continuation=trial.contactContinuation;
    assert.equal(trial.version,'v91-finale-trial-9');
    assert.equal(trial.contactContinuationStatus,
      'paid_conditional_line');
    assert.equal(continuation.version,
      'v2-finale-paid-one-clock-contact-runner-1');
    assert.equal(continuation.startDistanceM,contact.distanceM);
    assert.equal(continuation.frames[0].startDistanceM,
      contact.distanceM);
    assert.equal(continuation.sourceBunchElapsedSeconds,
      contact.elapsedSeconds);
    assert.equal(continuation.finishers.length,32);
    assert.equal(new Set(continuation.finishers.map(row=>
      row.riderId)).size,32);
    assert.equal(continuation.frames.at(-1).endDistanceM,40000);
    for(const row of continuation.frames[0].riders){
      const atContact=catchFrame.riders.find(rider=>
        rider.riderId===row.riderId);
      assert.ok(Math.abs(row.positionBeforeM-
        atContact.positionM)<1e-8);
      assert.ok(Math.abs(row.energyAtDecision-
        atContact.energyAfter)<1e-8);
    }
    for(const frame of continuation.frames)
      for(const row of frame.riders){
        assert.ok(row.distanceTravelledM>=0);
        assert.ok(Math.abs(row.positionM-row.positionBeforeM-
          row.distanceTravelledM)<1e-7);
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-7);
      }
    assert.ok(continuation.finishers.every(row=>
      Number.isFinite(row.elapsedSecondsFromLastKmStart)));
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91FinaleTrialWithOneClockCatch(settings,
      input,trial),true);
    assert.throws(()=>validateV91FinaleTrialWithOneClockCatch(
      settings,input,{...trial,pointsStatus:'awarded'}),
    /does not replay/);
  }
});

test('a sprinter catching the solo ahead of the bunch stays unresolved',()=>{
  const trial=createV91FinaleTrialWithOneClockCatch(settings,
    request(4));
  assert.equal(trial.oneClockSolo.outcome,'contact_uncontinued');
  assert.ok(trial.oneClockSolo.contact.distanceM>
    trial.oneClockSolo.frames.at(-1).bunchPositionM);
  assert.equal(trial.contactContinuation,null);
  assert.equal(trial.contactContinuationStatus,
    'unsupported_partial_contact');
  assert.equal(trial.pointsStatus,'withheld');
});

test('whole-bunch continuation keeps varied fields and routes intact',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:15,gender:'F'},
    {distanceKm:120,terrain:'rolling',teamCount:15,gender:'M'},
    {distanceKm:120,terrain:'mountain',teamCount:20,gender:'F'}]){
    const trial=createV91FinaleTrialWithOneClockCatch(
      {...settings,...variation},request(1));
    assert.equal(trial.contactContinuationStatus,
      'paid_conditional_line');
    assert.equal(trial.contactContinuation.finishers.length,
      variation.teamCount*8);
    assert.equal(trial.contactContinuation.frames[0].startDistanceM,
      trial.oneClockSolo.contact.distanceM);
    assert.equal(trial.pointsStatus,'withheld');
  }
});

test('one manager chase choice changes paid contact without roster changes',()=>{
  const chased=createV91FinaleTrialWithOneClockCatch(settings,
    request(2));
  const relaxed=createV91FinaleTrialWithOneClockCatch({...settings,
    managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}]},
  request(2));
  assert.deepEqual(chased.recording.committedInputs.teams.map(team=>
    team.riders),relaxed.recording.committedInputs.teams.map(team=>
    team.riders));
  assert.notEqual(chased.oneClockSolo.contact.distanceM,
    relaxed.oneClockSolo.contact.distanceM);
  assert.equal(chased.contactContinuationStatus,
    'paid_conditional_line');
  assert.equal(relaxed.contactContinuationStatus,
    'paid_conditional_line');
  assert.equal(chased.pointsStatus,'withheld');
  assert.equal(relaxed.pointsStatus,'withheld');
});

test('a tired rolling field still pays the exact catch and remaining race',()=>{
  const trial=createV91FinaleTrialWithOneClockCatch({...settings,
    distanceKm:120,terrain:'rolling',teamCount:15,fatigue:30},
  request(2));
  assert.equal(trial.contactContinuationStatus,
    'paid_conditional_line');
  assert.equal(trial.contactContinuation.finishers.length,120);
  assert.equal(trial.contactContinuation.frames[0].startDistanceM,
    trial.oneClockSolo.contact.distanceM);
  assert.equal(trial.pointsStatus,'withheld');
});
