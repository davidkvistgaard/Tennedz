import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayV94PhysicalWholeRaceV1} from
  '../../lib/engine/v2/v94-physical-whole-race-replay-v1.mjs';
import {auditV94PhysicalFrontDropContactsV1} from
  '../../lib/engine/v2/v94-physical-front-drop-contact-audit-v1.mjs';
import {decideV94PhysicalFrontDropFirstBatchV1} from
  '../../lib/engine/v2/v94-physical-front-drop-first-batch-choice-v1.mjs';
import {replayV94PhysicalFrontDropFirstBatchFragmentV1} from
  '../../lib/engine/v2/v94-physical-front-drop-first-batch-fragment-v1.mjs';
import {inspectV94PhysicalFrontDropFirstBatchNextV1} from
  '../../lib/engine/v2/v94-physical-front-drop-first-batch-next-v1.mjs';
import {quoteV94PhysicalFrontDropContactV1} from
  '../../lib/engine/v2/v94-physical-front-drop-contact-quote-v1.mjs';
import {extendV94PhysicalFrontDropBatchV1} from
  '../../lib/engine/v2/v94-physical-front-drop-batch-extension-v1.mjs';
import {replayV94PhysicalRecordedRestKmV1} from
  '../../lib/engine/v2/v94-physical-recorded-rest-km-v1.mjs';
