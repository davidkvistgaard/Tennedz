import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';
import {advanceRearPaceClimbSplitV1} from
  '../../lib/engine/v2/rear-pace-climb-split-v1.mjs';
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

test('a paid pace loss can source a later rear solo meeting',()=>{
  const frontRider=rider('front',25);
  const rearRider=rider('rear',80);
  const frontSource={rider:frontRider,segment:segment(12),
    energy:40,bunchTurnPlan:plan(58),
    stageNumber:18,stageCount:21};
  const rearSource={rider:rearRider,segment:segment(12),
    energy:40,bunchTurnPlan:{status:'worked',
      leaderAbility:80,turns:[
        {startM:0,endM:500,ability:60},
        {startM:500,endM:1000,ability:100}]},
    stageNumber:18,stageCount:21,
    soloEffort:'conserve',soloReason:'finish_safely'};
  const frontPrior=advanceRearDetachmentV1(frontSource);
  const rearPrior=advanceRearPaceClimbSplitV1(rearSource);
  assert.equal(frontPrior.status,'solo_behind');
  assert.equal(rearPrior.status,'solo_behind');
  assert.ok(rearPrior.behindBunchSeconds>
    frontPrior.behindBunchSeconds);
  const input={segment:segment(13),bunchTurnPlan:plan(90),
    front:{prior:frontPrior,priorSource:frontSource,
      rider:frontRider,effort:'conserve',reason:'finish_safely'},
    rear:{prior:rearPrior,priorSource:rearSource,
      rider:rearRider,effort:'hard',reason:'rejoin_bunch'}};
  const result=advanceRearSourceContactV1(input);
  assert.equal(result.contact.event?.kind,'rear_contact');
  assert.equal(validateRearSourceContactV1(input,result),true);
  const forged=structuredClone(rearPrior);
  forged.splitDistanceM+=10;
  assert.throws(()=>advanceRearSourceContactV1({...input,
    rear:{...input.rear,prior:forged}}),/differs/);
});
