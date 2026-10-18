import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithUnifiedRoad,
  createV91FinaleTrialWithPositionedBunch,
  validateV91FinaleTrialWithPositionedBunch,
  createV91FinaleTrialWithIndependentBunch,
  validateV91FinaleTrialWithIndependentBunch} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {recordFinalePositionedBunchRunnerFromTour,
  validateFinalePositionedBunchRunnerFromTour,
  validateFinaleIndependentBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};

function run(input,{leadOut=false}={}){
  const names=['you',...Array.from({length:input.teamCount-1},
    (_,index)=>`rival-${index+1}`)];
  const plans=names.map(teamId=>({teamId,
    finisherId:`${teamId}-7`,
    leadOutRiderId:leadOut&&teamId==='rival-1'?
      'rival-1-6':null}));
  const trial=createV91FinaleTrialWithUnifiedRoad(input,{
    attackTeamId:'you',attackRiderId:'you-0',plans});
  const request={attackTeamId:'you',plans};
  const positioned=recordFinalePositionedBunchRunnerFromTour(
    trial.recording,request);
  return {trial,request,positioned};
}

test('the positioned bunch pays every wheel through its individual line',()=>{
  for(const gender of ['M','F']){
    const input={...settings,gender};
    const {trial,request,positioned}=run(input,{leadOut:true});
    assert.equal(positioned.version,
      'v2-finale-positioned-bunch-runner-lab-2');
    assert.equal(positioned.frames.length,6);
    assert.equal(positioned.frames.at(-1).phase,
      'positioned_bunch_tail');
    assert.equal(positioned.frames.at(-1).startDistanceM,
      Math.min(...positioned.frames[4].riders.map(row=>row.positionM)));
    assert.equal(positioned.finishers.length,32);
    assert.deepEqual(positioned.lineOrder.map(row=>row.position),
      Array.from({length:32},(_,index)=>index+1));
    assert.equal(positioned.resultStatus,
      'experimental_inferred_order');
    assert.equal(positioned.pointsStatus,'withheld');
    assert.equal(positioned.canCommitAwards,false);
    for(const frame of positioned.frames){
      assert.equal(frame.riders.length,32);
      for(const row of frame.riders){
        assert.ok(Math.abs(row.positionM-row.positionBeforeM-
          row.distanceTravelledM)<1e-7);
        assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
          row.energyAfter)<1e-7);
        assert.ok(row.energySpent<=row.energyAtDecision+1e-8);
      }
      for(const event of frame.roadEvents){
        assert.equal(event.kind,'open_road_pass');
        assert.ok(event.elapsedSeconds>=
          frame.elapsedSecondsAtStart-1e-8);
        assert.ok(event.elapsedSeconds<=
          frame.elapsedSecondsAtStart+frame.durationSeconds+1e-8);
      }
    }
    assert.equal(validateFinalePositionedBunchRunnerFromTour(
      trial.recording,request,positioned),true);
    assert.throws(()=>validateFinalePositionedBunchRunnerFromTour(
      trial.recording,request,{...positioned,
        pointsStatus:'awarded'}),/does not replay/);
  }
});

test('a nominated helper changes a finisher on the same locked road',()=>{
  const without=run(settings);
  const withLead=run(settings,{leadOut:true});
  assert.deepEqual(without.trial.recording,
    withLead.trial.recording);
  const finisherId='rival-1-7';
  const first=without.positioned.lineOrder.find(row=>
    row.riderId===finisherId);
  const second=withLead.positioned.lineOrder.find(row=>
    row.riderId===finisherId);
  assert.notEqual(first.elapsedSecondsFromLastKmStart,
    second.elapsedSecondsFromLastKmStart);
  const helper=withLead.positioned.positionedSource.slots.find(row=>
    row.riderId==='rival-1-6');
  const finisher=withLead.positioned.positionedSource.slots.find(row=>
    row.riderId===finisherId);
  assert.equal(helper.lane,finisher.lane);
  assert.equal(finisher.row,helper.row+1);
  assert.equal(withLead.positioned.frames[0].riders.find(row=>
    row.riderId==='rival-1-6').role,'lead_out');
});

test('a long tired field records every inverted finish as a road pass',()=>{
  const input={...settings,distanceKm:260,terrain:'rolling',
    teamCount:15,gender:'F',fatigue:30};
  const {trial,request,positioned}=run(input);
  assert.equal(positioned.finishers.length,120);
  assert.equal(positioned.lineOrder.length,120);
  const starts=new Map(positioned.positionedSource.slots.map(row=>
    [row.riderId,row.positionM]));
  const times=new Map(positioned.finishers.map(row=>
    [row.riderId,row.elapsedSecondsFromLastKmStart]));
  const passes=new Set(positioned.frames.flatMap(frame=>
    frame.roadEvents.map(event=>
      `${event.passerId}:${event.passedId}`)));
  for(const [behindId,behindM] of starts)for(const [aheadId,aheadM]
    of starts){
    if(behindM<aheadM-1e-8&&
      times.get(behindId)<times.get(aheadId)-1e-8)
      assert.ok(passes.has(`${behindId}:${aheadId}`));
  }
  assert.equal(new Set(positioned.finishers.map(row=>
    row.riderId)).size,120);
  assert.equal(positioned.pointsStatus,'withheld');
  assert.equal(validateFinalePositionedBunchRunnerFromTour(
    trial.recording,request,positioned),true);
});

