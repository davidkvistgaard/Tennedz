import test from 'node:test';
import assert from 'node:assert/strict';
import {runRearBunchOriginRoadV1} from
  '../../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {advanceRearBunchEnergyLossV1,
  validateRearBunchEnergyLossV1} from
  '../../lib/engine/v2/rear-bunch-energy-loss-v1.mjs';

const rider={id:'worker',mountain:90,flat:90,hills:90,
  timetrial:90,endurance:70,strength:70,form:50,fatigue:100};
const segment=km=>({km,terrain:'flat',surface:'road',
  gradientPct:0,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}});
const leaderPlan=()=>({status:'worked',leaderAbility:40,
  turns:[{startM:0,endM:1000,ability:40,
    leaderRiderId:'worker'}]});
const shelterPlan=()=>({status:'worked',leaderAbility:40,
  turns:[{startM:0,endM:1000,ability:40,
    leaderRiderId:'other'}]});
const choice=km=>({riderId:'worker',km,
  effort:'hard',action:'hold_wheel',reason:'follow_order'});
const orders={baseline:{effort:'hard'},phases:[]};

test('exhausted bunch worker loses the wheel at last paid metre',()=>{
  let source=null;
  for(let count=1;count<=180;count++){
    const priorInput={rider,orders,
      routeKilometres:Array.from({length:count},(_,index)=>
        segment(index+1)),
      bunchTurnPlans:Array.from({length:count},leaderPlan),
      choices:Array.from({length:count},(_,index)=>choice(index+1)),
      stageNumber:1,stageCount:1};
    try{
      const prior=runRearBunchOriginRoadV1(priorInput);
      source={priorInput,prior};
    }catch(error){
      if(!/cannot pay/.test(String(error.message)))throw error;
      break;
    }
  }
  assert.ok(source?.prior.energyAfter>0);
  const km=source.prior.sourceKm+1;
  const input={priorInput:source.priorInput,prior:source.prior,
    routeKilometres:[...source.priorInput.routeKilometres,segment(km)],
    segment:segment(km),bunchTurnPlan:shelterPlan(),
    choice:choice(km)};
  const road=advanceRearBunchEnergyLossV1(input);
  assert.equal(road.status,'wheel_lost');
  assert.equal(road.split.kind,'physical_energy_loss');
  assert.ok(road.split.atDistanceM>(km-1)*1000);
  assert.ok(road.split.atDistanceM<km*1000);
  assert.equal(road.split.behindBunchSeconds,0);
  assert.ok(road.split.energySpent>0);
  assert.equal(road.energyAfter,0);
  assert.equal(validateRearBunchEnergyLossV1(input,road),true);
  const forged=structuredClone(road);
  forged.split.energySpent=0;
  assert.throws(()=>validateRearBunchEnergyLossV1(input,forged),
    /differs/);
});
