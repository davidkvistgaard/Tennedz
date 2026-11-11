import test from 'node:test';
import assert from 'node:assert/strict';
import {priceRearDepletedTravelV1,
  validateRearDepletedTravelV1} from
  '../../lib/engine/v2/rear-depleted-travel-v1.mjs';
import {quoteRearEnergyDemandV1} from
  '../../lib/engine/v2/rear-energy-demand-v1.mjs';

const rider={id:'rear-a',mountain:65,flat:65,hills:65,
  timetrial:65,endurance:70,strength:70,form:50,fatigue:30};
const segment={km:252,terrain:'flat',surface:'road',
  gradientPct:0,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const input={rider,segment,energyBefore:.1,
  effort:'steady',role:'leader',distanceM:1000,
  baseSpeedMps:10};

test('depleted rear leader pays available energy and loses own speed',()=>{
  const quote=quoteRearEnergyDemandV1(input);
  assert.ok(quote.energyDemand>input.energyBefore);
  const travel=priceRearDepletedTravelV1(input);
  assert.equal(travel.energyDemand,quote.energyDemand);
  assert.equal(travel.paidFromReserve,input.energyBefore);
  assert.equal(travel.energyAfter,0);
  assert.equal(travel.unmetEnergyDemand,
    quote.energyDemand-input.energyBefore);
  assert.ok(travel.speedMps<input.baseSpeedMps);
  assert.ok(travel.elapsedSeconds>100);
  assert.equal(travel.officialResults,false);
  assert.equal(validateRearDepletedTravelV1(input,travel),true);
  assert.throws(()=>validateRearDepletedTravelV1(input,
    {...travel,speedMps:input.baseSpeedMps}),/differs/);
});

test('payable rear travel preserves the priced full speed',()=>{
  const travel=priceRearDepletedTravelV1({...input,
    energyBefore:40});
  assert.equal(travel.unmetEnergyDemand,0);
  assert.equal(travel.sustainableFraction,1);
  assert.equal(travel.speedMps,10);
  assert.equal(travel.elapsedSeconds,100);
});
