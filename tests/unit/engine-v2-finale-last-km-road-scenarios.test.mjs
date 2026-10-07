import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {probeLastKmNamedAttackRoadFromTour,
  validateLastKmNamedAttackRoadFromTour} from
  '../../lib/engine/v2/finale-last-km-named-attack.mjs';
import {lastKmLineStateFromTour,validateLastKmLineStateFromTour} from
  '../../lib/engine/v2/finale-last-km-line-state.mjs';
import {probeLastKmFinishOrderBoundsFromTour,
  validateLastKmFinishOrderBoundsFromTour} from
  '../../lib/engine/v2/finale-finish-order-bounds.mjs';
import {recordFinaleSprintPlanFromTour,
  validateFinaleSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {recordFinaleSprintApproachFromTour,
  validateFinaleSprintApproachFromTour} from
  '../../lib/engine/v2/finale-sprint-approach.mjs';
import {recordFinaleSprintLaunchFromTour,
  validateFinaleSprintLaunchFromTour,
  FINALE_SPRINT_LAUNCH_FATIGUE_VERSION} from
  '../../lib/engine/v2/finale-sprint-launch.mjs';
import {recordFinaleSprintRunFromTour,
  validateFinaleSprintRunFromTour,
  FINALE_SPRINT_RUN_FATIGUE_VERSION} from
  '../../lib/engine/v2/finale-sprint-run.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
    {km:39,kind:'SPRINT'}]};
function team(id,skill,gender,chase,attack){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:50,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'conserve',chase,attack:'none',
      breakWork:'cooperate'},phases:attack?[{atKm:39,
      attack:'selective',attackRiderId:`${id}-0`}]:[]}};
}
const recordingHash=recording=>createHash('sha256').update(
  JSON.stringify(recording)).digest('hex');

