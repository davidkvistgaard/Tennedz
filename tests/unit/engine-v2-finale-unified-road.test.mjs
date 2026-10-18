import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithUnifiedRoad,
  validateV91FinaleTrialWithUnifiedRoad} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};

function request(attackRiderId,teamCount=4){
  return {attackTeamId:'you',attackRiderId,
    plans:['you',...Array.from({length:teamCount-1},
      (_,index)=>`rival-${index+1}`)].map(teamId=>({teamId,
      finisherId:`${teamId}-7`,
      leadOutRiderId:teamId==='rival-1'?'rival-1-6':null}))};
}

test('one locked race selects its paid road branch and withholds awards',()=>{
  for(const [attacker,branch,roadStatus] of [
    ['you-0','caught','paid_conditional_line'],
    ['you-7','solo','separated_line'],
    ['you-2','solo','contact_uncontinued']]){
    const choice=request(attacker);
    const trial=createV91FinaleTrialWithUnifiedRoad(settings,choice);
    assert.equal(trial.version,'v91-finale-trial-11');
    assert.equal(trial.decision.branch,branch);
    assert.equal(trial.paidFinaleStatus,roadStatus);
    assert.equal(trial.paidFinale.frames.length>0,true);
    assert.equal(trial.paidFinale.frames[0].riders.find(row=>
      row.riderId==='rival-1-6').role,'lead_out');
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(trial.canCommitAwards,false);
    assert.equal(validateV91FinaleTrialWithUnifiedRoad(settings,choice,
      trial),true);
    assert.throws(()=>validateV91FinaleTrialWithUnifiedRoad(settings,
      choice,{...trial,pointsStatus:'awarded'}),/does not replay/);
  }
});

test('large tired category keeps every paid rider in each resolved branch',()=>{
  const input={...settings,distanceKm:120,terrain:'rolling',
    teamCount:15,gender:'F',fatigue:15};
  for(const attacker of ['you-0','you-7']){
    const choice=request(attacker,15);
    const trial=createV91FinaleTrialWithUnifiedRoad(input,choice);
    assert.equal(trial.paidFinale.frames.length,5);
    assert.equal(trial.paidFinale.finishers.length,120);
    assert.equal(new Set(trial.paidFinale.finishers.map(row=>
      row.riderId)).size,120);
    for(const frame of trial.paidFinale.frames){
      assert.equal(frame.riders.length,120);
      for(const row of frame.riders){
        assert.ok(row.energySpent<=row.energyAtDecision+1e-8);
        assert.ok(Math.abs(row.positionM-row.positionBeforeM-
          row.distanceTravelledM)<1e-7);
      }
    }
    assert.equal(validateV91FinaleTrialWithUnifiedRoad(input,choice,
      trial),true);
    assert.equal(trial.pointsStatus,'withheld');
  }
});
