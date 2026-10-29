import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {decideTeamChaseChoiceV1,
  validateTeamChaseChoiceV1} from
  '../../lib/engine/v2/team-chase-choice-v1.mjs';

function team(index,skill){
  const id=`team-${index}`;
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(key=>[key,skill]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(row=>
    [row.id,80])),orders:{captainId:riders[0].id,
    helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',chase:'all',
      breakWork:'cooperate'},phases:[]}};
}
const route=Array.from({length:30},(_,index)=>({km:index+1,
  terrain:'flat',gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const teams=[team(1,80),team(2,72),team(3,90)];
const group=(id,rider,teamId,gapSeconds)=>({
  id,riderIds:[rider],teamIds:[teamId],gapSeconds});
const base={teams,observerTeamId:'team-3',
  raceSeed:'team-chase-choice-1',stake:'sprint_finish',
  nominatedChaseTeamIds:['team-3'],remainingSegments:route};

test('each front is observed separately and delayed help remains uncertain',()=>{
  const input={...base,roadGroups:[
    group('road-1','team-1-0','team-1',120),
    group('road-2','team-2-0','team-2',30)]};
  const result=decideTeamChaseChoiceV1(input);
  assert.deepEqual(result.assessments.map(row=>row.roadGroupId),
    ['road-1','road-2']);
  assert.deepEqual(result.assessments.map(row=>
    row.observedGapSeconds),[120,30]);
  assert.equal(validateTeamChaseChoiceV1(input,result),true);
  const forged=structuredClone(result);
  forged.assessments[0].action='watch';
  if(result.assessments[0].action==='watch')
    forged.assessments[0].action='commit_now';
  assert.throws(()=>validateTeamChaseChoiceV1(input,
    forged),/differs/);
  const withHelp=decideTeamChaseChoiceV1({...input,
    conditionalChaseTeamIds:['team-2'],
    roadGroups:[input.roadGroups[0]]});
  assert.equal(withHelp.conditionalChaseTeamIds[0],'team-2');
  assert.ok(Number.isFinite(withHelp.assessments[0]
    .conditionalHeadroomSeconds));
});

test('a committed chase order and real sporting stake are required',()=>{
  const input={...base,roadGroups:[
    group('road-1','team-1-0','team-1',120)]};
  assert.throws(()=>decideTeamChaseChoiceV1({...input,
    stake:'unknown'}),/stake/);
  const ignoring=structuredClone(input);
  ignoring.teams[2].orders.baseline.chase='ignore';
  assert.throws(()=>decideTeamChaseChoiceV1(ignoring),/stake/);
  assert.throws(()=>decideTeamChaseChoiceV1({...input,
    conditionalChaseTeamIds:['team-1']}),/road groups/);
});

test('one kilometre of rope can force a paid chase decision',()=>{
  const first=decideTeamChaseChoiceV1({...base,roadGroups:[
    group('road-1','team-1-0','team-1',20)]});
  const row=first.assessments[0];
  const nowCapacity=20+row.nominatedHeadroomSeconds;
  const delayedCapacity=20+row.nominatedDelayedHeadroomSeconds;
  assert.ok(nowCapacity>delayedCapacity);
  const gap=(nowCapacity+delayedCapacity)/2;
  const decision=decideTeamChaseChoiceV1({...base,roadGroups:[
    group('road-1','team-1-0','team-1',gap)]});
  assert.equal(decision.assessments[0].action,'commit_now');
  assert.equal(decision.assessments[0].nominatedCatchNow,true);
  assert.equal(decision.assessments[0].nominatedCatchAfterDelay,false);
});

test('the observer does not read rival private work orders',()=>{
  const input={...base,roadGroups:[
    group('road-1','team-1-0','team-1',90)]};
  const before=decideTeamChaseChoiceV1(input);
  const changed=structuredClone(input);
  changed.teams[0].orders.baseline.breakWork='sit_on';
  changed.teams[1].orders.baseline.chase='ignore';
  changed.teams[1].orders.helperIds=[];
  assert.deepEqual(decideTeamChaseChoiceV1(changed),before);
});
