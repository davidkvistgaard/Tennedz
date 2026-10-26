import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateTwoDeclaredWorkGroupsKilometreV3} from
  '../../lib/engine/v2/stage-two-declared-work-groups-v3.mjs';
import {evaluateSeparatedRoadBandsKilometreV3,
  STAGE_SEPARATED_ROAD_BANDS_VERSION} from
  '../../lib/engine/v2/stage-separated-road-bands-v3.mjs';

function fixture(){
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),
    features:[{id:'short-climb',kind:'climb',fromKm:.2,toKm:.8,
      gradientPct:8,label:'Synthetic short climb'}]});
  const member=(id,flat)=>({id,effort:'steady',energyBefore:80,
    rider:{id,flat,mountain:60,timetrial:60,endurance:70,
      strength:60,form:50,fatigue:0}});
  const bands=[
    {id:'road-1',members:[member('front-a',50),member('front-b',50)]},
    {id:'outside-solo',members:[member('solo',63)]},
    {id:'road-2',members:[member('rear-a',80),member('rear-b',80)]},
  ];
  return {overlay,kilometreIndex:0,bands,gapsSeconds:[5,5],
    baseTerrain:'flat',baseGradientPct:0,
    pullRiderIds:['front-a','solo','rear-a','rear-b'],
    driveRiderIds:['front-a']};
}

test('separated mixed road bands pay short slices for group and solo riders',()=>{
  const input=fixture(),saved=structuredClone(input);
  const result=evaluateSeparatedRoadBandsKilometreV3(input);
  assert.equal(result.version,STAGE_SEPARATED_ROAD_BANDS_VERSION);
  assert.equal(result.status,'separate');
  assert.deepEqual(result.frames.map(frame=>[frame.fromKm,frame.toKm]),
    [[0,.2],[.2,.8],[.8,1]]);
  assert.deepEqual(result.frames[1].featureIds,['short-climb']);
  assert.deepEqual(result.frames[0].bandClocks[1].pullRiderIds,['solo']);
  assert.ok(result.gapsSeconds.every(gap=>gap>0));
  for(const member of input.bands.flatMap(band=>band.members)){
    const paid=result.frames.reduce((sum,frame)=>sum+
      frame.bandClocks.flatMap(band=>band.members)
        .find(row=>row.riderId===member.id).work,0);
    const end=result.energies.find(row=>row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-end-paid)<3e-6);
  }
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('adjacent group clocks agree with the prior fixed-two-group version',()=>{
  const input=fixture();
  input.bands=[input.bands[0],input.bands[2],input.bands[1]];
  input.gapsSeconds=[5,100];
  const mixed=evaluateSeparatedRoadBandsKilometreV3(input);
  const old=evaluateTwoDeclaredWorkGroupsKilometreV3({
    overlay:input.overlay,kilometreIndex:0,
    front:input.bands[0],rear:input.bands[1],gapSeconds:5,
    baseTerrain:'flat',baseGradientPct:0,
    pullRiderIds:['front-a','rear-a','rear-b'],
    driveRiderIds:['front-a']});
  assert.equal(mixed.status,'separate');
  assert.equal(mixed.gapsSeconds[0],old.gapSeconds);
  for(let index=0;index<old.frames.length;index++){
    assert.deepEqual(mixed.frames[index].bandClocks.slice(0,2)
      .map(clock=>({...clock,groupId:clock.bandId,bandId:undefined})),
    old.frames[index].groupClocks.map(clock=>({...clock,bandId:undefined})));
  }
});

test('any possible adjacent contact refuses before charging the whole unpaid slice',()=>{
  const input=fixture();
  input.gapsSeconds=[.01,.01];
  const result=evaluateSeparatedRoadBandsKilometreV3(input);
  assert.equal(result.status,'unresolved_band_contact');
  assert.equal(result.paidUntilKm,result.possibleContactSpan.fromKm);
  assert.ok(result.possibleContactPairs.length>=1);
  assert.ok(result.frames.every(frame=>frame.toKm<=result.paidUntilKm));
  const last=result.frames.at(-1);
  for(const row of result.energies){
    const paid=last?.bandClocks.flatMap(band=>band.members)
      .find(member=>member.riderId===row.riderId);
    assert.equal(row.energy,paid?.energyAfter??80);
  }
  assert.ok(result.gapsSeconds.every(gap=>gap>0));
});

test('mixed bands refuse unearned solo sitting, invalid work and nonseparation',()=>{
  const input=fixture();
  for(const invalid of [
    {...input,pullRiderIds:['front-a','rear-a','rear-b']},
    {...input,pullRiderIds:['solo','solo']},
    {...input,driveRiderIds:['front-b']},
    {...input,gapsSeconds:[5,0]},
    {...input,bands:[input.bands[0],input.bands[1],input.bands[1]]},
  ])assert.throws(()=>evaluateSeparatedRoadBandsKilometreV3(invalid));
});
