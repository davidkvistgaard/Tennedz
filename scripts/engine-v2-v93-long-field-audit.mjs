// Full-race, fictional v93 acceptance sweep. An unavailable helper can be
// removed from the plan without changing the locked road or the race seed.
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const context={tier:2,divisionCount:2,divisionIndex:1};
const terrains=['flat','rolling','mountain','exposed','custom'];
const efforts=['steady','hard','conserve'];
const attacks=['none','selective','repeated'];
const chases=['ignore','selective','all'];
const rivalTactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'}];
const managerIds=['you',...Array.from({length:19},(_,index)=>
  `rival-${index+1}`)];
const cases=[];

for(let index=0;index<48;index++){
  const settings={distanceKm:260,teamCount:20,
    gender:index%2?'F':'M',terrain:terrains[index%5],
    fatigue:[0,15,30][index%3],
    seed:`v93-long-stress-${Math.floor(index/6)}`,
    defaultRivalPlan:'passive',effort:efforts[index%3],
    attack:attacks[Math.floor(index/2)%3],
    chase:chases[Math.floor(index/3)%3],
    profileHeightsM:[100,350,150,500,180,100],
    managerTactics:Array.from({length:19},(_,rivalIndex)=>
      rivalTactics[(rivalIndex+index)%3])};
  const plans=managerIds.map(teamId=>({teamId,
    finisherId:`${teamId}-7`,
    leadOutRiderId:['you','rival-1'].includes(teamId)?
      `${teamId}-6`:null}));
  const declinedHelpers=[];
  let race;
  for(;;){
    try{race=createV93PlayableTest(settings,{plans,pointContext:context});
      break;}
    catch(error){
      const refused=plans.find(plan=>plan.teamId===error.cause?.teamId&&
        plan.leadOutRiderId===error.cause?.helperId);
      if(!refused||!['different_road_group','exhausted']
        .includes(error.cause?.reason)){
        error.message=`Long-field case ${index}: ${error.message}`;
        throw error;
      }
      declinedHelpers.push({teamId:refused.teamId,
        reason:error.cause.reason});
      refused.leadOutRiderId=null;
    }
  }
  assert.equal(validateV93CoastedPlaytest(settings,{plans,
    pointContext:context},race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.kilometreFrames.length,259);
  assert.equal(summary.managerOrders.length,20);
  assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  assert.deepEqual(summary.pointPreview.awardRows??[],[]);
  const acceptedHelpers=plans.filter(plan=>plan.leadOutRiderId);
  assert.deepEqual(summary.managerDecisions.filter(row=>
    row.leadOutRiderId).map(row=>({teamId:row.teamId,
      leadOutRiderId:row.leadOutRiderId})).sort((a,b)=>
      a.teamId.localeCompare(b.teamId)),
    acceptedHelpers.map(row=>({teamId:row.teamId,
      leadOutRiderId:row.leadOutRiderId})).sort((a,b)=>
      a.teamId.localeCompare(b.teamId)));
  for(const helper of acceptedHelpers)
    assert.ok(summary.leadOutWork.some(row=>
      row.riderId===helper.leadOutRiderId&&row.energySpent>0));
  const crossings=new Map(summary.lineTimes.map(row=>
    [row.riderId,row]));
  assert.equal(crossings.size,160);
  const replayed=new Set();
  for(const band of summary.bandReplays)
    for(const row of band.frames.at(-1).riders){
      assert.equal(replayed.has(row.riderId),false);
      replayed.add(row.riderId);
      const crossing=crossings.get(row.riderId);
      assert.ok(crossing);
      assert.equal(crossing.roadBandId,band.id);
      assert.equal(crossing.elapsedSecondsFromLastKmStart,
        row.elapsedToLineSeconds);
      assert.equal(crossing.energyAtLine,row.energyAfter);
    }
  assert.equal(replayed.size,160);
  if(summary.pointPreview.status!=='unavailable'){
    const places=new Map(summary.provisionalLineOrder.map(row=>
      [row.riderId,row.position]));
    assert.equal(places.size,160);
    for(const row of summary.pointPreview.riders){
      assert.equal(row.provisionalPlace,places.get(row.riderId));
      assert.equal(row.previewPoints,pointsForDivisionResult({
        tier:context.tier,resultType:'ONE_DAY',
        placing:row.provisionalPlace,
        multiplier:summary.pointPreview.multiplier}));
    }
  }
  cases.push({index,gender:settings.gender,terrain:settings.terrain,
    fatigue:settings.fatigue,roadStatus:summary.roadStatus,
    pointStatus:summary.pointPreview.status??'illustrative',
    acceptedHelpers:acceptedHelpers.length,declinedHelpers});
}

const completed=cases.length;
const declinedHelpers=cases.reduce((sum,row)=>
  sum+row.declinedHelpers.length,0);
const acceptedHelpers=cases.reduce((sum,row)=>
  sum+row.acceptedHelpers,0);
const unavailablePoints=cases.filter(row=>
  row.pointStatus==='unavailable').length;
assert.equal(completed,48);
assert.ok(declinedHelpers>0&&acceptedHelpers>0);
assert.ok(unavailablePoints>0&&unavailablePoints<completed);
console.log(JSON.stringify({completed,declinedHelpers,acceptedHelpers,
  unavailablePoints,illustratedPoints:completed-unavailablePoints,
  roadStatuses:[...new Set(cases.map(row=>row.roadStatus))],
  cases},null,2));
