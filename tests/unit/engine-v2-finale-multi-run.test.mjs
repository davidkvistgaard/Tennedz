import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from '../../lib/engine/v2/finale-snapshot.mjs';
import {pendingFinaleAttacksAt} from '../../lib/engine/v2/finale-attack-guard.mjs';
import {probeFinaleSeparatedFinishBoundsFromTour,
  validateFinaleSeparatedFinishBoundsFromTour} from
  '../../lib/engine/v2/finale-separated-finish-bounds.mjs';
import {assertNoFinaleGroupContact,probeFinaleSeparatedGroupsFromTour,
  selectiveFinaleChaseDecision,FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION,
  FINALE_SEPARATED_NAMED_BLOCKS_VERSION,
  FINALE_SEPARATED_DROPPED_TRAVEL_VERSION,
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
    assert.equal(run.version,'v2-finale-separated-one-or-more-4');
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
    const priorAllChase=probeFinaleSeparatedGroupsFromTour(tour,{
      version:'v2-finale-multi-separated-2'});
    assert.equal(validateFinaleSeparatedGroupsFromTour(tour,priorAllChase),true);
    const priorSelective=probeFinaleSeparatedGroupsFromTour(tour,{
      version:'v2-finale-multi-separated-3'});
    assert.equal(validateFinaleSeparatedGroupsFromTour(tour,priorSelective),true);
    const forged=structuredClone(run);
    forged.frames[1].roadGroups[1].gapSeconds+=1;
    assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
      /differs/);
    assert.deepEqual(tour,original);
  }
});

test('one road group with a new selective pursuer records separate paid travel',()=>{
  const teams=[team('a','M',0),team('c','M',null)];
  teams[1].orders.phases.push({atKm:35,chase:'selective',effort:'hard'});
  const tour=simulateTacticalTour({stage,teams,seed:'separated-finale',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(tour.frames[34].roadGroups.length,1);
  assert.equal(tour.frames[34].engagedChaseTeamIds.length,0);
  const run=probeFinaleSeparatedGroupsFromTour(tour);
  assert.equal(run.version,'v2-finale-separated-one-or-more-4');
  assert.equal(run.sourceRoadGroupIds.length,1);
  assert.ok(run.frames.every(frame=>frame.roadGroups.length===1&&
    frame.roadGroups[0].gapSeconds>0));
  assert.ok(run.frames.some(frame=>frame.bunchPullRiderId?.startsWith('c-')));
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:'v2-finale-multi-separated-3'}),/multiple road groups/);
});

test('four-kilometre handoff preserves a valid named attack in the source replay',()=>{
  const teams=[team('a','M',0),team('c','M',null)];
  teams[1].orders.phases.push({atKm:35,attack:'selective',
    attackRiderId:'c-0'});
  const tour=simulateTacticalTour({stage,teams,seed:'separated-finale',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(tour.frames[34].roadGroups.length,1);
  assert.ok(tour.frames[35].attackReasons.some(row=>
    row.riderId==='c-0'&&row.reason==='named_order'));
  assert.equal(tour.frames[35].roadGroups.length,2);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour),
    /needs a recorded peloton attack/);
  const afterAttack=probeFinaleSeparatedGroupsFromTour(tour,{
    version:'v2-finale-separated-post-attack-5'});
  assert.equal(afterAttack.sourceKm,36);
  assert.equal(afterAttack.sourceSnapshotVersion,'v2-finale-snapshot-2');
  assert.equal(afterAttack.frames.length,10);
  assert.deepEqual(afterAttack.sourceRoadGroupIds,
    tour.frames[35].roadGroups.map(group=>group.id));
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,afterAttack),true);
  const forged=structuredClone(afterAttack);
  forged.postAttackHandoffKm=35;
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs/);
});

