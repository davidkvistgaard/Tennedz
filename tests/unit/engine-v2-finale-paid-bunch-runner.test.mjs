import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91FinaleTrial,
  createV91FinaleTrialWithPhysicalRunner,
  validateV91FinaleTrialWithPhysicalRunner} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinalePaidBunchRunnerFromTour,
  validateFinalePaidBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

const settings=gender=>({distanceKm:40,terrain:'flat',teamCount:4,
  gender,attack:'none',chase:'ignore',defaultRivalPlan:'chase',
  seed:'trial'});
const plans=helper=>['you','rival-1','rival-2','rival-3']
  .map(teamId=>({teamId,finisherId:`${teamId}-7`,
    leadOutRiderId:teamId==='you'&&helper?'you-6':null}));
function source(gender){
  const prepared=prepareV91FinaleTrial(settings(gender),{
    attackTeamId:'you',attackRiderId:'you-0',plans:plans(true)});
  const tour=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  return {tour,input:{attackTeamId:'you',plans:prepared.finalePlans}};
}

function containedTeam(id,skill,gender,{attack=false,rotate=false,
  chase='ignore'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:70,sprint:70,
    leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort:attack?'conserve':'steady',
      chase,attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('one-clock 500 m runner charges actual lead-out and sprint distance',()=>{
  for(const gender of ['M','F']){
    const {tour,input}=source(gender);
    const recording=recordFinalePaidBunchRunnerFromTour(tour,input);
    const withoutHelper=recordFinalePaidBunchRunnerFromTour(tour,{
      ...input,plans:plans(false)});
    assert.equal(recording.frames.length,5);
    assert.equal(recording.finishers.length,32);
    assert.equal(recording.pointsStatus,'withheld');
    assert.equal(recording.canCommitAwards,false);
    for(const [index,frame] of recording.frames.entries()){
      assert.equal(frame.startDistanceM,39500+index*100);
      assert.equal(frame.riders.length,32);
      for(const row of frame.riders){
        assert.ok(row.energySpent<=row.energyAtDecision+1e-8);
        assert.ok(Math.abs(row.distanceTravelledM-
          (row.activeDistanceM+row.shelteredDistanceM))<1e-8);
        assert.ok(Math.abs(row.positionM-row.positionBeforeM-
          row.distanceTravelledM)<1e-8);
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-8);
        assert.ok(Math.abs(row.energySpent-(
          row.activeDistanceM*row.activeWorkCostPerKm+
          row.shelteredDistanceM*row.shelteredWorkCostPerKm)/1000)<1e-8);
        if(row.reabsorbedAt){
          assert.ok(row.activeDistanceM>0);
          assert.ok(row.shelteredDistanceM>0);
          assert.ok(Math.abs(row.reabsorbedAt.distanceM-
            row.positionBeforeM-row.activeDistanceM)<1e-8);
        }
      }
      if(index>0)for(const row of frame.riders){
        const previous=recording.frames[index-1].riders.find(prior=>
          prior.riderId===row.riderId);
        assert.ok(Math.abs(row.positionBeforeM-previous.positionM)<1e-8);
        assert.ok(Math.abs(row.energyAtDecision-previous.energyAfter)<1e-8);
      }
    }
    const helper=recording.frames[0].riders.find(row=>
      row.riderId==='you-6');
    assert.ok(helper.distanceTravelledM>100);
    assert.ok(helper.energySpent>0);
    const sprint=recording.frames[2].riders.find(row=>
      row.riderId==='you-7');
    assert.ok(sprint.distanceTravelledM>100);
    assert.ok(sprint.energySpent>0);
    assert.ok(recording.finishers.find(row=>row.riderId==='you-7')
      .elapsedSecondsFromLastKmStart<withoutHelper.finishers.find(row=>
        row.riderId==='you-7').elapsedSecondsFromLastKmStart);
    assert.equal(validateFinalePaidBunchRunnerFromTour(tour,input,
      recording),true);
    assert.throws(()=>validateFinalePaidBunchRunnerFromTour(tour,input,
      {...recording,pointsStatus:'awarded'}),/does not replay/);
  }
});

test('the physical continuation shares the locked trial and withholds points',()=>{
  const request={attackTeamId:'you',attackRiderId:'you-0',
    plans:plans(true)};
  const result=createV91FinaleTrialWithPhysicalRunner(settings('M'),request);
  assert.equal(result.version,'v91-finale-trial-4');
  assert.equal(result.physicalRunnerStatus,'paid_conditional_line');
  assert.equal(Object.hasOwn(result,'finale'),false);
  assert.equal(result.physicalRunner.finishers.length,32);
  assert.equal(result.physicalRunner.pointsStatus,'withheld');
  assert.equal(result.classifiedResults,null);
  assert.equal(result.canCommitAwards,false);
  assert.equal(validateV91FinaleTrialWithPhysicalRunner(settings('M'),
    request,result),true);
  const solo=createV91FinaleTrialWithPhysicalRunner(settings('M'),{
    ...request,attackRiderId:'you-7'});
  assert.equal(solo.physicalRunnerStatus,'unsupported_separated_road');
  assert.equal(solo.physicalRunner,null);
});

test('the same paid runner covers larger, tired fields in both categories',()=>{
  for(const input of [
    {distanceKm:120,terrain:'mountain',teamCount:15,gender:'M',
      fatigue:15},
    {distanceKm:260,terrain:'rolling',teamCount:20,gender:'F',
      fatigue:30}]){
    const result=createV91FinaleTrialWithPhysicalRunner({
      ...settings(input.gender),...input},{attackTeamId:'you',
      attackRiderId:'you-0'});
    assert.equal(result.physicalRunnerStatus,'paid_conditional_line');
    assert.equal(result.physicalRunner.finishers.length,input.teamCount*8);
    assert.equal(new Set(result.physicalRunner.finishers.map(row=>
      row.riderId)).size,input.teamCount*8);
    assert.ok(result.physicalRunner.frames.every(frame=>
      frame.riders.every(row=>row.energySpent<=
        row.energyAtDecision+1e-8)));
    assert.equal(result.classifiedResults,null);
    assert.equal(result.pointsStatus,'withheld');
  }
});

test('contained attack uses the paid whole-bunch path without awards',()=>{
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage:{distance_km:40,
      profile_points:[[0,100],[40,100]],
      keypoints:[{km:39,kind:'SPRINT'}]},teams:[
      containedTeam('a',56,gender,{attack:true}),
      containedTeam('b',95,gender,{rotate:true}),
      containedTeam('c',95,gender,{chase:'all'}),
      containedTeam('d',80,gender,{rotate:true})],
    seed:`contained-rotation-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const plans=['a','b','c','d'].map(teamId=>({teamId,
      finisherId:`${teamId}-0`,
      leadOutRiderId:teamId==='c'?'c-2':null}));
    const recording=recordFinalePaidBunchRunnerFromTour(tour,{
      attackTeamId:'a',plans});
    assert.equal(recording.branch,'contained');
    assert.equal(recording.finishers.length,32);
    assert.equal(recording.frames.length,5);
    assert.equal(recording.pointsStatus,'withheld');
    assert.equal(validateFinalePaidBunchRunnerFromTour(tour,{
      attackTeamId:'a',plans},recording),true);
  }
});
