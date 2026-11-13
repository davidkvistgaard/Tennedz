import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {decideRoadGroupSprintChoiceV1,
  validateRoadGroupSprintChoiceV1} from
  '../../lib/engine/v2/road-group-sprint-choice-v1.mjs';
import {planRoadGroupTurnsV1} from
  '../../lib/engine/v2/road-group-turns-v1.mjs';

const rider=(id,sprint)=>({id,...Object.fromEntries(
  SPORTING_SKILLS.map(skill=>[skill,skill==='sprint'?sprint:65])),
form:50,fatigue:0});
const weak=rider('weak',50),strong=rider('strong',90);
const teams=[{id:'a',riders:[weak],energy:{weak:60},
  orders:{baseline:{breakWork:'cooperate',effort:'steady'},phases:[]}},
{id:'b',riders:[strong],energy:{strong:60},
  orders:{baseline:{breakWork:'cooperate',effort:'steady'},phases:[]}}];
const group={id:'road-1',riderIds:['weak','strong'],
  teamIds:['a','b'],gapSeconds:30};
const input={roadGroups:[group],groupId:'road-1',teams,
  riderGoals:[{riderId:'weak',goal:'win_stage'},
    {riderId:'strong',goal:'win_stage'}],
  km:90,distanceKm:100,raceSeed:'sprint-choice-1'};

test('a weaker sprinter can explicitly sit while the other pays a turn',()=>{
  const result=decideRoadGroupSprintChoiceV1(input);
  assert.deepEqual(result.decisions.map(row=>row.choice),
    ['sit_in','pull']);
  assert.equal(result.decisions[0].reason,'preserve_sprint_chance');
  assert.equal(validateRoadGroupSprintChoiceV1(input,result),true);
  const forged=structuredClone(result);
  forged.decisions[0].choice='pull';
  assert.throws(()=>validateRoadGroupSprintChoiceV1(input,
    forged),/differs/);
  assert.ok(result.decisions[0].rivalSprintIntervals[0]
    .interval[0]<strong.sprint);
  assert.notEqual(result.decisions[0].rivalSprintIntervals[0]
    .interval[1]-result.decisions[0].rivalSprintIntervals[0]
    .interval[0],0);
  const plan=planRoadGroupTurnsV1({group,
    riderDecisions:result.decisions,teams,
    segment:{km:90,terrain:'flat',surface:'road',
      gradientPct:0,exposed:false,
      weather:{temperatureC:16,windKph:0,rainMm:0}}});
  assert.equal(plan.status,'worked');
  assert.deepEqual(plan.turns.map(row=>row.leaderRiderId),
    ['strong']);
  assert.ok(plan.extraEnergyCosts.find(row=>
    row.riderId==='strong').extraCost>
    plan.extraEnergyCosts.find(row=>
      row.riderId==='weak').extraCost);
});

test('committed drive overrides sprint shelter and a teammate ahead blocks it',()=>{
  const drive=structuredClone(input);
  drive.teams[0].orders.baseline.breakWork='drive';
  assert.equal(decideRoadGroupSprintChoiceV1(drive)
    .decisions[0].choice,'pull');
  const ahead={id:'road-2',riderIds:['mate'],
    teamIds:['a'],gapSeconds:40};
  const ownAhead=structuredClone(input);
  ownAhead.teams[0].riders.push(rider('mate',60));
  ownAhead.roadGroups=[ahead,group];
  assert.equal(decideRoadGroupSprintChoiceV1(ownAhead)
    .decisions[0].reason,'teammate_further_ahead');
  const early={...input,km:20};
  assert.equal(decideRoadGroupSprintChoiceV1(early)
    .decisions[0].choice,'pull');
});
