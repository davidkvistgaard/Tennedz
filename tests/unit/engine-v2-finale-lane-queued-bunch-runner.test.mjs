import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {recordFinaleEarlyBunchRunnerFromTour,
  recordFinaleLaneQueuedEarlyBunchRunnerFromTour,
  validateFinaleLaneQueuedEarlyBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',fatigue:0,attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'early-matrix'};

function plansFor(teamCount){
  return ['you',...Array.from({length:teamCount-1},(_,index)=>
    `rival-${index+1}`)].map(teamId=>({teamId,
    finisherId:`${teamId}-7`,leadOutRiderId:null}));
}

test('fixed source lanes pay a complete last kilometre without passing through a wheel',()=>{
  for(const [distanceKm,terrain,fatigue] of [
    [40,'flat',0],[120,'rolling',15],[260,'mountain',30]])
    for(const teamCount of [4,15,20])for(const gender of ['M','F']){
      if(distanceKm===260&&teamCount===4)continue;
      const tour=createV91Playtest({...settings,distanceKm,
        terrain,fatigue,teamCount,gender}).recording;
      const input={plans:plansFor(teamCount)};
      const paid=recordFinaleLaneQueuedEarlyBunchRunnerFromTour(
        tour,input);
      const source=paid.positionedSource;
      const slots=new Map(source.slots.map(slot=>
        [slot.riderId,slot]));
      assert.equal(paid.passingRule,'fixed-source-lane-queue-lab-1');
      assert.equal(paid.finishers.length,teamCount*8);
      assert.equal(paid.lineOrder.length,teamCount*8);
      assert.equal(paid.pointsStatus,'withheld');
      assert.equal(paid.canCommitAwards,false);
      assert.equal(paid.frames[0].startDistanceM,
        distanceKm*1000-1000);
      assert.equal(paid.frames.at(-1).endDistanceM,
        distanceKm*1000);
      for(const frame of paid.frames){
        for(const row of frame.riders){
          assert.ok(Math.abs(row.positionM-row.positionBeforeM-
            row.distanceTravelledM)<1e-7);
          assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
            row.energyAfter)<1e-7);
          assert.ok(row.energySpent<=row.energyAtDecision+1e-8);
          for(const block of row.laneBlocks??[])
            assert.equal(slots.get(row.riderId).lane,
              slots.get(block.leaderId).lane);
        }
        for(const event of frame.roadEvents)
          assert.notEqual(slots.get(event.passerId).lane,
            slots.get(event.passedId).lane);
      }
      assert.equal(validateFinaleLaneQueuedEarlyBunchRunnerFromTour(
        tour,input,paid),true);
      assert.equal(validateFinaleLaneQueuedEarlyBunchRunnerFromTour(
        tour,input,JSON.parse(JSON.stringify(paid))),true);
    }
});

test('a lead-out can change a paid finisher crossing on the same recording',()=>{
  const tour=createV91Playtest(settings).recording;
  const plans=plansFor(4);
  const baseline=recordFinaleLaneQueuedEarlyBunchRunnerFromTour(
    tour,{plans});
  const withHelper=recordFinaleLaneQueuedEarlyBunchRunnerFromTour(
    tour,{plans:plans.map(plan=>plan.teamId==='rival-1'?{
      ...plan,leadOutRiderId:'rival-1-6'}:plan)});
  const crossing=paid=>paid.lineOrder.find(row=>
    row.riderId==='rival-1-7').elapsedSecondsFromLastKmStart;
  assert.ok(crossing(withHelper)<crossing(baseline));
  assert.ok(withHelper.frames.some(frame=>frame.riders.some(row=>
    row.riderId==='rival-1-6'&&row.role==='lead_out'&&
    row.energySpent>0)));
  const earlier=recordFinaleEarlyBunchRunnerFromTour(tour,{plans});
  assert.equal(earlier.version,'v2-finale-early-bunch-runner-lab-5');
  assert.equal(earlier.passingRule,'open-road-lab-1');
  assert.throws(()=>validateFinaleLaneQueuedEarlyBunchRunnerFromTour(
    tour,{plans},{...baseline,pointsStatus:'awarded'}),
  /does not replay/);
});
