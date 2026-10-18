import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithUnifiedRoad} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {probeLastKmRotationCatchFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationSoloFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-solo.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationSoloSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {resolvePositionedBunchSource,
  validatePositionedBunchSource} from
  '../../lib/engine/v2/finale-positioned-source.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};

function source(input,attacker,{leadOut=true}={}){
  const names=['you',...Array.from({length:input.teamCount-1},
    (_,index)=>`rival-${index+1}`)];
  const request={attackTeamId:'you',attackRiderId:attacker,
    plans:names.map(teamId=>({teamId,finisherId:`${teamId}-7`,
      leadOutRiderId:leadOut&&teamId==='rival-1'?
        'rival-1-6':null}))};
  const trial=createV91FinaleTrialWithUnifiedRoad(input,request);
  const tour=trial.recording;
  const bunch=trial.decision.branch==='caught';
  const road=bunch?probeLastKmRotationCatchFromTour(tour,
    {teamId:'you'}):probeLastKmRotationSoloFromTour(tour,
    {teamId:'you'});
  const planInput={attackTeamId:'you',plans:request.plans};
  const plan=bunch?recordFinaleRotationCatchSprintPlanFromTour(tour,
    planInput):recordFinaleRotationSoloSprintPlanFromTour(tour,
    planInput);
  return {tour,road,plan};
}

test('a paid 500 m bunch receives unique, replayable inferred wheel slots',()=>{
  for(const [attacker,expected] of [
    ['you-0',32],['you-7',31]]){
    const {tour,road,plan}=source(settings,attacker);
    const grid=resolvePositionedBunchSource(tour,road,plan);
    assert.equal(grid.status,'provisional_inferred_wheel_order');
    assert.equal(grid.slots.length,expected);
    assert.equal(new Set(grid.slots.map(row=>row.riderId)).size,
      expected);
    assert.equal(new Set(grid.slots.map(row=>row.positionM)).size,
      expected);
    assert.ok(grid.slots.every(row=>
      row.positionM<=grid.distanceM));
    const helper=grid.slots.find(row=>
      row.riderId==='rival-1-6');
    const finisher=grid.slots.find(row=>
      row.riderId==='rival-1-7');
    assert.equal(helper.lane,finisher.lane);
    assert.equal(finisher.row,helper.row+1);
    assert.equal(validatePositionedBunchSource(tour,road,plan,
      grid),true);
    assert.throws(()=>validatePositionedBunchSource(tour,road,plan,
      {...grid,slots:grid.slots.map((row,index)=>index===0?
        {...row,positionM:row.positionM+1}:row)}),/does not replay/);
  }
});

test('a long, tired field stays behind its recorded front edge',()=>{
  const input={...settings,distanceKm:260,terrain:'rolling',
    teamCount:15,gender:'F',fatigue:30};
  const {tour,road,plan}=source(input,'you-0',{leadOut:false});
  const grid=resolvePositionedBunchSource(tour,road,plan);
  assert.equal(grid.slots.length,120);
  assert.ok(grid.slots.every(row=>row.positionM<=road.at500M.distanceM));
  assert.ok(grid.slots.every(row=>row.row>=0&&row.lane>=0&&
    row.lane<grid.laneCount));
  assert.equal(validatePositionedBunchSource(tour,road,plan,
    grid),true);
});
