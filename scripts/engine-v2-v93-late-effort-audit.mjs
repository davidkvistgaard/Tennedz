// Fictional full-race acceptance audit for v93 five-kilometre effort orders.
// Reads no live data and never settles a result or awards points.
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';
import {pointsForDivisionResult} from '../lib/calendar/points.mjs';

const distances=[40,120,260],teamCounts=[4,15,20];
const genders=['M','F'],terrains=['flat','rolling','mountain','exposed','custom'];
const fatigues=[0,15,30],rivalPlans=['neutral','mixed','attack','chase'];
const attacks=['none','selective','repeated'],chases=['ignore','selective','all'];
const efforts=['conserve','steady','hard'];
const indices=[0,1,5,9,13,18,20,26,34,40,42,47];
const report={scenarios:indices.length,finished:0,refusals:[],
  changedCrossings:0,changedEnergy:0,changedPlaces:0,
  illustratedPoints:0,withheldPoints:0,withheldCases:[],
  replayMatchedCrossings:0};
for(const index of indices){
  const settings={distanceKm:distances[index%3],
    teamCount:teamCounts[Math.floor(index/3)%3],
    gender:genders[Math.floor(index/9)%2],
    terrain:terrains[index%5],
    fatigue:fatigues[Math.floor(index/2)%3],
    seed:`v93-diversity-${Math.floor(index/12)}`,
    defaultRivalPlan:rivalPlans[Math.floor(index/4)%4],
    attack:attacks[Math.floor(index/5)%3],
    chase:chases[Math.floor(index/7)%3],
    effort:efforts[Math.floor(index/11)%3],
    profileHeightsM:[100,350,150,500,180,100]};
  const context={tier:2,divisionIndex:1,divisionCount:2};
  const runs=[];
  for(const effort of ['conserve','hard']){
    const input={...settings,managerFinaleOrders:[
      {teamId:'you',atKm:settings.distanceKm-5,effort},
      {teamId:'rival-1',atKm:settings.distanceKm-5,
        effort:effort==='conserve'?'hard':'conserve'}]};
    try{
      const race=createV93PlayableTest(input,{pointContext:context});
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lineTimes.length,settings.teamCount*8);
      assert.equal(summary.lastKmRoad.at(-1).distanceM,
        settings.distanceKm*1000);
      for(const [teamId,expected] of [['you',effort],
        ['rival-1',effort==='conserve'?'hard':'conserve']])
        assert.deepEqual(summary.managerOrders.find(row=>
          row.teamId===teamId).phaseOrders,
        [{atKm:settings.distanceKm-5,effort:expected}]);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      const lines=new Map(summary.lineTimes.map(row=>[row.riderId,row]));
      const seen=new Set();
      for(const band of summary.bandReplays)
        for(const rider of band.frames.at(-1).riders){
          assert.equal(seen.has(rider.riderId),false);
          seen.add(rider.riderId);
          const crossing=lines.get(rider.riderId);
          assert.equal(crossing.roadBandId,band.id);
          assert.equal(crossing.elapsedSecondsFromLastKmStart,
            rider.elapsedToLineSeconds);
          assert.equal(crossing.energyAtLine,rider.energyAfter);
          report.replayMatchedCrossings++;
        }
      assert.equal(seen.size,lines.size);
      if(race.pointPreview.status==='unavailable'){
        assert.equal(race.pointPreview.canCommitAwards,false);
        report.withheldPoints++;
        report.withheldCases.push({index,effort,
          reason:race.pointPreview.reason});
      }else{
        assert.deepEqual(race.pointPreview.awardRows,[]);
        for(const row of race.pointPreview.riders){
          assert.equal(row.energyAtLine,lines.get(row.riderId).energyAtLine);
          assert.equal(row.previewPoints,pointsForDivisionResult({
            tier:2,resultType:'ONE_DAY',placing:row.provisionalPlace,
            multiplier:race.pointPreview.multiplier}));
        }
        report.illustratedPoints++;
      }
      runs.push(summary);
    }catch(error){
      report.refusals.push({index,effort,settings,error:error.message});
    }
  }
  if(runs.length!==2)continue;
  const first=new Map(runs[0].lineTimes.map(row=>[row.riderId,row]));
  report.changedCrossings+=runs[1].lineTimes.filter(row=>
    row.elapsedSecondsFromLastKmStart!==first.get(row.riderId)
      .elapsedSecondsFromLastKmStart).length;
  report.changedEnergy+=runs[1].lineTimes.filter(row=>
    row.energyAtLine!==first.get(row.riderId).energyAtLine).length;
  const places=runs.map(summary=>new Map((summary.provisionalLineOrder??[])
    .map(row=>[row.riderId,row.position])));
  if(places.every(map=>map.size))report.changedPlaces+=
    [...places[0]].filter(([id,place])=>places[1].get(id)!==place).length;
  report.finished++;
}
report.coverage={distancesKm:[...new Set(indices.map(i=>distances[i%3]))],
  teamCounts:[...new Set(indices.map(i=>teamCounts[Math.floor(i/3)%3]))],
  genders:[...new Set(indices.map(i=>genders[Math.floor(i/9)%2]))],
  terrains:[...new Set(indices.map(i=>terrains[i%5]))],
  fatigues:[...new Set(indices.map(i=>fatigues[Math.floor(i/2)%3]))]};
assert.equal(report.coverage.distancesKm.length,3);
assert.equal(report.coverage.teamCounts.length,3);
assert.equal(report.coverage.genders.length,2);
assert.equal(report.coverage.terrains.length,5);
assert.equal(report.coverage.fatigues.length,3);
console.log(JSON.stringify(report,null,2));
assert.equal(report.refusals.length,0);
assert.equal(report.finished,indices.length);
assert.ok(report.changedCrossings>0);
assert.ok(report.changedEnergy>0);
assert.ok(report.changedPlaces>0);
assert.equal(report.illustratedPoints+report.withheldPoints,
  indices.length*2);
assert.equal(report.replayMatchedCrossings,indices.reduce((total,index)=>
  total+teamCounts[Math.floor(index/3)%3]*8*2,0));
