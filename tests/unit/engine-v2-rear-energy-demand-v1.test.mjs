import test from 'node:test';
import assert from 'node:assert/strict';
import {priceRearEnergyDemandV1,validateRearEnergyDemandV1} from
  '../../lib/engine/v2/rear-energy-demand-v1.mjs';

const rider={id:'rear-a',mountain:65,flat:65,hills:65,
  timetrial:65,endurance:70,strength:70,form:50,fatigue:0};
const flat={km:14,terrain:'flat',surface:'road',gradientPct:0,
  exposed:false,weather:{temperatureC:16,windKph:0,rainMm:0}};
const base={rider,segment:flat,energyBefore:40,
  effort:'steady',distanceM:1000};

test('terrain prices exposed and sheltered work on the same paid road',()=>{
  const climb={...flat,terrain:'climb',gradientPct:6};
  const flatLeader=priceRearEnergyDemandV1({...base,role:'leader'});
  const climbLeader=priceRearEnergyDemandV1({...base,
    segment:climb,role:'leader'});
  const flatFollower=priceRearEnergyDemandV1({...base,role:'sheltered'});
  const climbFollower=priceRearEnergyDemandV1({...base,
    segment:climb,role:'sheltered'});
  assert.equal(climbLeader.terrainLoad,1.21);
  assert.ok(climbLeader.energyDemand>flatLeader.energyDemand);
  assert.ok(climbFollower.energyDemand>flatFollower.energyDemand);
  assert.ok(climbLeader.energyDemand>climbFollower.energyDemand);
  assert.ok(flatLeader.energyDemand>flatFollower.energyDemand);
  assert.equal(validateRearEnergyDemandV1({...base,
    segment:climb,role:'leader'},climbLeader),true);
  const forged=structuredClone(climbLeader);
  forged.energyAfter=40;
  assert.throws(()=>validateRearEnergyDemandV1({...base,
    segment:climb,role:'leader'},forged),/differs/);
});

test('distance and capacity constrain each rider’s chosen work',()=>{
  const full=priceRearEnergyDemandV1({...base,role:'solo'});
  const half=priceRearEnergyDemandV1({...base,
    role:'solo',distanceM:500});
  assert.equal(half.energyDemand,full.energyDemand/2);
  assert.throws(()=>priceRearEnergyDemandV1({...base,
    role:'leader',energyBefore:.01}),/cannot pay/);
  assert.throws(()=>priceRearEnergyDemandV1({...base,
    role:'leader',distanceM:1001}),/payable distance/);
});
