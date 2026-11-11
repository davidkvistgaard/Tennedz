import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearSoloRoadV1,validateRearSoloRoadV1} from
  '../../lib/engine/v2/rear-solo-road-v1.mjs';

const rider={id:'a',mountain:85,flat:70,hills:70,timetrial:85,
  endurance:80,strength:75,form:50,fatigue:0};
const segment={km:13,terrain:'climb',surface:'road',exposed:false,
  gradientPct:6,weather:{temperatureC:16,windKph:0,rainMm:0}};
const plan=ability=>({status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:500,ability},
    {startM:500,endM:1000,ability}]});
const prior={version:'v2-rear-detachment-1',status:'solo_behind',
  riderId:'a',endDistanceM:12000,behindBunchSeconds:2,
  energyAfter:20};

test('solo rider pays road energy and meets the bunch at a physical marker',()=>{
  const input={prior,rider,segment,bunchTurnPlan:plan(40),
    effort:'hard',reason:'rejoin_bunch'};
  const next=advanceRearSoloRoadV1(input);
  assert.equal(next.status,'bunch_contact');
  assert.ok(next.endDistanceM>12000&&next.endDistanceM<13000);
  assert.equal(next.event.kind,'rejoin_bunch');
  assert.equal(next.event.atDistanceM,next.endDistanceM);
  assert.ok(next.energySpent>0&&next.energySpent<1);
  assert.equal(validateRearSoloRoadV1(input,next),true);
  assert.throws(()=>validateRearSoloRoadV1(input,{...next,
    energySpent:0}),/differs/);
});

test('solo rider can conserve and remain behind without a free wheel',()=>{
  const input={prior,rider,segment,bunchTurnPlan:plan(90),
    effort:'conserve',reason:'finish_safely'};
  const next=advanceRearSoloRoadV1(input);
  assert.equal(next.status,'solo_behind');
  assert.equal(next.endDistanceM,13000);
  assert.ok(next.behindBunchSeconds>prior.behindBunchSeconds);
  assert.ok(next.energySpent>0);
  assert.equal(next.event,null);
});

test('forged position, unpayable effort and unvalidated bunch turns refuse',()=>{
  const input={prior,rider,segment,bunchTurnPlan:plan(90),
    effort:'hard',reason:'rejoin_bunch'};
  assert.throws(()=>advanceRearSoloRoadV1({...input,
    prior:{...prior,endDistanceM:11000}}),/exact prior position/);
  assert.throws(()=>advanceRearSoloRoadV1({...input,
    prior:{...prior,energyAfter:0}}),/cannot pay/);
  assert.throws(()=>advanceRearSoloRoadV1({...input,
    bunchTurnPlan:{...plan(90),leaderAbility:95}}),/differs/);
});
