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
import {settlePhysicalFirstPositionFinishTailV1,
  replayPhysicalFirstPositionFinishTailV1} from
  '../../lib/engine/v2/physical-first-position-finish-tail-v1.mjs';
import {advancePhysicalFirstPositionRotationKmV1,
  replayPhysicalFirstPositionRotationKmV1} from
  '../../lib/engine/v2/physical-first-position-rotation-km-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  replayPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2,
  replayPhysicalFirstPositionRotationKmV2} from
  '../../lib/engine/v2/physical-first-position-rotation-km-v2.mjs';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {settlePhysicalFirstPositionFinishTailV2,
  replayPhysicalFirstPositionFinishTailV2} from
  '../../lib/engine/v2/physical-first-position-finish-tail-v2.mjs';
import {recordPhysicalFirstPositionRotationRaceV2,
  replayPhysicalFirstPositionRotationRaceV2} from
  '../../lib/engine/v2/physical-first-position-rotation-race-v2.mjs';
import {choosePhysicalFirstBoundaryAttacksV1} from
  '../../lib/engine/v2/physical-first-attack-choice-v1.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1,
  replayPhysicalFirstPositionAttackDepartureKmV1} from
  '../../lib/engine/v2/physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSoloKmV1,
  replayPhysicalFirstPositionSoloKmV1} from
  '../../lib/engine/v2/physical-first-position-solo-km-v1.mjs';
import {recordPhysicalFirstPositionOneAttackRaceV1,
  replayPhysicalFirstPositionOneAttackRaceV1} from
  '../../lib/engine/v2/physical-first-position-one-attack-race-v1.mjs';
import {advancePhysicalFirstPositionRearTailDropKmV1,
  replayPhysicalFirstPositionRearTailDropKmV1} from
  '../../lib/engine/v2/physical-first-position-rear-tail-drop-km-v1.mjs';
import {advancePhysicalFirstPositionFixedLaneConvoyKmV1,
  replayPhysicalFirstPositionFixedLaneConvoyKmV1} from
  '../../lib/engine/v2/physical-first-position-fixed-lane-convoy-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1,
  replayPhysicalFirstPositionFixedLaneFinishV1} from
  '../../lib/engine/v2/physical-first-position-fixed-lane-finish-v1.mjs';
import {recordPhysicalFirstPositionHybridRaceV1,
  replayPhysicalFirstPositionHybridRaceV1} from
  '../../lib/engine/v2/physical-first-position-hybrid-race-v1.mjs';
import {advancePhysicalFirstPositionHybridKmV1,
  replayPhysicalFirstPositionHybridKmV1} from
  '../../lib/engine/v2/physical-first-position-hybrid-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION} from
  '../../lib/engine/v2/physical-first-position-mixed-front-pass-km-v1.mjs';
import {quotePhysicalFirstPositionFrontPassV1} from
  '../../lib/engine/v2/physical-first-position-front-pass-quote-v1.mjs';

const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};

