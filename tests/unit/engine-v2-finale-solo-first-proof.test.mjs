import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithSoloFirstProof,
  validateV91FinaleTrialWithSoloFirstProof} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {validateFinaleSoloFirstProofFromTour} from
  '../../lib/engine/v2/finale-solo-first-proof.mjs';

function settings(teamCount,gender,chase){
  return {distanceKm:40,terrain:'flat',teamCount,gender,
    attack:'none',chase:'ignore',seed:'trial',
    managerTactics:Array.from({length:teamCount-1},()=>({
      effort:chase==='all'?'hard':'steady',attack:'none',chase}))};
}

test('a separated rider wins only when even an optimistic bunch cannot arrive',()=>{
  for(const teamCount of [4,15,20])for(const gender of ['M','F']){
    const request={attackTeamId:'you',attackRiderId:'you-7'};
    const calm=createV91FinaleTrialWithSoloFirstProof(
      settings(teamCount,gender,'ignore'),request);
    const chased=createV91FinaleTrialWithSoloFirstProof(
      settings(teamCount,gender,'all'),request);
    assert.equal(calm.version,'v91-finale-trial-7');
    assert.equal(calm.soloContinuation.outcome.branch,'surviving_solo');
    assert.equal(chased.soloContinuation.outcome.branch,'surviving_solo');
    assert.equal(calm.soloFirstProof.proofStatus,'model_bound_first');
    assert.equal(calm.soloFirstProof.knownFirstRiderId,'you-7');
    assert.ok(calm.soloFirstProof.soloLineSeconds<
      calm.soloFirstProof.earliestPossibleBunchSeconds);
    assert.equal(chased.soloFirstProof.proofStatus,
      'unresolved_sprint_contact');
    assert.equal(chased.soloFirstProof.knownFirstRiderId,null);
    assert.ok(chased.soloFirstProof.soloLineSeconds>=
      chased.soloFirstProof.earliestPossibleBunchSeconds);
    for(const [input,result] of [
      [settings(teamCount,gender,'ignore'),calm],
      [settings(teamCount,gender,'all'),chased]]){
      assert.equal(result.classifiedResults,null);
      assert.equal(result.pointsStatus,'withheld');
      assert.equal(result.canCommitAwards,false);
      assert.equal(validateFinaleSoloFirstProofFromTour(result.recording,
        {attackTeamId:'you'},result.soloFirstProof),true);
      assert.equal(validateV91FinaleTrialWithSoloFirstProof(input,request,
        result),true);
      assert.throws(()=>validateFinaleSoloFirstProofFromTour(
        result.recording,{attackTeamId:'you'},
        {...result.soloFirstProof,knownFirstRiderId:'rival-1-7'}),
      /does not replay/);
    }
  }
});

test('first-place proof is absent without a paid surviving solo',()=>{
  const result=createV91FinaleTrialWithSoloFirstProof(
    settings(4,'M','all'),{attackTeamId:'you',attackRiderId:'you-1'});
  assert.equal(result.soloContinuation.outcome.branch,'first_catch');
  assert.equal(result.soloFirstProof,null);
  assert.equal(result.postContactRunnerStatus,'paid_conditional_line');
});

test('a long tired route retains uncertainty instead of declaring a solo win',()=>{
  const input={...settings(15,'F','ignore'),distanceKm:260,
    terrain:'rolling',fatigue:30};
  const result=createV91FinaleTrialWithSoloFirstProof(input,{
    attackTeamId:'you',attackRiderId:'you-7'});
  assert.equal(result.soloContinuation.outcome.branch,'surviving_solo');
  assert.equal(result.soloFirstProof.proofStatus,
    'unresolved_sprint_contact');
  assert.equal(result.soloFirstProof.knownFirstRiderId,null);
  assert.equal(result.pointsStatus,'withheld');
});
