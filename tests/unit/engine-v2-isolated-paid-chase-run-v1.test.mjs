import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {commitTeamChaseStakesV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {runIsolatedPaidChaseV1,
  validateIsolatedPaidChaseRunV1} from
  '../../lib/engine/v2/isolated-paid-chase-run-v1.mjs';
import {advanceCaughtFrontSlideV1} from
  '../../lib/engine/v2/isolated-caught-front-slide-v1.mjs';
import {validateIsolatedPaidChaseRoadV1} from
  '../../lib/engine/v2/isolated-paid-chase-road-v1.mjs';

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
const route=[29,30].map(km=>({km,terrain:'flat',
  gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const commitment=commitTeamChaseStakesV1({teams,
  distanceKm:30,intentions:teams.map(row=>({teamId:row.id,
    baseline:{goal:row.id==='chaser'?'sprint_finish':
      'break_stage',captainId:row.riders[0].id},phases:[]}))});
const input={commitment,teams,
  roadGroup:{id:'road-1',riderIds:['front-0'],
    teamIds:['front'],gapSeconds:3.5},
  observerTeamId:'chaser',raceSeed:'paid-chase-run-1',
  nominatedChaseTeamIds:['chaser'],
  frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
  remainingSegments:route};

test('a team re-evaluates and pays each consecutive chase kilometre',()=>{
  const run=runIsolatedPaidChaseV1(input);
  assert.equal(run.steps.length,2);
  assert.equal(run.steps[0].road.sourceKm,29);
  assert.equal(run.steps[1].road.sourceKm,30);
  assert.equal(run.steps[0].road.contact,null);
  assert.equal(run.contact?.kind,'front_bunch_contact');
  assert.equal(run.officialResults,false);
  assert.ok(run.unmodeledRiderIds.includes('front-1'));
  assert.ok(run.steps.every(step=>
    validateIsolatedPaidChaseRoadV1(step.paidInput,step.road)));
  assert.equal(run.steps[1].paidInput.committedChoiceInput
    .roadGroups[0].gapSeconds,run.steps[0].road.gapSeconds);
  assert.equal(run.steps[1].paidInput.committedChoiceInput
    .teams[1].energy['chaser-2'],
  run.steps[0].road.energyByRider['chaser-2']);
  assert.equal(validateIsolatedPaidChaseRunV1(input,run),true);
  const last=run.steps.at(-1);
  const slide=advanceCaughtFrontSlideV1({
    paidInput:last.paidInput,paidRoad:last.road,
    slideDecision:{riderId:'front-0',
      action:'finish_safely',effort:'conserve'}});
  assert.equal(slide.catchDistanceM,run.contact.atDistanceM);
  assert.ok(slide.behindBunchSeconds>0);
  const forged=structuredClone(run);
  forged.steps[0].road.energyByRider['chaser-2']=100;
  assert.throws(()=>validateIsolatedPaidChaseRunV1(input,forged),
    /differs/);
  assert.throws(()=>runIsolatedPaidChaseV1({...input,
    remainingSegments:[route[0]]}),/complete one-front route/);
});
