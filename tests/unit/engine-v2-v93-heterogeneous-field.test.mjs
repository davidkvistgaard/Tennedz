import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {recordFinaleCoastMixedTwoFrontDroppedClock,
  validateFinaleCoastMixedTwoFrontDroppedClock,
  FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';

test('unequal-strength whole race refuses unresolved two-front exits',()=>{
  const teamCount=4;
  const settings={distanceKm:260,teamCount,gender:'M',terrain:'flat',
    fatigue:30,seed:'v93-heterogeneous-4-M-flat-30',
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','steady','conserve'][index%3],
      attack:index%3===0?'repeated':'selective',
      chase:index%3===1?'all':'selective'})),
    teamOverrides:[{teamId:'you',level:45},
      ...Array.from({length:teamCount-1},(_,index)=>({
        teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'steady',chase:'all'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
  let refusal;
  try{createV93PlayableTest(settings);}catch(error){refusal=error;}
  assert.match(refusal?.message??'',
    /The depleted line bands crossed without contact/);
  assert.equal(refusal.roadPreview.unsupportedReason,
    'unresolved_band_contact');
  assert.deepEqual(refusal.roadPreview.kilometreFrames.at(-1)
    .roadGroups.map(row=>[row.id,row.riderIds.length]),
  [['road-2',4],['road-4',4]]);
  assert.equal(refusal.roadPreview.lastKmRoad.length,0);
  assert.equal(refusal.roadPreview.lineTimes,null);
  assert.equal(refusal.roadPreview.pointsStatus,'withheld');
  assert.equal(refusal.roadPreview.canCommitAwards,false);

  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const source=finaleSnapshotFromTour(recording,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
  assert.equal(source.droppedRiderIds.length,12);
  assert.equal(trace.frames.length,7);
  const exits=trace.frames.flatMap(frame=>frame.frontExhaustionDrops);
  assert.equal(exits.length,4);
  assert.deepEqual([...new Set(exits.map(row=>row.fromRoadGroupId))],
    ['road-2','road-4']);
  assert.ok(exits.every(row=>row.atDistanceM===259000));
  assert.ok(trace.frames.every(frame=>
    frame.roadGroups.length===2&&
    !frame.exhaustionDrops.length&&
    !frame.frontGroupDissolutions?.length));
  const candidate=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  assert.equal(candidate.version,
    FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION);
  assert.equal(candidate.line.outcome,
    'mixed_two_front_leavers_with_older_drops_clear');
  assert.deepEqual(candidate.line.bands.map(row=>row.riderIds.length),
    [4,4,12,12]);
  assert.equal(candidate.trace.finalRiderEnergy.length,32);
  assert.equal(candidate.passageFrames.length,7);
  assert.equal(validateFinaleCoastMixedTwoFrontDroppedClock(recording,
    candidate),true);
  const line=recordFinaleCoastedIndividualLine(recording,candidate);
  assert.equal(line.conditionalCrossings.length,32);
  assert.equal(line.roadStatus,
    'conditional_mixed_two_front_older_drops_lines');
  assert.equal(line.pre500Audit.contactResolved,false);
  assert.equal(line.provisionalLineOrder,null);
  const at500=new Map(candidate.trace.frames.find(frame=>
    frame.endDistanceM===259500).riders.map(row=>[
    row.riderId,row.energy]));
  const crossings=new Map(line.conditionalCrossings.map(row=>[
    row.riderId,row]));
  const finished=new Set();
  for(const band of line.bandRunners){
    for(const row of band.runner.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-at500.get(row.riderId))<1e-7);
    for(const row of band.runner.finishers){
      assert.equal(finished.has(row.riderId),false);
      finished.add(row.riderId);
      assert.ok(Math.abs(row.energyAtLine-
        crossings.get(row.riderId).energyAtLine)<1e-7);
    }
  }
  assert.equal(finished.size,32);
});