test('opt-in start stages a payable backup on the front edge',()=>{
  const committed=input(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  committed.teams[0].orders.baseline.frontWorkRiderId=null;
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.equal(start.version,
    PHYSICAL_FIRST_POSITION_START_V2_VERSION);
  assert.equal(start.positions.length,16);
  assert.ok(start.stagedBackupRiderId);
  const backup=start.positions.find(row=>row.riderId===
    start.stagedBackupRiderId);
  assert.equal(backup.lane,3);
  assert.equal(backup.row,0);
  assert.ok(start.positions.every(row=>row.lane<4));
  assert.deepEqual(replayPhysicalFirstPositionStartV2(
    committed,grid,start),start);
  const forged=structuredClone(start);
  forged.positions[3].lane=4;
  assert.throws(()=>replayPhysicalFirstPositionStartV2(
    committed,grid,forged),/differs from committed inputs/);
});

test('staged start keeps 160 distinct paid rider slots',()=>{
  const committed=cappedInput(120,20);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  committed.teams[0].orders.baseline.frontWorkRiderId=null;
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.equal(start.positions.length,160);
  assert.equal(new Set(start.positions.map(row=>
    `${row.lane}:${row.row}`)).size,160);
  assert.ok(start.stagedBackupRiderId);
});

test('committed future worker stages near front before its order begins',()=>{
  const committed=cappedInput(30);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  committed.teams[0].orders.phases=[{
    atKm:25,frontWork:'rotate',
    frontWorkRiderId:'team-0-6'}];
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.equal(start.stagedBackupRiderId,
    'team-0-6');
  const worker=start.positions.find(row=>
    row.riderId==='team-0-6');
  assert.equal(worker.lane,3);
  assert.equal(worker.row,0);
  assert.deepEqual(replayPhysicalFirstPositionStartV2(
    committed,grid,start),start);
});

test('staged worker makes a paid front pass in a full 120 km race',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'mountain',chase:'selective',
      attack:'none',seed:'preview-recorded-road-1'});
  const committed={...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
  const request={input:committed,grid};
  const race=recordPhysicalFirstPositionRotationRaceV2(request);
  const state=race.steps.at(-1);
  assert.equal(race.start.stagedBackupRiderId,'you-2');
  const paidPasses=race.steps.filter(step=>
    step.event?.type==='paid_front_pass');
  const firstPass=paidPasses[0]?.event;
  assert.equal(state.sourceKm,120);
  assert.equal(state.positions.length,120);
  assert.equal(race.positionRiderKm,14400);
  assert.equal(paidPasses.length,1);
  assert.equal(firstPass.sourceKm,25);
  assert.equal(firstPass.toRiderId,'you-2');
  assert.ok(firstPass.surgePaidFromReserve>0);
  assert.equal(race.checkpointCrossings.filter(row=>
    row.km===119).length,120);
  assert.equal(state.officialResults,false);
  const passRequest={prior:race.steps[23],
    segment:committed.kilometres[24],input:committed};
  assert.deepEqual(replayPhysicalFirstPositionRotationKmV2(
    passRequest,race.steps[24]),race.steps[24]);
  const finish=race.finish;
  assert.equal(finish.lineCrossingCoverage,'120/120');
  assert.equal(finish.officialResults,false);
  assert.ok(finish.frontWorkerPaidBeyondFinish);
  const tailRequest={input:committed,prior:state};
  assert.deepEqual(settlePhysicalFirstPositionFinishTailV2(
    tailRequest),finish);
  assert.deepEqual(replayPhysicalFirstPositionFinishTailV2(
    tailRequest,finish),finish);
  assert.deepEqual(replayPhysicalFirstPositionRotationRaceV2(
    request,race),race);
  const forged=structuredClone(finish);
  forged.lineCrossings[1].clockSeconds-=1;
  assert.throws(()=>replayPhysicalFirstPositionFinishTailV2(
    tailRequest,forged),/differs from paid movement/);
});

test('hybrid records and replays the same-seed 120 km front rotation',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'mountain',chase:'selective',
      attack:'none',seed:'preview-recorded-road-1'});
  const committed={...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
  const request={input:committed,grid};
  const race=recordPhysicalFirstPositionHybridRaceV1(
    request);
  assert.equal(race.positionRiderKm,14400);
  assert.equal(race.frontPassEvents.length,1);
  assert.equal(race.frontPassEvents[0].sourceKm,25);
  assert.equal(race.finishCrossingCoverage,'120/120');
  assert.equal(race.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionHybridRaceV1(
    request,race),race);
});

test('an attack order cannot create an unpaid positional departure',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'flat',chase:'all',
      attack:'selective',seed:'preview-recorded-road-1'});
  const committed={...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
  assert.throws(()=>recordPhysicalFirstPositionRotationRaceV2({
    input:committed,grid}),
  /lacks paid attack departure at km 20/);
});

