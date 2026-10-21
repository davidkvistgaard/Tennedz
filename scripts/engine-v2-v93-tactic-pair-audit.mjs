// Synthetic whole-race pairs: hold the route, roster and seed while changing
// one manager attack or the rivals' chase. Never settle points or awards.
import assert from 'node:assert/strict';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const scenarios=[
  [40,4,'M','flat',0],[40,15,'F','rolling',0],
  [40,20,'M','mountain',15],[40,4,'F','custom',30],
  [120,4,'F','exposed',15],[120,15,'M','custom',15],
  [120,20,'F','rolling',30],[120,15,'F','flat',0],
  [260,4,'M','flat',30],[260,15,'F','mountain',15],
  [260,20,'M','exposed',30],[260,20,'F','rolling',15]];
const pointContext={tier:2,divisionCount:2,divisionIndex:1};

function run(index,{attack,chase,leadOutTeams=[],mixed=false}){
  const [distanceKm,teamCount,gender,terrain,fatigue]=scenarios[index];
  const settings={distanceKm,teamCount,gender,terrain,fatigue,
    seed:`v93-tactic-pair-${index}`,profileHeightsM:[100,350,150,500,180,100],
    defaultRivalPlan:'passive',effort:'steady',attack,chase:'ignore',
    managerTactics:Array.from({length:teamCount-1},(_row,rivalIndex)=>
      mixed?[{effort:'hard',attack:'none',chase:'all'},
        {effort:'steady',attack:'selective',chase:'ignore'},
        {effort:'conserve',attack:'none',chase:'selective'}]
        [rivalIndex%3]:{effort:'steady',attack:'none',chase})};
  const plans=['you',...Array.from({length:teamCount-1},(_row,index)=>
    `rival-${index+1}`)].map(teamId=>({teamId,
    finisherId:`${teamId}-7`,leadOutRiderId:leadOutTeams.includes(teamId)?
      `${teamId}-6`:null}));
  let race,helperRefusals=[];
  for(;;){
    try{
      race=createV93PlayableTest(settings,{plans,pointContext});
      break;
    }catch(error){
      if(mixed&&error.message===
        'The v93 preview cannot continue riders leaving the bunch after 500 m.'&&
        Number.isFinite(error.cause?.metresToGo))
        return {race:null,summary:null,settings,helperRefusals,
          refusal:{reason:'late_bunch_exit',
            metresToGo:error.cause.metresToGo,
            riderIds:error.cause.riderIds}};
      const refused=plans.find(plan=>plan.teamId===error.cause?.teamId&&
        plan.leadOutRiderId===error.cause?.helperId);
      if(mixed&&refused&&['different_road_group',
        'exhausted'].includes(error.cause?.reason)){
        helperRefusals.push({teamId:refused.teamId,
          reason:error.cause.reason});
        refused.leadOutRiderId=null;
        continue;
      }
      error.message=`Scenario ${index} ${attack}/${chase} helpers ${
        leadOutTeams.join(',')}: ${error.message}`;
      throw error;
    }
  }
  assert.equal(validateV93CoastedPlaytest(settings,{plans,pointContext},
    race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  const crossings=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
  const replayed=new Set();
  assert.equal(crossings.size,teamCount*8);
  for(const band of summary.bandReplays)
    for(const rider of band.frames.at(-1).riders){
      const crossing=crossings.get(rider.riderId);
      assert.ok(crossing);
      assert.equal(replayed.has(rider.riderId),false);
      replayed.add(rider.riderId);
      assert.equal(crossing.roadBandId,band.id);
      assert.equal(crossing.elapsedSecondsFromLastKmStart,
        rider.elapsedToLineSeconds);
      assert.equal(crossing.energyAtLine,rider.energyAfter);
    }
  assert.equal(replayed.size,crossings.size);
  assert.equal(summary.canCommitAwards,false);
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.pointPreview.canCommitAwards,false);
  if(summary.pointPreview.status!=='unavailable'){
    const order=new Map(summary.provisionalLineOrder.map(row=>
      [row.riderId,row.position]));
    assert.equal(order.size,crossings.size);
    for(const row of summary.pointPreview.riders){
      assert.equal(row.provisionalPlace,order.get(row.riderId));
      assert.equal(row.previewPoints,pointsForDivisionResult({
        tier:pointContext.tier,resultType:'ONE_DAY',
        placing:row.provisionalPlace,
        multiplier:summary.pointPreview.multiplier}));
    }
  }
  return {race,summary,settings,helperRefusals};
}

function compare(before,after){
  assert.deepEqual(before.race.recording.route,
    after.race.recording.route);
  assert.equal(before.race.recording.raceSeed,
    after.race.recording.raceSeed);
  assert.deepEqual(before.race.recording.committedInputs.teams.map(team=>
    team.riders),after.race.recording.committedInputs.teams.map(team=>
    team.riders));
  const byId=new Map(before.summary.lineTimes.map(row=>
    [row.riderId,row]));
  const changedCrossings=after.summary.lineTimes.filter(row=>{
    const prior=byId.get(row.riderId);
    return row.elapsedSecondsFromLastKmStart!==
      prior.elapsedSecondsFromLastKmStart||
      row.energyAtLine!==prior.energyAtLine||
      row.roadBandId!==prior.roadBandId;
  }).length;
  const changedRoadFrames=after.summary.kilometreFrames.filter((frame,k)=>{
    const prior=before.summary.kilometreFrames[k];
    return JSON.stringify(frame.roadGroups)!==
      JSON.stringify(prior.roadGroups)||
      JSON.stringify(frame.droppedRiders)!==
        JSON.stringify(prior.droppedRiders);
  }).length;
  return {changedRoadFrames,changedCrossings,
    beforeRoad:before.summary.roadStatus,afterRoad:after.summary.roadStatus,
    beforePoints:before.summary.pointPreview.status??'illustrative',
    afterPoints:after.summary.pointPreview.status??'illustrative'};
}

const report=[];
for(let index=0;index<scenarios.length;index++){
  const passive=run(index,{attack:'none',chase:'ignore'});
  const attacking=run(index,{attack:'repeated',chase:'ignore'});
  const chased=run(index,{attack:'repeated',chase:'all'});
  const assisted=run(index,{attack:'none',chase:'ignore',
    leadOutTeams:['you','rival-1']});
  const mixed=run(index,{attack:'repeated',chase:'selective',
    leadOutTeams:['you','rival-1'],mixed:true});
  assert.deepEqual(assisted.race.recording,passive.race.recording);
  assert.deepEqual(assisted.race.clock,passive.race.clock);
  const paidHelpers=new Set(assisted.summary.bandReplays.flatMap(band=>
    band.frames.flatMap(frame=>frame.riders.filter(row=>
      row.role==='lead_out'&&row.energySpent>0).map(row=>row.riderId))));
  assert.ok(paidHelpers.has('you-6'));
  assert.ok(paidHelpers.has('rival-1-6'));
  const leadOut=compare(passive,assisted);
  assert.ok(leadOut.changedCrossings>0);
  assert.equal(leadOut.changedRoadFrames,0);
  report.push({index,scenario:scenarios[index],
    attack:compare(passive,attacking),
    chase:compare(attacking,chased),
    leadOut,mixed:{helperRefusals:mixed.helperRefusals,
      ...(mixed.refusal?{refusal:mixed.refusal}:{
        road:mixed.summary.roadStatus,
        points:mixed.summary.pointPreview.status??'illustrative'})}});
}
assert.ok(report.some(row=>row.attack.changedRoadFrames>0));
assert.ok(report.some(row=>row.chase.changedRoadFrames>0));
assert.deepEqual(report.filter(row=>row.mixed.refusal).map(row=>({
  index:row.index,refusal:row.mixed.refusal})),[{
  index:11,refusal:{reason:'late_bunch_exit',metresToGo:300,
    riderIds:['rival-1-5','rival-13-5']}}]);
console.log(JSON.stringify({scenarios:report.length,
  runs:report.length*5,
  completedRuns:report.length*5-report.filter(row=>row.mixed.refusal).length,
  attackChangedRoad:report.filter(row=>row.attack.changedRoadFrames>0).length,
  chaseChangedRoad:report.filter(row=>row.chase.changedRoadFrames>0).length,
  attackChangedCrossings:report.filter(row=>
    row.attack.changedCrossings>0).length,
  chaseChangedCrossings:report.filter(row=>
    row.chase.changedCrossings>0).length,
  leadOutChangedCrossings:report.filter(row=>
    row.leadOut.changedCrossings>0).length,
  mixedRefusals:report.filter(row=>row.mixed.refusal).length,
  report},null,2));
