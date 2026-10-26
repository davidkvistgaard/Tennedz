import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateTwoCooperativeGroupsKilometreV3} from
  '../../lib/engine/v2/stage-two-cooperative-groups-v3.mjs';
import {relativeRoadGroupPace,roadGroupExposureCosts} from
  '../../lib/engine/v2/road-groups.mjs';
import {evaluateStageSliceRiderV3} from
  '../../lib/engine/v2/stage-slice-evaluation-v3.mjs';

function parityCase({terrain,gradientPct,surface,exposed,frontSize,rearSize}){
  const weather={temperatureC:16,windKph:exposed?24:8,rainMm:0};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,
      conditions:{surface,exposed,source:'illustrative',weather}})),
    features:[]});
  const members=(prefix,size,flat,mountain)=>Array.from({length:size},(_,index)=>{
    const id=`${prefix}-${index}`;
    return {id,effort:'steady',breakWork:'cooperate',energyBefore:80-index,
      rider:{id,flat,mountain,timetrial:65,endurance:70,
        strength:60,wind:55,form:50,fatigue:0}};
  });
  const front={id:'road-1',members:members('front',frontSize,80,45)};
  const rear={id:'road-2',members:members('rear',rearSize,45,80)};
  const legacyGroups=[front,rear].map((group,index)=>({id:group.id,
    riderIds:group.members.map(member=>member.id),
    teamIds:group.members.map(member=>member.id),gapSeconds:index?5:10}));
  const teams=[...front.members,...rear.members].map(member=>({
    id:member.id,riders:[member.rider],energy:{[member.id]:member.energyBefore},
    orders:{baseline:{effort:'steady',breakWork:'cooperate'},phases:[]}}));
  const segment={km:1,terrain,gradientPct,surface,exposed,weather};
  return {overlay,front,rear,legacyGroups,teams,segment};
}

test('one homogeneous v3 group slice preserves v2 cooperative drift and exposure work',()=>{
  for(const scenario of [
    {terrain:'flat',gradientPct:0,surface:'road',exposed:false,
      frontSize:2,rearSize:2},
    {terrain:'climb',gradientPct:8,surface:'road',exposed:false,
      frontSize:5,rearSize:3},
    {terrain:'hill',gradientPct:3,surface:'gravel',exposed:true,
      frontSize:3,rearSize:5},
  ]){
    const {overlay,front,rear,legacyGroups,teams,segment}=
      parityCase(scenario);
    const oldDrift=relativeRoadGroupPace(...legacyGroups,teams,segment);
    const oldCosts=roadGroupExposureCosts(legacyGroups,
      legacyGroups.flatMap(group=>group.riderIds));
    const next=evaluateTwoCooperativeGroupsKilometreV3({overlay,
      kilometreIndex:0,front,rear,gapSeconds:5,
      baseTerrain:segment.terrain,baseGradientPct:segment.gradientPct});
    assert.equal(next.status,'separate');
    assert.equal(next.frames.length,1);
    assert.ok(Math.abs(next.gapSeconds-5-oldDrift)<=.005001);
    const slice=next.frames[0];
    for(const member of [...front.members,...rear.members]){
      const paid=slice.groupClocks.flatMap(group=>group.members)
        .find(row=>row.riderId===member.id);
      const expected=evaluateStageSliceRiderV3({
        slice:{fromKm:0,toKm:1,distanceKm:1,features:[],
          conditions:overlay.tacticalIntervals[0].conditions},
        rider:member.rider,energyBefore:member.energyBefore,
        effort:'steady',baseTerrain:segment.terrain,
        baseGradientPct:segment.gradientPct,phase:'solo',
        extraWorkPerKm:oldCosts.get(member.id)});
      assert.ok(Math.abs(paid.work-expected.work)<1e-6);
      assert.ok(Math.abs(paid.energyAfter-expected.energyAfter)<1e-6);
    }
  }
});