test('ordered attacker separates only after paid physical passing',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'flat',chase:'all',
      attack:'selective',seed:'preview-recorded-road-1'});
  const committed={...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
  let state=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.equal(state.stagedAttackRiderId,'you-7');
  for(const segment of committed.kilometres.slice(0,19))
    state=advancePhysicalFirstPositionRotationKmV2({
      prior:state,segment,input:committed});
  const choicePrior={sourceKm:state.sourceKm,
    roads:[{roadId:'peloton',
      riderIds:state.positions.map(row=>row.riderId),
      clockSeconds:state.clockSeconds}],
    riders:state.positions.map(row=>({
      riderId:row.riderId,teamId:row.teamId,
      roadId:'peloton',distanceM:19000,
      clockSeconds:state.clockSeconds,
      reserve:row.energy,quietKm:row.quietKm}))};
  const choice=choosePhysicalFirstBoundaryAttacksV1({
    prior:choicePrior,segment:committed.kilometres[19],
    teams:committed.teams,stakes:committed.stakes,
    kilometres:committed.kilometres})
    .find(row=>row.choice==='attempt_paid_attack');
  const request={prior:state,
    segment:committed.kilometres[19],
    input:committed,choice};
  const departure=advancePhysicalFirstPositionAttackDepartureKmV1(
    request);
  assert.equal(departure.passEvent.type,'paid_attack_pass');
  assert.equal(departure.passEvent.sourceKm,20);
  assert.equal(departure.soloPosition.riderId,'you-7');
  assert.ok(departure.soloPosition.distanceM>
    departure.peloton.frontDistanceM);
  assert.ok(departure.soloDecision.paidFromReserve>
    departure.soloDecision.attackInitiationCost);
  assert.ok(!departure.peloton.positions.some(row=>
    row.riderId==='you-7'));
  assert.ok(departure.soloCheckpointCrossings.some(row=>
    row.km===20));
  assert.deepEqual(replayPhysicalFirstPositionAttackDepartureKmV1(
    request,departure),departure);
  const nextPeloton=advancePhysicalFirstPositionRotationKmV2({
    prior:departure.peloton,
    segment:committed.kilometres[20],
    input:committed});
  assert.equal(nextPeloton.positions.length,119);
  assert.deepEqual(nextPeloton.separateRoadRiderIds,
    ['you-7']);
  const soloRequest={priorSolo:departure.soloPosition,
    priorPeloton:departure.peloton,
    nextPeloton,segment:committed.kilometres[20],
    input:committed};
  const solo=advancePhysicalFirstPositionSoloKmV1(
    soloRequest);
  assert.equal(solo.sourceKm,21);
  assert.ok(solo.position.distanceM>
    nextPeloton.frontDistanceM);
  assert.ok(solo.decision.paidFromReserve>0);
  assert.deepEqual(replayPhysicalFirstPositionSoloKmV1(
    soloRequest,solo),solo);
  const forged=structuredClone(departure);
  forged.soloPosition.distanceM+=10;
  assert.throws(()=>replayPhysicalFirstPositionAttackDepartureKmV1(
    request,forged),/differs from paid movement/);
});

test('one paid solo reaches the line on the shared race clock',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'flat',chase:'all',
      attack:'selective',seed:'preview-recorded-road-1'});
  const request={input:{...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION},
  grid};
  const race=recordPhysicalFirstPositionOneAttackRaceV1(
    request);
  assert.equal(race.completedThroughKm,120);
  assert.equal(race.riderCount,120);
  assert.equal(race.steps.filter(row=>
    row.departure).length,1);
  assert.equal(race.steps[19].departure
    .passEvent.riderId,'you-7');
  assert.equal(race.soloFinish.riderId,'you-7');
  assert.equal(race.soloFinish.sourceKm,118);
  assert.equal(race.finishCrossings.length,120);
  assert.equal(race.finishCrossings[0].riderId,'you-7');
  assert.equal(race.finishCrossings[0].sourceKm,118);
  assert.ok(race.soloFinish.clockSeconds<
    race.tail.frontClockSeconds);
  assert.equal(race.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionOneAttackRaceV1(
    request,race),race);
});