test('independent v91 managers reach the line with recorded solo and catch branches',()=>{
  for(const gender of ['M','F'])for(const scenario of [
    {attacker:90,defender:60,chase:'ignore',survives:true},
    {attacker:60,defender:80,chase:'all',survives:false},
  ]){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',scenario.attacker,gender,'ignore',true),
      team('b',scenario.defender,gender,scenario.chase,false)],
    seed:`last-km-road-${gender}-${scenario.attacker}-${scenario.defender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const trace=probeLastKmNamedAttackRoadFromTour(tour,{teamId:'a'});
    assert.equal(trace.frames.length,7);
    assert.equal(trace.frames[0].attack.status,'split');
    assert.equal(trace.lineRoadGroups.length,Number(scenario.survives));
    assert.equal(trace.linePelotonRiderIds.length,
      scenario.survives?15:16);
    assert.equal(trace.lineRiderEnergy.length,16);
    assert.equal(trace.frames.at(-1).endDistanceM,40000);
    assert.equal(validateLastKmNamedAttackRoadFromTour(tour,
      {teamId:'a'},trace),true);
    const line=lastKmLineStateFromTour(tour,{teamId:'a'});
    assert.equal(line.version,'v2-finale-last-km-line-state-1');
    assert.equal(line.roadTraceVersion,trace.version);
    assert.equal(line.lineDistanceM,40000);
    assert.ok(line.bunchTravelSeconds>0);
    assert.equal(line.riders.length,16);
    assert.equal(line.roadGroups.length,Number(scenario.survives));
    assert.equal(new Set(line.riders.map(row=>row.riderId)).size,16);
    assert.deepEqual(line.riders.map(row=>row.energyAtLine).sort((a,b)=>a-b),
      trace.lineRiderEnergy.map(row=>row.energyAfter).sort((a,b)=>a-b));
    const attacker=line.riders.find(row=>row.riderId==='a-0');
    assert.equal(Boolean(attacker.roadGroupId),scenario.survives);
    assert.equal(attacker.roadBandGapAheadOfBunchSeconds>0,
      scenario.survives);
    assert.equal(validateLastKmLineStateFromTour(tour,
      {teamId:'a'},line),true);
    const bounds=probeLastKmFinishOrderBoundsFromTour(tour,
      {teamId:'a'});
    assert.equal(bounds.lineDistanceM,40000);
    assert.equal(bounds.riders.length,16);
    assert.deepEqual(bounds.bands.map(band=>
      [band.firstPossiblePlace,band.lastPossiblePlace]),
    scenario.survives?[[1,1],[2,16]]:[[1,16]]);
    assert.equal(bounds.riders.find(row=>row.riderId==='a-0')
      .lastPossiblePlace,scenario.survives?1:16);
    assert.equal(validateLastKmFinishOrderBoundsFromTour(tour,
      {teamId:'a'},bounds),true);
    assert.throws(()=>validateLastKmFinishOrderBoundsFromTour(tour,
      {teamId:'a'},{...bounds,bands:bounds.bands.map(band=>
        ({...band,lastPossiblePlace:1}))}),/do not replay/);
    assert.throws(()=>validateLastKmLineStateFromTour(tour,
      {teamId:'a'},{...line,bunchTravelSeconds:0}),/does not replay/);
    if(scenario.chase==='all'){
      assert.ok(trace.frames.some(frame=>frame.chaseRiderId==='b-2'));
      assert.ok(trace.frames.some(frame=>frame.riderEnergy.some(row=>
        row.riderId==='b-2'&&row.role==='pull'&&row.energySpent>0)));
    }
  }
});

test('a valid rotating rival is not silently turned into passive finale travel',()=>{
  const attacker=team('a',60,'M','ignore',true);
  const rival=team('b',80,'M','ignore',false);
  rival.orders.helperIds=['b-2','b-3'];
  rival.orders.baseline.frontWork='rotate';
  const tour=simulateTacticalTour({stage,teams:[attacker,rival],
    seed:'frontwork-boundary',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.deepEqual(tour.frames.at(-2).paidBunchPace.riderIds,
    ['b-2','b-3']);
  assert.deepEqual(tour.frames.at(-1).paidBunchPace.riderIds,
    ['b-2','b-3']);
  assert.throws(()=>probeLastKmNamedAttackRoadFromTour(tour,
    {teamId:'a'}),/needs recorded GC or front work/);
});

test('nominated lead-outs pay for each 100 m approach slice',()=>{
  const caught=simulateTacticalTour({stage,teams:[
    team('a',60,'M','ignore',true),team('b',80,'M','all',false)],
  seed:'paid-sprint-approach',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',plans:[
    {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
    {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
  const paid=recordFinaleSprintApproachFromTour(caught,input);
  const passive=recordFinaleSprintApproachFromTour(caught,{
    ...input,plans:input.plans.map(row=>({...row,leadOutRiderId:null}))});
  assert.equal(paid.frames.length,2);
  assert.equal(paid.startDistanceM,39500);
  assert.equal(paid.endDistanceM,39700);
  assert.ok(paid.frames.every(frame=>frame.paceSource==='passive_bunch'&&
    frame.riderEnergy.length===16));
  for(const helper of ['a-2','b-2']){
    assert.ok(paid.frames.every(frame=>frame.riderEnergy.find(row=>
      row.riderId===helper).role==='lead_out'));
    assert.ok(paid.energyAt300M.find(row=>row.riderId===helper).energy<
      passive.energyAt300M.find(row=>row.riderId===helper).energy);
  }
  assert.equal(validateFinaleSprintApproachFromTour(caught,input,paid),true);
  assert.throws(()=>validateFinaleSprintApproachFromTour(caught,input,{
    ...paid,frames:[{...paid.frames[0],bunchElapsedSeconds:0},
      paid.frames[1]]}),/does not replay/);
  const solo=simulateTacticalTour({stage,teams:[
    team('a',90,'M','ignore',true),team('b',60,'M','all',false)],
  seed:'solo-sprint-approach',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.throws(()=>recordFinaleSprintApproachFromTour(solo,{
    ...input,plans:[{...input.plans[0],leadOutRiderId:null},
      input.plans[1]]}),/reunited complete bunch/);
});

test('first 100 m sprint launch costs finishers and earns only faster movement',()=>{
  const a=team('a',60,'M','ignore',true);
  const b=team('b',80,'M','all',false);
  a.riders[0].sprint=100;
  b.riders[0].sprint=20;
  const tour=simulateTacticalTour({stage,teams:[a,b],
    seed:'paid-sprint-approach',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',plans:[
    {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
    {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
  const launch=recordFinaleSprintLaunchFromTour(tour,input);
  assert.equal(launch.startDistanceM,39700);
  assert.equal(launch.endDistanceM,39800);
  assert.equal(launch.riderEnergy.length,16);
  assert.equal(launch.riderEnergy.filter(row=>row.role==='sprint').length,2);
  const fast=launch.riderEnergy.find(row=>row.riderId==='a-0');
  const slow=launch.riderEnergy.find(row=>row.riderId==='b-0');
  assert.ok(fast.gainSeconds>0);
  assert.equal(slow.gainSeconds,0);
  assert.ok(fast.energySpent>0&&slow.energySpent>0);
  assert.ok(launch.riderEnergy.every(row=>row.energyAfter<
    row.energyAtDecision&&row.movementSeconds>0));
  assert.ok(launch.riderEnergy.filter(row=>row.role==='sheltered').every(
    row=>row.gainSeconds===0));
  assert.equal(validateFinaleSprintLaunchFromTour(tour,input,launch),true);
  assert.throws(()=>validateFinaleSprintLaunchFromTour(tour,input,{
    ...launch,riderEnergy:launch.riderEnergy.map(row=>row.riderId==='a-0'?
      {...row,gainSeconds:0}:row)}),/does not replay/);
});

test('opt-in sprint launch caps effort from a tired recorded 300 km source',()=>{
  const longStage={distance_km:300,
    profile_points:[[0,100],[300,100]],
    keypoints:[{km:299,kind:'SPRINT'}]};
  const a=team('a',60,'M','ignore',true);
  const b=team('b',95,'M','all',false);
  a.orders.phases=[{atKm:299,attack:'selective',
    attackRiderId:'a-0'}];
  b.orders.baseline.effort='steady';
  b.riders[0].fatigue=100;
  b.riders[0].sprint=100;
  const tour=simulateTacticalTour({stage:longStage,teams:[a,b],
    seed:'low-energy-finish',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',plans:[
    {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
    {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
  const original=recordFinaleSprintLaunchFromTour(tour,input);
  const bounded=recordFinaleSprintLaunchFromTour(tour,input,{
    version:FINALE_SPRINT_LAUNCH_FATIGUE_VERSION});
  assert.equal(recordingHash(original),
    'd6eb2561defd8b0699fc9fe93acd3de5df65de7c0b0f8d63729ddf74c83fba6b');
  assert.equal(recordingHash(bounded),
    '5b78150d65f2d9512037a07a6eab3c56633b07359bda96e655f4904d5180d991');
  const tired=bounded.riderEnergy.find(row=>row.riderId==='b-0');
  const fresh=bounded.riderEnergy.find(row=>row.riderId==='a-0');
  assert.ok(tired.energyAtDecision<30&&tired.energyAtDecision>0);
  assert.ok(tired.effortAbilityPoints>0&&tired.effortAbilityPoints<8);
  assert.equal(fresh.effortAbilityPoints,8);
  assert.ok(tired.attemptedMovementSeconds>0);
  assert.ok(!Object.hasOwn(original.riderEnergy.find(row=>
    row.riderId==='b-0'),'effortAbilityPoints'));
  assert.equal(validateFinaleSprintLaunchFromTour(tour,input,original),true);
  assert.equal(validateFinaleSprintLaunchFromTour(tour,input,bounded),true);
  assert.throws(()=>validateFinaleSprintLaunchFromTour(tour,input,{
    ...bounded,riderEnergy:bounded.riderEnergy.map(row=>
      row.riderId==='b-0'?{...row,effortAbilityPoints:8}:row)}),
  /does not replay/);
  assert.throws(()=>recordFinaleSprintRunFromTour(tour,input),
    /cannot pay/);
  const run=recordFinaleSprintRunFromTour(tour,input,{
    version:FINALE_SPRINT_RUN_FATIGUE_VERSION});
  assert.equal(recordingHash(run),
    '09706bb19dddfc4267ed45314f143a891ad01a6f902a78a1057271e9b214afd0');
  assert.equal(run.sourceLaunchVersion,
    FINALE_SPRINT_LAUNCH_FATIGUE_VERSION);
  assert.equal(run.endDistanceM,300000);
  assert.equal(run.lineRiderEnergy.length,16);
  assert.equal(run.frames.at(-1).riderEnergy.find(row=>
    row.riderId==='b-0').role,'exhausted_sprint');
  assert.equal(run.lineRiderEnergy.find(row=>
    row.riderId==='b-0').gainSeconds,0);
  assert.equal(validateFinaleSprintRunFromTour(tour,input,run),true);
  assert.throws(()=>validateFinaleSprintRunFromTour(tour,input,{
    ...run,frames:run.frames.map((frame,index)=>index===1?{
      ...frame,riderEnergy:frame.riderEnergy.map(row=>
        row.riderId==='b-0'?{...row,energySpent:0}:row)}:frame)}),
  /does not replay/);
});

test('an exhausted finisher with a timing gain cannot become an invented road group',()=>{
  const longStage={distance_km:300,
    profile_points:[[0,100],[300,100]],
    keypoints:[{km:299,kind:'SPRINT'}]};
  const a=team('a',40,'M','ignore',true);
  const b=team('b',60,'M','all',false);
  a.orders.phases=[{atKm:299,attack:'selective',
    attackRiderId:'a-0'}];
  b.orders.baseline.effort='steady';
  Object.assign(b.riders[0],{flat:100,strength:100,
    timetrial:100,sprint:100,acceleration:100,fatigue:100});
  const tour=simulateTacticalTour({stage:longStage,teams:[a,b],
    seed:'low-energy-finish',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',plans:[
    {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
    {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
  const launch=recordFinaleSprintLaunchFromTour(tour,input,{
    version:FINALE_SPRINT_LAUNCH_FATIGUE_VERSION});
  const leader=launch.riderEnergy.find(row=>row.riderId==='b-0');
  assert.ok(leader.gainSeconds>0);
  assert.ok(leader.energyAtDecision<30);
  assert.throws(()=>recordFinaleSprintRunFromTour(tour,input,{
    version:FINALE_SPRINT_RUN_FATIGUE_VERSION}),
  /leading sprint rider needs an exposed coast rule/);
});

test('route and category change the sprint handoff without moving separated helpers',()=>{
  const routes={
    flat:[[0,100],[40,100]],
    uphill:[[0,100],[39,100],[40,150]],
    rolling:[[0,100],[30,100],[35,175],[40,100]],
    downhill:[[0,150],[39,150],[40,100]],
  };
  for(const [route,profile_points] of Object.entries(routes))
    for(const gender of ['M','F']){
      const routeStage={...stage,profile_points};
      const a=team('a',60,gender,'ignore',true);
      const b=team('b',80,gender,'all',false);
      for(const rider of [...a.riders,...b.riders]){
        rider.hills=rider.flat;
        rider.mountain=rider.flat;
      }
      a.riders[0].sprint=90;
      b.riders[0].sprint=90;
      const tour=simulateTacticalTour({stage:routeStage,teams:[a,b],
        seed:`route-${route}-${gender}`,
        motorVersion:MOTOR_ATTACK_TRACE_VERSION});
      const input={attackTeamId:'a',plans:[
        {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
        {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
      if(route==='downhill'){
        assert.throws(()=>recordFinaleSprintRunFromTour(tour,input,{
          version:FINALE_SPRINT_RUN_FATIGUE_VERSION}),
        /nominated lead-out cannot work beside/);
        continue;
      }
      const run=recordFinaleSprintRunFromTour(tour,input,{
        version:FINALE_SPRINT_RUN_FATIGUE_VERSION});
      assert.equal(run.lineRiderEnergy.length,16);
      assert.equal(run.endDistanceM,40000);
      assert.equal(validateFinaleSprintRunFromTour(tour,input,run),true);
    }
});

test('sprint continuation carries earned time and pays through the line',()=>{
  const a=team('a',60,'F','ignore',true);
  const b=team('b',80,'F','all',false);
  a.riders[0].sprint=100;
  b.riders[0].sprint=20;
  const tour=simulateTacticalTour({stage,teams:[a,b],
    seed:'paid-sprint-approach',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const input={attackTeamId:'a',plans:[
    {teamId:'a',finisherId:'a-0',leadOutRiderId:'a-2'},
    {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
  const run=recordFinaleSprintRunFromTour(tour,input);
  assert.equal(recordingHash(run),
    'de68e8d41c1d5c9e0e88cdfe9014f3b185b0c90e867fdaa4903875c7e1b51164');
  assert.equal(run.version,'v2-finale-sprint-run-1');
  assert.equal(run.startDistanceM,39700);
  assert.equal(run.endDistanceM,40000);
  assert.deepEqual(run.frames.map(frame=>frame.endDistanceM),[39900,40000]);
  assert.equal(run.lineRiderEnergy.length,16);
  assert.ok(run.frames.every(frame=>frame.riderEnergy.length===16));
  const first=run.launch.riderEnergy.find(row=>row.riderId==='a-0');
  const fast=run.lineRiderEnergy.find(row=>row.riderId==='a-0');
  const slow=run.lineRiderEnergy.find(row=>row.riderId==='b-0');
  assert.ok(fast.gainSeconds>first.gainSeconds);
  assert.ok(fast.energyAfter<first.energyAfter);
  assert.equal(slow.gainSeconds,0);
  assert.ok(slow.energyAfter<run.launch.riderEnergy.find(row=>
    row.riderId==='b-0').energyAfter);
  assert.ok(run.lineRiderEnergy.filter(row=>row.riderId!=='a-0').every(
    row=>row.gainSeconds===0));
  assert.equal(validateFinaleSprintRunFromTour(tour,input,run),true);
  assert.throws(()=>validateFinaleSprintRunFromTour(tour,input,{
    ...run,lineRiderEnergy:run.lineRiderEnergy.map(row=>
      row.riderId==='a-0'?{...row,gainSeconds:0}:row)}),
  /does not replay/);
});

test('500 m sprint nominations respect locked helpers and actual road contact',()=>{
  for(const {attackerSkill,defenderSkill} of [
    {attackerSkill:90,defenderSkill:60},
    {attackerSkill:60,defenderSkill:80},
  ]){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',attackerSkill,'M','ignore',true),
      team('b',defenderSkill,'M','all',false)],
    seed:`sprint-lock-${attackerSkill}-${defenderSkill}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const input={attackTeamId:'a',plans:[
      {teamId:'a',finisherId:'a-0',leadOutRiderId:null},
      {teamId:'b',finisherId:'b-0',leadOutRiderId:'b-2'}]};
    const recorded=recordFinaleSprintPlanFromTour(tour,input);
    assert.equal(recorded.decisionDistanceM,39500);
    assert.equal(recorded.decisions.length,2);
    assert.equal(recorded.decisions[1].leadOutRiderId,'b-2');
    assert.ok(recorded.decisions[1].leadOutWorkCostPerKm>0);
    assert.equal(recorded.decisions[0].roadGroupId==='peloton',
      attackerSkill===60);
    assert.equal(validateFinaleSprintPlanFromTour(tour,input,recorded),true);
    assert.throws(()=>validateFinaleSprintPlanFromTour(tour,input,{
      ...recorded,decisionDistanceM:39000}),/does not replay/);
    assert.throws(()=>recordFinaleSprintPlanFromTour(tour,{
      ...input,plans:input.plans.slice(0,1)}),/Every locked team/);
    assert.throws(()=>recordFinaleSprintPlanFromTour(tour,{
      ...input,plans:[input.plans[0],{...input.plans[1],
        leadOutRiderId:'b-1'}]}),/distinct locked team riders/);
    if(recorded.decisions[0].roadGroupId!=='peloton')
      assert.throws(()=>recordFinaleSprintPlanFromTour(tour,{
        ...input,plans:[{...input.plans[0],leadOutRiderId:'a-2'},
          input.plans[1]]}),/cannot work beside/);
  }
});
