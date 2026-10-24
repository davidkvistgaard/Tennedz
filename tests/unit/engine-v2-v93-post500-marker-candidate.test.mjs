import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastMixedThreeFrontPost500CandidateClock,
  validateFinaleCoastMixedThreeFrontPost500CandidateClock,
  FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION,
  recordFinaleCoastMixedThreeFrontStraddlingCandidateClock,
  validateFinaleCoastMixedThreeFrontStraddlingCandidateClock,
  FINALE_COAST_MIXED_THREE_FRONT_STRADDLING_CANDIDATE_VERSION} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleDepletedIndividualLine,
  FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION,
  FINALE_STRADDLING_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedPost500IndividualAudit,
  validateFinaleMixedPost500IndividualAudit,
  recordFinaleMixedPost500OutsideLaneAudit,
  validateFinaleMixedPost500OutsideLaneAudit} from
  '../../lib/engine/v2/finale-mixed-post500-individual-audit.mjs';
import {recordFinaleMixedPost500OutsideLaneLine,
  validateFinaleMixedPost500OutsideLaneLine,
  FINALE_MIXED_POST500_OUTSIDE_LANE_LINE_VERSION} from
  '../../lib/engine/v2/finale-mixed-post500-outside-lane-line.mjs';
import {recordFinaleMixedStraddlingHandoffAudit,
  validateFinaleMixedStraddlingHandoffAudit} from
  '../../lib/engine/v2/finale-mixed-straddling-handoff-audit.mjs';
import {recordFinaleMixedStraddlingIndividualAudit,
  validateFinaleMixedStraddlingIndividualAudit} from
  '../../lib/engine/v2/finale-mixed-straddling-individual-audit.mjs';
import {recordFinaleMixedStraddlingOutsideLaneAudit,
  validateFinaleMixedStraddlingOutsideLaneAudit} from
  '../../lib/engine/v2/finale-mixed-straddling-outside-lane-audit.mjs';
import {recordFinaleMixedStraddlingOutsideLaneLine,
  validateFinaleMixedStraddlingOutsideLaneLine,
  FINALE_MIXED_STRADDLING_OUTSIDE_LANE_LINE_VERSION} from
  '../../lib/engine/v2/finale-mixed-straddling-outside-lane-line.mjs';