test('the last wheel pays shelter until it physically loses contact',()=>{
  const committed=input(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  const before=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const tailId=before.positions.at(-1).riderId;
  const source=committed.teams.flatMap(team=>
    team.riders).find(row=>row.id===tailId);
  Object.assign(source,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,positioning:0});
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.equal(start.positions.at(-1).riderId,tailId);
  const request={prior:start,
    segment:committed.kilometres[0],
    input:committed,riderId:tailId};
  const drop=advancePhysicalFirstPositionRearTailDropKmV1(
    request);
  assert.equal(drop.contactLossEvent.type,
    'paid_tail_contact_loss');
  assert.ok(drop.contactLossEvent.atClockSeconds>0);
  assert.ok(drop.contactLossEvent.paidShelteredDistanceM>0);
  assert.ok(drop.contactLossEvent.paidSoloDistanceM>0);
  assert.ok(drop.position.distanceM<
    drop.peloton.positions.at(-1).distanceM);
  assert.equal(drop.peloton.positions.length,15);
  assert.ok(drop.decision.paidFromReserve>0);
  assert.deepEqual(replayPhysicalFirstPositionRearTailDropKmV1(
    request,drop),drop);
  const forged=structuredClone(drop);
  forged.contactLossEvent.atClockSeconds=0;
  assert.throws(()=>replayPhysicalFirstPositionRearTailDropKmV1(
    request,forged),/differs from paid movement/);
});
test('a weak interior lane forms only measured contact components',()=>{
  const committed=input(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  const initial=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const weakId=initial.positions[1].riderId;
  const weak=committed.teams.flatMap(team=>team.riders)
    .find(row=>row.id===weakId);
  Object.assign(weak,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,
    positioning:100});
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  assert.ok(start.positions.findIndex(row=>
    row.riderId===weakId)<4);
  const request={prior:start,
    segment:committed.kilometres[0],
    input:committed};
  const first=advancePhysicalFirstPositionFixedLaneConvoyKmV1(
    request);
  assert.equal(first.decisions.length,16);
  assert.ok(first.contactEvents.length>0);
  assert.ok(first.contactComponents.length>1);
  assert.equal(first.contactComponents.flat().length,16);
  assert.ok(first.decisions.every(row=>
    row.paidFromReserve>0&&
    row.paidDistanceM>0));
  assert.ok(first.positions.every(row=>
    row.distanceM<=1000));
  for(let lane=0;lane<grid.laneCount;lane++){
    const sameLane=first.positions.filter(row=>
      row.lane===lane).sort((a,b)=>
      a.row-b.row);
    assert.ok(sameLane.slice(1).every((row,index)=>
      sameLane[index].distanceM-row.distanceM>=
        grid.wheelSpacingM-1e-6));
  }
  assert.deepEqual(replayPhysicalFirstPositionFixedLaneConvoyKmV1(
    request,first),first);
  const forged=structuredClone(first);
  forged.contactEvents[0].components=[];
  assert.throws(()=>replayPhysicalFirstPositionFixedLaneConvoyKmV1(
    request,forged),/differs from paid movement/);
});

test('detached lanes continue paying and cross their real kilometre lines',()=>{
  const committed=cappedInput(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  const initial=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const weakId=initial.positions[1].riderId;
  const weak=committed.teams.flatMap(team=>team.riders)
    .find(row=>row.id===weakId);
  Object.assign(weak,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,
    positioning:100});
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const first=advancePhysicalFirstPositionFixedLaneConvoyKmV1({
    prior:start,segment:committed.kilometres[0],
    input:committed});
  const request={prior:first,
    segment:committed.kilometres[1],
    input:committed};
  const second=advancePhysicalFirstPositionFixedLaneConvoyKmV1(
    request);
  assert.equal(second.sourceKm,2);
  assert.equal(second.positions.length,16);
  assert.equal(second.decisions.length,16);
  assert.ok(second.clockSeconds>first.clockSeconds);
  assert.ok(second.checkpointCrossings.some(row=>
    row.km===1&&row.riderId!==
      second.leaderRiderId));
  assert.equal(second.checkpointCrossings.filter(row=>
    row.km===2).length,1);
  assert.ok(second.checkpointCrossings.every(row=>
    row.clockSeconds>first.clockSeconds&&
    row.clockSeconds<=second.clockSeconds));
  assert.deepEqual(replayPhysicalFirstPositionFixedLaneConvoyKmV1(
    request,second),second);
});

