import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateSeparatedRoadBandsKilometreV3} from
  '../../lib/engine/v2/stage-separated-road-bands-v3.mjs';
import {replaySeparatedRoadBandsStageV3} from
  '../../lib/engine/v2/stage-separated-road-replay-v3.mjs';
import {prepareRecordedRoadHandoffV3,
  STAGE_RECORDED_ROAD_HANDOFF_VERSION} from
  '../../lib/engine/v2/stage-recorded-road-handoff-v3.mjs';

function fixture(){
  const team=(id,overrides)=>{
    const riderIds=Array.from({length:8},(_,index)=>`${id}-${index}`);
    return {id,riders:riderIds.map(riderId=>({id:riderId,gender:'M',
      flat:50,strength:60,endurance:60,sprint:50,leadership:50})),
    orders:normalizeOrders({captainId:riderIds[0],
      roadCaptainId:riderIds[1],preset:'balanced',...overrides},
    {riderIds,distanceKm:40})};
  };
  const leader=team('a',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(leader.riders[0],{flat:95,strength:95,
    endurance:95,timetrial:95});
  const second=team('b',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
      {atKm:30,attack:'none',breakAttackRiderId:'b-0'}]});
  const third=team('c',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'c-0'},
      {atKm:30,attack:'none'}]});
  for(const entry of [second,third])Object.assign(entry.riders[0],
    {flat:95,strength:95,endurance:95,timetrial:95});
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
      {km:30,kind:'SPRINT'}]};
  const recording=simulateTacticalTour({stage,
    teams:[leader,second,third],seed:'chase-break-attack'});
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:40,
    tacticalIntervals:Array.from({length:8},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),features:[]});
  return {recording,overlay};
}

test('validated v2 split hands paid end-of-km energy and gaps to v3',()=>{
  const {recording,overlay}=fixture();
  const saved=structuredClone(recording),frame=recording.frames[30];
  const handoff=prepareRecordedRoadHandoffV3({recording,frameIndex:30,
    overlay});
  assert.equal(handoff.version,STAGE_RECORDED_ROAD_HANDOFF_VERSION);
  assert.equal(handoff.source.completedKm,31);
  assert.deepEqual(handoff.source.paidSplitRiderIds,['b-0']);
  assert.equal(handoff.startKilometreIndex,31);
  assert.deepEqual(handoff.bands.map(band=>band.id),
    frame.roadGroups.map(group=>group.id));
  assert.deepEqual(handoff.gapsSeconds,frame.roadGroups.slice(0,-1)
    .map((group,index)=>+(group.gapSeconds-
      frame.roadGroups[index+1].gapSeconds).toFixed(6)));
  for(const member of handoff.bands.flatMap(band=>band.members))
    assert.equal(member.energyBefore,frame.riderGroups.find(row=>
      row.id===member.id).energy);
  assert.deepEqual(recording,saved);
  assert.equal(Object.hasOwn(handoff,'places'),false);
  const next=recording.route.kilometres[31];
  const step=evaluateSeparatedRoadBandsKilometreV3({overlay,
    kilometreIndex:handoff.startKilometreIndex,
    bands:handoff.bands,gapsSeconds:handoff.gapsSeconds,
    baseTerrain:next.terrain,baseGradientPct:next.gradientPct,
    pullRiderIds:handoff.bands.flatMap(band=>band.members.map(member=>
      member.id))});
  assert.ok(['separate','unresolved_band_contact'].includes(step.status));
  assert.ok(step.paidUntilKm>=31);
  const continued=replaySeparatedRoadBandsStageV3({overlay,
    bands:handoff.bands,gapsSeconds:handoff.gapsSeconds,
    startKilometreIndex:handoff.startKilometreIndex,
    kilometreBaselines:recording.route.kilometres.map(segment=>({
      terrain:segment.terrain,gradientPct:segment.gradientPct})),
    pullRiderIds:handoff.bands.flatMap(band=>band.members.map(member=>
      member.id))});
  assert.equal(continued.startedAtKm,31);
  assert.equal(continued.kilometres[0].kilometreIndex,31);
  assert.ok(['separate','unresolved_band_contact'].includes(continued.status));
  assert.equal(Object.hasOwn(continued,'places'),false);
});

test('handoff refuses unearned, tampered or mismatched recorded split',()=>{
  const {recording,overlay}=fixture();
  assert.throws(()=>prepareRecordedRoadHandoffV3({recording,
    frameIndex:29,overlay}),/paid recorded/);
  assert.throws(()=>prepareRecordedRoadHandoffV3({recording,
    frameIndex:39,overlay}),/non-final/);
  assert.throws(()=>prepareRecordedRoadHandoffV3({recording,
    frameIndex:30,overlay:{...overlay,distanceKm:41}}),/matching/);
  assert.throws(()=>prepareRecordedRoadHandoffV3({recording,
    frameIndex:30,overlay:{version:3,distanceKm:40}}),/tactical intervals/);
  const free=structuredClone(recording);
  free.frames[30].splitAttack.attackSeconds=0;
  assert.throws(()=>prepareRecordedRoadHandoffV3({recording:free,
    frameIndex:30,overlay}),/break attack route/);
});
