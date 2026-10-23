import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const tactics=[{effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:20,gender:'F',terrain:'rolling',
  fatigue:30,seed:'v93-matrix-86',defaultRivalPlan:'passive',
  effort:'hard',attack:'selective',chase:'selective',
  profileHeightsM:[100,250,500,250,400,100],
  managerTactics:Array.from({length:19},(_,index)=>
    tactics[(index+86)%4])};
const pointContext={tier:3,divisionCount:4,divisionIndex:2};

function race(options={}){
  const plans=['you',...Array.from({length:19},(_,index)=>
    `rival-${index+1}`)].map(teamId=>({teamId,
    finisherId:`${teamId}-4`,leadOutRiderId:
      ['you','rival-1'].includes(teamId)?`${teamId}-6`:null}));
  for(;;){
    try{return {plans,recorded:createV93PlayableTest(settings,
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

test('full-kilometre isolated lanes preserve paid road, ties and replay',()=>{
  const {recorded,plans}=race();
  const summary=summarizeV93CoastedPlaytest(recorded);
  assert.equal(recorded.version,
    'v93-coast-full-km-isolated-lanes-playtest-1');
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.provisionalLineOrder.length,160);
  assert.ok(summary.isolatedLaneEncounters.some(row=>
    row.distanceM<259500));
  assert.ok(summary.isolatedLaneEncounters.some(row=>
    row.distanceM>259500));
  assert.equal(summary.potentialRoadContact,undefined);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.match(summary.pointPreview.reason,/Tied conditional crossings/);
  assert.ok(summary.provisionalLineOrder.some(row=>
    row.position===null&&row.firstPossiblePlace<row.lastPossiblePlace));
  assert.equal(summary.canCommitAwards,false);
  const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  for(const replay of summary.bandReplays)
    for(const row of replay.frames.at(-1).riders){
      const finish=crossings.get(row.riderId);
      assert.equal(finish.roadBandId,replay.id);
      assert.equal(finish.elapsedSecondsFromLastKmStart,
        row.elapsedToLineSeconds);
      assert.equal(finish.energyAtLine,row.energyAfter);
    }
  assert.equal(validateV93CoastedPlaytest(settings,
    {plans,pointContext},recorded),true);
});

test('the earlier unresolved recording still replays',()=>{
  const {recorded,plans}=race({resolveIsolatedPasses:false});
  assert.equal(recorded.version,'v93-coasted-playtest-1');
  assert.equal(recorded.individualLine.provisionalLineOrder,null);
  assert.equal(recorded.pointPreview.status,'unavailable');
  assert.equal(validateV93CoastedPlaytest(settings,
    {plans,pointContext},recorded),true);
});
