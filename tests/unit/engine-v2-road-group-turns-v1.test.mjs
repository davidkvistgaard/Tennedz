import test from 'node:test';
import assert from 'node:assert/strict';
import {decideRoadGroupWork} from '../../lib/engine/v2/road-groups.mjs';
import {planRoadGroupTurnsV1} from
  '../../lib/engine/v2/road-group-turns-v1.mjs';
import {TUNING} from '../../lib/engine/v2/tuning.mjs';

const segment={km:1,terrain:'flat',gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const team=(id,work='cooperate',energy=100)=>({id,
  riders:[{id,flat:75,endurance:75,strength:75,timetrial:75}],
  energy:{[id]:energy},orders:{baseline:{breakWork:work},phases:[]}});

test('one leader at a time plans turns while a sitter only shelters',()=>{
  const teams=[team('a'),team('b','drive'),team('c','sit_on')];
  const group={id:'road-1',riderIds:['a','b','c'],
    teamIds:['a','b','c'],gapSeconds:20};
  const decisions=decideRoadGroupWork([group],teams,1).riderDecisions;
  const plan=planRoadGroupTurnsV1({group,riderDecisions:decisions,teams,segment});
  assert.equal(plan.status,'worked');
  assert.deepEqual(plan.turns.map(turn=>[turn.leaderRiderId,turn.startM,turn.endM]),
    [['b',0,1000]]);
  assert.deepEqual(plan.extraEnergyCosts.map(row=>row.extraCost),[.04,.18,.04]);
  assert.ok(plan.leadAbility>0);
  const driving=planRoadGroupTurnsV1({group,riderDecisions:decisions,teams,
    segment,driveRiderIds:['b']});
  assert.equal(driving.extraEnergyCosts.find(row=>row.riderId==='b').extraCost,
    .18+TUNING.breakaway.driveExtraCostPerKm);
  assert.equal(driving.leadAbility,
    plan.leadAbility+TUNING.breakaway.driveAbilityBonusPoints);
});

test('two willing riders rotate without adding their instantaneous abilities',()=>{
  const teams=[team('a'),team('b')];
  const group={id:'road-1',riderIds:['a','b'],teamIds:['a','b'],gapSeconds:20};
  const decisions=decideRoadGroupWork([group],teams,1).riderDecisions;
  const plan=planRoadGroupTurnsV1({group,riderDecisions:decisions,teams,segment});
  assert.deepEqual(plan.turns.map(turn=>[turn.startM,turn.endM]),
    [[0,500],[500,1000]]);
  assert.deepEqual(plan.extraEnergyCosts.map(row=>row.extraCost),[.11,.11]);
  assert.equal(plan.leadAbility,plan.turns[0].ability);
  const settled=planRoadGroupTurnsV1({group,riderDecisions:decisions,
    teams,segment,activePullRiderIds:['b']});
  assert.deepEqual(settled.turns.map(turn=>turn.leaderRiderId),['b']);
  assert.deepEqual(settled.extraEnergyCosts.map(row=>row.extraCost),
    [.04,.18]);
  assert.throws(()=>planRoadGroupTurnsV1({group,riderDecisions:decisions,
    teams,segment,activePullRiderIds:['b','b']}),/Active turns/);
  assert.throws(()=>planRoadGroupTurnsV1({group,riderDecisions:decisions,
    teams:[team('a','cooperate',.1),team('b')],segment}),/cannot be paid/);
});

test('a group of sitters cannot receive invented worked pace',()=>{
  const teams=[team('a','sit_on'),team('b','sit_on')];
  const group={id:'road-1',riderIds:['a','b'],teamIds:['a','b'],gapSeconds:20};
  const decisions=decideRoadGroupWork([group],teams,1).riderDecisions;
  const plan=planRoadGroupTurnsV1({group,riderDecisions:decisions,teams,segment});
  assert.equal(plan.status,'unsupported_unworked');
  assert.deepEqual(plan.turns,[]);
  assert.equal(Object.hasOwn(plan,'leadAbility'),false);
});
