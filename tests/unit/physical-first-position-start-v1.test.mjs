import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhysicalFirstPositionStartV1,
  replayPhysicalFirstPositionStartV1,
  PHYSICAL_FIRST_POSITION_START_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRoadV1,
  replayPhysicalFirstPositionRoadV1} from
  '../../lib/engine/v2/physical-first-position-road-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {recordPhysicalFirstPositionTraceV1,
  replayPhysicalFirstPositionTraceV1} from
  '../../lib/engine/v2/physical-first-position-trace-v1.mjs';
import {recordPhysicalFirstRaceV1} from
  '../../lib/engine/v2/physical-first-race-record-v1.mjs';

const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};
const rider=id=>({id,flat:65,hills:65,mountain:65,
  sprint:65,endurance:65,form:50,fatigue:0});
function input(teamCount=2,raceSeed='position-seed-a'){
  const teams=Array.from({length:teamCount},(_,teamIndex)=>{
    const id=`team-${teamIndex}`;
    const riders=Array.from({length:8},(_,index)=>
      rider(`${id}-${index+1}`));
    return {id,riders,orders:{captainId:riders[6].id,
      helperIds:riders.filter((_,index)=>index!==6)
        .map(row=>row.id),
      baseline:{effort:'steady',chase:'selective',
        attack:'none',frontWork:teamIndex===0?'rotate':'sit_in',
        frontWorkRiderId:teamIndex===0?riders[1].id:null},
      phases:[]}};
  });
  const ids=teams.flatMap(team=>team.riders.map(row=>row.id));
  return {raceSeed,
    positionModelVersion:PHYSICAL_FIRST_POSITION_START_VERSION,
    start:{sourceKm:0,roads:[{roadId:'peloton',
      riderIds:ids,clockSeconds:0}],
    riders:teams.flatMap(team=>team.riders.map(row=>({
      riderId:row.id,teamId:team.id,roadId:'peloton',
      distanceM:0,clockSeconds:0,reserve:80,quietKm:0})))},
    kilometres:[{km:1,terrain:'flat',gradientPct:0,
      surface:'road',exposed:false,
      weather:{temperatureC:16,windKph:0,rainMm:0}}],
    teams,stakes:teams.map(team=>({teamId:team.id,
      sportingGoal:'sprint_finish',
      sportingCaptainId:team.orders.captainId}))};
}

function cappedInput(kmCount){
  const committed=input();
  committed.kilometres=Array.from({length:kmCount},
    (_,index)=>({...committed.kilometres[0],km:index+1}));
  for(const state of committed.start.riders){
    const source=committed.teams.find(team=>
      team.id===state.teamId).riders.find(row=>
      row.id===state.riderId);
    state.reserve=replayRearEnergyCapV1({rider:source,
      kilometres:committed.kilometres,
      throughKm:0}).initialCap;
  }
  return committed;
}

test('committed first leader and positioning contest form a replayable start',()=>{
  const committed=input();
  const start=createPhysicalFirstPositionStartV1({input:committed,grid});
  assert.equal(start.version,PHYSICAL_FIRST_POSITION_START_VERSION);
  assert.equal(start.positions.length,16);
  assert.equal(start.firstLeaderPlan.leaderRiderId,'team-0-2');
  assert.equal(start.positions[0].riderId,'team-0-2');
  assert.equal(start.positions[0].distanceM,0);
  assert.equal(new Set(start.positions.map(row=>
    `${row.lane}:${row.row}`)).size,16);
  assert.ok(start.positions.every(row=>row.distanceM<=0));
  assert.equal(start.legacyGroupClockPositionsUsed,false);
  assert.equal(start.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionStartV1(
    committed,grid,start),start);
  const changed=structuredClone(start);
  changed.positions[1].row=99;
  assert.throws(()=>replayPhysicalFirstPositionStartV1(
    committed,grid,changed),/differs from committed inputs/);
  const other=createPhysicalFirstPositionStartV1({
    input:input(2,'position-seed-b'),grid});
  assert.notEqual(other.inputHash,start.inputHash);
  assert.notEqual(other.positions[1].seededTie,
    start.positions[1].seededTie);
  const reorderedGrid={laneStaggerM:.08,
    wheelSpacingM:2.5,laneCount:4};
  assert.equal(createPhysicalFirstPositionStartV1({
    input:committed,grid:reorderedGrid}).inputHash,start.inputHash);
});

test('complete 160-rider field has unique model positions',()=>{
  const start=createPhysicalFirstPositionStartV1({
    input:input(20),grid});
  assert.equal(start.positions.length,160);
  assert.equal(new Set(start.positions.map(row=>
    `${row.lane}:${row.row}`)).size,160);
  assert.equal(start.positions.at(-1).row,39);
});

