import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {replaySeparatedRoadBandsStageV3,
  STAGE_SEPARATED_ROAD_REPLAY_VERSION} from
  '../../lib/engine/v2/stage-separated-road-replay-v3.mjs';

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
  return {overlay,bands:[
    {id:'road-1',members:[member('front-a',50),member('front-b',50)]},
    {id:'outside-solo',members:[member('solo',63)]},
    {id:'road-2',members:[member('rear-a',75),member('rear-b',75)]},
  ],gapsSeconds:[100,100],
  kilometreBaselines:Array.from({length:20},()=>({
    terrain:'flat',gradientPct:0})),
  pullRiderIds:['front-a','solo','rear-a','rear-b'],
  driveRiderIds:['front-a'],
  workOrders:[{markerKm:5,pullRiderIds:[
    'front-a','front-b','solo','rear-a'],driveRiderIds:[]}],
  effortOrders:[{markerKm:10,bandId:'outside-solo',effort:'hard'}]};
}

test('already separated mixed bands replay exact conditions and 5 km orders',()=>{
  const input=fixture(),saved=structuredClone(input);
  const result=replaySeparatedRoadBandsStageV3(input);
  assert.equal(result.version,STAGE_SEPARATED_ROAD_REPLAY_VERSION);
  assert.equal(result.status,'separate');
  assert.equal(result.paidUntilKm,20);
  assert.equal(result.kilometres.length,20);
  assert.equal(result.kilometres[4].workOrderActivated,null);
  assert.equal(result.kilometres[5].workOrderActivated.markerKm,5);
  assert.equal(result.kilometres[10].effortOrdersActivated[0].bandId,
    'outside-solo');
  assert.equal(result.kilometres[9].activeEfforts[1].members[0].effort,
    'steady');
  assert.equal(result.kilometres[10].activeEfforts[1].members[0].effort,
    'hard');
  assert.deepEqual(result.kilometres[10].frames.map(frame=>
    [frame.fromKm,frame.toKm]),
  [[10,10.2],[10.2,10.4],[10.4,10.6],[10.6,10.8],[10.8,11]]);
  const rough=result.kilometres[10].frames[2];
  assert.equal(rough.surface,'gravel');
  assert.equal(rough.conditionSpanId,'rough-road');
  assert.deepEqual(rough.featureIds,['short-climb']);
  assert.ok(result.gapsSeconds.every(gap=>gap>0));
  for(const member of input.bands.flatMap(band=>band.members)){
    const paid=result.kilometres.flatMap(km=>km.frames)
      .reduce((sum,frame)=>sum+frame.bandClocks.flatMap(band=>
        band.members).find(row=>row.riderId===member.id).work,0);
    const end=result.energies.find(row=>row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-end-paid)<.00005);
  }
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('mixed-band replay stops all riders at first unpaid possible contact',()=>{
  const input=fixture();
  const result=replaySeparatedRoadBandsStageV3({...input,
    gapsSeconds:[.01,.01]});
  assert.equal(result.status,'unresolved_band_contact');
  assert.equal(result.paidUntilKm,result.possibleContactSpan.fromKm);
  assert.ok(result.possibleContactPairs.length>=1);
  assert.ok(result.kilometres.at(-1).frames.every(frame=>
    frame.toKm<=result.paidUntilKm));
  assert.ok(result.gapsSeconds.every(gap=>gap>0));
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('mixed-band replay refuses invalid markers, work and effort',()=>{
  const input=fixture();
  for(const invalid of [
    {...input,workOrders:[{markerKm:6,pullRiderIds:['solo']}]},
    {...input,workOrders:[...input.workOrders,
      {...input.workOrders[0]}]},
    {...input,workOrders:[{markerKm:5,pullRiderIds:['front-a']}]},
    {...input,effortOrders:[{markerKm:5,bandId:'unknown',effort:'hard'}]},
    {...input,effortOrders:[{markerKm:5,bandId:'road-1',effort:'invalid'}]},
    {...input,effortOrders:[{markerKm:5,bandId:'road-1',effort:'hard'},
      {markerKm:5,bandId:'road-1',effort:'steady'}]},
    {...input,kilometreBaselines:input.kilometreBaselines.slice(1)},
  ])assert.throws(()=>replaySeparatedRoadBandsStageV3(invalid));
});
