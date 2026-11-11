import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionHybridKmV1,
  replayPhysicalFirstPositionHybridKmV1} from
  '../../lib/engine/v2/physical-first-position-hybrid-km-v1.mjs';
import {PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION} from
  '../../lib/engine/v2/physical-first-position-pass-contact-km-v1.mjs';

test('a front pass pays all wheels when the coarse shelter check refuses',()=>{
  const settings={distanceKm:120,teamCount:20,
    gender:'M',terrain:'mountain',fatigue:0,
    attack:'none',chase:'selective',
    seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({teamId:team.id,
      goal:team.id==='you'?'summit_attack':'none',
      captainId:team.orders.captainId}));
  const rivalGoals=Array.from({length:19},(_,index)=>
    ({teamId:`rival-${index+1}`,role:'protect'}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals,ownFrontWork:'rotate',
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,
    pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,
    roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const {teams,rivalIntent}=recording.committedInputs;
  const worker=teams.find(team=>team.id==='you')
    .riders.find(rider=>rider.id==='you-5');
  for(const ability of ['flat','hills','mountain'])
    worker[ability]-=5;
  const orders=teams.find(team=>team.id==='you')
    .orders;
  orders.baseline.frontWorkRiderId='you-5';
  orders.phases=[...orders.phases,
    {atKm:25,frontWork:'rotate',
      frontWorkRiderId:'you-6'}]
    .sort((a,b)=>a.atKm-b.atKm);
  const kilometres=recording.route.kilometres;
  const riders=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,
    roadId:'peloton',distanceM:0,
    clockSeconds:0,
    reserve:replayRearEnergyCapV1({
      rider,kilometres,throughKm:0}).initialCap,
    quietKm:0})));
  const input={raceSeed:recording.raceSeed,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    start:{sourceKm:0,roads:[{
      roadId:'peloton',clockSeconds:0,
      riderIds:riders.map(row=>row.riderId)}],
    riders},kilometres,teams,stakes:rivalIntent};
  let prior=createPhysicalFirstPositionStartV2({
    input,grid:{laneCount:4,wheelSpacingM:2.5,
      laneStaggerM:.08}});
  for(const segment of kilometres.slice(0,42))
    prior=advancePhysicalFirstPositionHybridKmV1({
      prior,segment,input});
  const request={prior,segment:kilometres[42],input};
  const step=advancePhysicalFirstPositionHybridKmV1(
    request);
  assert.equal(step.version,
    PHYSICAL_FIRST_POSITION_PASS_CONTACT_VERSION);
  assert.equal(step.sourceKm,43);
  assert.equal(step.event.type,'paid_front_pass');
  assert.equal(step.event.toRiderId,'you-6');
  assert.equal(step.positions.length,160);
  assert.equal(step.decisions.length,160);
  assert.ok(step.decisions.every(row=>
    row.paidDistanceM>0&&
    row.paidFromReserve>0));
  assert.deepEqual(replayPhysicalFirstPositionHybridKmV1(
    request,step),step);
  const forged=structuredClone(step);
  forged.decisions.find(row=>
    row.riderId==='you-6').paidFromReserve=0;
  assert.throws(()=>replayPhysicalFirstPositionHybridKmV1(
    request,forged),/differs from paid movement/);
  const moved=structuredClone(step);
  moved.positions.find(row=>
    row.riderId==='you-6').distanceM-=1;
  assert.throws(()=>replayPhysicalFirstPositionHybridKmV1(
    request,moved),/differs from paid movement/);
});