test('an exhausted named finale attack is recorded at its actual decision boundary',()=>{
  const tired=team('c','M',null);
  tired.riders[0].fatigue=50;
  tired.orders.baseline.effort='hard';
  tired.orders.phases.push({atKm:255,attack:'selective',
    attackRiderId:'c-0'});
  const longStage={distance_km:260,profile_points:[[0,100],[260,100]],
    keypoints:stage.keypoints};
  const tour=simulateTacticalTour({stage:longStage,
    teams:[team('a','M',0),team('b','M',20),tired],
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const sourceRider=tour.frames[255].riderGroups.find(row=>row.id==='c-0');
  assert.equal(sourceRider.group,'peloton');
  assert.equal(tour.frames[255].roadGroups.length,2);
  const fullTeamSnapshot=finaleSnapshotFromTour(tour,{remainingKm:4});
  fullTeamSnapshot.riders.filter(row=>['c-1','c-2'].includes(row.riderId))
    .forEach(row=>{row.status='breakaway';});
  assert.equal(pendingFinaleAttacksAt(tour,fullTeamSnapshot,260).length,0);
  assert.deepEqual(pendingFinaleAttacksAt(tour,fullTeamSnapshot,260,
    {includeBlocked:true}).map(event=>event.kind),['team_break_limit']);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:'v2-finale-separated-post-attack-5'}),
  /needs a recorded peloton attack/);
  const original=structuredClone(tour);
  const run=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION});
  const blocked=run.frames.flatMap(frame=>frame.blockedNamedAttacks);
  assert.equal(run.attackDecisionVersion,'v2-finale-exhausted-named-attack-1');
  assert.equal(run.frames.length,10);
  assert.equal(blocked.length,1);
  assert.equal(blocked[0].teamId,'c');
  assert.equal(blocked[0].riderId,'c-0');
  assert.equal(blocked[0].reason,'exhausted');
  assert.equal(blocked[0].sourceKm,260);
  assert.equal(blocked[0].distanceM,259000);
  assert.ok(blocked[0].energyAtDecision<12);
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
  const forged=structuredClone(run);
  forged.frames.find(frame=>frame.blockedNamedAttacks.length>0)
    .blockedNamedAttacks[0].energyAtDecision=20;
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs/);
  assert.deepEqual(tour,original);
});

test('a ready named attacker still refuses the exhausted-only finale version',()=>{
  const attacker=team('c','M',null);
  attacker.orders.phases.push({atKm:255,attack:'selective',
    attackRiderId:'c-0'});
  const chaser=team('d','M',null);
  chaser.orders.helperIds=['d-2','d-3'];
  chaser.orders.phases.push({atKm:255,chase:'all',effort:'hard'});
  const longStage={distance_km:260,profile_points:[[0,100],[260,100]],
    keypoints:stage.keypoints};
  const tour=simulateTacticalTour({stage:longStage,
    teams:[team('a','M',0),team('b','M',20),attacker,chaser],
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(tour.frames[255].riderGroups.find(row=>
    row.id==='c-0').group,'peloton');
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION}),
  /needs a recorded peloton attack: c at km 260/);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_NAMED_BLOCKS_VERSION}),
  /needs a recorded peloton attack: c at km 260/);
});

