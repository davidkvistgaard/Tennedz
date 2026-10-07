import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {probeLastKmNamedAttackRoadFromTour,
  validateLastKmNamedAttackRoadFromTour} from
  '../../lib/engine/v2/finale-last-km-named-attack.mjs';
import {lastKmLineStateFromTour,validateLastKmLineStateFromTour} from
  '../../lib/engine/v2/finale-last-km-line-state.mjs';
import {recordFinaleSprintPlanFromTour,
  validateFinaleSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {recordFinaleSprintApproachFromTour,
  validateFinaleSprintApproachFromTour} from
  '../../lib/engine/v2/finale-sprint-approach.mjs';
import {recordFinaleSprintLaunchFromTour,
  validateFinaleSprintLaunchFromTour} from
  '../../lib/engine/v2/finale-sprint-launch.mjs';

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
    assert.throws(()=>validateLastKmLineStateFromTour(tour,
      {teamId:'a'},{...line,bunchTravelSeconds:0}),/does not replay/);
    if(scenario.chase==='all'){
      assert.ok(trace.frames.some(frame=>frame.chaseRiderId==='b-2'));
      assert.ok(trace.frames.some(frame=>frame.riderEnergy.some(row=>
        row.riderId==='b-2'&&row.role==='pull'&&row.energySpent>0)));
    }
  }
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
