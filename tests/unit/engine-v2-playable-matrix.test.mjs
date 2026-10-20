import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidFinaleReplay} from
  '../../lib/engine/v2/playtest-finale-replay.mjs';
import {summarizeV91PaidMultibandReplay} from
  '../../lib/engine/v2/playtest-multiband-replay.mjs';
import {pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';

const routes=[
  {distanceKm:40,terrain:'flat',fatigue:0},
  {distanceKm:40,terrain:'exposed',fatigue:15},
  {distanceKm:120,terrain:'rolling',fatigue:15},
  {distanceKm:120,terrain:'custom',fatigue:15,
    profileHeightsM:[100,350,150,500,180,100]},
  {distanceKm:260,terrain:'mountain',fatigue:30}];
const tactics=[
  {name:'attack',attack:'repeated',chase:'ignore'},
  {name:'chase',attack:'none',chase:'all'}];
const close=(actual,expected)=>
  assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

for(const route of routes)for(const gender of ['M','F'])
  for(const tactic of tactics){
    const teamCount=gender==='M'?4:20;
    test(`${route.distanceKm} km ${route.terrain} ${gender} ${teamCount} teams ${tactic.name}: paid road, line, replay and points`,()=>{
      const output=runV91IntegratedTestDrive({settings:{...route,gender,
        teamCount,seed:'test-drive-acceptance-1',
        defaultRivalPlan:tactic.name,attack:tactic.attack,
        chase:tactic.chase},individualGroupLine:true,
      pointContext:{tier:3,divisionIndex:1,divisionCount:1}},
      {full:true});
      const {summary,recording}=output;
      const riderIds=recording.recording.committedInputs.teams.flatMap(
        team=>team.riders.map(rider=>rider.id));
      const expected=new Set(riderIds);
      assert.equal(recording.recording.route.distanceKm,route.distanceKm);
      assert.equal(summary.input.terrain,route.terrain);
      assert.equal(recording.recording.route.kilometres.length,
        route.distanceKm);
      if(route.terrain==='custom'){
        assert.deepEqual(summary.input.profileHeightsM,
          route.profileHeightsM);
        assert.ok(recording.recording.route.kilometres.some(km=>
          Math.abs(km.gradientPct)>0.01));
      }
      if(route.terrain==='exposed')
        assert.ok(recording.recording.route.kilometres.some(km=>
          km.exposed));
      assert.equal(recording.recording.committedInputs.teams.length,
        teamCount);
      assert.equal(expected.size,teamCount*8);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.ok(['paid_conditional_line','conditional_multiband_line',
        'conditional_depleted_line'].includes(summary.roadStatus));
      const crossings=summary.finale.lineTimes;
      assert.equal(crossings.length,expected.size);
      assert.deepEqual(new Set(crossings.map(row=>row.riderId)),expected);
      assert.ok(crossings.every(row=>
        Number.isFinite(row.elapsedSecondsFromLastKmStart)&&
        Number.isFinite(row.energyAtLine)&&row.energyAtLine>=0));

      const source=summary.lastKmSource;
      const onRoad=[...source.roadGroups.flatMap(group=>group.riderIds),
        ...source.droppedRiderIds];
      // The peloton is the complement of named front groups and drops.
      assert.equal(new Set(onRoad).size,onRoad.length);
      assert.ok(onRoad.every(id=>expected.has(id)));
      const replay=summary.roadStatus==='paid_conditional_line'?
        summarizeV91PaidFinaleReplay(recording):
        summarizeV91PaidMultibandReplay(output);
      assert.ok(replay,'Every accepted individual line needs paid replay.');
      assert.equal(replay.lineDistanceM,route.distanceKm*1000);
      const replayRiders=replay.bands?
        replay.bands.flatMap(band=>band.frames.at(-1).riders):
        replay.frames.at(-1).riders;
      assert.equal(replayRiders.length,expected.size);
      assert.deepEqual(new Set(replayRiders.map(row=>row.riderId)),expected);
      const replayById=new Map(replayRiders.map(row=>[row.riderId,row]));
      for(const row of crossings){
        const final=replayById.get(row.riderId);
        close(final.positionM,route.distanceKm*1000);
        close(final.energyAfter,row.energyAtLine);
        close(final.elapsedToLineSeconds,
          row.elapsedSecondsFromLastKmStart);
      }
      const preview=summary.provisionalPointPreview;
      assert.equal(preview.canCommitAwards,false);
      assert.deepEqual(preview.awardRows,[]);
      assert.equal(preview.riders.length,expected.size);
      for(const [index,row] of preview.riders.entries()){
        assert.equal(row.provisionalPlace,index+1);
        const crossing=crossings.find(entry=>entry.riderId===row.riderId);
        assert.ok(crossing);
        close(row.elapsedSecondsFromLastKmStart,
          crossing.elapsedSecondsFromLastKmStart);
        close(row.energyAtLine,crossing.energyAtLine);
        assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
          resultType:'ONE_DAY',placing:index+1,
          multiplier:preview.multiplier}));
      }
    });
  }

for(const gender of ['M','F'])test(`260 km mountain ${gender}: zero reserve cannot create a paid result`,()=>{
  const output=runV91IntegratedTestDrive({settings:{distanceKm:260,
    terrain:'mountain',fatigue:30,teamCount:4,gender,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'mixed',
    attack:'selective',chase:'selective'},
  finalePlans:[{teamId:'you',finisherId:'you-7',leadOutRiderId:null}],
  individualGroupLine:true,
  pointContext:{tier:3,divisionIndex:1,divisionCount:1}},{full:true});
  assert.equal(output.summary.status,'unsupported');
  assert.equal(output.summary.roadStatus,'recorded_depleted_bands');
  assert.equal(output.summary.finale.reserveStatus,
    'energy_demand_saturated_at_zero');
  assert.equal(output.summary.lastKmSource.droppedRiderIds.length,6);
  assert.ok(output.summary.finale.totalUnmetEnergyDemand>0);
  assert.equal(output.summary.finale.lineTimes,undefined);
  assert.equal(summarizeV91PaidMultibandReplay(output),null);
  assert.equal(output.summary.provisionalPointPreview.status,'unavailable');
  assert.equal(output.summary.pointsStatus,'withheld');
  assert.equal(output.summary.canCommitAwards,false);
});