test('a dropped named rider has a recorded blocked order in the new version',()=>{
  const dropped=team('c','M',null);
  dropped.riders[0].fatigue=100;
  for(const skill of ['flat','strength','endurance','timetrial'])
    dropped.riders[0][skill]=20;
  dropped.orders.baseline.effort='hard';
  dropped.orders.phases.push({atKm:255,attack:'selective',
    attackRiderId:'c-0'});
  const longStage={distance_km:260,profile_points:[[0,100],[260,100]],
    keypoints:stage.keypoints};
  const tour=simulateTacticalTour({stage:longStage,
    teams:[team('a','M',0),team('b','M',20),dropped],
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=finaleSnapshotFromTour(tour,{remainingKm:4});
  assert.equal(source.riders.find(row=>row.riderId==='c-0').status,
    'dropped');
  assert.equal(pendingFinaleAttacksAt(tour,source,260).length,0);
  assert.deepEqual(pendingFinaleAttacksAt(tour,source,260,
    {includeUnavailable:true}).map(row=>[row.teamId,row.kind]),
  [['b','named_unavailable'],['c','named_unavailable']]);
  const old=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_EXHAUSTED_ATTACK_VERSION});
  assert.equal(old.frames.flatMap(frame=>frame.blockedNamedAttacks).length,0);
  const run=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_NAMED_BLOCKS_VERSION});
  const blocked=run.frames.flatMap(frame=>frame.blockedNamedAttacks);
  assert.deepEqual(blocked.map(row=>[row.riderId,row.reason]),
    [['b-0','already_ahead'],['c-0','dropped']]);
  assert.ok(blocked.every(row=>row.sourceKm===260));
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
  const forged=structuredClone(run);
  forged.frames.find(frame=>frame.blockedNamedAttacks.length)
    .blockedNamedAttacks[0].reason='exhausted';
  assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
    /differs/);
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,old),true);
});

