import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {createV91FinaleTrial,validateV91FinaleTrial,
  createV91FinaleTrialWithSoloBounds,
  validateV91FinaleTrialWithSoloBounds} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';

const settings=gender=>({distanceKm:40,terrain:'flat',teamCount:4,
  gender,attack:'none',chase:'ignore',defaultRivalPlan:'chase',
  seed:'trial'});
const plans=helper=>['you','rival-1','rival-2','rival-3']
  .map(teamId=>({teamId,finisherId:`${teamId}-7`,
    leadOutRiderId:teamId==='you'&&helper?'you-6':null}));
const request=helper=>({attackTeamId:'you',attackRiderId:'you-0',
  plans:plans(helper)});

test('fictional player and independent rivals replay a chosen lead-out',()=>{
  for(const gender of ['M','F']){
    const noHelper=createV91FinaleTrial(settings(gender),request(false));
    const withHelper=createV91FinaleTrial(settings(gender),request(true));
    assert.equal(withHelper.version,'v91-finale-trial-1');
    assert.equal(withHelper.decision.branch,'caught');
    assert.equal(withHelper.finaleStatus,'provisional_conditional');
    assert.deepEqual(withHelper.attackIntent,{teamId:'you',
      riderId:'you-0',atKm:39});
    assert.deepEqual(withHelper.finalePlans,plans(true));
    assert.equal(withHelper.leadOutTiming,'late');
    assert.deepEqual(noHelper.recording,withHelper.recording);
    assert.deepEqual(withHelper.recording.committedInputs.teams.map(team=>
      team.riders),createV91Playtest(settings(gender)).recording
      .committedInputs.teams.map(team=>team.riders));
    assert.equal(noHelper.finale.line.finishers[0].riderId,
      'rival-1-7');
    assert.equal(withHelper.finale.line.finishers[0].riderId,
      'you-7');
    assert.equal(withHelper.finale.line.finishers.length,32);
    assert.ok(withHelper.finale.line.finishers.find(row=>
      row.riderId==='you-7').elapsedSecondsFromLastKmStart<
      noHelper.finale.line.finishers.find(row=>
        row.riderId==='you-7').elapsedSecondsFromLastKmStart);
    assert.equal(withHelper.finale.longitudinal.frames.length,4);
    assert.equal(withHelper.pointsStatus,'withheld');
    assert.equal(withHelper.canCommitAwards,false);
    assert.equal(withHelper.sourceResultStatus,
      'kilometre_provisional_not_finale');
    assert.equal(withHelper.classifiedResults,null);
    assert.deepEqual(withHelper,createV91FinaleTrial(settings(gender),
      request(true)));
    assert.equal(validateV91FinaleTrial(settings(gender),
      request(true),withHelper),true);
    assert.throws(()=>validateV91FinaleTrial(settings(gender),
      request(true),{...withHelper,pointsStatus:'awarded'}),
    /does not replay/);
  }
});

test('the same trial builder accepts varied routes, fatigue and field sizes',()=>{
  for(const input of [
    {distanceKm:120,terrain:'mountain',teamCount:15,gender:'M'},
    {distanceKm:260,terrain:'rolling',teamCount:20,gender:'F',
      fatigue:30}]){
    const result=createV91FinaleTrial({...settings(input.gender),...input},
      {attackTeamId:'you',attackRiderId:'you-0'});
    assert.equal(result.decision.branch,'caught');
    assert.equal(result.finale.line.finishers.length,input.teamCount*8);
    assert.equal(new Set(result.finale.line.finishers.map(row=>
      row.riderId)).size,input.teamCount*8);
    assert.equal(result.finale.canCommitAwards,false);
  }
});

test('a surviving solo and unsupported manager plans remain explicit',()=>{
  const solo=createV91FinaleTrial(settings('M'),{
    attackTeamId:'you',attackRiderId:'you-7',plans:plans(true)});
  assert.equal(solo.decision.branch,'solo');
  assert.equal(solo.finaleStatus,'unsupported_road_outcome');
  assert.equal(solo.finale,null);
  assert.equal(solo.canCommitAwards,false);
  assert.equal(solo.classifiedResults,null);
  assert.throws(()=>createV91FinaleTrial(settings('M'),{
    attackTeamId:'you',attackRiderId:'you-0',plans:plans(true).slice(1)}),
  /one valid finale plan/);
  assert.throws(()=>createV91FinaleTrial(settings('M'),{
    attackTeamId:'you',attackRiderId:'you-0',plans:plans(true).map(row=>
      row.teamId==='you'?{...row,hiddenBoost:10}:row)}),
  /one valid finale plan/);
  assert.throws(()=>createV91FinaleTrial(settings('M'),{
    ...request(true),leadOutTiming:'early'}),
  /supported controlled-finale/);
  assert.throws(()=>createV91FinaleTrial({...settings('M'),
    chase:'selective'},request(true)),/supported controlled-finale/);
  assert.throws(()=>createV91FinaleTrial({...settings('M'),
    attack:'repeated'},request(true)),/supported controlled-finale/);
});

