import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateSeparatedRoadBandsKilometreV3,
  evaluateSeparatedRoadBandsWithCapacityKilometreV3,
  STAGE_SEPARATED_ROAD_CAPACITY_VERSION} from
  '../../lib/engine/v2/stage-separated-road-bands-v3.mjs';
import {projectStageCapacityKilometreV3} from
  '../../lib/engine/v2/stage-sliced-capacity-v3.mjs';
import {replaySeparatedRoadBandsStageV3,
  replaySeparatedRoadBandsWithCapacityStageV3,
  STAGE_SEPARATED_ROAD_CAPACITY_REPLAY_VERSION} from
  '../../lib/engine/v2/stage-separated-road-replay-v3.mjs';

function fixture(){
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:165,
    tacticalIntervals:Array.from({length:33},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),
    features:[{id:'synthetic-climb',kind:'climb',fromKm:161.2,
      toKm:161.8,gradientPct:8,label:'Synthetic climb'}]});
  const member=(id,flat)=>({id,effort:'conserve',energyBefore:60,
    energyCapBefore:60,rider:{id,flat,mountain:60,timetrial:60,
      endurance:0,strength:60,form:50,fatigue:0}});
  return {overlay,kilometreIndex:161,
    bands:[
      {id:'front',members:[member('front-pull',50),member('front-sit',50)]},
      {id:'solo',members:[member('solo-pull',65)]},
      {id:'rear',members:[member('rear-pull',80),member('rear-sit',80)]},
    ],gapsSeconds:[5,5],baseTerrain:'flat',baseGradientPct:0,
    pullRiderIds:['front-pull','solo-pull','rear-pull']};
}

test('opt-in capacity settles each paid short slice without changing legacy output',()=>{
  const input=fixture(),saved=structuredClone(input);
  const legacy=evaluateSeparatedRoadBandsKilometreV3(input);
  const result=evaluateSeparatedRoadBandsWithCapacityKilometreV3(input);
  assert.equal(result.version,STAGE_SEPARATED_ROAD_CAPACITY_VERSION);
  assert.equal(result.status,'separate');
  assert.deepEqual(result.frames.map(frame=>[frame.fromKm,frame.toKm]),
    [[161,161.2],[161.2,161.8],[161.8,162]]);
  assert.equal(Object.hasOwn(legacy,'capacities'),false);
  assert.equal(Object.hasOwn(legacy.frames[0].bandClocks[0].members[0],
    'energyCapAfter'),false);
  assert.deepEqual(input,saved);
  assert.deepEqual(result.gapsSeconds,legacy.gapsSeconds);
  for(const member of input.bands.flatMap(band=>band.members)){
    const plan=projectStageCapacityKilometreV3({overlay:input.overlay,
      kilometreIndex:161,rider:member.rider,
      energyCapBefore:member.energyCapBefore,
      baseTerrain:'flat',baseGradientPct:0});
    const cap=result.capacities.find(row=>row.riderId===member.id).energyCap;
    assert.equal(cap,plan.energyCapAfter);
    let energy=member.energyBefore;
    for(const frame of result.frames){
      const paid=frame.bandClocks.flatMap(band=>band.members)
        .find(row=>row.riderId===member.id);
      assert.equal(paid.energyBefore,+energy.toFixed(6));
      assert.ok(Math.abs(energy-paid.work-paid.capAdjustment-
        paid.energyAfter)<3e-6);
      assert.ok(paid.energyAfter<=paid.energyCapAfter+1e-6);
      energy=paid.energyAfter;
    }
    assert.equal(result.energies.find(row=>row.riderId===member.id).energy,
      +energy.toFixed(6));
  }
  assert.ok(result.frames.some(frame=>frame.bandClocks.some(band=>
    band.members.some(row=>row.capAdjustment>0))));
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('possible contact rolls back work and capacity for every band',()=>{
  const input=fixture();
  input.gapsSeconds=[.01,.01];
  const result=evaluateSeparatedRoadBandsWithCapacityKilometreV3(input);
  assert.equal(result.status,'unresolved_band_contact');
  assert.ok(result.frames.every(frame=>frame.toKm<=result.paidUntilKm));
  for(const member of input.bands.flatMap(band=>band.members)){
    const last=result.frames.at(-1)?.bandClocks.flatMap(band=>band.members)
      .find(row=>row.riderId===member.id);
    assert.equal(result.energies.find(row=>row.riderId===member.id).energy,
      last?.energyAfter??member.energyBefore);
    assert.equal(result.capacities.find(row=>row.riderId===member.id).energyCap,
      last?.energyCapAfter??member.energyCapBefore);
  }
});

test('capacity clock requires explicit valid cap for every rider',()=>{
  const input=fixture();
  delete input.bands[1].members[0].energyCapBefore;
  assert.throws(()=>evaluateSeparatedRoadBandsWithCapacityKilometreV3(input),
    /capacity/i);
});

test('whole bounded replay carries paid energy and capacity across kilometres',()=>{
  const input=fixture();
  const stage={...input,startKilometreIndex:161,
    kilometreBaselines:Array.from({length:165},()=>({
      terrain:'flat',gradientPct:0})),effortOrders:[],workOrders:[]};
  const legacy=replaySeparatedRoadBandsStageV3(stage);
  const result=replaySeparatedRoadBandsWithCapacityStageV3(stage);
  assert.equal(result.version,STAGE_SEPARATED_ROAD_CAPACITY_REPLAY_VERSION);
  assert.equal(result.status,'separate');
  assert.equal(result.paidUntilKm,165);
  assert.notDeepEqual(result.gapsSeconds,legacy.gapsSeconds);
  assert.ok(result.gapsSeconds.every(gap=>gap>0));
  assert.equal(Object.hasOwn(legacy,'capacities'),false);
  assert.deepEqual(result.kilometres.map(row=>row.kilometreIndex),
    [161,162,163,164]);
  for(const member of input.bands.flatMap(band=>band.members)){
    let previousCap=member.energyCapBefore;
    let previousEnergy=member.energyBefore;
    for(const kilometre of result.kilometres){
      const cap=kilometre.capacities.find(row=>
        row.riderId===member.id).energyCap;
      const energy=kilometre.energies.find(row=>
        row.riderId===member.id).energy;
      assert.ok(cap<=previousCap);
      assert.ok(energy<=previousEnergy);
      assert.ok(energy<=cap+1e-6);
      previousCap=cap;
      previousEnergy=energy;
    }
    assert.equal(result.capacities.find(row=>row.riderId===member.id).energyCap,
      previousCap);
  }
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('replay refuses possible contact with all capacity states at last paid slice',()=>{
  const input=fixture();
  input.gapsSeconds=[.01,.01];
  const stage={...input,startKilometreIndex:161,
    kilometreBaselines:Array.from({length:165},()=>({
      terrain:'flat',gradientPct:0})),effortOrders:[],workOrders:[]};
  const result=replaySeparatedRoadBandsWithCapacityStageV3(stage);
  assert.equal(result.status,'unresolved_band_contact');
  const last=result.kilometres.at(-1);
  assert.equal(result.paidUntilKm,last.paidUntilKm);
  assert.deepEqual(result.capacities,last.capacities);
  assert.deepEqual(result.energies,last.energies);
  assert.ok(last.frames.every(frame=>frame.toKm<=result.paidUntilKm));
});