test('unchanged paid road moves every rider and energy on the same clock',()=>{
  const committed=input();
  committed.kilometres.push({...committed.kilometres[0],km:2});
  const race=runPhysicalFirstWholeRaceProbeV1(committed);
  const start=createPhysicalFirstPositionStartV1({
    input:committed,grid});
  const first=advancePhysicalFirstPositionRoadV1(
    start,race.steps[0]);
  const second=advancePhysicalFirstPositionRoadV1(
    first,race.steps[1]);
  assert.equal(second.sourceKm,2);
  assert.equal(second.frontDistanceM,2000);
  assert.equal(second.clockSeconds,race.states[2].frontClockSeconds);
  assert.equal(second.positions[0].distanceM,2000);
  assert.ok(second.positions.slice(1).every(row=>
    row.distanceM<2000&&row.paidDistanceM===2000));
  assert.deepEqual(first.checkpointCrossings.map(row=>row.riderId),
    [start.positions[0].riderId]);
  const firstLine=second.checkpointCrossings.filter(row=>row.km===1);
  assert.equal(firstLine.length,15);
  assert.equal(second.checkpointCrossings.filter(row=>
    row.km===2).length,1);
  assert.deepEqual(firstLine.map(row=>row.riderId),
    start.positions.slice(1).map(row=>row.riderId));
  assert.ok(firstLine.every(row=>row.clockSeconds>
    first.clockSeconds&&row.clockSeconds<second.clockSeconds));
  assert.equal(new Set(firstLine.map(row=>
    row.clockSeconds)).size,firstLine.length);
  assert.deepEqual(replayPhysicalFirstPositionRoadV1(
    first,race.steps[1],second),second);
  const forged=structuredClone(second);
  forged.positions[1].distanceM+=2.5;
  assert.throws(()=>replayPhysicalFirstPositionRoadV1(
    first,race.steps[1],forged),/differs from paid rider movement/);
  const rotating=structuredClone(race.steps[1]);
  rotating.peloton.road.leaderRiderId=
    rotating.peloton.road.riderIds.find(id=>
      id!==rotating.peloton.road.leaderRiderId);
  assert.throws(()=>advancePhysicalFirstPositionRoadV1(
    first,rotating),/unchanged paid leader and road/);
});

test('start refuses an uncommitted grid or changed rider roster',()=>{
  const historic=input();
  delete historic.positionModelVersion;
  assert.throws(()=>createPhysicalFirstPositionStartV1({
    input:historic,grid}),/committed field and grid/);
  assert.throws(()=>createPhysicalFirstPositionStartV1({
    input:input(),grid:{...grid,laneCount:1}}),
  /committed field and grid/);
  const altered=input();
  altered.start.roads[0].riderIds.pop();
  assert.throws(()=>createPhysicalFirstPositionStartV1({
    input:altered,grid}),/committed field and grid/);
});

test('position trace reports paid coverage and missing finish crossings',()=>{
  const committed=cappedInput(3);
  const trace=recordPhysicalFirstPositionTraceV1(committed,grid);
  assert.equal(trace.raceValidatedKm,3);
  assert.equal(trace.completedThroughKm,3);
  assert.equal(trace.validatedPositionRiderKm,48);
  assert.equal(trace.unsupported,null);
  assert.equal(trace.finishCrossingCoverage,'1/16');
  assert.equal(trace.checkpointCrossings.filter(row=>
    row.km===1).length,16);
  assert.equal(trace.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionTraceV1(
    committed,grid,trace,{recording:
      recordPhysicalFirstRaceV1(committed).recording}),trace);
  const forged=structuredClone(trace);
  forged.finishCrossings[0].clockSeconds+=1;
  assert.throws(()=>replayPhysicalFirstPositionTraceV1(
    committed,grid,forged),/differs from committed paid race/);
});

test('position trace stops at a leader change without paid passing',()=>{
  const committed=cappedInput(3);
  committed.teams[1].orders.baseline.frontWork='rotate';
  committed.teams[1].orders.baseline.frontWorkRiderId=
    committed.teams[1].riders[1].id;
  const trace=recordPhysicalFirstPositionTraceV1(committed,grid);
  assert.equal(trace.raceValidatedKm,3);
  assert.equal(trace.completedThroughKm,1);
  assert.equal(trace.unsupported.sourceKm,2);
  assert.match(trace.unsupported.reason,/unchanged paid leader/);
  assert.equal(trace.validatedPositionRiderKm,16);
  assert.equal(trace.officialResults,false);
});
