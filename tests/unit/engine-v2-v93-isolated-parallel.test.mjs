import test from 'node:test';
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const tactics=[{effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:4,gender:'M',terrain:'mountain',
  fatigue:30,seed:'v93-matrix-62',defaultRivalPlan:'passive',
  effort:'hard',attack:'selective',chase:'all',
  profileHeightsM:[100,250,500,250,400,100],
  managerTactics:Array.from({length:3},(_,rival)=>tactics[(rival+62)%4])};
const pointContext={tier:3,divisionCount:4,divisionIndex:2};
function playable(options={}){
  const plans=['you','rival-1','rival-2','rival-3'].map(teamId=>({
    teamId,finisherId:`${teamId}-4`,leadOutRiderId:
      ['you','rival-1'].includes(teamId)?`${teamId}-6`:null}));
  for(;;){
    try{return {plans,race:createV93PlayableTest(settings,
      {plans,pointContext},options)};}
    catch(error){
      const helper=plans.find(row=>row.teamId===error.cause?.teamId&&
        row.leadOutRiderId===error.cause?.helperId);
      if(!helper||!['exhausted','different_road_group']
        .includes(error.cause?.reason))throw error;
      helper.leadOutRiderId=null;
    }
  }
}

test('isolated parallel start carries whole race to paid line and points',()=>{
  const {race,plans}=playable();
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(race.version,'v93-coast-isolated-parallel-playtest-1');
  assert.equal(summary.isolatedParallelStarts.length,1);
  assert.deepEqual(summary.isolatedParallelStarts[0].riderIds,
    ['you-1','you-7']);
  assert.equal(summary.isolatedParallelStarts[0].distanceM,259000);
  assert.equal(summary.provisionalLineOrder.length,32);
  assert.equal(summary.potentialRoadContact,undefined);
  assert.equal(summary.lineTimes.length,32);
  assert.equal(summary.pointPreview.riders.length,32);
  assert.equal(summary.pointPreview.awardRows.length,0);
  assert.equal(summary.canCommitAwards,false);
  const crossing=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  for(const replay of summary.bandReplays)
    for(const row of replay.frames.at(-1).riders){
      const finish=crossing.get(row.riderId);
      assert.equal(finish.roadBandId,replay.id);
      assert.equal(finish.elapsedSecondsFromLastKmStart,
        row.elapsedToLineSeconds);
      assert.equal(finish.energyAtLine,row.energyAfter);
    }
  for(const row of summary.pointPreview.riders)
    assert.equal(row.previewPoints,pointsForDivisionResult({
      tier:3,resultType:'ONE_DAY',placing:row.provisionalPlace,
      multiplier:summary.pointPreview.multiplier}));
  assert.equal(validateV93CoastedPlaytest(settings,
    {plans,pointContext},race),true);
});

test('the older unresolved no-front recording remains replayable',()=>{
  const {race,plans}=playable({resolveIsolatedPasses:false});
  assert.equal(race.version,'v93-coast-no-front-playtest-1');
  assert.equal(race.individualLine.provisionalLineOrder,null);
  assert.equal(race.pointPreview.status,'unavailable');
  assert.equal(validateV93CoastedPlaytest(settings,
    {plans,pointContext},race),true);
});
