import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearUnpayableClimbV1} from
  '../../lib/engine/v2/rear-unpayable-climb-v1.mjs';
import {runRearUnpayableSoloV1,validateRearUnpayableSoloV1} from
  '../../lib/engine/v2/rear-unpayable-solo-run-v1.mjs';

const rider={id:'climber',mountain:65,flat:65,hills:65,
  sprint:50,cobbles:50,timetrial:35,endurance:70,
  strength:65,wind:50,form:50,fatigue:0};
const segment=km=>({km,terrain:'climb',surface:'road',
  gradientPct:6,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}});
const plan={status:'worked',leaderAbility:80,
  turns:[{startM:0,endM:1000,ability:80}]};

test('a paid within-km climb split continues only as replayed solo road',()=>{
  const initialInput={rider,segment:segment(12),energy:.24,
    bunchTurnPlan:plan,stageNumber:18,stageCount:21};
  const initial=advanceRearUnpayableClimbV1(initialInput);
  assert.equal(initial.status,'solo_behind');
  const input={initialInput,initial,steps:[{rider,
    segment:segment(13),bunchTurnPlan:plan,
    effort:'conserve',reason:'finish_safely'}]};
  const result=runRearUnpayableSoloV1(input);
  assert.equal(result.road.length,1);
  assert.equal(result.road[0].sourceKm,13);
  assert.equal(result.road[0].energyBefore,initial.energyAfter);
  assert.equal(result.finalSolo.status,'solo_behind');
  assert.equal(validateRearUnpayableSoloV1(input,result),true);
  const tampered=structuredClone(initial);
  tampered.splitDistanceM+=10;
  assert.throws(()=>runRearUnpayableSoloV1({...input,
    initial:tampered}),/replayed paid climb split/);
  assert.throws(()=>runRearUnpayableSoloV1({...input,
    steps:[{...input.steps[0],segment:segment(14)}]}),
  /consecutive rider road/);
});

test('an unresolved sub-threshold gap cannot become a rear solo',()=>{
  const initialInput={rider,segment:segment(12),energy:.16,
    bunchTurnPlan:{status:'worked',leaderAbility:45,
      turns:[{startM:0,endM:1000,ability:45}]},
  stageNumber:18,stageCount:21};
  const initial=advanceRearUnpayableClimbV1(initialInput);
  assert.equal(initial.status,'wheel_gap_unresolved');
  assert.throws(()=>runRearUnpayableSoloV1({initialInput,initial,
    steps:[{rider,segment:segment(13),bunchTurnPlan:plan,
      effort:'conserve',reason:'finish_safely'}]}),
  /replayed paid climb split/);
});
