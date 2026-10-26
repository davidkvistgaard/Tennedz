import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {simulateTacticalTour,simulateTacticalTourWithHandoffStateV3,
  sameRunHandoffStateAtV3,
  MOTOR_HANDOFF_STATE_TRACE_VERSION} from '../../lib/engine/v2/tour.mjs';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateSeparatedRoadBandsKilometreV3} from
  '../../lib/engine/v2/stage-separated-road-bands-v3.mjs';
import {replaySeparatedRoadBandsStageV3} from
  '../../lib/engine/v2/stage-separated-road-replay-v3.mjs';
import {prepareRecordedRoadHandoffV3,
  STAGE_RECORDED_ROAD_HANDOFF_VERSION} from
  '../../lib/engine/v2/stage-recorded-road-handoff-v3.mjs';
import {normalizeCompleteStageInputV3,
  continueRecordedRoadWithCompleteStageV3,
  STAGE_COMPLETE_INPUT_VERSION,STAGE_RECORDED_CONTINUATION_VERSION} from
  '../../lib/engine/v2/stage-complete-input-v3.mjs';

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
  const input={stage,teams:[leader,second,third],seed:'chase-break-attack'};
  const recording=simulateTacticalTour(input);
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:40,
    tacticalIntervals:Array.from({length:8},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),features:[]});
  return {input,recording,overlay};
}

test('opt-in handoff state is separate from unchanged v2 recording',()=>{
  const {input,recording}=fixture();
  const result=simulateTacticalTourWithHandoffStateV3(input);
  assert.deepEqual(result.recording,recording);
  assert.equal(result.handoffStateTrace.version,
    MOTOR_HANDOFF_STATE_TRACE_VERSION);
  assert.equal(result.handoffStateTrace.frames.length,40);
  assert.equal(Object.hasOwn(result.recording,'handoffStateTrace'),false);
  for(let index=0;index<40;index++){
    const source=recording.frames[index];
    const trace=result.handoffStateTrace.frames[index];
    assert.equal(trace.km,source.km);
    assert.equal(trace.riders.length,source.riderGroups.length);
    assert.equal(trace.teams.length,3);
    assert.deepEqual(trace.teams.map(team=>team.activeLeaderId),
      source.activeLeaders.map(row=>row.riderId));
    assert.ok(trace.teams.every(team=>typeof team.breakResponseActive===
      'boolean'&&typeof team.gcResponseActive==='boolean'));
    for(const rider of trace.riders){
      const saved=source.riderGroups.find(row=>row.id===rider.riderId);
      assert.ok(saved);
      assert.equal(rider.group,saved.group);
      assert.equal(rider.energy,saved.energy);
      assert.equal(rider.deficitSeconds,saved.deficitSeconds);
      assert.ok(Number.isInteger(rider.lowKilometres)&&
        rider.lowKilometres>=0);
      assert.ok(Number.isInteger(rider.quietKm)&&rider.quietKm>=0);
      assert.ok(Number.isFinite(rider.energyCap)&&
        rider.energyCap>=rider.energy&&rider.energyCap<=100);
      assert.ok(Number.isFinite(rider.attackLoad)&&
        rider.attackLoad>=0);
    }
  }
  result.handoffStateTrace.frames[30].riders[0].energy=0;
  assert.deepEqual(result.recording,recording);
  const issued=sameRunHandoffStateAtV3({recording:result.recording,
    frameIndex:30});
  assert.notEqual(issued.riders[0].energy,0);
  issued.riders[0].energy=0;
  assert.notEqual(sameRunHandoffStateAtV3({recording:result.recording,
    frameIndex:30}).riders[0].energy,0);
  assert.throws(()=>sameRunHandoffStateAtV3({recording,
    frameIndex:30}),/same-run issued/);
  assert.throws(()=>sameRunHandoffStateAtV3({recording:
    structuredClone(result.recording),frameIndex:30}),/same-run issued/);
  assert.throws(()=>sameRunHandoffStateAtV3({recording:result.recording,
    frameIndex:40}),/same-run issued/);
  result.recording.frames[30].riderGroups[0].energy=0;
  assert.throws(()=>sameRunHandoffStateAtV3({recording:result.recording,
    frameIndex:30}),/same-run issued/);
});

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
  for(const member of handoff.bands.flatMap(band=>band.members)){
    const paid=continued.kilometres.flatMap(km=>km.frames)
      .reduce((sum,part)=>sum+part.bandClocks.flatMap(band=>
        band.members).find(row=>row.riderId===member.id).work,0);
    const after=continued.energies.find(row=>row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-after-paid)<.00005);
  }
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

