// Full-race synthetic acceptance matrix across route, category and field size.
// Refusals are reported as evidence; no result or award is committed.
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const distances=[40,120,260];
const teamCounts=[4,15,20];
const genders=['M','F'];
const terrains=['flat','rolling','mountain','exposed','custom'];
const rivalTactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const context={tier:3,divisionCount:4,divisionIndex:2};
const cases=[];
let index=0;
for(const distanceKm of distances)for(const teamCount of teamCounts)
  for(const gender of genders)for(const terrain of terrains){
    const fatigue=[0,15,30][index%3];
    const customManagers=index%3===0?
      Math.min(3,teamCount-1):teamCount-1;
    const settings={distanceKm,teamCount,gender,terrain,fatigue,
      seed:`v93-matrix-${index}`,defaultRivalPlan:'passive',
      effort:['conserve','steady','hard'][index%3],
      attack:['none','selective','repeated'][Math.floor(index/2)%3],
      chase:['ignore','selective','all'][Math.floor(index/3)%3],
      profileHeightsM:index%2?
        [500,350,200,400,250,100]:[100,250,500,250,400,100],
      managerTactics:Array.from({length:customManagers},(_row,rival)=>
        rivalTactics[(rival+index)%rivalTactics.length])};
    const plans=['you',...Array.from({length:teamCount-1},(_,n)=>
      `rival-${n+1}`)].map(teamId=>({teamId,
      finisherId:`${teamId}-${index%2?7:4}`,
      leadOutRiderId:['you','rival-1'].includes(teamId)?
        `${teamId}-6`:null}));
    const helperRefusals=[];
    let race,refusal=null;
    for(;;){
      try{race=createV93PlayableTest(settings,{plans,
        pointContext:context});break;}
      catch(error){
        const helper=plans.find(row=>row.teamId===error.cause?.teamId&&
          row.leadOutRiderId===error.cause?.helperId);
        if(helper&&['exhausted','different_road_group']
          .includes(error.cause?.reason)){
          helperRefusals.push({teamId:helper.teamId,
            reason:error.cause.reason});
          helper.leadOutRiderId=null;
          continue;
        }
        refusal={message:error.message,cause:error.cause??null,
          paidRoad:!!error.roadPreview};
        break;
      }
    }
    if(race){
      assert.equal(validateV93CoastedPlaytest(settings,{plans,
        pointContext:context},race),true);
      const summary=summarizeV93CoastedPlaytest(race);
      const acceptedHelpers=plans.filter(row=>row.leadOutRiderId);
      for(const helper of acceptedHelpers)
        assert.ok(summary.leadOutWork.some(row=>
          row.riderId===helper.leadOutRiderId&&row.energySpent>0));
      const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
      const at500=race.clock.trace.frames.find(frame=>
        frame.endDistanceM===distanceKm*1000-500);
      const energy=new Map(at500.riders.map(row=>
        [row.riderId,row.energy]));
      const replayed=new Set();
      for(const band of summary.bandReplays){
        const first=band.frames[0];
        const last=band.frames.at(-1);
        for(const row of first.riders)
          assert.equal(row.energyAtDecision,energy.get(row.riderId));
        for(const row of last.riders){
          assert.equal(replayed.has(row.riderId),false);
          replayed.add(row.riderId);
          const crossing=crossings.get(row.riderId);
          assert.equal(crossing?.roadBandId,band.id);
          assert.equal(crossing.elapsedSecondsFromLastKmStart,
            row.elapsedToLineSeconds);
          assert.equal(crossing.energyAtLine,row.energyAfter);
        }
      }
      assert.equal(replayed.size,teamCount*8);
      assert.equal(summary.canCommitAwards,false);
      assert.equal(summary.pointsStatus,'withheld');
      if(summary.pointPreview.status!=='unavailable'){
        const places=new Map(summary.provisionalLineOrder.map(row=>
          [row.riderId,row.position]));
        for(const row of summary.pointPreview.riders){
          assert.equal(row.provisionalPlace,places.get(row.riderId));
          assert.equal(row.previewPoints,pointsForDivisionResult({
            tier:context.tier,resultType:'ONE_DAY',
            placing:row.provisionalPlace,
            multiplier:summary.pointPreview.multiplier}));
        }
      }
      cases.push({index,distanceKm,teamCount,gender,terrain,fatigue,
        customManagers,
        helperRefusals,acceptedHelpers:acceptedHelpers.length,
        roadStatus:summary.roadStatus,
        points:summary.pointPreview.status??'illustrative'});
    }else cases.push({index,distanceKm,teamCount,gender,terrain,
      customManagers,
      fatigue,helperRefusals,refusal});
    index++;
  }

const completed=cases.filter(row=>!row.refusal).length;
const pointIllustrations=cases.filter(row=>
  row.points==='illustrative').length;
const refusals=cases.filter(row=>row.refusal);
const acceptedHelpers=cases.reduce((sum,row)=>
  sum+(row.acceptedHelpers??0),0);
assert.equal(cases.length,90);
assert.equal(completed,90);
assert.ok(pointIllustrations>0&&pointIllustrations<completed);
assert.ok(acceptedHelpers>0&&cases.some(row=>row.helperRefusals.length));
assert.ok(cases.some(row=>row.customManagers<row.teamCount-1));
console.log(JSON.stringify({scenarios:cases.length,completed,
  pointIllustrations,acceptedHelpers,
  helperRefusals:cases.reduce((sum,row)=>
    sum+row.helperRefusals.length,0),refusals,
  defaultTacticCases:cases.filter(row=>
    row.customManagers<row.teamCount-1).length,
  byDistance:distances.map(distanceKm=>({distanceKm,
    completed:cases.filter(row=>row.distanceKm===distanceKm&&
      !row.refusal).length})),
  byField:teamCounts.map(teamCount=>({teamCount,
    completed:cases.filter(row=>row.teamCount===teamCount&&
      !row.refusal).length})),
  byGender:genders.map(gender=>({gender,
    completed:cases.filter(row=>row.gender===gender&&
      !row.refusal).length})),
  byTerrain:terrains.map(terrain=>({terrain,
    completed:cases.filter(row=>row.terrain===terrain&&!row.refusal).length,
    refusals:cases.filter(row=>row.terrain===terrain&&row.refusal).length}))},
null,2));