test('separated finale pays and records every source-dropped rider to the line',()=>{
  for(const gender of ['M','F']){
    const weak=team('c',gender,null);
    for(const skill of ['flat','strength','endurance','timetrial'])
      weak.riders[0][skill]=20;
    weak.orders.phases.push({atKm:255,attack:'selective',
      attackRiderId:'c-0'});
    const longStage={distance_km:260,
      profile_points:[[0,100],[260,100]],keypoints:stage.keypoints};
    const tour=simulateTacticalTour({stage:longStage,
      teams:[team('a',gender,0),team('b',gender,20),weak],
      seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const source=tour.frames[255];
    assert.equal(source.roadGroups.length,2);
    const dropped=source.riderGroups.find(row=>row.id==='c-0');
    assert.equal(dropped.group,'dropped');
    assert.ok(dropped.energy>0&&dropped.deficitSeconds>0);
    const original=structuredClone(tour);
    const run=probeFinaleSeparatedGroupsFromTour(tour,{
      version:FINALE_SEPARATED_DROPPED_TRAVEL_VERSION});
    assert.deepEqual(run.sourceDroppedRiderIds,['c-0']);
    assert.equal(run.frames.length,10);
    assert.ok(run.frames.every(frame=>frame.droppedTravel.riders.length===1&&
      frame.droppedTravel.riders[0].energySpent>0&&
      frame.riders.some(row=>row.riderId==='c-0'&&row.role==='dropped')));
    assert.ok(run.frames.every(frame=>frame.droppedTravel.riders[0]
      .deficitSecondsAfter>0));
    assert.deepEqual(run.finalDroppedRiderDeficits,[{
      riderId:'c-0',deficitSeconds:run.frames.at(-1).droppedTravel
        .riders[0].deficitSecondsAfter}]);
    assert.equal(new Set(run.finalRiderEnergy.map(row=>row.riderId)).size,
      source.riderGroups.length);
    const decision=run.frames.find(frame=>frame.sourceKm===260)
      .blockedNamedAttacks.find(row=>row.riderId==='c-0');
    const beforeDecision=run.frames.find(frame=>
      frame.endDistanceM===decision.distanceM).droppedTravel.riders[0];
    assert.equal(decision.reason,'dropped');
    assert.equal(decision.energyAtDecision,beforeDecision.energyAfter);
    assert.equal(validateFinaleSeparatedGroupsFromTour(tour,run),true);
    const forged=structuredClone(run);
    forged.frames[0].droppedTravel.riders[0].energySpent=0;
    assert.throws(()=>validateFinaleSeparatedGroupsFromTour(tour,forged),
      /differs/);
    assert.deepEqual(tour,original);
  }
});

test('new dropped-travel version refuses a rider with no energy to reach the line',()=>{
  const weak=team('c','M',null);
  weak.riders[0].fatigue=100;
  for(const skill of ['flat','strength','endurance','timetrial'])
    weak.riders[0][skill]=20;
  weak.orders.baseline.effort='hard';
  const longStage={distance_km:260,
    profile_points:[[0,100],[260,100]],keypoints:stage.keypoints};
  const tour=simulateTacticalTour({stage:longStage,
    teams:[team('a','M',0),team('b','M',20),weak],
    seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(tour.frames[255].riderGroups.find(row=>
    row.id==='c-0').energy,0);
  assert.throws(()=>probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_DROPPED_TRAVEL_VERSION}),
  /cannot pay for travel/);
});

test('separated finish bounds include front groups, bunch and dropped riders without awarding points',()=>{
  for(const gender of ['M','F']){
    const weak=team('c',gender,null);
    for(const skill of ['flat','strength','endurance','timetrial'])
      weak.riders[0][skill]=20;
    const longStage={distance_km:260,
      profile_points:[[0,100],[260,100]],keypoints:stage.keypoints};
    const tour=simulateTacticalTour({stage:longStage,
      teams:[team('a',gender,0),team('b',gender,20),weak],
      seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const original=structuredClone(tour);
    const bounds=probeFinaleSeparatedFinishBoundsFromTour(tour);
    assert.equal(bounds.sourceTraceVersion,
      FINALE_SEPARATED_DROPPED_TRAVEL_VERSION);
    assert.deepEqual(bounds.bands.map(band=>band.kind),
      ['road_group','road_group','peloton','dropped']);
    assert.equal(bounds.bands[0].firstPossiblePlace,1);
    assert.equal(bounds.bands[1].firstPossiblePlace,
      bounds.bands[0].lastPossiblePlace+1);
    assert.equal(bounds.bands.at(-1).lastPossiblePlace,24);
    assert.equal(bounds.bands.at(-1).riderIds[0],'c-0');
    assert.equal(bounds.riders.find(row=>row.riderId==='c-0')
      .firstPossiblePlace,24);
    assert.equal(bounds.resultStatus,'unclassified');
    assert.equal(bounds.pointsStatus,'withheld');
    assert.equal(validateFinaleSeparatedFinishBoundsFromTour(tour,bounds),true);
    const forged=structuredClone(bounds);
    forged.riders.find(row=>row.riderId==='c-0').firstPossiblePlace=1;
    assert.throws(()=>validateFinaleSeparatedFinishBoundsFromTour(tour,forged),
      /do not replay/);
    assert.deepEqual(tour,original);
  }
});

test('dropped riders with equal deficits share bounds; distinct deficits retain road order',()=>{
  const longStage={distance_km:260,
    profile_points:[[0,100],[260,100]],keypoints:stage.keypoints};
  for(const secondSkill of [20,30]){
    const weak=team('c','M',null);
    for(const index of [0,1])
      for(const skill of ['flat','strength','endurance','timetrial'])
        weak.riders[index][skill]=index===0?20:secondSkill;
    const tour=simulateTacticalTour({stage:longStage,
      teams:[team('a','M',0),team('b','M',20),weak],
      seed:'separated-finale',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const bounds=probeFinaleSeparatedFinishBoundsFromTour(tour);
    const dropped=bounds.bands.filter(band=>band.kind==='dropped');
    if(secondSkill===20){
      assert.equal(dropped.length,1);
      assert.deepEqual(dropped[0].riderIds,['c-0','c-1']);
      assert.deepEqual([dropped[0].firstPossiblePlace,
        dropped[0].lastPossiblePlace],[23,24]);
    }else{
      assert.equal(dropped.length,2);
      assert.deepEqual(dropped.map(band=>band.riderIds[0]),
        ['c-1','c-0']);
      assert.deepEqual(dropped.map(band=>band.firstPossiblePlace),
        [23,24]);
    }
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