import {createV93PlayableTest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest,
  V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(teamCount,gender,terrain){
  return {distanceKm:260,teamCount,gender,terrain,fatigue:30,
    seed:`v93-next-contact-field-hills-${teamCount}-${gender}-${terrain}-30-1`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','conserve','steady'][(index+1)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

function recording(teamCount,gender,terrain){
  const {stage,weather,teams,seed}=prepareV91Playtest(
    settings(teamCount,gender,terrain));
  return simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
}

test('straddling candidate pays both marker sides without resolving wheels',()=>{
  const tour=recording(20,'F','rolling');
  const clock=recordFinaleCoastMixedThreeFrontStraddlingCandidateClock(tour);
  assert.equal(clock.version,
    FINALE_COAST_MIXED_THREE_FRONT_STRADDLING_CANDIDATE_VERSION);
  assert.equal(validateFinaleCoastMixedThreeFrontStraddlingCandidateClock(
    tour,clock),true);
  assert.equal(clock.markerPasses.length,7);
  assert.equal(clock.markerPasses.filter(row=>
    row.markerDistanceM<259500).length,3);
  assert.equal(clock.markerPasses.filter(row=>
    row.markerDistanceM>259500).length,4);
  assert.ok(clock.markerPasses.every(row=>row.contactResolved===false));
  assert.equal(clock.passageFrames.length,7);
  assert.equal(clock.line.bands[1].kind,
    'unresolved_individual_contact_candidate');
  assert.equal(clock.classifiedResults,null);
  assert.equal(clock.pointsStatus,'withheld');
  assert.equal(clock.canCommitAwards,false);
  const line=recordFinaleDepletedIndividualLine(tour,clock);
  assert.equal(line.version,
    FINALE_STRADDLING_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION);
  assert.equal(line.conditionalCrossings.length,160);
  assert.equal(line.classifiedResults,null);
  assert.equal(line.pointsStatus,'withheld');
  assert.equal(line.canCommitAwards,false);
  const outside=recordFinaleMixedStraddlingOutsideLaneAudit(
    tour,clock,line);
  assert.equal(outside.approachCount,7);
  assert.equal(outside.energyContinuity.length,7);
  assert.equal(outside.pre500OtherActive.encounters.length,39);
  assert.equal(outside.pre500OtherActive.checkedOlderDropMarkerBounds,5);
  assert.ok(outside.pre500OtherActive.checkedRearIsolatedRiders>0);
  assert.ok(outside.pre500OtherActive.encounters.every(row=>
    row.activeRoadBandId==='road-1'));
  const fresh=outside.pre500OtherActive.encounters.filter(row=>
    row.laterFreshEncounter);
  assert.equal(fresh.length,1);
  assert.equal(fresh[0].isolatedRiderId,'rival-9-7');
  assert.equal(fresh[0].activeRiderId,'rival-10-7');
  assert.equal(fresh[0].firstNewEncounter.contactResolved,false);
  assert.ok(Math.abs(fresh[0].firstNewEncounter.paidSplit.isolated
    .frames.at(-1).riders[0].energyAfter-
    fresh[0].firstNewEncounter.isolatedEnergyAtApproach)<1e-7);
  assert.ok(Math.abs(fresh[0].firstNewEncounter.paidSplit.active
    .frames.at(-1).riders[0].energyAfter-
    fresh[0].firstNewEncounter.activeEnergyAtApproach)<1e-7);
  assert.equal(outside.freshSourceGroupEnergy.length,1);
  assert.equal(outside.freshSourceGroupEnergy[0].riders.length,2);
  assert.equal(outside.contactResolved,false);
  assert.equal(outside.pre500OtherBandsStatus,
    'former_road1_source_exit_contacts_unresolved');
  assert.equal(outside.pointsStatus,'withheld');
  assert.equal(outside.canCommitAwards,false);
  assert.equal(validateFinaleMixedStraddlingOutsideLaneAudit(
    tour,clock,line,outside),true);
  const conditional=recordFinaleMixedStraddlingOutsideLaneLine(tour,clock);
  assert.equal(conditional.version,
    FINALE_MIXED_STRADDLING_OUTSIDE_LANE_LINE_VERSION);
  assert.equal(conditional.conditionalCrossings.length,160);
  assert.equal(conditional.provisionalLineOrder.length,160);
  assert.ok(conditional.finalRoadBands.some(row=>
    row.id==='isolated:rival-9-7'));
  assert.ok(!conditional.finalRoadBands.some(row=>
    row.id==='road2_with_marker_crossing_leavers'));
  assert.equal(conditional.contactResolved,false);
  assert.equal(conditional.classifiedResults,null);
  assert.equal(conditional.pointsStatus,'withheld');
  assert.equal(conditional.canCommitAwards,false);
  assert.equal(validateFinaleMixedStraddlingOutsideLaneLine(tour,clock,
    {},conditional),true);
});

test('late marker candidates keep road-2 and passing leavers unresolved',()=>{
  for(const [teamCount,gender,terrain] of [
    [15,'M','rolling'],[15,'F','mountain']]){
    const tour=recording(teamCount,gender,terrain);
    const clock=recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour);
    assert.equal(clock.version,
      FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION);
    assert.equal(validateFinaleCoastMixedThreeFrontPost500CandidateClock(
      tour,clock),true);
    assert.ok(clock.markerPasses.length>=5);
    assert.ok(clock.markerPasses.every(row=>
      row.markerDistanceM>259500&&row.contactResolved===false));
    assert.equal(clock.line.bands[1].kind,
      'unresolved_individual_contact_candidate');
    assert.equal(clock.classifiedResults,null);
    assert.equal(clock.pointsStatus,'withheld');
    assert.equal(clock.canCommitAwards,false);
    const line=recordFinaleDepletedIndividualLine(tour,clock);
    assert.equal(line.version,
      FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION);
    assert.equal(line.conditionalCrossings.length,teamCount*8);
    assert.equal(line.classifiedResults,null);
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(line.canCommitAwards,false);
    const at500=new Map(clock.trace.frames.find(frame=>
      frame.endDistanceM===259500).riders.map(row=>
      [row.riderId,row.energy]));
    const finishers=new Set();
    for(const band of line.bandRunners)
      for(const row of band.runner.finishers){
        assert.equal(finishers.has(row.riderId),false);
        finishers.add(row.riderId);
        const paid=band.runner.frames.reduce((sum,frame)=>
          sum+(frame.riders.find(value=>
            value.riderId===row.riderId)?.energySpent??0),0);
        assert.ok(Math.abs(at500.get(row.riderId)-paid-
          row.energyAtLine)<1e-7);
      }
    assert.equal(finishers.size,teamCount*8);
    const audit=recordFinaleMixedPost500IndividualAudit(tour,clock,line);
    assert.equal(audit.encounters.length,clock.markerPasses.length);
    assert.ok(audit.encounters.every(row=>row.isolatedWheelM>
      259500&&row.isolatedWheelM<260000&&
      row.contactResolved===false));
    assert.ok(audit.encounters.some(row=>
      Math.abs(row.isolatedWheelM-row.markerDistanceM)>1e-3));
    for(const event of audit.encounters)
      for(const [side,energy] of [
        ['isolated',event.isolatedEnergyAtApproach],
        ['active',event.activeEnergyAtApproach]]){
        const frames=event.paidSplit[side].frames;
        const spent=frames.reduce((sum,frame)=>
          sum+frame.riders[0].energySpent,0);
        assert.ok(Math.abs(frames[0].riders[0].energyAtDecision-
          spent-energy)<1e-7);
        assert.ok(Math.abs(frames.at(-1).riders[0].energyAfter-
          energy)<1e-7);
      }
    assert.equal(validateFinaleMixedPost500IndividualAudit(
      tour,clock,line,audit),true);
    assert.equal(audit.classifiedResults,null);
    assert.equal(audit.pointsStatus,'withheld');
    const lanes=recordFinaleMixedPost500OutsideLaneAudit(tour,
      clock,line);
    assert.equal(lanes.laneAssignments.length,
      line.bandRunners.filter(row=>
        row.roadBandId.startsWith('isolated:')).length);
    assert.equal(new Set(lanes.laneAssignments.map(row=>
      row.lane)).size,lanes.laneAssignments.length);
    assert.equal(lanes.encounters.length,audit.encounters.length);
    for(const event of lanes.encounters)
      for(const side of ['isolated','active']){
        const paid=event.paidContinuation[side];
        assert.ok(Math.abs(paid.energyAtApproach-
          paid.spentAfterApproach-paid.energyAtLine)<1e-7);
      }
    assert.ok(lanes.pairwisePasses.some(row=>
      row.rule==='former_leader_outside_road_2'));
    assert.equal(lanes.classifiedResults,null);
    assert.equal(lanes.pointsStatus,'withheld');
    assert.equal(lanes.contactResolved,false);
    assert.equal(validateFinaleMixedPost500OutsideLaneAudit(tour,
      clock,line,lanes),true);
    const unsafe=structuredClone(line);
    unsafe.bandRunners[0].runner.frames=
      unsafe.bandRunners[1].runner.frames;
    assert.throws(()=>recordFinaleMixedPost500OutsideLaneAudit(
      tour,clock,unsafe),/unpaid active-band encounter/);
    const continued=recordFinaleMixedPost500OutsideLaneLine(tour,
      clock);
    assert.equal(continued.version,
      FINALE_MIXED_POST500_OUTSIDE_LANE_LINE_VERSION);
    assert.equal(continued.provisionalLineOrder.length,teamCount*8);
    assert.equal(continued.finalRoadBands.reduce((sum,band)=>
      sum+band.riderIds.length,0),teamCount*8);
    assert.equal(continued.laneAudit.encounters.length,
      audit.encounters.length);
    assert.equal(continued.classifiedResults,null);
    assert.equal(continued.pointsStatus,'withheld');
    assert.equal(continued.canCommitAwards,false);
    assert.equal(validateFinaleMixedPost500OutsideLaneLine(
      tour,clock,{},continued),true);
  }
});

test('post-500 outside lanes continue whole races with conditional viewer road',()=>{
  for(const [gender,terrain] of [
    ['M','rolling'],['F','rolling'],['M','mountain'],['F','mountain']]){
    const input=settings(15,gender,terrain);
    const race=createV93PlayableTest(input,{pointContext:{tier:2,
      divisionIndex:0,divisionCount:1}});
    assert.equal(race.version,
      V93_MIXED_THREE_FRONT_POST500_LANES_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(input,
      {pointContext:{tier:2,divisionIndex:0,divisionCount:1}},
      race),true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.lastKmRoad.length,7);
    assert.deepEqual(summary.lastKmRoad.slice(2).map(row=>
      row.distanceM),[259600,259700,259800,259900,260000]);
    assert.ok(summary.lastKmRoad.slice(2).every(row=>
      row.groups.map(group=>group.id).join(',')===
        'road-1,road-2,road-3'&&
      row.droppedPassages.every(pass=>
        pass.contactDistanceM===null&&
        pass.contactStatus==='separate_inferred_outside_lane')&&
      row.ownRiderEnergy.length===8));
    assert.equal(summary.bandReplays.reduce((sum,band)=>
      sum+band.riderIds.length,0),120);
    assert.equal(summary.post500OutsideLanePasses.length,
      race.post500Result.line.laneAudit.encounters.length);
    assert.ok(summary.post500OutsideLanePasses.every(row=>
      row.atDistanceM>259500&&row.atDistanceM<260000&&
      row.occupiedWheelOrderResolved===false));
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.classifiedResults,null);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    assert.throws(()=>createV93PlayableTest(input,{},
      {resolveMixedThreeFrontPost500Pass:false}),
    /depleted line bands crossed without contact/);
  }
});

test('straddling 500 m marker candidates remain unsupported',()=>{
  const tour=recording(20,'F','rolling');
  const audit=recordFinaleMixedStraddlingHandoffAudit(tour);
  assert.equal(audit.paidRiderCount,160);
  assert.equal(audit.handoffRiderEnergy.length,160);
  assert.equal(audit.beforeHandoff.length,3);
  assert.equal(audit.afterHandoff.length,4);
  assert.ok(audit.beforeHandoff.every(row=>row.distanceM<259500));
  assert.ok(audit.afterHandoff.every(row=>row.distanceM>259500));
  assert.equal(audit.contactResolved,false);
  assert.equal(audit.classifiedResults,null);
  assert.equal(audit.pointsStatus,'withheld');
  assert.equal(validateFinaleMixedStraddlingHandoffAudit(tour,audit),true);
  const individual=recordFinaleMixedStraddlingIndividualAudit(tour);
  assert.equal(individual.approaches.length,7);
  assert.equal(individual.stillSeparatedAtHandoff.length,0);
  assert.ok(individual.approaches.every(row=>
    row.isolatedWheelM>259485&&row.isolatedWheelM<259500&&
    row.activeRiderId==='rival-5-7'&&
    row.contactResolved===false&&
    Math.abs(row.isolatedWheelM-row.activeWheelM-2.5)<1e-7&&
    Math.abs(row.paidSplit.isolated.frames.at(-1).riders[0]
      .energyAfter-row.isolatedEnergyAtApproach)<1e-7&&
    Math.abs(row.paidSplit.active.frames.at(-1).riders[0]
      .energyAfter-row.activeEnergyAtApproach)<1e-7));
  assert.equal(individual.classifiedResults,null);
  assert.equal(individual.pointsStatus,'withheld');
  assert.equal(validateFinaleMixedStraddlingIndividualAudit(tour,
    individual),true);
  assert.throws(()=>
    recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour),
    /paid post-500 m candidate clock/);
});
