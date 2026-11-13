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

const mixedRivalTactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'repeated',chase:'selective'}];

for(const scenario of [
  {index:8,gender:'M',terrain:'exposed',fatigue:15,chase:'all',
    bandSizes:[28,94,38]},
  {index:17,gender:'F',terrain:'mountain',fatigue:30,
    chase:'selective',bandSizes:[28,86,46]}]){
  test(`front leavers stay paid ahead of the bunch in mixed race ${scenario.index}`,
    ()=>{
      const settings={distanceKm:260,teamCount:20,gender:scenario.gender,
        terrain:scenario.terrain,fatigue:scenario.fatigue,
        seed:`v93-mixed-probe-${scenario.index}`,effort:'hard',
        attack:'repeated',chase:scenario.chase,
        defaultRivalPlan:'passive',managerTactics:Array.from({length:19},
          (_row,index)=>mixedRivalTactics[(index+scenario.index)%3])};
      const input={pointContext};
      const race=createV93PlayableTest(settings,input);
      const summary=summarizeV93CoastedPlaytest(race);
      const exits=race.clock.trace.frames.flatMap(frame=>
        frame.frontExhaustionDrops);
      assert.equal(race.version,'v93-dynamic-front-playtest-1');
      assert.equal(race.clock.line.outcome,
        'front_leavers_ahead_of_bunch_contact_unresolved');
      assert.deepEqual(race.clock.line.bands.map(band=>band.riderIds.length),
        scenario.bandSizes);
      assert.deepEqual(exits.map(row=>row.riderId),
        scenario.index===8?['you-4','you-7']:['you-3','you-0']);
      assert.ok(exits.every(row=>row.atDistanceM===259000));
      assert.equal(summary.roadStatus,
        'conditional_front_leavers_ahead_of_bunch');
      assert.equal(summary.lineTimes.length,160);
      assert.equal(new Set(summary.lineTimes.map(row=>row.riderId)).size,160);
      assert.equal(summary.pointPreview.status,'unavailable');
      assert.equal(summary.pointPreview.canCommitAwards,false);
      assert.equal(summary.provisionalLineOrder,null);
      assert.equal(summary.canCommitAwards,false);
      const replayById=new Map(summary.bandReplays.flatMap(band=>
        band.frames.at(-1).riders.map(row=>[row.riderId,
          {bandId:band.id,row}])));
      for(const crossing of summary.lineTimes){
        const replay=replayById.get(crossing.riderId);
        assert.equal(crossing.roadBandId,replay.bandId);
        assert.equal(crossing.elapsedSecondsFromLastKmStart,
          replay.row.elapsedToLineSeconds);
        assert.equal(crossing.energyAtLine,replay.row.energyAfter);
      }
      for(const frame of race.clock.passageFrames){
        const bunch=frame.bunchPassageSecondsFromBunchMarker;
        assert.ok(frame.groups.every(group=>
          group.passageSecondsFromBunchMarker<bunch));
        assert.ok(exits.every(exit=>{
          const row=frame.droppedPassages.find(value=>
            value.riderId===exit.riderId);
          return row.contactDistanceM===null&&
            row.passageSecondsFromBunchMarker<bunch;
        }));
      }
      assert.equal(validateV93CoastedPlaytest(settings,input,race),true);
    });
}
