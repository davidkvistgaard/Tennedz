import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {replayTwoDeclaredWorkGroupsStageV3,
  STAGE_TWO_DECLARED_WORK_REPLAY_VERSION} from
  '../../lib/engine/v2/stage-two-declared-work-replay-v3.mjs';

function fixture(){
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),
    features:[{id:'short-climb',kind:'climb',fromKm:10.2,toKm:10.8,
      gradientPct:9,label:'Synthetic short climb'}],
    conditionSpans:[{id:'rough-road',fromKm:10.4,toKm:10.6,
      conditions:{surface:'gravel',exposed:true,source:'illustrative',
        weather:{temperatureC:16,windKph:25,rainMm:0}}}]});
  const member=(id,flat)=>({id,effort:'steady',energyBefore:90,
    rider:{id,flat,mountain:60,timetrial:60,endurance:70,
      strength:60,form:50,fatigue:0}});
  return {overlay,front:{id:'road-1',members:[
    member('front-a',50),member('front-b',50)]},
  rear:{id:'road-2',members:[member('rear-a',75),member('rear-b',75)]},
  gapSeconds:100,kilometreBaselines:Array.from({length:20},()=>({
    terrain:'flat',gradientPct:0})),
  pullRiderIds:['front-a','rear-a','rear-b'],driveRiderIds:['front-a'],
  workOrders:[
    {markerKm:5,pullRiderIds:['front-a','front-b','rear-a'],
      driveRiderIds:[]},
    {markerKm:10,pullRiderIds:['front-b','rear-a','rear-b'],
      driveRiderIds:['rear-b']},
  ]};
}

test('precommitted work changes pay every precise stage slice without changing groups',()=>{
  const input=fixture(),saved=structuredClone(input);
  const result=replayTwoDeclaredWorkGroupsStageV3(input);
  assert.equal(result.version,STAGE_TWO_DECLARED_WORK_REPLAY_VERSION);
  assert.equal(result.status,'separate');
  assert.equal(result.paidUntilKm,20);
  assert.equal(result.kilometres.length,20);
  assert.equal(result.kilometres[4].workOrderActivated,null);
  assert.deepEqual(result.kilometres[5].workOrderActivated,
    {markerKm:5,pullRiderIds:['front-a','front-b','rear-a'],
      driveRiderIds:[]});
  assert.deepEqual(result.kilometres[10].workOrderActivated,
    {markerKm:10,pullRiderIds:['front-b','rear-a','rear-b'],
      driveRiderIds:['rear-b']});
  assert.deepEqual(result.kilometres[10].frames.map(frame=>
    [frame.fromKm,frame.toKm]),
  [[10,10.2],[10.2,10.4],[10.4,10.6],[10.6,10.8],[10.8,11]]);
  const rough=result.kilometres[10].frames[2];
  assert.equal(rough.surface,'gravel');
  assert.equal(rough.conditionSource,'illustrative');
  assert.ok(rough.roadBaselineSeconds>0);
  assert.deepEqual(rough.featureIds,['short-climb']);
  assert.equal(rough.conditionSpanId,'rough-road');
  for(const member of [...input.front.members,...input.rear.members]){
    const paid=result.kilometres.flatMap(km=>km.frames)
      .reduce((sum,frame)=>sum+frame.groupClocks.flatMap(group=>
        group.members).find(row=>row.riderId===member.id).work,0);
    const energy=result.energies.find(row=>row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-energy-paid)<.00004);
  }
  assert.ok(result.kilometres.every(km=>km.gapSeconds>0));
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('declared-work stage refuses possible contact before spending that slice',()=>{
  const input=fixture();
  const result=replayTwoDeclaredWorkGroupsStageV3({...input,
    gapSeconds:.01});
  assert.equal(result.status,'unresolved_group_contact');
  assert.equal(result.paidUntilKm,result.possibleContactSpan.fromKm);
  assert.ok(result.kilometres.at(-1).frames.every(frame=>
    frame.toKm<=result.paidUntilKm));
  assert.ok(result.gapSeconds>0);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('declared-work stage refuses off-grid, duplicate and invalid rosters',()=>{
  const input=fixture();
  for(const invalid of [
    {...input,workOrders:[{markerKm:6,pullRiderIds:['front-a']}]},
    {...input,workOrders:[...input.workOrders,
      {...input.workOrders[0]}]},
    {...input,workOrders:[{markerKm:5,pullRiderIds:['unknown']}]},
    {...input,workOrders:[{markerKm:5,pullRiderIds:['front-a'],
      driveRiderIds:['rear-a']}]},
    {...input,kilometreBaselines:input.kilometreBaselines.slice(1)},
  ])assert.throws(()=>replayTwoDeclaredWorkGroupsStageV3(invalid));
});
