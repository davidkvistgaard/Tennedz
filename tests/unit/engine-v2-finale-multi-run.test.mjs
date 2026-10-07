import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {assertNoFinaleGroupContact,probeFinaleSeparatedGroupsFromTour,
  selectiveFinaleChaseDecision,
  validateFinaleSeparatedGroupsFromTour} from
  '../../lib/engine/v2/finale-multi-run.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,gender,attackAt){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:index===0?95:55,
    strength:index===0?95:55,endurance:index===0?95:55,
    timetrial:index===0?95:55,sprint:50,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:'balanced',baseline:{effort:'conserve',chase:'ignore',
      attack:attackAt===0?'selective':'none',breakWork:'cooperate'},
    phases:attackAt===0?[{atKm:10,attack:'none'}]:
      attackAt===null?[]:[{atKm:attackAt,attack:'selective',
        attackRiderId:`${id}-0`}]}};
}
function source(gender){
  return simulateTacticalTour({stage,
    teams:[team('a',gender,0),team('b',gender,20),
      team('c',gender,null)],seed:'separated-finale',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('separated road groups keep their IDs, gaps and paid energy to the line',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const sourceFrame=tour.frames[34];
    assert.equal(sourceFrame.roadGroups.length,2);
    const original=structuredClone(tour);
    const run=probeFinaleSeparatedGroupsFromTour(tour);
    assert.equal(run.version,'v2-finale-multi-separated-3');
    assert.equal(run.sourceTuningVersion,MOTOR_ATTACK_TRACE_VERSION);
    assert.equal(run.frames.length,11);
    assert.ok(run.frames.every(frame=>frame.roadGroups.length===2&&
      frame.roadGroups[0].gapSeconds>frame.roadGroups[1].gapSeconds&&
      frame.roadGroups[1].gapSeconds>0));
    assert.deepEqual(run.sourceRoadGroupIds,
      sourceFrame.roadGroups.map(group=>group.id));
    assert.ok(run.frames.some(frame=>frame.roadGroups.some(group=>
      group.pullRiderId!==null)));
    assert.ok(run.frames.every(frame=>frame.riders.every(row=>
      row.energySpent>0&&row.energy>=0)));
    assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
    const prior=probeFinaleSeparatedGroupsFromTour(tour,{
      version:'v2-finale-multi-separated-1'});
    assert.equal(validateFinaleSeparatedGroupsFromTour(tour,prior),true);
    const forged=structuredClone(run);
    forged.frames[1].roadGroups[1].gapSeconds+=1;
    assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
      /differs/);
    assert.deepEqual(tour,original);
  }
});

test('separated continuation refuses a source without multiple road groups',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a','M',null),team('b','M',null)],
    seed:'no-multi-source',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour),
    /multiple road groups/);
});

test('separated groups refuse future named and break attacks',()=>{
  const teams=[team('a','M',0),team('b','M',20),team('c','M',null)];
  teams[2].orders.phases.push({atKm:35,attack:'selective',
    attackRiderId:'c-0'});
  const named=simulateTacticalTour({stage,teams,
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(named.frames[34].roadGroups.length,2);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(named),
    /needs a recorded peloton attack/);
  const breakTeams=[team('a','M',0),team('b','M',20),
    team('c','M',null)];
  breakTeams[0].orders.phases.push({atKm:35,
    breakAttackRiderId:'a-0'});
  const split=simulateTacticalTour({stage,teams:breakTeams,
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(split.frames[34].roadGroups.length,2);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(split),
    /needs a recorded break attack/);
});

test('a new all-out bunch chase is not omitted behind separate groups',()=>{
  const teams=[team('a','M',0),team('b','M',20),team('c','M',null)];
  teams[2].orders.phases.push({atKm:35,chase:'all',effort:'hard'});
  const tour=simulateTacticalTour({stage,teams,
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(tour.frames[34].engagedChaseTeamIds.length,0);
  const run=probeFinaleSeparatedGroupsFromTour(tour);
  assert.ok(run.frames.some(frame=>frame.bunchPullRiderId!==null));
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
  teams[2].orders.phases[0].chase='selective';
  const selective=simulateTacticalTour({stage,teams,
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(selective.frames[34].engagedChaseTeamIds.length,0);
  const conditional=probeFinaleSeparatedGroupsFromTour(selective);
  assert.equal(conditional.frames[0].selectiveChaseDecisions.find(row=>
    row.teamId==='c')?.decision,'engaged');
  assert.ok(conditional.frames.some(frame=>
    frame.bunchPullRiderId?.startsWith('c-')));
  assert.ok(conditional.frames.some(frame=>frame.riders.some(row=>
    row.riderId===frame.bunchPullRiderId&&row.role==='pull'&&
    row.energySpent>0)));
  assert.equal(validateFinaleSeparatedGroupsFromTour(selective,conditional),true);
  const forged=structuredClone(conditional);
  forged.frames[0].selectiveChaseDecisions[0].decision='held';
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(selective,forged),
    /differs/);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(selective,{
    version:'v2-finale-multi-separated-2'}),
    /needs a recorded selective chase/);
  const prior=probeFinaleSeparatedGroupsFromTour(selective,{
    version:'v2-finale-multi-separated-1'});
  assert.equal(validateFinaleSeparatedGroupsFromTour(selective,prior),true);
});

test('selective chase waits when unaware or safely close, then responds to a visible lead',()=>{
  const manager=team('c','M',null);
  assert.equal(selectiveFinaleChaseDecision({team:manager,awareBefore:false,
    rearGapSeconds:20,leadingGapSeconds:20,remainingKm:5}).decision,
  'unaware');
  assert.equal(selectiveFinaleChaseDecision({team:manager,awareBefore:true,
    rearGapSeconds:.1,leadingGapSeconds:.2,remainingKm:5}).decision,
  'held');
  assert.deepEqual(selectiveFinaleChaseDecision({team:manager,
    awareBefore:false,rearGapSeconds:31,leadingGapSeconds:46,
    remainingKm:5}),{aware:true,decision:'engaged'});
});

test('a rear group reaching the front needs a recorded contact distance',()=>{
  const slice={startDistanceM:39000,endDistanceM:39250,lengthM:250};
  const plans=[
    {group:{id:'road-1',gapSeconds:10},
      movement:{gapSeconds:11,frontSeconds:22}},
    {group:{id:'road-2',gapSeconds:9},
      movement:{gapSeconds:12,frontSeconds:20}},
  ];
  assert.throws(()=>assertNoFinaleGroupContact(slice,plans),
    /recorded group contact at 39125 m/);
  assert.doesNotThrow(()=>assertNoFinaleGroupContact(slice,[
    {...plans[0],movement:{gapSeconds:13,frontSeconds:20}},
    plans[1],
  ]));
});