test('detached wheels pay to the finish without invented road beyond it',()=>{
  const committed=cappedInput(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  const initial=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const weakId=initial.positions[1].riderId;
  const weak=committed.teams.flatMap(team=>team.riders)
    .find(row=>row.id===weakId);
  Object.assign(weak,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,
    positioning:100});
  let prior=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  for(const segment of committed.kilometres)
    prior=advancePhysicalFirstPositionFixedLaneConvoyKmV1({
      prior,segment,input:committed});
  const request={prior,input:committed};
  const finish=settlePhysicalFirstPositionFixedLaneFinishV1(
    request);
  assert.equal(finish.finishCrossings.length,16);
  assert.equal(finish.finishCrossings[0].riderId,
    prior.leaderRiderId);
  assert.equal(finish.finishCrossings[0].clockSeconds,
    prior.clockSeconds);
  assert.ok(finish.finishCrossings.at(-1)
    .clockSeconds>prior.clockSeconds);
  assert.ok(finish.decisions.some(row=>
    row.paidTailDistanceM>0&&
    row.paidFromReserve>0));
  assert.equal(finish.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionFixedLaneFinishV1(
    request,finish),finish);
  const forged=structuredClone(finish);
  forged.finishCrossings.at(-1).clockSeconds=0;
  assert.throws(()=>replayPhysicalFirstPositionFixedLaneFinishV1(
    request,forged),/differs from paid movement/);
});

test('whole-race hybrid replay keeps every paid wheel and crossing',()=>{
  const committed=cappedInput(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  const initial=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const weakId=initial.positions[1].riderId;
  const weak=committed.teams.flatMap(team=>team.riders)
    .find(row=>row.id===weakId);
  Object.assign(weak,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,
    positioning:100});
  const request={input:committed,grid};
  const race=recordPhysicalFirstPositionHybridRaceV1(
    request);
  assert.equal(race.positionRiderKm,32);
  assert.equal(race.steps.length,2);
  assert.equal(race.finishCrossingCoverage,'16/16');
  assert.equal(race.steps[0].contactComponents
    .flat().length,16);
  assert.equal(race.officialResults,false);
  assert.equal(race.viewerReady,false);
  assert.deepEqual(replayPhysicalFirstPositionHybridRaceV1(
    request,race),race);
  const forged=structuredClone(race);
  forged.finish.finishCrossings[0].clockSeconds=0;
  assert.throws(()=>replayPhysicalFirstPositionHybridRaceV1(
    request,forged),/differs from paid movement/);
});

