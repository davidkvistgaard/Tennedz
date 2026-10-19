import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithUnifiedRoad} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {recordFinaleIndependentBunchRunnerFromTour,
  recordFinaleLaneQueuedCaughtBunchRunnerFromTour,
  validateFinaleLaneQueuedCaughtBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

function plansFor(teamCount){
  return ['you',...Array.from({length:teamCount-1},(_,index)=>
    `rival-${index+1}`)].map(teamId=>({teamId,
    finisherId:`${teamId}-7`,leadOutRiderId:null}));
}

test('a caught attack enters a paid fixed-lane bunch finish without an unrecorded same-lane pass',()=>{
  for(const [distanceKm,terrain,fatigue] of [
    [40,'flat',0],[120,'rolling',15],[260,'mountain',30]])
    for(const teamCount of [4,15,20])for(const gender of ['M','F']){
      if(distanceKm===260&&teamCount===4)continue;
      const settings={distanceKm,terrain,fatigue,teamCount,
        gender,attack:'none',chase:'ignore',
        defaultRivalPlan:'chase',seed:'trial'};
      const plans=plansFor(teamCount);
      const trial=createV91FinaleTrialWithUnifiedRoad(settings,{
        attackTeamId:'you',attackRiderId:'you-0',plans});
      const request={attackTeamId:'you',plans};
      const paid=recordFinaleLaneQueuedCaughtBunchRunnerFromTour(
        trial.recording,request);
      const lanes=new Map(paid.positionedSource.slots.map(slot=>
        [slot.riderId,slot.lane]));
      assert.equal(paid.branch,'caught');
      assert.equal(paid.startDistanceM,distanceKm*1000-500);
      assert.equal(paid.finishers.length,teamCount*8);
      assert.equal(paid.lineOrder.length,teamCount*8);
      assert.equal(paid.pointsStatus,'withheld');
      for(const frame of paid.frames){
        for(const row of frame.riders){
          assert.ok(Math.abs(row.positionM-row.positionBeforeM-
            row.distanceTravelledM)<1e-7);
          assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
            row.energyAfter)<1e-7);
          for(const block of row.laneBlocks??[])
            assert.equal(lanes.get(row.riderId),
              lanes.get(block.leaderId));
        }
        for(const event of frame.roadEvents)
          assert.notEqual(lanes.get(event.passerId),
            lanes.get(event.passedId));
      }
      assert.equal(validateFinaleLaneQueuedCaughtBunchRunnerFromTour(
        trial.recording,request,paid),true);
      assert.equal(validateFinaleLaneQueuedCaughtBunchRunnerFromTour(
        trial.recording,request,JSON.parse(JSON.stringify(paid))),true);
    }
});

test('caught-attack helper earns a different crossing while the older runner retains its version',()=>{
  const settings={distanceKm:40,terrain:'flat',fatigue:0,
    teamCount:4,gender:'M',attack:'none',chase:'ignore',
    defaultRivalPlan:'chase',seed:'trial'};
  const plans=plansFor(4);
  const trial=createV91FinaleTrialWithUnifiedRoad(settings,{
    attackTeamId:'you',attackRiderId:'you-0',plans});
  const request={attackTeamId:'you',plans};
  const baseline=recordFinaleLaneQueuedCaughtBunchRunnerFromTour(
    trial.recording,request);
  const helperPlans=plans.map(row=>row.teamId==='rival-1'?{
    ...row,leadOutRiderId:'rival-1-5'}:row);
  const withHelper=recordFinaleLaneQueuedCaughtBunchRunnerFromTour(
    trial.recording,{...request,plans:helperPlans});
  const crossing=paid=>paid.lineOrder.find(row=>
    row.riderId==='rival-1-7').elapsedSecondsFromLastKmStart;
  assert.ok(crossing(withHelper)<crossing(baseline));
  assert.equal(recordFinaleIndependentBunchRunnerFromTour(
    trial.recording,request).passingRule,'open-road-lab-1');
  assert.throws(()=>validateFinaleLaneQueuedCaughtBunchRunnerFromTour(
    trial.recording,request,{...baseline,pointsStatus:'awarded'}),
  /does not replay/);
});
