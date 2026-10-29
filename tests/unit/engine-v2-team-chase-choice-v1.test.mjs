import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {decideTeamChaseChoiceV1,
  validateTeamChaseChoiceV1} from
  '../../lib/engine/v2/team-chase-choice-v1.mjs';
import {commitTeamChaseStakesV1,teamChaseStakeAtKmV1,
  decideCommittedTeamChaseV1,validateCommittedTeamChaseV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  '../../lib/engine/v2/road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidChaseRoadV1,
  validateIsolatedPaidChaseRoadV1} from
  '../../lib/engine/v2/isolated-paid-chase-road-v1.mjs';

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
  const intentions=teams.map(team=>({teamId:team.id,
    baseline:{goal:team.id==='team-3'?'sprint_finish':
      'break_stage',captainId:team.riders[0].id},phases:[]}));
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:30,intentions});
  const committedChoiceInput={commitment,teams,
    roadGroups:[group('road-1','team-1-0','team-1',gap)],
    observerTeamId:'team-3',raceSeed:base.raceSeed,
    nominatedChaseTeamIds:['team-3'],remainingSegments:route};
  const committedChoice=decideCommittedTeamChaseV1(
    committedChoiceInput);
  const frontChoiceInput={roadGroups:committedChoiceInput.roadGroups,
    groupId:'road-1',teams,riderGoals:[{
      riderId:'team-1-0',goal:'cooperate'}],
  km:1,distanceKm:30,raceSeed:base.raceSeed};
  const frontChoice=decideRoadGroupSprintChoiceV1(frontChoiceInput);
  const paidInput={committedChoiceInput,committedChoice,
    frontChoiceInput,frontChoice,segment:route[0]};
  const paid=advanceIsolatedPaidChaseRoadV1(paidInput);
  assert.ok(paid.slices.length>=2);
  assert.ok(paid.slices.every(row=>
    row.riders.filter(rider=>rider.roadRole==='front'&&
      rider.role==='leader').length===1&&
    row.riders.filter(rider=>rider.roadRole==='bunch'&&
      rider.role==='leader').length===1));
  assert.ok(paid.slices.every(row=>row.riders.every(rider=>
    rider.energySpent>0&&rider.energy>=0)));
  assert.equal(paid.conditionalHelpPaid,false);
  assert.equal(validateIsolatedPaidChaseRoadV1(paidInput,paid),true);
  const forgedPaid=structuredClone(paid);
  forgedPaid.slices[0].riders[0].energySpent=0;
  assert.throws(()=>validateIsolatedPaidChaseRoadV1(paidInput,
    forgedPaid),/differs/);
  assert.throws(()=>advanceIsolatedPaidChaseRoadV1({...paidInput,
    segment:{...route[0],terrain:'climb',gradientPct:6}}),
  /matching committed road/);
  const lateChoiceInput={...committedChoiceInput,
    roadGroups:[group('road-1','team-1-0','team-1',.1)],
    remainingSegments:[route[29]]};
  const lateChoice=decideCommittedTeamChaseV1(lateChoiceInput);
  assert.equal(lateChoice.choice.assessments[0].action,
    'commit_now');
  const lateFrontInput={...frontChoiceInput,
    roadGroups:lateChoiceInput.roadGroups,km:30};
  const lateFront=decideRoadGroupSprintChoiceV1(lateFrontInput);
  const late=advanceIsolatedPaidChaseRoadV1({
    committedChoiceInput:lateChoiceInput,committedChoice:lateChoice,
    frontChoiceInput:lateFrontInput,frontChoice:lateFront,
    segment:route[29]});
  assert.equal(late.contact?.kind,'front_bunch_contact');
  assert.ok(late.endDistanceM>29000&&late.endDistanceM<30000);
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

test('remaining climbs change the perceived rope for a weak climber',()=>{
  const terrainTeams=[team(1,70),team(3,70)];
  terrainTeams[0].riders[0].flat=85;
  terrainTeams[0].riders[0].mountain=35;
  for(const rider of terrainTeams[1].riders){
    rider.flat=60;
    rider.mountain=90;
  }
  const common={teams:terrainTeams,observerTeamId:'team-3',
    raceSeed:'terrain-rope-1',stake:'summit_attack',
    nominatedChaseTeamIds:['team-3'],roadGroups:[
      group('road-1','team-1-0','team-1',120)]};
  const flat=decideTeamChaseChoiceV1({...common,
    remainingSegments:route});
  const climb=decideTeamChaseChoiceV1({...common,
    remainingSegments:route.map(segment=>({...segment,
      terrain:'climb',gradientPct:6}))});
  assert.ok(climb.assessments[0].nominatedHeadroomSeconds>
    flat.assessments[0].nominatedHeadroomSeconds);
});

test('fatigue and unavailable helpers shrink an actual team choice',()=>{
  const input={...base,roadGroups:[
    group('road-1','team-1-0','team-1',120)]};
  const fresh=decideTeamChaseChoiceV1(input);
  const tiredInput=structuredClone(input);
  for(const rider of tiredInput.teams[2].riders){
    rider.fatigue=70;
    tiredInput.teams[2].energy[rider.id]=40;
  }
  const tired=decideTeamChaseChoiceV1(tiredInput);
  const short=decideTeamChaseChoiceV1({...input,
    unavailableRiderIds:[...input.teams[2].orders.helperIds]});
  assert.ok(fresh.assessments[0].nominatedHeadroomSeconds>
    tired.assessments[0].nominatedHeadroomSeconds);
  assert.ok(fresh.assessments[0].nominatedHeadroomSeconds>
    short.assessments[0].nominatedHeadroomSeconds);
});

test('team chase goal and later change have a replayed roster source',()=>{
  const intentions=teams.map(team=>({teamId:team.id,
    baseline:{goal:team.id==='team-3'?'sprint_finish':
      'break_stage',captainId:team.riders[0].id},
    phases:team.id==='team-3'?[{atKm:10,
      goal:'summit_attack',captainId:team.riders[0].id}]:[]}));
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:30,intentions});
  assert.equal(teamChaseStakeAtKmV1({commitment,
    teamId:'team-3',km:10}).goal,'sprint_finish');
  assert.equal(teamChaseStakeAtKmV1({commitment,
    teamId:'team-3',km:11}).goal,'summit_attack');
  const input={commitment,teams,roadGroups:[
    group('road-1','team-1-0','team-1',90)],
  observerTeamId:'team-3',raceSeed:base.raceSeed,
  nominatedChaseTeamIds:['team-3'],remainingSegments:route};
  const result=decideCommittedTeamChaseV1(input);
  assert.equal(result.stake.goal,'sprint_finish');
  assert.equal(validateCommittedTeamChaseV1(input,result),true);
  const forged=structuredClone(result);
  forged.stake.goal='summit_attack';
  assert.throws(()=>validateCommittedTeamChaseV1(input,
    forged),/differs/);
  const altered=structuredClone(input);
  altered.teams[2].riders[0].id='other';
  assert.throws(()=>decideCommittedTeamChaseV1(altered),
    /roster differs/);
  assert.throws(()=>commitTeamChaseStakesV1({teams,distanceKm:30,
    intentions:intentions.map(row=>row.teamId==='team-3'?{
      ...row,phases:[{atKm:11,goal:'summit_attack',
        captainId:row.baseline.captainId}]}:row)}),/route marker/);
  const duplicated=structuredClone(teams);
  duplicated[1].riders[1].id=duplicated[0].riders[1].id;
  assert.throws(()=>commitTeamChaseStakesV1({teams:duplicated,
    distanceKm:30,intentions}),/rosters/);
});
