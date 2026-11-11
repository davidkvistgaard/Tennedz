import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {recordPhysicalFirstPositionMultiSoloRaceV1,
  replayPhysicalFirstPositionMultiSoloRaceV1} from
  '../../lib/engine/v2/physical-first-position-multi-solo-race-v1.mjs';

const grid={laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08};

test('an ordered second attack without a clear lane is only a refusal',()=>{
  const {input:base}=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'flat',chase:'all',
      attack:'selective',
      seed:'preview-recorded-road-1'});
  const input=structuredClone({...base,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION});
  const start=createPhysicalFirstPositionStartV2({
    input,grid});
  const attacker=input.teams.flatMap(team=>team.riders)
    .find(row=>row.id===start.stagedAttackRiderId);
  for(const ability of ['flat','hills','mountain'])
    attacker[ability]-=10;
  input.start.riders.find(row=>
    row.riderId===attacker.id).reserve=
    replayRearEnergyCapV1({rider:attacker,
      kilometres:input.kilometres,
      throughKm:0}).initialCap;
  const request={input,grid};
  const race=recordPhysicalFirstPositionMultiSoloRaceV1(
    request);
  assert.equal(race.completedThroughKm,120);
  assert.equal(race.paidAttackDepartures,1);
  assert.ok(race.refusedAttackPasses>=1);
  assert.equal(race.finishCrossings.length,120);
  assert.ok(race.steps.some(row=>
    row.attackRefusal?.reason===
      'no_clear_paid_passing_lane'));
  assert.deepEqual(replayPhysicalFirstPositionMultiSoloRaceV1(
    request,race),race);
  const forged=structuredClone(race);
  forged.steps.find(row=>row.attackRefusal)
    .attackRefusal=null;
  assert.throws(()=>replayPhysicalFirstPositionMultiSoloRaceV1(
    request,forged),/differs from paid movement/);
});