test('one committed rider state can take two distinct future stage overlays',()=>{
  const {recording,overlay}=fixture();
  const rough=normalizeStageOverlayV3({version:3,distanceKm:40,
    tacticalIntervals:Array.from({length:8},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,
      conditions:{surface:'gravel',exposed:true,source:'illustrative',
        weather:{temperatureC:16,windKph:28,rainMm:0}}})),
    features:[]});
  const roadHandoff=prepareRecordedRoadHandoffV3({recording,
    frameIndex:30,overlay});
  const roughHandoff=prepareRecordedRoadHandoffV3({recording,
    frameIndex:30,overlay:rough});
  assert.deepEqual(roadHandoff,roughHandoff);
  const segment=recording.route.kilometres[31];
  const evaluate=stage=>evaluateSeparatedRoadBandsKilometreV3({
    overlay:stage,kilometreIndex:roadHandoff.startKilometreIndex,
    bands:roadHandoff.bands,gapsSeconds:roadHandoff.gapsSeconds,
    baseTerrain:segment.terrain,baseGradientPct:segment.gradientPct,
    pullRiderIds:roadHandoff.bands.flatMap(band=>band.members.map(member=>
      member.id))});
  const road=evaluate(overlay),gravel=evaluate(rough);
  assert.equal(road.status,'separate');
  assert.equal(gravel.status,'separate');
  assert.notEqual(road.frames[0].bandClocks[0].members[0].work,
    gravel.frames[0].bandClocks[0].members[0].work);
  assert.deepEqual(roadHandoff.bands,roughHandoff.bands);
});

test('one complete stage input owns terrain and short-slice conditions after paid split',()=>{
  const {recording,overlay}=fixture();
  const before=structuredClone(recording);
  const baselines=recording.route.kilometres.map(segment=>({
    terrain:segment.terrain,gradientPct:segment.gradientPct,
    source:'illustrative'}));
  const stageInput=normalizeCompleteStageInputV3({
    version:STAGE_COMPLETE_INPUT_VERSION,overlay,
    kilometreBaselines:baselines});
  const handoff=prepareRecordedRoadHandoffV3({recording,frameIndex:30,
    overlay});
  const pulls=handoff.bands.flatMap(band=>band.members.map(member=>member.id));
  const run=input=>continueRecordedRoadWithCompleteStageV3({recording,
    frameIndex:30,stageInput:input,pullRiderIds:pulls});
  const flat=run(stageInput);
  const climbing=structuredClone(stageInput);
  climbing.kilometreBaselines[31]={terrain:'climb',gradientPct:8,
    source:'illustrative'};
  const climb=run(climbing);
  assert.equal(flat.version,STAGE_RECORDED_CONTINUATION_VERSION);
  assert.equal(flat.stageInputVersion,STAGE_COMPLETE_INPUT_VERSION);
  assert.equal(flat.source.completedKm,31);
  assert.equal(flat.startedAtKm,31);
  assert.equal(flat.kilometres[0].kilometreIndex,31);
  assert.equal(flat.sourceCoverage.totalRiders,24);
  assert.equal(flat.sourceCoverage.wholeRaceCovered,false);
  assert.deepEqual(flat.sourceCoverage.continuedRiderIds,
    handoff.bands.flatMap(band=>band.members.map(member=>member.id)));
  assert.equal(flat.sourceCoverage.continuedRiderIds.length+
    flat.sourceCoverage.outsideRiders.length,24);
  for(const outside of flat.sourceCoverage.outsideRiders){
    const source=recording.frames[30].riderGroups.find(row=>
      row.id===outside.riderId);
    assert.equal(outside.sourceGroup,source.group);
    assert.equal(outside.energyAtHandoff,source.energy);
  }
  assert.ok(flat.kilometres[0].frames.length>0);
  assert.ok(climb.kilometres[0].frames.length>0);
  assert.notEqual(flat.kilometres[0].frames[0].roadBaselineSeconds,
    climb.kilometres[0].frames[0].roadBaselineSeconds);
  assert.deepEqual(recording,before);
  assert.equal(Object.hasOwn(flat,'places'),false);
  assert.equal(Object.hasOwn(climb,'awards'),false);
});

test('complete stage input refuses incomplete or unprovenanced terrain',()=>{
  const {recording,overlay}=fixture();
  const baselines=recording.route.kilometres.map(segment=>({
    terrain:segment.terrain,gradientPct:segment.gradientPct,
    source:'illustrative'}));
  const raw={version:STAGE_COMPLETE_INPUT_VERSION,overlay,
    kilometreBaselines:baselines};
  assert.throws(()=>normalizeCompleteStageInputV3({...raw,
    kilometreBaselines:baselines.slice(1)}),/Every whole kilometre/);
  const missing=structuredClone(raw);
  delete missing.kilometreBaselines[31].source;
  assert.throws(()=>normalizeCompleteStageInputV3(missing),/provenance/);
  assert.throws(()=>normalizeCompleteStageInputV3({...raw,
    version:'v2'}),/versioned complete stage/);
});
