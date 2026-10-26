import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {replaySeparatedSoloBandsStageV3} from
  '../../lib/engine/v2/stage-separated-solo-replay-v3.mjs';
import {evaluateSeparatedSoloBandsKilometreV3} from
  '../../lib/engine/v2/stage-separated-solo-bands-v3.mjs';

function fixture(){
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,
      conditions:{surface:'road',exposed:false,source:'illustrative',
        weather:{temperatureC:16,windKph:0,rainMm:0}}})),
    features:[{id:'short-climb',kind:'climb',fromKm:10.2,toKm:10.8,
      gradientPct:10,label:'Synthetic climb'}],
    conditionSpans:[{id:'rough',fromKm:10.4,toKm:10.6,
      conditions:{surface:'gravel',exposed:true,source:'simulated',
        weather:{temperatureC:16,windKph:28,rainMm:0}}}]});
  const bands=[['front',90,30],['middle',60,60],['rear',30,90]]
    .map(([id,flat,mountain])=>({id,breakWork:'cooperate',
      effort:'steady',energyBefore:80,rider:{flat,mountain,
        timetrial:60,endurance:70,strength:60,form:50,fatigue:0}}));
  const kilometreBaselines=Array.from({length:20},()=>({
    terrain:'flat',gradientPct:0}));
  return {overlay,bands,gapsSeconds:[30,30],kilometreBaselines};
}

test('three separated lanes pay each rider once across short stage slices',()=>{
  const input=fixture();
  const saved=structuredClone(input);
  const result=replaySeparatedSoloBandsStageV3(input);
  assert.equal(result.status,'separate');
  assert.equal(result.paidUntilKm,20);
  assert.equal(result.kilometres.length,20);
  const frames=result.kilometres[10].frames;
  assert.deepEqual(frames.map(frame=>[frame.fromKm,frame.toKm]),
    [[10,10.2],[10.2,10.4],[10.4,10.6],[10.6,10.8],[10.8,11]]);
  assert.equal(frames[2].surface,'gravel');
  assert.deepEqual(frames[2].featureIds,['short-climb']);
  assert.deepEqual(frames[2].riders.map(row=>row.riderId),
    ['front','middle','rear']);
  assert.deepEqual(frames[2].gaps.map(row=>[row.frontId,row.rearId]),
    [['front','middle'],['middle','rear']]);
  for(const band of input.bands){
    const spent=result.kilometres.flatMap(km=>km.frames)
      .reduce((total,frame)=>total+
        frame.riders.find(row=>row.riderId===band.id).work,0);
    const remaining=result.energies.find(row=>row.riderId===band.id).energy;
    assert.ok(Math.abs(band.energyBefore-remaining-spent)<2e-5);
  }
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('multiple 5 km effort orders activate after each marker',()=>{
  const input=fixture();
  const baseline=replaySeparatedSoloBandsStageV3(input);
  const changed=replaySeparatedSoloBandsStageV3({...input,
    effortOrders:[{riderId:'front',markerKm:5,effort:'hard'},
      {riderId:'middle',markerKm:10,effort:'conserve'}]});
  assert.equal(changed.kilometres[4].frames[0].riders[0].effort,'steady');
  assert.equal(changed.kilometres[5].frames[0].riders[0].effort,'hard');
  assert.equal(changed.kilometres[9].frames[0].riders[1].effort,'steady');
  assert.equal(changed.kilometres[10].frames[0].riders[1].effort,'conserve');
  assert.ok(changed.energies[0].energy<baseline.energies[0].energy);
  assert.ok(changed.energies[1].energy>baseline.energies[1].energy);
});

test('possible contact refuses the first unpaid slice and rolls back every lane',()=>{
  const input=fixture();
  const step=evaluateSeparatedSoloBandsKilometreV3({
    overlay:input.overlay,kilometreIndex:10,bands:input.bands,
    gapsSeconds:[.01,.01],baseTerrain:'flat',baseGradientPct:0});
  assert.equal(step.status,'unresolved_contact');
  assert.ok(step.possibleContactPairs.length>=1);
  assert.ok(step.frames.every(frame=>frame.toKm<=step.paidUntilKm));
  assert.equal(step.possibleContactSpan.fromKm,step.paidUntilKm);
  const lastPaid=step.frames.at(-1);
  for(const row of step.energies){
    const expected=lastPaid?.riders.find(rider=>rider.riderId===row.riderId)
      .energyAfter??80;
    assert.equal(row.energy,expected);
  }
  assert.deepEqual(step.gapsSeconds,lastPaid?.gaps.map(gap=>
    gap.afterSeconds)??[.01,.01]);
  assert.ok(step.gapsSeconds.every(gap=>gap>0));
  assert.equal(Object.hasOwn(step,'places'),false);
});

test('three, five and eight equal solo lanes keep distinct positive gaps',()=>{
  const input=fixture();
  for(const count of [3,5,8]){
    const bands=Array.from({length:count},(_,index)=>({
      ...input.bands[1],id:'lane-'+index}));
    const race=replaySeparatedSoloBandsStageV3({...input,bands,
      gapsSeconds:Array(count-1).fill(3)});
    assert.equal(race.status,'separate');
    assert.equal(race.energies.length,count);
    assert.equal(race.gapsSeconds.length,count-1);
    assert.ok(race.gapsSeconds.every(gap=>gap===3));
    assert.ok(race.kilometres.every(km=>km.frames.every(frame=>
      frame.riders.length===count&&frame.gaps.length===count-1)));
  }
});

test('unsupported geometry and duplicate orders remain explicit refusals',()=>{
  const input=fixture();
  assert.throws(()=>replaySeparatedSoloBandsStageV3({...input,
    bands:[input.bands[0],input.bands[1]]}),/Three to eight/);
  assert.throws(()=>replaySeparatedSoloBandsStageV3({...input,
    gapsSeconds:[1]}),/neighboring solo gap/);
  assert.throws(()=>replaySeparatedSoloBandsStageV3({...input,
    effortOrders:[{riderId:'front',markerKm:5,effort:'hard'},
      {riderId:'front',markerKm:5,effort:'steady'}]}),/Duplicate/);
  assert.throws(()=>replaySeparatedSoloBandsStageV3({...input,
    bands:[...input.bands.slice(0,2),{...input.bands[2],
      breakWork:'sit_on'}]}),/cooperating solo/);
});