test('hybrid refuses an attack order until the departure is paid',()=>{
  const committed=input(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  committed.teams[0].orders.baseline.attack=
    'selective';
  assert.throws(()=>recordPhysicalFirstPositionHybridRaceV1({
    input:committed,grid}),
  /needs a paid attack departure/);
});

test('a paid front pass continues detached rear roads on one clock',()=>{
  const committed=cappedInput(2);
  committed.positionModelVersion=
    PHYSICAL_FIRST_POSITION_START_V2_VERSION;
  committed.teams[0].orders.phases=[{
    atKm:1,frontWork:'rotate',
    frontWorkRiderId:'team-0-6'}];
  const successor=committed.teams[0].riders[5];
  Object.assign(successor,{flat:68,
    sprint:68,acceleration:100,
    form:70,endurance:70,
    positioning:100});
  const before=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const weakId=before.positions.find(row=>
    row.lane===1&&row.row===0).riderId;
  const weak=committed.teams.flatMap(team=>team.riders)
    .find(row=>row.id===weakId);
  Object.assign(weak,{flat:0,hills:0,mountain:0,
    sprint:0,endurance:0,form:0,
    positioning:100});
  const start=createPhysicalFirstPositionStartV2({
    input:committed,grid});
  const first=advancePhysicalFirstPositionHybridKmV1({
    prior:start,segment:committed.kilometres[0],
    input:committed});
  assert.ok(first.contactComponents.length>1);
  const request={prior:first,
    segment:committed.kilometres[1],
    input:committed};
  const quote=quotePhysicalFirstPositionFrontPassV1(
    request);
  const second=advancePhysicalFirstPositionHybridKmV1(
    request);
  assert.equal(second.version,
    PHYSICAL_FIRST_POSITION_MIXED_FRONT_PASS_VERSION);
  assert.equal(second.event.type,'paid_front_pass');
  assert.equal(quote.fromRiderId,
    second.event.fromRiderId);
  assert.equal(quote.toRiderId,
    second.event.toRiderId);
  assert.ok(Math.abs(quote.firstSeconds-
    second.firstSeconds)<1e-6);
  assert.ok(Math.abs(quote.secondSeconds-
    second.secondSeconds)<1e-6);
  assert.equal(second.positions.length,16);
  assert.ok(second.positions.some(row=>
    row.roadId!=='peloton'));
  assert.ok(second.decisions.filter(row=>
    row.role==='rear_road_movement')
    .every(row=>row.paidFromReserve>0));
  assert.deepEqual(replayPhysicalFirstPositionHybridKmV1(
    request,second),second);
  const forged=structuredClone(second);
  forged.event.surgePaidFromReserve=0;
  assert.throws(()=>replayPhysicalFirstPositionHybridKmV1(
    request,forged),/differs from paid movement/);
  const unpaidRear=structuredClone(second);
  unpaidRear.decisions.find(row=>
    row.role==='rear_road_movement').paidFromReserve=0;
  assert.throws(()=>replayPhysicalFirstPositionHybridKmV1(
    request,unpaidRear),/differs from paid movement/);
  const movedRear=structuredClone(second);
  movedRear.positions.find(row=>
    row.roadId!=='peloton').distanceM+=1;
  assert.throws(()=>replayPhysicalFirstPositionHybridKmV1(
    request,movedRear),/differs from paid movement/);
});

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

function cappedInput(kmCount,teamCount=2){
  const committed=input(teamCount);
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
  assert.equal(first.checkpointCrossings.filter(row=>
    row.km===1).length,1);
  assert.equal(second.checkpointCrossings.filter(row=>
    row.km===1).length,15);
  assert.equal(second.checkpointCrossings.filter(row=>
    row.km===2).length,1);
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
  assert.throws(()=>settlePhysicalFirstPositionFinishTailV1(
    committed,trace),/fully paid connected position road/);
});

test('paid finish tail carries all model wheels across the line',()=>{
  const committed=cappedInput(3);
  const trace=recordPhysicalFirstPositionTraceV1(committed,grid);
  const tail=settlePhysicalFirstPositionFinishTailV1(
    committed,trace);
  assert.equal(tail.lineCrossingCoverage,'16/16');
  assert.equal(tail.tailDistanceM,
    3000-Math.min(...trace.states.at(-1).positions.map(row=>
      row.distanceM)));
  assert.equal(tail.lineCrossings[0].riderId,
    trace.states[0].positions[0].riderId);
  assert.equal(tail.lineCrossings[0].clockSeconds,
    trace.states.at(-1).clockSeconds);
  assert.ok(tail.lineCrossings.slice(1).every(row=>
    row.clockSeconds>tail.lineCrossings[0].clockSeconds));
  assert.ok(tail.tailDecisions.every(row=>
    row.paidFromReserve>0&&
    row.energyAfter<row.energyBefore));
  assert.equal(tail.tailDecisions[0].role,'leader');
  assert.equal(tail.frontWorkerPaidBeyondFinish,true);
  assert.equal(tail.competitiveSprintModelUsed,false);
  assert.equal(tail.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionFinishTailV1(
    committed,trace,tail),tail);
  const forged=structuredClone(tail);
  forged.lineCrossings[1].clockSeconds-=1;
  assert.throws(()=>replayPhysicalFirstPositionFinishTailV1(
    committed,trace,forged),/differs from paid rider motion/);
});