import {completeV94PhysicalFrontDropBatchFieldV1} from
  '../../lib/engine/v2/v94-physical-front-drop-batch-field-v1.mjs';

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
        const prior20=fatigue===0?
          cause?.paidTraces?.[19]:cause?.paidPriorTrace;
        let km21Cause=null;
        if(fatigue===0){
          assert.match(error.message,/stops at km 70/);
          assert.equal(cause.message,
            'Detached preset needs exact paid rear and source membership.');
          assert.equal(cause.paidTraces?.[20]?.sourceKm,21);
          assert.equal(cause.paidTraces[20].fullFieldKilometre,
            true);
        }
        try{replayV94PhysicalRecordedRestKmV1(
          recording,prior20);}
        catch(measured){km21Cause=measured;}
        const evidence=km21Cause?.sourceEvidence;
        const physicalRoads=km21Cause?.physicalRoads;
        const road=physicalRoads?.roads?.find(row=>
          row.roadId===evidence?.roadId);
        const drop=physicalRoads?.newFrontDrops?.find(row=>
          row.riderId===evidence?.riderId);
        const audit=auditV94PhysicalFrontDropContactsV1(
          physicalRoads,{sourceKm:21});
        assert.equal(audit.frontDropCount,fatigue===0?30:33);
        assert.equal(audit.rearRoadCount,fatigue===0?10:9);
        assert.equal(audit.contactCount,audit.frontDropCount);
        assert.equal(audit.firstContact.kind,
          'front_drop_rear_road');
        assert.equal(audit.firstContact.secondRoadId,
          'solo-rival-2-5');
        assert.equal(audit.firstContact.firstRiderId,
          fatigue===0?'rival-10-6':'rival-11-3');
        assert.ok(audit.firstContact.clockSeconds<
          evidence.clockSeconds);
        assert.equal(audit.physicalGroupFormed,false);
        const provisional=replayV94PhysicalRecordedRestKmV1(
          recording,prior20,{
            provisionalFrontDropContacts:true});
        assert.equal(provisional.fullFieldKilometre,false);
        assert.equal(provisional.finishes.length,160);
        assert.equal(provisional.pendingFrontDropContacts.length,
          audit.contactCount);
        const choice=decideV94PhysicalFrontDropFirstBatchV1(
          recording,prior20,physicalRoads);
        assert.equal(choice.passingRiderId,'rival-2-5');
        assert.equal(choice.passingWillingToLead,true);
        assert.equal(choice.drops.length,fatigue===0?17:13);
        assert.equal(choice.pendingShelterRiderIds.length,
          fatigue===0?17:0);
        assert.ok(choice.drops.every(row=>
          row.paidEnergyToContact>=0&&
          row.energyAtContact>0));
        assert.equal(choice.physicalGroupFormed,false);
        if(fatigue===0){
          const fragment=
            replayV94PhysicalFrontDropFirstBatchFragmentV1(
              recording,prior20,physicalRoads);
          assert.equal(fragment.riderWork.length,18);
          assert.equal(fragment.road.leaderRiderId,
            'rival-2-5');
          assert.equal(fragment.road.shelteredRiderIds.length,
            17);
          assert.ok(fragment.riderWork.every(row=>
            row.energyAfter>=0&&
            row.paidFromReserve>=0));
          assert.equal(fragment.fullFieldKilometre,false);
          const probe=inspectV94PhysicalFrontDropFirstBatchNextV1(
            physicalRoads,fragment);
          assert.equal(probe.remainingRearRoadCount,9);
          assert.equal(probe.remainingFrontDropCount,13);
          assert.equal(probe.contactCount,13);
          assert.deepEqual(probe.firstAdditionalContact.roadIds,
            ['rival-10-5','rival-14-5','rival-18-5'].map(id=>[
              fragment.road.roadId,`solo-${id}`]));
          assert.ok(probe.firstAdditionalContact.clockSeconds>
            fragment.contactClockSeconds);
          assert.equal(probe.fullFieldKilometre,false);
          const quotes=probe.firstAdditionalContact.riderIds
            .flat().map(riderId=>
              quoteV94PhysicalFrontDropContactV1(
                recording,prior20,physicalRoads,{riderId,
                  clockSeconds:probe.firstAdditionalContact
                    .clockSeconds,
                  atDistanceM:probe.firstAdditionalContact
                    .atDistanceM,
                  requiredAbility:choice
                    .passingPerceivedSoloAbility}));
          assert.deepEqual(quotes.map(row=>row.riderId),
            ['rival-10-5','rival-14-5','rival-18-5']);
          assert.ok(quotes.every(row=>
            row.choice==='eligible_for_paid_shelter'&&
            row.paidEnergyToContact>0&&
            row.perceivedShelterHoldAbility>=
              row.requiredAbility));
          const extended=extendV94PhysicalFrontDropBatchV1(
            recording,prior20,physicalRoads,fragment);
          assert.equal(extended.riderWork.length,21);
          assert.equal(extended.road.shelteredRiderIds.length,
            20);
          assert.equal(extended.contactHistory.length,1);
          const later=inspectV94PhysicalFrontDropFirstBatchNextV1(
            physicalRoads,extended);
          const all=extendV94PhysicalFrontDropBatchV1(
            recording,prior20,physicalRoads,extended);
          assert.equal(later.remainingFrontDropCount,10);
          assert.equal(all.riderWork.length,31);
          assert.equal(all.passThroughContacts.length,0);
          assert.equal(all.contactHistory.length,2);
          const finishedContacts=
            inspectV94PhysicalFrontDropFirstBatchNextV1(
              physicalRoads,all);
          assert.equal(finishedContacts.contactCount,0);
          const field=completeV94PhysicalFrontDropBatchFieldV1(
            recording,prior20,physicalRoads,
            provisional,all);
          assert.equal(field.fullFieldKilometre,true);
          assert.equal(field.finishes.length,160);
          assert.equal(field.physicalRearGroups.find(row=>
            row.roadId===all.road.roadId)
            .riderDecisions.length,31);
          assert.equal(field.paidContactHistory.length,3);
          assert.ok(field.finishes.every(row=>
            row.energyBefore>=row.energyAfter));
        }else assert.throws(()=>
          replayV94PhysicalFrontDropFirstBatchFragmentV1(
            recording,prior20,physicalRoads),
        /needs paid shelter/);
        return (fatigue===0?
          /stops at km 70/.test(error.message):
          /stops at km 21/.test(error.message)&&
          cause.message===
            'Front-drop batch fragment needs paid shelter.')&&
          km21Cause.message===
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
