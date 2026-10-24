import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_MIXED_THREE_FRONT_PRE500_PASS_PLAYTEST_VERSION,
  V93_UNRESOLVED_FRONT_MARKER_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(teamCount,gender,terrain){
  const seedIndex=1;
  return {distanceKm:260,teamCount,gender,terrain,fatigue:30,
    seed:`v93-next-contact-field-hills-${teamCount}-${gender}-${terrain}-30-1`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','conserve','steady'][(index+seedIndex)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

test('pre-500 m outside-lane passes retain the whole paid race',()=>{
  for(const [gender,terrain] of [
    ['M','mountain'],['F','mountain'],['M','rolling']]){
    const selected=settings(20,gender,terrain);
    const input={pointContext:{tier:2,divisionCount:2,divisionIndex:1}};
    const race=createV93PlayableTest(selected,input);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,
      V93_MIXED_THREE_FRONT_PRE500_PASS_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(selected,input,race),true);
    assert.equal(race.clock.line.outcome,
      'mixed_three_front_pre500_unassisted_pass_with_older_drops');
    assert.equal(race.clock.frontPasses.length,7);
    assert.equal(race.clock.line.bands.length,7);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.mixedFrontLeavers.frontPasses.length,7);
    assert.equal(summary.mixedFrontLeavers.olderDroppedRiderIds.length,5);
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(race.individualLine.pre500ContactStatus,
      'paid_pre500_front_passes_wheels_unresolved');
    const at500=new Map(race.clock.trace.frames.find(frame=>
      frame.endDistanceM===259500).riders.map(row=>
      [row.riderId,row.energy]));
    const atStart=race.clock.passageFrames[0];
    const at500Passage=race.clock.passageFrames.find(frame=>
      frame.distanceM===259500);
    const secondStart=atStart.groups.find(row=>row.id==='road-2')
      .passageSecondsFromBunchMarker;
    const secondAt500=at500Passage.groups.find(row=>row.id==='road-2')
      .passageSecondsFromBunchMarker;
    const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
    const seen=new Set();
    for(const event of race.clock.frontPasses){
      assert.equal(event.groupId,'road-2');
      assert.ok(event.atDistanceM>259000&&event.atDistanceM<259500);
      assert.equal(event.energyAtContact,0);
      assert.equal(event.wheelOrderResolved,false);
      assert.ok(atStart.droppedPassages.find(row=>
        row.riderId===event.riderId).passageSecondsFromBunchMarker<
        secondStart);
      assert.ok(at500Passage.droppedPassages.find(row=>
        row.riderId===event.riderId).passageSecondsFromBunchMarker>
        secondAt500);
    }
    for(const band of summary.bandReplays){
      for(const row of band.frames[0].riders)
        assert.ok(Math.abs(row.energyAtDecision-
          at500.get(row.riderId))<1e-7);
      for(const row of band.frames.at(-1).riders){
        assert.equal(seen.has(row.riderId),false);
        seen.add(row.riderId);
        assert.equal(lines.get(row.riderId).roadBandId,band.id);
        assert.ok(Math.abs(lines.get(row.riderId).energyAtLine-
          row.energyAfter)<1e-7);
      }
    }
    assert.equal(seen.size,160);
    assert.throws(()=>createV93PlayableTest(selected,{},
      {resolveMixedThreeFrontPre500Pass:false}),
    /The depleted line bands crossed without contact/);
  }
});

test('post-500 m front passes still refuse without a paid continuation',()=>{
  for(const [teamCount,gender,terrain] of [
    [15,'M','rolling'],[15,'F','mountain'],[20,'F','rolling']]){
    let refusal;
    try{createV93PlayableTest(settings(teamCount,gender,terrain));}
    catch(error){refusal=error;}
    assert.match(refusal?.message??'',
      /The depleted line bands crossed without contact/);
    const preview=refusal.roadPreview;
    assert.equal(preview.version,
      V93_UNRESOLVED_FRONT_MARKER_PREVIEW_VERSION);
    assert.equal(preview.unsupportedReason,'unresolved_band_contact');
    assert.equal(preview.markerAudit.contactResolved,false);
    assert.equal(preview.markerAudit.pointsStatus,'withheld');
    assert.ok(preview.markerAudit.encounters.length>=5);
    assert.ok(preview.markerAudit.encounters.some(row=>
      row.distanceM>259500));
    assert.equal(preview.lastKmRoad.length,0);
    assert.equal(preview.lineTimes,null);
  }
});