test('larger flat and mountain bunches retain paid experimental lines',()=>{
  for(const input of [
    {...settings,teamCount:20,gender:'F',seed:'large-flat'},
    {...settings,teamCount:20,gender:'M',terrain:'mountain',
      distanceKm:120,fatigue:15,seed:'large-mountain'}]){
    const {trial,request,positioned}=run(input);
    const count=input.teamCount*8;
    assert.equal(positioned.positionedSource.slots.length,count);
    assert.equal(positioned.finishers.length,count);
    assert.equal(positioned.lineOrder.length,count);
    assert.equal(new Set(positioned.lineOrder.map(row=>row.riderId))
      .size,count);
    assert.ok(positioned.finishers.every(row=>
      Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
      row.energyAtLine>=0));
    assert.equal(positioned.frames.at(-1).riders.length,count);
    assert.equal(positioned.pointsStatus,'withheld');
    assert.equal(validateFinalePositionedBunchRunnerFromTour(
      trial.recording,request,positioned),true);
  }
});

test('the opt-in player trial exposes the experimental order only for a bunch',()=>{
  for(const [attacker,expected] of [
    ['you-0','experimental_inferred_order'],
    ['you-7','separated_line']]){
    const request={attackTeamId:'you',attackRiderId:attacker};
    const trial=createV91FinaleTrialWithPositionedBunch(
      settings,request);
    assert.equal(trial.version,'v91-finale-trial-12');
    assert.equal(trial.paidFinaleStatus,expected);
    assert.equal(trial.paidFinale.finishers.length,32);
    assert.equal(trial.paidFinale.lineOrder?.length??0,
      attacker==='you-0'?32:0);
    assert.equal(trial.classifiedResults,null);
    assert.equal(trial.pointsStatus,'withheld');
    assert.equal(validateV91FinaleTrialWithPositionedBunch(
      settings,request,trial),true);
  }
});

test('a helper changes paid work without changing the locked source wheel',()=>{
  const plans=helper=>['you','rival-1','rival-2','rival-3']
    .map(teamId=>({teamId,finisherId:`${teamId}-7`,
      leadOutRiderId:teamId==='rival-1'?helper:null}));
  const request=helper=>({attackTeamId:'you',attackRiderId:'you-0',
    plans:plans(helper)});
  const without=createV91FinaleTrialWithIndependentBunch(
    settings,request(null));
  const withLead=createV91FinaleTrialWithIndependentBunch(
    settings,request('rival-1-5'));
  assert.equal(withLead.version,'v91-finale-trial-13');
  assert.deepEqual(without.recording,withLead.recording);
  assert.deepEqual(without.paidFinale.positionedSource.slots,
    withLead.paidFinale.positionedSource.slots);
  const line=(trial,id)=>trial.paidFinale.lineOrder.find(row=>
    row.riderId===id);
  assert.ok(line(withLead,'rival-1-7')
    .elapsedSecondsFromLastKmStart<line(without,'rival-1-7')
      .elapsedSecondsFromLastKmStart);
  assert.ok(line(withLead,'rival-1-5').energyAtLine<
    line(without,'rival-1-5').energyAtLine);
  assert.equal(withLead.classifiedResults,null);
  assert.equal(withLead.pointsStatus,'withheld');
  assert.equal(validateFinaleIndependentBunchRunnerFromTour(
    withLead.recording,{attackTeamId:'you',plans:withLead.finalePlans},
    withLead.paidFinale),true);
  assert.equal(validateV91FinaleTrialWithIndependentBunch(
    settings,request('rival-1-5'),withLead),true);
  assert.throws(()=>createV91FinaleTrialWithIndependentBunch(
    settings,request('rival-1-6')),/not on the finisher's source wheel/);
});

test('independent source keeps full tired fields and the solo guard',()=>{
  for(const input of [
    {...settings,teamCount:20,gender:'F',seed:'independent-flat'},
    {...settings,teamCount:20,gender:'M',terrain:'mountain',
      distanceKm:120,fatigue:15,seed:'independent-mountain'}]){
    const request={attackTeamId:'you',attackRiderId:'you-0'};
    const trial=createV91FinaleTrialWithIndependentBunch(input,request);
    assert.equal(trial.paidFinale.positionedSource.version,
      'v2-finale-independent-source-lab-2');
    assert.equal(trial.paidFinale.lineOrder.length,160);
    assert.equal(trial.paidFinale.finishers.length,160);
    assert.equal(trial.paidFinale.pointsStatus,'withheld');
    assert.equal(validateV91FinaleTrialWithIndependentBunch(
      input,request,trial),true);
  }
  const request={attackTeamId:'you',attackRiderId:'you-7'};
  const trial=createV91FinaleTrialWithIndependentBunch(settings,request);
  assert.equal(trial.decision.branch,'solo');
  assert.equal(trial.paidFinaleStatus,'separated_line');
  assert.equal(trial.classifiedResults,null);
});
