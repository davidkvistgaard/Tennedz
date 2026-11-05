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
import {decideV94PhysicalMixedOriginPresetV1} from
  '../../lib/engine/v2/v94-physical-mixed-origin-preset-choice-v1.mjs';
import {replayV94PhysicalFreshAttackSolosV1} from
  '../../lib/engine/v2/v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalMixedOriginPresetKmV1} from
  '../../lib/engine/v2/v94-physical-mixed-origin-preset-km-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  '../../lib/engine/v2/v94-physical-forward-boundary-choice-v1.mjs';
import {planV94PhysicalAvailableFrontTurnsV1} from
  '../../lib/engine/v2/v94-physical-available-front-turns-v1.mjs';
import {decideV94PhysicalMidKmContactChoiceV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-choice-v1.mjs';
import {replayV94PhysicalMidKmContactFragmentV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-fragment-v1.mjs';
import {inspectV94PhysicalMidKmContactRoadsV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-road-audit-v1.mjs';
import {replayV94PhysicalMidKmContactFullFieldV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-full-field-v1.mjs';

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
      const completed=fatigue===0?
        replayV94PhysicalWholeRaceV1(recording):null;
      const check=error=>{
        const cause=error?.cause;
        const traces=completed?.traces??cause?.paidTraces;
        const prior20=fatigue===0?
          traces?.[19]:cause?.paidPriorTrace;
        let km21Cause=null;
        if(fatigue===0){
          assert.equal(completed.traces.length,120);
          assert.equal(completed.validation.totalRiderKm,19200);
          assert.equal(completed.physicalFinish.riderCount,160);
          assert.equal(completed.sourceCheckpointCalibrationFailed,
            true);
          assert.equal(completed.sourceGapAudit
            .sourceGapExceedsBestPaidLeadCount,49);
          assert.equal(completed.sourceGapAudit
            .maxGapOverBestPaidLeadSeconds,27.44668);
          assert.equal(completed.finishSourceAudit.mismatchCount,
            119);
          assert.equal(completed.finishSourceAudit
            .maxAbsoluteMismatchSeconds,498.307936);
          const prior69=traces[68];
          const frame70=recording.frames[69];
          assert.deepEqual(prior69.sourceBreakRiderIds,[]);
          assert.deepEqual(frame70.attackers,
            ['rival-19-7','rival-6-7']);
          assert.equal(prior69.finishes.find(row=>
            row.riderId==='rival-19-7').physicalGroup,
          'peloton');
          assert.equal(prior69.finishes.find(row=>
            row.riderId==='rival-6-7').physicalGroup,
          'paid-contact-km69-1');
          assert.ok(frame70.freshAttackRiderDecisions
            .every(row=>row.attackReason==='preset_cadence'));
          const mixed=decideV94PhysicalMixedOriginPresetV1(
            recording,prior69);
          assert.deepEqual(mixed.pendingPelotonLaunchRiderIds,
            ['rival-19-7']);
          assert.deepEqual(
            mixed.declinedSourceFrontLaunchRiderIds,
            ['rival-6-7']);
          assert.equal(mixed.fullFieldKilometre,false);
          const solos=replayV94PhysicalFreshAttackSolosV1(
            recording,prior69,{
              existingSourceBreakRiderIds:
                mixed.declinedSourceFrontLaunchRiderIds,
              selectedRiderIds:
                mixed.pendingPelotonLaunchRiderIds});
          assert.equal(solos.roads.length,1);
          assert.equal(solos.roads[0].riderId,'rival-19-7');
          assert.equal(solos.mixedSourceRoadClaims.length,1);
          const km70=replayV94PhysicalMixedOriginPresetKmV1(
            recording,prior69);
          assert.equal(km70.sourceKm,70);
          assert.equal(km70.finishes.length,160);
          const forward=decideV94PhysicalForwardBoundaryChoicesV1(
            recording,km70,{allowPaidMixedContact:true});
          assert.ok(forward.choices.some(row=>
            row.mixedPaidContact===true));
          const rearNamedLeaders=recording.frames[70]
            .pelotonFrontTurnPlan.turns.filter(turn=>
              km70.finishes.find(row=>
                row.riderId===turn.leaderRiderId)
                ?.physicalGroup!=='peloton');
          assert.deepEqual(rearNamedLeaders.map(row=>
            row.leaderRiderId),[
            'rival-10-5','rival-10-6',
            'rival-14-5','rival-14-6',
            'rival-18-5','rival-18-6']);
          const available=planV94PhysicalAvailableFrontTurnsV1(
            recording,km70);
          assert.equal(available.missing.length,6);
          assert.equal(available.availableTurnCount,20);
          assert.equal(available.turns.at(-1).endM,1000);
          assert.ok(available.turns.every(row=>row.payable));
          assert.equal(available.physicalRoadMoved,false);
          assert.equal(traces[69].sourceKm,70);
          assert.equal(traces[69].fullFieldKilometre,
            true);
          const prior109=traces[108];
          assert.equal(prior109.sourceKm,109);
          assert.equal(prior109.fullFieldKilometre,true);
          assert.equal(prior109.sourceBreakMembershipEnded,true);
          assert.deepEqual(prior109.sourceBreakRiderIds,[]);
          assert.equal(prior109.formerSourceBreakRiderIds.length,7);
          const contact110=decideV94PhysicalMidKmContactChoiceV1(
            recording,prior109,{detachedPresetAvailable:true});
          assert.equal(contact110.pendingLeaderRiderId,null);
          assert.equal(contact110.candidates.length,2);
          const km110=traces[109];
          assert.equal(km110.sourceKm,110);
          assert.equal(km110.fullFieldKilometre,true);
          assert.equal(km110.finishes.length,160);
          assert.ok(km110.passThroughContacts.some(row=>
            row.formsRearGroup===false&&
            row.riderDecisions?.length===2&&
            row.riderDecisions.every(decision=>
              decision.choice===
                'continue_separate_paid_solo_road')));
          const prior79=traces[78];
          const contact=decideV94PhysicalMidKmContactChoiceV1(
            recording,prior79,{
              detachedPresetAvailable:true});
          assert.deepEqual(contact.observedRoads.map(row=>
            row.roadId),['paid-contact-km80-1',
            'paid-contact-km80-2']);
          assert.ok(contact.atDistanceM>79000&&
            contact.atDistanceM<80000);
          assert.equal(contact.pendingLeaderRiderId,
            'rival-14-7');
          assert.equal(contact.pendingShelterRiderIds.length,32);
          const fragment=replayV94PhysicalMidKmContactFragmentV1(
            recording,prior79,{
              detachedPresetAvailable:true});
          assert.equal(fragment.riderWork.length,33);
          assert.equal(fragment.fullFieldKilometre,false);
          const contactAudit=inspectV94PhysicalMidKmContactRoadsV1(
            recording,prior79,{
              detachedPresetAvailable:true});
          assert.equal(contactAudit.firstOtherContact,null);
          assert.equal(contactAudit.frontDropCount,0);
          assert.equal(contactAudit.otherContactCount,0);
          const km80=replayV94PhysicalMidKmContactFullFieldV1(
            recording,prior79,{
              detachedPresetAvailable:true});
          assert.deepEqual(traces[79],km80);
          assert.equal(km80.sourceKm,80);
          assert.equal(km80.finishes.length,160);
          assert.equal(km80.fullFieldKilometre,true);
          assert.equal(km80.detachedPresetDecisions.length,3);
          for(let index=79;index<108;index++){
            const paid=traces[index];
            assert.equal(paid.sourceKm,index+1);
            assert.equal(paid.fullFieldKilometre,true);
            assert.equal(paid.finishes.length,160);
          }
          const km71=traces[70];
          assert.equal(km71.sourceKm,71);
          assert.equal(km71.fullFieldKilometre,true);
          assert.equal(km71.finishes.length,160);
          assert.equal(km71.front.sourceNamedFrontReallocated,true);
          assert.equal(km71.front.availableFrontPlanVersion,
            available.version);
          assert.ok(km71.finishes.every(row=>
            Math.abs(row.energyBefore-row.paidFromReserve+
              row.recoveryAward-row.capAdjustment-
              row.energyAfter)<=.0010001));
          for(let index=70;index<79;index++){
            const paid=traces[index];
            assert.equal(paid.sourceKm,index+1);
            assert.equal(paid.fullFieldKilometre,true);
            assert.equal(paid.finishes.length,160);
            assert.equal(paid.front.availableFrontPlanVersion,
              available.version);
          }
          assert.equal(traces?.[20]?.sourceKm,21);
          assert.equal(traces[20].fullFieldKilometre,
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
          completed.traces.length===120:
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
      };
      if(completed)assert.equal(check(null),true);
      else assert.throws(()=>replayV94PhysicalWholeRaceV1(
        recording),check);
    }else{
      const replay=replayV94PhysicalWholeRaceV1(recording);
      assert.equal(replay.validation.totalRiderKm,19200);
      assert.equal(replay.physicalFinish.riderCount,160);
      assert.equal(replay.sourceCheckpointCalibrationFailed,
        true);
    }
  });
