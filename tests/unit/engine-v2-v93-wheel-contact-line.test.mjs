import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastedWheelContactLine,
  validateFinaleCoastedWheelContactLine,
  FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION} from
  '../../lib/engine/v2/finale-coasted-wheel-contact-line.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_WHEEL_CONTACT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const tactics=[{effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:20,gender:'M',terrain:'exposed',
  fatigue:0,seed:'v93-long-stress-M-exposed-0-2',
  defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
  chase:'selective',managerTactics:Array.from({length:19},(_,index)=>
    tactics[index%4])};
const prepared=prepareV91Playtest(settings);
const tour=simulateTacticalTour({stage:prepared.stage,
  weather:prepared.weather,teams:prepared.teams,seed:prepared.seed,
  motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});

test('the locked 260 km contact pays a shared road and every individual crossing',()=>{
  const line=recordFinaleCoastedWheelContactLine(tour);
  assert.equal(line.version,FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION);
  assert.equal(validateFinaleCoastedWheelContactLine(tour,{},line),true);
  assert.ok(line.contact.bunchEdgeM>259400&&
    line.contact.bunchEdgeM<259500);
  assert.ok(Math.abs(line.contact.frontWheelM-
    line.contact.bunchWheelM-2.5)<1e-8);
  assert.equal(line.at500.slots.length,130);
  assert.equal(line.isolated.length,30);
  assert.equal(line.finishers.length,160);
  assert.equal(new Set(line.finishers.map(row=>row.riderId)).size,160);
  assert.equal(line.runner.finishers.length,130);
  assert.ok(line.runner.frames.flatMap(frame=>frame.riders)
    .some(row=>row.laneBlocks?.length));
  assert.ok(Math.min(...line.isolated.map(row=>
    row.elapsedSecondsFromLastKmStart))>
    Math.max(...line.runner.finishers.map(row=>
      row.elapsedSecondsFromLastKmStart)));
  for(const lane of Array.from({length:8},(_,index)=>
    line.at500.slots.filter(row=>row.lane===index).sort((a,b)=>
      a.row-b.row)))
    for(let i=1;i<lane.length;i++)
      assert.ok(lane[i-1].positionM-lane[i].positionM>=2.5-1e-7);
  const own=line.finishers.find(row=>row.riderId==='you-7');
  const replay=line.runner.frames.flatMap(frame=>frame.riders)
    .find(row=>row.riderId===own.riderId&&
      row.elapsedToLineSeconds!==null);
  assert.equal(replay.elapsedToLineSeconds,
    own.elapsedSecondsFromLastKmStart);
  assert.equal(line.lineOrder[0].riderId,'you-7');
  assert.equal(line.lineOrder[0].position,1);
  assert.ok(line.lineOrder.some(row=>row.position===null));
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(line.canCommitAwards,false);
  assert.equal(line.classifiedResults,null);
});

test('a changed rival nomination changes its paid sprint without rewriting contact',()=>{
  const baseline=recordFinaleCoastedWheelContactLine(tour);
  const plans=tour.committedInputs.teams.map(team=>({
    teamId:team.id,
    finisherId:team.id==='rival-13'?'rival-13-1':
      team.orders.captainId,
    leadOutRiderId:null}));
  const changed=recordFinaleCoastedWheelContactLine(tour,{plans});
  assert.equal(changed.contact.bunchEdgeM,
    baseline.contact.bunchEdgeM);
  assert.deepEqual(changed.at500.slots,baseline.at500.slots);
  assert.notEqual(changed.finishers.find(row=>
    row.riderId==='rival-13-1').energyAtLine,
  baseline.finishers.find(row=>
    row.riderId==='rival-13-1').energyAtLine);
  assert.notEqual(changed.finishers.find(row=>
    row.riderId==='rival-13-7').elapsedSecondsFromLastKmStart,
  baseline.finishers.find(row=>
    row.riderId==='rival-13-7').elapsedSecondsFromLastKmStart);
  assert.equal(validateFinaleCoastedWheelContactLine(tour,
    {plans},changed),true);
  assert.throws(()=>validateFinaleCoastedWheelContactLine(tour,
    {plans},{...changed,canCommitAwards:true}),
  /differs from the locked race/);
});

test('a nominated lead-out completes the shared road and pays for its work',()=>{
  const plans=tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-0':null}));
  const input={plans,pointContext:{tier:3,divisionCount:4,
    divisionIndex:2}};
  const race=createV93PlayableTest(settings,input);
  assert.equal(race.version,V93_WHEEL_CONTACT_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  const helperWork=summary.leadOutWork.filter(row=>
    row.riderId==='you-0');
  assert.ok(helperWork.length>0&&helperWork.every(row=>
    row.energySpent>0));
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.bandReplays.length,31);
  const helper=summary.lineTimes.find(row=>row.riderId==='you-0');
  const last=summary.bandReplays.find(row=>row.id==='peloton')
    .frames.flatMap(frame=>frame.riders).find(row=>
      row.riderId==='you-0'&&row.elapsedToLineSeconds!==null);
  assert.equal(last.elapsedToLineSeconds,
    helper.elapsedSecondsFromLastKmStart);
  assert.equal(last.energyAfter,helper.energyAtLine);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.canCommitAwards,false);
});

test('the complete Motor Lab path shows the same road, finish and replays',()=>{
  const input={pointContext:{tier:3,divisionCount:4,
    divisionIndex:2}};
  const race=createV93PlayableTest(settings,input);
  assert.equal(race.version,V93_WHEEL_CONTACT_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.bandReplays.length,31);
  assert.equal(summary.lastKmRoad.length,8);
  assert.deepEqual(summary.lastKmRoad.map(frame=>frame.distanceM),
    [259250,summary.sharedWheelContact.atDistanceM,259500,
      259600,259700,259800,259900,260000]);
  assert.equal(summary.lastKmRoad[0].groups.length,1);
  assert.ok(summary.lastKmRoad.slice(1).every(frame=>
    frame.groups.length===0&&frame.droppedPassages.length===30&&
    frame.ownRiderEnergy.length===8));
  assert.equal(summary.sharedWheelContact.wheelPairs.length,5);
  assert.equal(summary.roadPlaceBounds.riders.length,160);
  assert.equal(summary.roadPlaceBounds.riders[0].riderId,'you-7');
  assert.equal(summary.roadPlaceBounds.riders[0].position,1);
  assert.equal(summary.provisionalLineOrder,null);
  const own=summary.lineTimes.find(row=>row.riderId==='you-7');
  const ownReplay=summary.bandReplays.find(band=>
    band.id==='peloton').frames.flatMap(frame=>frame.riders)
    .find(row=>row.riderId===own.riderId&&
      row.elapsedToLineSeconds!==null);
  assert.equal(ownReplay.elapsedToLineSeconds,
    own.elapsedSecondsFromLastKmStart);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.classifiedResults,null);
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
});
