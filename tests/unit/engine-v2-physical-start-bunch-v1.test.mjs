import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {commitTeamChaseStakesV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1,advancePhysicalStartBunchV1,
  validatePhysicalStartBunchV1,runPhysicalBunchV1,
  validatePhysicalBunchRunV1} from
  '../../lib/engine/v2/physical-start-bunch-v1.mjs';

const route=(terrain='flat')=>Array.from({length:20},(_,index)=>({
  km:index+1,terrain,gradientPct:terrain==='climb'?6:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=(fatigue=20)=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>[skill,70]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>
    [rider.id,100-fatigue*.4])),orders:{
    captainId:riders[0].id,helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},phases:[]}};
});
const source=(teams=field(),routeKilometres=route())=>{
  const commitment=commitTeamChaseStakesV1({teams,distanceKm:20,
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,
    raceSeed:'physical-start-1'};
  const start=startPhysicalBunchV1(startInput);
  return {startInput,start,segment:routeKilometres[0]};
};

test('start line pays one named leader and all 23 sheltered riders',()=>{
  const input=source();
  const road=advancePhysicalStartBunchV1(input);
  assert.equal(road.leaderRiderId,'control-2');
  assert.equal(road.riderDecisions.length,24);
  assert.equal(road.riders.length,24);
  assert.equal(road.physicalGroup.riderIds.length,24);
  assert.equal(road.riders.filter(row=>row.role==='leader').length,1);
  assert.equal(road.riderDecisions.filter(row=>
    row.choice==='pull').length,1);
  assert.ok(road.riders.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.ok(road.riders.find(row=>row.riderId==='control-2')
    .energySpent>road.riders.find(row=>row.riderId==='sprint-2')
      .energySpent);
  assert.equal(road.riderDecisions.find(row=>
    row.riderId==='sprint-0').goal,'sprint_finish');
  assert.equal(road.endDistanceM,1000);
  assert.ok(road.elapsedSeconds>0);
  assert.equal(validatePhysicalStartBunchV1(input,road),true);
  const forged=structuredClone(road);
  forged.riders[0].energySpent=0;
  assert.throws(()=>validatePhysicalStartBunchV1(input,forged),
    /differs/);
});

test('same-seed terrain and fatigue change paid start road',()=>{
  const flat=advancePhysicalStartBunchV1(source());
  const climbing=advancePhysicalStartBunchV1(
    source(field(),route('climb')));
  const tired=advancePhysicalStartBunchV1(
    source(field(70)));
  assert.ok(climbing.riders[0].energySpent>
    flat.riders[0].energySpent);
  assert.ok(tired.riders[0].energyBefore<
    flat.riders[0].energyBefore);
  assert.notEqual(tired.bunchSpeedKph,flat.bunchSpeedKph);
  assert.equal(climbing.riderDecisions.length,24);
  assert.equal(tired.riderDecisions.length,24);
});

test('unsupported orders and physical inability refuse before movement',()=>{
  const input=source();
  const noLeader=structuredClone(input.startInput.teams);
  delete noLeader[0].orders.baseline.frontWork;
  delete noLeader[0].orders.baseline.frontWorkRiderId;
  assert.throws(()=>advancePhysicalStartBunchV1(source(noLeader)),
    /one ordered front worker/);
  const attack=structuredClone(input.startInput.teams);
  attack[1].orders.baseline.attack='opportunistic';
  assert.throws(()=>advancePhysicalStartBunchV1(source(attack)),
    /one ordered front worker/);
  const weak=structuredClone(input.startInput.teams);
  for(const skill of SPORTING_SKILLS)weak[2].riders[3][skill]=10;
  assert.throws(()=>advancePhysicalStartBunchV1(source(weak)),
    /cannot hold paid pace/);
  const forged=structuredClone(input.start);
  forged.energyByRider['control-2']=100;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    start:forged}),/replayed start source/);
  const changedRoute=structuredClone(input.startInput);
  changedRoute.routeKilometres[0].gradientPct=4;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedRoute}),/replayed start source/);
  const changedOrders=structuredClone(input.startInput);
  changedOrders.teams[0].orders.baseline.effort='hard';
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedOrders}),/replayed start source/);
});

test('consecutive paid road rotates named leader and replays every rider',()=>{
  const teams=field();
  teams[0].orders.phases=[{atKm:1,frontWork:'sit_in'},
    {atKm:3,frontWork:'rotate',frontWorkRiderId:'control-3'}];
  teams[1].orders.phases=[{atKm:1,frontWork:'rotate',
    frontWorkRiderId:'sprint-2'},
  {atKm:3,frontWork:'sit_in'}];
  const input=source(teams);
  const road=runPhysicalBunchV1({...input,throughKm:5});
  assert.deepEqual(road.road.map(row=>row.leaderRiderId),
    ['control-2','sprint-2','sprint-2','control-3','control-3']);
  assert.deepEqual(road.road.map(row=>row.sourceKm),[1,2,3,4,5]);
  assert.equal(road.physicalGroup.atDistanceM,5000);
  assert.equal(road.road.reduce((sum,row)=>sum+
    row.riderDecisions.length,0),120);
  assert.ok(road.elapsedSeconds>road.road[0].elapsedSeconds);
  for(let index=1;index<road.road.length;index++)for(const rider of
    road.road[index].riders){
    assert.equal(rider.energyBefore,
      road.road[index-1].energyByRider[rider.riderId]);
  }
  assert.equal(validatePhysicalBunchRunV1({...input,
    throughKm:5},road),true);
  const forged=structuredClone(road);
  forged.road[2].riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalBunchRunV1({...input,
    throughKm:5},forged),/differs/);
});
