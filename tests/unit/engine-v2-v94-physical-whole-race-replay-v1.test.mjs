import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayV94PhysicalWholeRaceV1} from
  '../../lib/engine/v2/v94-physical-whole-race-replay-v1.mjs';

for(const fatigue of [0,30])test(
  `opt-in whole physical flat 260 km fatigue ${fatigue}`,()=>{
    const settings={distanceKm:260,teamCount:20,
      terrain:'flat',fatigue,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'};
    const sportingStakes=prepareV91Playtest(settings)
      .teams.map(team=>({teamId:team.id,
        goal:'sprint_finish',
        captainId:team.orders.captainId}));
    const {recording}=createV94RaceDynamicsPreview({
      format:'one_day',settings,sportingStakes,
      roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,
      pelotonFrontTurnVersion:1,
      pelotonDraftCostVersion:1,
      pelotonExposureCostVersion:1,
      freshAttackDecisionVersion:1,
      roadGroupRiderDecisionVersion:1,
      protectorSportingPursuitVersion:1});
    const replay=replayV94PhysicalWholeRaceV1(recording);
    assert.equal(replay.validation.totalRiderKm,41600);
    assert.equal(replay.traces.length,260);
    assert.equal(replay.physicalFinish.riderCount,160);
    assert.equal(replay.officialResults,false);
    assert.equal(replay.sourceCheckpointCalibrationFailed,true);
    assert.equal(replay.sourceGapAudit
      .sourceGapExceedsBestPaidLeadCount,
    fatigue===0?60:57);
    assert.equal(replay.finishSourceAudit.mismatchCount,
      fatigue===0?87:74);
  });

for(const [seed,fatigue] of [
  [1,0],[2,0],[2,30],[3,0],[3,30]])test(
  `opt-in whole physical flat 120 km seed ${seed} fatigue ${
    fatigue}`,()=>{
    const settings={distanceKm:120,teamCount:20,
      terrain:'flat',fatigue,attack:'none',chase:'selective',
      seed:`preview-recorded-road-${seed}`};
    const sportingStakes=prepareV91Playtest(settings)
      .teams.map(team=>({teamId:team.id,
        goal:'sprint_finish',
        captainId:team.orders.captainId}));
    const {recording}=createV94RaceDynamicsPreview({
      format:'one_day',settings,sportingStakes,
      roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,
      pelotonFrontTurnVersion:1,
      pelotonDraftCostVersion:1,
      pelotonExposureCostVersion:1,
      freshAttackDecisionVersion:1,
      roadGroupRiderDecisionVersion:1,
      protectorSportingPursuitVersion:1});
    const replay=replayV94PhysicalWholeRaceV1(recording);
    assert.equal(replay.validation.totalRiderKm,19200);
    assert.equal(replay.traces.length,120);
    assert.equal(replay.physicalFinish.riderCount,160);
    assert.equal(replay.officialResults,false);
    assert.equal(replay.sourceCheckpointCalibrationFailed,true);
  });

for(const [terrain,fatigue] of [
  ['rolling',0],['mountain',0],['mountain',30]])test(
  `opt-in whole physical ${terrain} 120 km fatigue ${fatigue}`,
  ()=>{
    const settings={distanceKm:120,teamCount:20,
      terrain,fatigue,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'};
    const sportingStakes=prepareV91Playtest(settings)
      .teams.map(team=>({teamId:team.id,
        goal:'sprint_finish',
        captainId:team.orders.captainId}));
    const {recording}=createV94RaceDynamicsPreview({
      format:'one_day',settings,sportingStakes,
      roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,
      pelotonFrontTurnVersion:1,
      pelotonDraftCostVersion:1,
      pelotonExposureCostVersion:1,
      freshAttackDecisionVersion:1,
      roadGroupRiderDecisionVersion:1,
      protectorSportingPursuitVersion:1});
    if(terrain==='mountain'){
      assert.throws(()=>replayV94PhysicalWholeRaceV1(
        recording),error=>{
        const cause=error.cause;
        const evidence=cause?.sourceEvidence;
        const road=cause?.physicalRoads?.roads?.find(row=>
          row.roadId===evidence?.roadId);
        const drop=cause?.physicalRoads?.newFrontDrops?.find(row=>
          row.riderId===evidence?.riderId);
        return /stops at km 21/.test(error.message)&&
          cause.message===
            'Physical front drop/rear contact needs paid resolution.'&&
          evidence.riderId==='rival-10-5'&&
          evidence.roadId==='solo-rival-2-5'&&
          evidence.atDistanceM>20000&&
          evidence.atDistanceM<21000&&
          road?.riderDecisions?.[0]?.riderId==='rival-2-5'&&
          road.startClockSeconds>drop?.origin?.startClockSeconds&&
          road.finishClockSeconds<drop?.finish?.clockSeconds;
      });
    }else{
      const replay=replayV94PhysicalWholeRaceV1(recording);
      assert.equal(replay.validation.totalRiderKm,19200);
      assert.equal(replay.physicalFinish.riderCount,160);
      assert.equal(replay.sourceCheckpointCalibrationFailed,
        true);
    }
  });