test('paid finish tail covers a 160-rider connected field',()=>{
  const committed=cappedInput(2,20);
  const trace=recordPhysicalFirstPositionTraceV1(committed,grid);
  const tail=settlePhysicalFirstPositionFinishTailV1(
    committed,trace);
  assert.equal(trace.validatedPositionRiderKm,320);
  assert.equal(tail.lineCrossings.length,160);
  assert.equal(new Set(tail.lineCrossings.map(row=>
    row.clockSeconds)).size,160);
  assert.ok(tail.tailDistanceM<1000);
  assert.equal(tail.officialResults,false);
});

test('120 km connected road pays and replays all 160 rider positions',()=>{
  const committed=cappedInput(120,20);
  const trace=recordPhysicalFirstPositionTraceV1(committed,grid);
  assert.equal(trace.raceValidatedKm,120);
  assert.equal(trace.completedThroughKm,120);
  assert.equal(trace.validatedPositionRiderKm,19200);
  assert.equal(trace.unsupported,null);
  assert.equal(trace.checkpointCrossings.filter(row=>
    row.km===119).length,160);
  const tail=settlePhysicalFirstPositionFinishTailV1(
    committed,trace);
  assert.equal(tail.lineCrossingCoverage,'160/160');
  assert.equal(tail.officialResults,false);
});

test('selected replacement reaches the front only through paid passing',()=>{
  const committed=cappedInput(2);
  committed.teams[1].orders.baseline.frontWork='rotate';
  committed.teams[1].orders.baseline.frontWorkRiderId=
    committed.teams[1].riders[1].id;
  committed.teams[1].riders[1].positioning=100;
  const start=createPhysicalFirstPositionStartV1({
    input:committed,grid});
  const firstInput={prior:start,
    segment:committed.kilometres[0],
    input:committed};
  const first=advancePhysicalFirstPositionRotationKmV1(
    firstInput);
  const secondInput={...firstInput,prior:first,
    segment:committed.kilometres[1]};
  const second=advancePhysicalFirstPositionRotationKmV1(
    secondInput);
  assert.equal(first.leaderRiderId,'team-0-2');
  assert.equal(second.proposedLeaderRiderId,'team-1-2');
  assert.equal(second.event.type,'paid_front_pass');
  assert.equal(second.leaderRiderId,'team-1-2');
  assert.equal(second.positions[0].distanceM,2000);
  assert.ok(second.event.atClockSeconds>
    first.clockSeconds&&second.event.atClockSeconds<
    second.clockSeconds);
  assert.ok(second.event.surgePaidFromReserve>0);
  assert.ok(second.decisions.every(row=>
    row.paidFromReserve>0));
  assert.deepEqual(replayPhysicalFirstPositionRotationKmV1(
    secondInput,second),second);
  const forged=structuredClone(second);
  forged.event.surgePaidFromReserve=0;
  assert.throws(()=>replayPhysicalFirstPositionRotationKmV1(
    secondInput,forged),/differs from paid movement/);
  const changed=structuredClone(committed);
  changed.teams[1].riders[1].sprint+=1;
  assert.throws(()=>advancePhysicalFirstPositionRotationKmV1({
    ...secondInput,input:changed}),
  /changed committed race input/);
});

test('unreachable front worker is refused without changing the leader',()=>{
  const committed=cappedInput(2);
  committed.teams[1].orders.baseline.frontWork='rotate';
  committed.teams[1].orders.baseline.frontWorkRiderId=
    committed.teams[1].riders[1].id;
  committed.teams[1].riders[1].positioning=100;
  committed.teams[1].riders[1].acceleration=0;
  const first=advancePhysicalFirstPositionRotationKmV1({
    prior:createPhysicalFirstPositionStartV1({
      input:committed,grid}),
    segment:committed.kilometres[0],input:committed});
  const second=advancePhysicalFirstPositionRotationKmV1({
    prior:first,segment:committed.kilometres[1],
    input:committed});
  assert.equal(second.proposedLeaderRiderId,'team-1-2');
  assert.equal(second.event.type,'front_pass_refused');
  assert.equal(second.leaderRiderId,'team-0-2');
  assert.equal(second.positions[0].distanceM,2000);
  assert.ok(second.decisions.find(row=>
    row.riderId==='team-1-2').firstRole==='sheltered');
});
