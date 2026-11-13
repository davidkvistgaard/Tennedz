import test from 'node:test';
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const settings={distanceKm:260,teamCount:4,gender:'M',terrain:'flat',
  fatigue:15,seed:'v93-diversity-1',defaultRivalPlan:'mixed',
  attack:'selective',chase:'all',effort:'steady',
  profileHeightsM:[100,350,150,500,180,100]};
const pointContext={tier:1,divisionIndex:1,divisionCount:1};

test('paid isolated passes reach replay, line and read-only points',()=>{
  for(const options of [{pointContext},{}]){
    const race=createV93PlayableTest(settings,options);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,'v93-coast-isolated-pass-playtest-1');
    assert.equal(summary.isolatedPassEvents.length,4);
    assert.equal(summary.potentialRoadContact,undefined);
    assert.equal(summary.provisionalLineOrder.length,32);
    assert.equal(race.individualLine.pre500Audit.contactResolved,true);
    assert.deepEqual(summary.isolatedPassEvents.map(row=>[
      row.passingRiderId,row.passedRiderId]),[
      ['rival-1-3','rival-1-4'],
      ['rival-1-2','rival-1-4'],
      ['rival-1-0','rival-1-6'],
      ['rival-1-0','rival-1-4']]);
    for(const event of summary.isolatedPassEvents){
      assert.ok(event.distanceM>259000&&event.distanceM<259500);
      assert.equal(event.laneRule,'isolated_open_lane_no_draft');
      for(const id of [event.passingRiderId,event.passedRiderId]){
        const crossing=summary.lineTimes.find(row=>row.riderId===id);
        const replay=summary.bandReplays.find(row=>
          row.id===`isolated:${id}`);
        const final=replay.frames.at(-1).riders.find(row=>
          row.riderId===id);
        assert.equal(crossing.roadBandId,replay.id);
        assert.equal(final.elapsedToLineSeconds,
          crossing.elapsedSecondsFromLastKmStart);
        assert.equal(final.energyAfter,crossing.energyAtLine);
      }
    }
    if(options.pointContext){
      assert.equal(summary.pointPreview.awardRows.length,0);
      assert.equal(summary.pointPreview.riders.length,32);
      for(const row of summary.pointPreview.riders)
        assert.equal(row.previewPoints,pointsForDivisionResult({
          tier:1,resultType:'ONE_DAY',placing:row.provisionalPlace,
          multiplier:summary.pointPreview.multiplier}));
    }
    assert.equal(validateV93CoastedPlaytest(settings,options,race),true);
  }
});

test('the older unresolved contact recording remains replayable',()=>{
  for(const options of [{pointContext},{}]){
    const race=createV93PlayableTest(settings,options,{
      resolveIsolatedPasses:false});
    const summary=summarizeV93CoastedPlaytest(race);
    const contact=summary.potentialRoadContact;
    assert.equal(race.version,'v93-coasted-playtest-1');
    assert.equal(summary.pointPreview?.status,
      options.pointContext?'unavailable':undefined);
    assert.equal(summary.provisionalLineOrder,null);
    assert.equal(summary.isolatedPassEvents,undefined);
    assert.equal(contact.sourcePhase,'paid_first_500m');
    assert.deepEqual(contact.riderIds,['rival-1-3','rival-1-4']);
    assert.ok(contact.distanceM>259000&&contact.distanceM<259250);
    assert.equal(contact.contactResolved,false);
    const current=createV93PlayableTest(settings,options);
    assert.deepEqual(race.recording,current.recording);
    assert.deepEqual(race.clock,current.clock);
    assert.deepEqual(race.individualLine.bandRunners,
      current.individualLine.bandRunners);
    assert.deepEqual(race.individualLine.conditionalCrossings,
      current.individualLine.conditionalCrossings);
    assert.equal(validateV93CoastedPlaytest(settings,options,race),true);
  }
});