test('one independent manager can change catch into an explicit solo',()=>{
  const chased=createV91FinaleTrial(settings('M'),request(true));
  const inactive=createV91FinaleTrial({...settings('M'),
    managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}]},
  request(true));
  assert.equal(chased.decision.branch,'caught');
  assert.equal(inactive.decision.branch,'solo');
  assert.equal(inactive.finaleStatus,'unsupported_road_outcome');
  assert.equal(inactive.finale,null);
  assert.deepEqual(chased.recording.committedInputs.teams.map(team=>
    team.riders),inactive.recording.committedInputs.teams.map(team=>
    team.riders));
});

test('a custom profile and one rival decision change paid road coverage',()=>{
  const shared={...settings('F'),terrain:'custom',
    profileHeightsM:[100,130,160,135,120,100],
    seed:'custom-boundary'};
  const request={attackTeamId:'you',attackRiderId:'you-0'};
  const chased=createV91FinaleTrialWithSoloBounds(shared,request);
  const relaxed=createV91FinaleTrialWithSoloBounds({...shared,
    managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}]},
  request);
  assert.equal(chased.decision.branch,'caught');
  assert.ok(chased.recording.route.kilometres.some(km=>
    km.gradientPct>0));
  assert.deepEqual(chased.recording.route,relaxed.recording.route);
  assert.equal(chased.finale.line.finishers.length,32);
  assert.equal(relaxed.decision.branch,'solo');
  assert.equal(relaxed.soloContinuation.outcome.branch,'first_catch');
  assert.equal(relaxed.soloContinuation.bounds.riders.length,32);
  assert.deepEqual(chased.recording.committedInputs.teams.map(team=>
    team.riders),relaxed.recording.committedInputs.teams.map(team=>
    team.riders));
  assert.equal(chased.canCommitAwards,false);
  assert.equal(relaxed.canCommitAwards,false);
});

test('a tired multi-group source is refused before the finale branch',()=>{
  const tired={...settings('M'),distanceKm:260,teamCount:4,
    fatigue:30,seed:'paired-size-fatigue'};
  assert.throws(()=>createV91FinaleTrialWithSoloBounds(tired,{
    attackTeamId:'you',attackRiderId:'you-7'}),
  /one complete source bunch/);
  assert.equal(createV91Playtest(tired).recording
    .committedInputs.teams.length,4);
});

test('solo-aware trial reuses paid survival and catch bounds without awards',()=>{
  for(const gender of ['M','F']){
    const survived=createV91FinaleTrialWithSoloBounds(settings(gender),{
      attackTeamId:'you',attackRiderId:'you-7'});
    assert.equal(survived.version,'v91-finale-trial-2');
    assert.equal(survived.sourceTrialVersion,'v91-finale-trial-1');
    assert.equal(survived.finaleStatus,'provisional_solo_bounds');
    assert.equal(survived.soloContinuation.outcome.branch,
      'surviving_solo');
    assert.equal(survived.soloContinuation.bounds.knownFirstPlaceRiderId,
      'you-7');
    assert.equal(survived.soloContinuation.bounds.riders.length,32);
    assert.equal(survived.classifiedResults,null);
    assert.equal(survived.pointsStatus,'withheld');
    assert.equal(validateV91FinaleTrialWithSoloBounds(settings(gender),{
      attackTeamId:'you',attackRiderId:'you-7'},survived),true);
    assert.throws(()=>validateV91FinaleTrialWithSoloBounds(
      settings(gender),{attackTeamId:'you',attackRiderId:'you-7'},
      {...survived,classifiedResults:[]}),/does not replay/);
    const caught=createV91FinaleTrialWithSoloBounds({
      ...settings(gender),managerTactics:[{effort:'steady',
        attack:'none',chase:'ignore'}]},
    {attackTeamId:'you',attackRiderId:'you-0'});
    assert.equal(caught.finaleStatus,
      'provisional_post_contact_bounds');
    assert.equal(caught.soloContinuation.outcome.branch,'first_catch');
    assert.equal(caught.soloContinuation.bounds.riders.length,32);
    assert.equal(caught.soloContinuation.bounds.knownFirstPlaceRiderId,
      null);
    assert.equal(caught.canCommitAwards,false);
    const unsupported=createV91FinaleTrialWithSoloBounds(
      settings(gender),{attackTeamId:'you',attackRiderId:'you-7',
        plans:plans(true)});
    assert.equal(unsupported.finaleStatus,
      'unsupported_road_outcome');
    assert.equal(unsupported.soloContinuation,null);
  }
});
