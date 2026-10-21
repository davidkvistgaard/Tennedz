import test from 'node:test';
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinalePre500FrontExit} from
  '../../lib/engine/v2/finale-pre500-active-overlap-audit.mjs';

const settings={distanceKm:260,teamCount:20,gender:'M',
  terrain:'rolling',fatigue:15,seed:'v93-diversity-2',
  defaultRivalPlan:'attack',attack:'repeated',chase:'ignore',
  effort:'hard',profileHeightsM:[100,350,150,500,180,100]};
const pointContext={tier:3,divisionIndex:2,divisionCount:4};

test('a paid front exit reaches an individual line and read-only points',()=>{
  const input={pointContext};
  const current=createV93PlayableTest(settings,input);
  const old=createV93PlayableTest(settings,input,
    {resolveFrontExits:false});
  const summary=summarizeV93CoastedPlaytest(current);
  assert.equal(current.version,'v93-coast-front-exit-playtest-1');
  assert.equal(old.version,'v93-dynamic-single-playtest-1');
  assert.equal(old.pointPreview.status,'unavailable');
  assert.equal(old.individualLine.provisionalLineOrder,null);
  assert.deepEqual(current.recording,old.recording);
  assert.deepEqual(current.clock,old.clock);
  assert.deepEqual(current.individualLine.bandRunners,
    old.individualLine.bandRunners);
  assert.deepEqual(current.individualLine.conditionalCrossings,
    old.individualLine.conditionalCrossings);
  assert.deepEqual(summary.frontExit.exitRiderIds,['you-6','you-7']);
  assert.equal(summary.frontExit.fromRoadGroupId,'road-2');
  assert.equal(summary.frontExit.frontRiderCount,38);
  assert.equal(summary.frontExit.laneRule,'front_exit_shoulder_no_draft');
  assert.ok(summary.frontExit.clearance.every(row=>
    row.frontClearanceSecondsAt250>11&&
    row.frontClearanceSecondsAt500>24));
  assert.equal(summary.potentialRoadContact,undefined);
  assert.equal(summary.provisionalLineOrder.length,160);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.pointPreview.riders.length,160);
  assert.deepEqual(summary.pointPreview.awardRows,[]);
  assert.equal(summary.pointPreview.canCommitAwards,false);
  for(const row of summary.pointPreview.riders)
    assert.equal(row.previewPoints,pointsForDivisionResult({
      tier:pointContext.tier,resultType:'ONE_DAY',
      placing:row.provisionalPlace,
      multiplier:summary.pointPreview.multiplier}));
  for(const id of summary.frontExit.exitRiderIds){
    const crossing=summary.lineTimes.find(row=>row.riderId===id);
    const replay=summary.bandReplays.find(row=>
      row.id===`isolated:${id}`);
    const final=replay.frames.at(-1).riders.find(row=>row.riderId===id);
    assert.equal(crossing.roadBandId,replay.id);
    assert.equal(crossing.elapsedSecondsFromLastKmStart,
      final.elapsedToLineSeconds);
    assert.equal(crossing.energyAtLine,final.energyAfter);
  }
  assert.equal(validateV93CoastedPlaytest(settings,input,current),true);
  assert.equal(validateV93CoastedPlaytest(settings,input,old),true);
  const tampered=structuredClone(current);
  tampered.individualLine.pre500Audit.clearance[0]
    .frontClearanceSecondsAt250=0;
  assert.throws(()=>validateV93CoastedPlaytest(settings,input,tampered),
    /does not replay/);
});

test('an unrecorded bunch contact refuses the front exit rule',()=>{
  const race=createV93PlayableTest(settings);
  const clock=structuredClone(race.clock);
  clock.trace.frames[0].droppedTravel.riders[0]
    .contactDistanceM=259125;
  assert.equal(recordFinalePre500FrontExit(race.recording,clock,
    race.individualLine.positionedSource),null);
});
