import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {commitTeamChaseStakesV1,
  decideCommittedTeamChaseV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  '../../lib/engine/v2/road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidChaseRoadV1} from
  '../../lib/engine/v2/isolated-paid-chase-road-v1.mjs';
import {advanceCaughtFrontSlideV1,
  validateCaughtFrontSlideV1} from
  '../../lib/engine/v2/isolated-caught-front-slide-v1.mjs';
import {advanceCaughtFrontSlideV2,
  validateCaughtFrontSlideV2} from
  '../../lib/engine/v2/isolated-caught-front-slide-v2.mjs';

const team=(id,skill)=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(key=>[key,skill]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(row=>
    [row.id,80])),orders:{captainId:riders[0].id,
    helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',chase:'all',
      breakWork:'cooperate'},phases:[]}};
};
const teams=[team('front',80),team('chaser',90)];
const segment={km:30,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const group={id:'road-1',riderIds:['front-0'],
  teamIds:['front'],gapSeconds:.1};
const commitment=commitTeamChaseStakesV1({teams,
  distanceKm:30,intentions:teams.map(row=>({teamId:row.id,
    baseline:{goal:row.id==='chaser'?'sprint_finish':
      'break_stage',captainId:row.riders[0].id},phases:[]}))});
const committedChoiceInput={commitment,teams,
  roadGroups:[group],observerTeamId:'chaser',
  raceSeed:'caught-front-slide-1',
  nominatedChaseTeamIds:['chaser'],remainingSegments:[segment]};
const committedChoice=decideCommittedTeamChaseV1(
  committedChoiceInput);
const frontChoiceInput={roadGroups:[group],groupId:'road-1',
  teams,riderGoals:[{riderId:'front-0',goal:'cooperate'}],
  km:30,distanceKm:30,raceSeed:'caught-front-slide-1'};
const frontChoice=decideRoadGroupSprintChoiceV1(frontChoiceInput);
const paidInput={committedChoiceInput,committedChoice,
  frontChoiceInput,frontChoice,segment};
const paidRoad=advanceIsolatedPaidChaseRoadV1(paidInput);
const slideDecision={riderId:'front-0',
  action:'finish_safely',effort:'conserve'};

test('caught solo passes through the paid bunch with no free wheel',()=>{
  assert.equal(paidRoad.contact?.kind,'front_bunch_contact');
  const input={paidInput,paidRoad,slideDecision};
  const result=advanceCaughtFrontSlideV1(input);
  assert.equal(result.event.kind,'front_passes_through_bunch');
  assert.equal(result.event.atDistanceM,result.catchDistanceM);
  const versioned=advanceCaughtFrontSlideV2(input);
  assert.equal(versioned.version,'v2-isolated-caught-front-slide-2');
  assert.ok(versioned.event.atDistanceM>versioned.catchDistanceM);
  assert.ok(versioned.event.atDistanceM<versioned.endDistanceM);
  assert.equal(versioned.event.atDistanceM,
    versioned.bunchExitDistanceM);
  assert.deepEqual(versioned.slices,result.slices);
  assert.equal(validateCaughtFrontSlideV2(input,versioned),true);
  const forgedExit=structuredClone(versioned);
  forgedExit.event.atDistanceM=forgedExit.catchDistanceM;
  assert.throws(()=>validateCaughtFrontSlideV2(input,forgedExit),
    /differs/);
  assert.equal(result.catchDistanceM,
    paidRoad.contact.atDistanceM);
  assert.equal(result.endDistanceM,30000);
  assert.ok(result.behindBunchSeconds>0);
  assert.equal(result.status,'solo_behind',
    JSON.stringify({gap:result.behindBunchSeconds,
      catchDistanceM:result.catchDistanceM}));
  assert.ok(result.slices.every(slice=>
    slice.riders.filter(row=>row.role==='bunch_leader').length===1&&
    slice.riders.filter(row=>row.role==='solo').length===1&&
    slice.riders.every(row=>row.energySpent>0&&row.energy>=0)));
  assert.equal(validateCaughtFrontSlideV1(input,result),true);
  const forged=structuredClone(result);
  forged.slices[0].riders[0].energySpent=0;
  assert.throws(()=>validateCaughtFrontSlideV1(input,forged),
    /differs/);
  assert.throws(()=>advanceCaughtFrontSlideV1({...input,
    paidRoad:{...paidRoad,energyByRider:{
      ...paidRoad.energyByRider,'front-0':100}}}),
  /replayed paid front catch/);
});
