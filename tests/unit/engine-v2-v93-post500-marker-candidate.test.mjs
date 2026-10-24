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
  FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleDepletedIndividualLine,
  FINALE_POST500_MARKER_CANDIDATE_INDIVIDUAL_LINE_VERSION} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedPost500IndividualAudit,
  validateFinaleMixedPost500IndividualAudit} from
  '../../lib/engine/v2/finale-mixed-post500-individual-audit.mjs';

function recording(teamCount,gender,terrain){
  const settings={distanceKm:260,teamCount,gender,terrain,fatigue:30,
    seed:`v93-next-contact-field-hills-${teamCount}-${gender}-${terrain}-30-1`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','conserve','steady'][(index+1)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  return simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
}

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
  }
});

test('straddling 500 m marker candidates remain unsupported',()=>{
  const tour=recording(20,'F','rolling');
  assert.throws(()=>
    recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour),
    /paid post-500 m candidate clock/);
});
