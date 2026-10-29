import test from 'node:test';
import assert from 'node:assert/strict';
import {runRearBunchOriginRoadV1} from
  '../../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {advanceRearBunchEnergyLossV1,
  validateRearBunchEnergyLossV1} from
  '../../lib/engine/v2/rear-bunch-energy-loss-v1.mjs';
import {continueRearExhaustedSoloV1,
  validateRearExhaustedSoloV1} from
  '../../lib/engine/v2/rear-exhausted-solo-v1.mjs';
import {runRearExhaustedFinishV1,
  validateRearExhaustedFinishV1} from
  '../../lib/engine/v2/rear-exhausted-finish-v1.mjs';

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
  const soloInput={lossInput:input,loss:road};
  const solo=continueRearExhaustedSoloV1(soloInput);
  assert.equal(solo.splitDistanceM,road.endDistanceM);
  assert.equal(solo.endDistanceM,km*1000);
  assert.ok(solo.soloElapsedSeconds>solo.bunchElapsedSeconds);
  assert.ok(solo.behindBunchSeconds>0);
  assert.equal(solo.paidFromReserve,0);
  assert.ok(solo.slices.every(slice=>
    slice.curtailedWorkDemand>0&&slice.coastDelaySeconds>0));
  assert.equal(validateRearExhaustedSoloV1(soloInput,solo),true);
  const forgedSolo=structuredClone(solo);
  forgedSolo.slices[0].coastDelaySeconds=0;
  assert.throws(()=>validateRearExhaustedSoloV1(
    soloInput,forgedSolo),/differs/);
  const finishInput={soloInput,solo,
    routeKilometres:[...input.routeKilometres,
      segment(km+1),segment(km+2)],
    bunchTurnPlans:[...source.priorInput.bunchTurnPlans,
      shelterPlan(),shelterPlan(),shelterPlan()],
    soloChoices:[{riderId:'worker',km:km+1,
      effort:'conserve',reason:'finish_safely'},
    {riderId:'worker',km:km+2,
      effort:'conserve',reason:'finish_safely'}]};
  const finish=runRearExhaustedFinishV1(finishInput);
  assert.equal(finish.finishDistanceM,(km+2)*1000);
  assert.equal(finish.steps.length,2);
  assert.ok(finish.finishElapsedSeconds>finish.bunchElapsedSeconds);
  assert.ok(Math.abs(finish.finishElapsedSeconds-
    finish.bunchElapsedSeconds-finish.behindBunchSeconds)<1e-6);
  assert.equal(finish.energyAfter,0);
  assert.equal(finish.timeLimitSeconds,null);
  assert.equal(finish.officialResults,false);
  assert.equal(validateRearExhaustedFinishV1(
    finishInput,finish),true);
  const forgedFinish=structuredClone(finish);
  forgedFinish.finishElapsedSeconds=0;
  assert.throws(()=>validateRearExhaustedFinishV1(
    finishInput,forgedFinish),/differs/);
  const conflictSegment={...segment(km),terrain:'climb',
    gradientPct:8};
  const conflictPlan={status:'worked',leaderAbility:40,
    turns:[{startM:0,endM:900,ability:40,
      leaderRiderId:'other'},
    {startM:900,endM:1000,ability:40,
      leaderRiderId:'worker'}]};
  const conflictInput={...input,
    routeKilometres:[...source.priorInput.routeKilometres,
      conflictSegment],segment:conflictSegment,
    bunchTurnPlan:conflictPlan};
  const conflictLoss=advanceRearBunchEnergyLossV1(
    conflictInput);
  assert.ok(conflictLoss.endDistanceM<
    (km-1)*1000+900);
  assert.throws(()=>continueRearExhaustedSoloV1({
    lossInput:conflictInput,loss:conflictLoss}),
  /cannot lead the later bunch turn/);
});
