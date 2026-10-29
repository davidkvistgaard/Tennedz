import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';
import {advanceRearUnpayableClimbV1} from
  '../../lib/engine/v2/rear-unpayable-climb-v1.mjs';
import {advanceRearSourceContactV1,
  validateRearSourceContactV1} from
  '../../lib/engine/v2/rear-source-contact-v1.mjs';

const rider=(id,mountain)=>({id,mountain,flat:65,hills:65,
  timetrial:50,endurance:70,strength:70,form:50,fatigue:0});
const segment=km=>({km,terrain:'climb',surface:'road',
  gradientPct:6,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}});
const plan=ability=>({status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:1000,ability}]});

test('an unaffordable climb split can source a later paid rear contact',()=>{
  const frontRider=rider('front',10);
  const rearRider=rider('rear',99);
  const frontSource={rider:frontRider,segment:segment(12),
    energy:40,bunchTurnPlan:plan(55),
    stageNumber:18,stageCount:21};
  const rearSource={rider:rearRider,segment:segment(12),
    energy:.24,bunchTurnPlan:plan(60),
    stageNumber:18,stageCount:21};
  const frontPrior=advanceRearDetachmentV1(frontSource);
  const rearPrior=advanceRearUnpayableClimbV1(rearSource);
  assert.equal(frontPrior.status,'solo_behind');
  assert.equal(rearPrior.status,'solo_behind');
  assert.ok(rearPrior.behindBunchSeconds>
    frontPrior.behindBunchSeconds);
  const input={segment:segment(13),bunchTurnPlan:plan(90),
    front:{prior:frontPrior,priorSource:frontSource,
      rider:frontRider,effort:'conserve',reason:'finish_safely'},
    rear:{prior:rearPrior,priorSource:rearSource,
      rider:rearRider,effort:'conserve',reason:'finish_safely'}};
  const result=advanceRearSourceContactV1(input);
  assert.equal(result.contact.event?.kind,'rear_contact');
  assert.equal(validateRearSourceContactV1(input,result),true);
  const tampered=structuredClone(rearPrior);
  tampered.splitDistanceM+=10;
  assert.throws(()=>advanceRearSourceContactV1({...input,
    rear:{...input.rear,prior:tampered}}),/differs/);
  assert.throws(()=>advanceRearSourceContactV1({...input,
    rear:{...input.rear,rider:{...rearRider,mountain:100}}}),
  /rider differs/);
});
