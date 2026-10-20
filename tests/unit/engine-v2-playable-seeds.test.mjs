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
  {defaultRivalPlan:'mixed',attack:'selective',chase:'selective'},
  {defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'},
  {defaultRivalPlan:'chase',attack:'none',chase:'all'}];
const pointContext={tier:3,divisionIndex:1,divisionCount:1};
const near=(actual,expected)=>
  assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);

test('five seeds across routes, categories and tactics retain paid road evidence',()=>{
  const counts={paid:0,unpaid:0};
  for(const route of routes)for(const gender of ['M','F'])
    for(let seedIndex=1;seedIndex<=5;seedIndex++){
      const teamCount=gender==='M'?4:15;
      const settings={...route,gender,teamCount,
        seed:`playable-seed-${seedIndex}`,...tactics[(seedIndex-1)%3]};
      const output=runV91IntegratedTestDrive({settings,
        individualGroupLine:true,pointContext},{full:true});
      const {summary,recording}=output;
      const label=`${route.terrain} ${gender} seed ${seedIndex}`;
      assert.equal(recording.recording.route.distanceKm,route.distanceKm,
        label);
      assert.equal(summary.pointsStatus,'withheld',label);
      assert.equal(summary.canCommitAwards,false,label);
      assert.equal(recording.classifiedResults,null,label);
      if(summary.roadStatus==='recorded_depleted_bands'){
        assert.equal(route.terrain,'mountain',label);
        assert.equal(gender,'M',label);
        assert.ok([1,4].includes(seedIndex),label);
        assert.ok(summary.finale.totalUnmetEnergyDemand>0,label);
        assert.equal(summary.finale.lineTimes,undefined,label);
        assert.equal(summary.provisionalPointPreview.status,'unavailable',
          label);
        assert.equal(summarizeV91PaidMultibandReplay(output),null,label);
        counts.unpaid++;
        continue;
      }
      assert.ok(['paid_conditional_line','conditional_multiband_line',
        'conditional_depleted_line'].includes(summary.roadStatus),label);
      const lines=summary.finale.lineTimes;
      const riderCount=teamCount*8;
      assert.equal(lines.length,riderCount,label);
      assert.equal(new Set(lines.map(row=>row.riderId)).size,riderCount,
        label);
      const replay=summary.roadStatus==='paid_conditional_line'?
        summarizeV91PaidFinaleReplay(recording):
        summarizeV91PaidMultibandReplay(output);
      assert.ok(replay,`${label}: missing paid replay`);
      const riders=replay.bands?
        replay.bands.flatMap(band=>band.frames.at(-1).riders):
        replay.frames.at(-1).riders;
      assert.equal(riders.length,riderCount,label);
      const finalById=new Map(riders.map(row=>[row.riderId,row]));
      assert.equal(finalById.size,riderCount,label);
      for(const line of lines){
        const final=finalById.get(line.riderId);
        assert.ok(final,`${label}: missing ${line.riderId}`);
        near(final.positionM,route.distanceKm*1000);
        near(final.energyAfter,line.energyAtLine);
        near(final.elapsedToLineSeconds,
          line.elapsedSecondsFromLastKmStart);
      }
      const preview=summary.provisionalPointPreview;
      assert.equal(preview.canCommitAwards,false,label);
      assert.deepEqual(preview.awardRows,[],label);
      if(Array.isArray(preview.riders)){
        assert.equal(preview.riders.length,riderCount,label);
        for(const [index,row] of preview.riders.entries()){
          assert.equal(row.provisionalPlace,index+1,label);
          assert.equal(row.previewPoints,pointsForDivisionResult({
            tier:3,resultType:'ONE_DAY',placing:index+1,
            multiplier:preview.multiplier}),label);
          const line=lines.find(entry=>entry.riderId===row.riderId);
          assert.ok(line,label);
          near(row.energyAtLine,line.energyAtLine);
          near(row.elapsedSecondsFromLastKmStart,
            line.elapsedSecondsFromLastKmStart);
        }
      }else{
        assert.equal(preview.status,'unavailable',label);
        assert.ok(preview.reason,label);
      }
      counts.paid++;
    }
  assert.deepEqual(counts,{paid:48,unpaid:2});
});
