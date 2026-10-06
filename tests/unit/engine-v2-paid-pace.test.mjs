import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
  MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION,
  MOTOR_EARNED_BRIDGE_VERSION} from '../../lib/engine/v2/tuning.mjs';

function team(id,level,{effort='conserve',attack='none',chase='ignore',phases=[]}={}){
  const riders=Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
    form:70,fatigue:0,...Object.fromEntries(['sprint','flat','hills','mountain',
      'cobbles','timetrial','endurance','strength','wind'].map(skill=>[skill,level]))}));
  return {id,riders,orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort,attack,chase},phases}};
}
function prepared(raw,distanceKm=20){
  return {...raw,orders:normalizeOrders(raw.orders,{riderIds:raw.riders.map(r=>r.id),
    distanceKm,keypoints:[]}),energy:Object.fromEntries(raw.riders.map(r=>[r.id,100]))};
}

test('v81 paid bunch pace uses identified helpers and leaves v80 unchanged',()=>{
  const escape=prepared(team('escape',90));
  const pacer=prepared(team('pacer',98,{effort:'hard'}));
  const weak=Array.from({length:13},(_,index)=>prepared(team(`weak-${index}`,55)));
  const context={km:11,terrain:'flat',gapSeconds:40,breakawayTeamIds:['escape'],
    breakawayRiderIds:['escape-7'],rearRoadGroupRiderIds:['escape-7'],distanceKm:20};
  const v80=resolveTacticalKilometre({...context,teams:[escape,pacer,...weak],
    resolutionVersion:MOTOR_CANDIDATE_VERSION});
  const v81=resolveTacticalKilometre({...context,teams:[escape,pacer,...weak],
    resolutionVersion:MOTOR_PAID_PACE_VERSION});
  const small=resolveTacticalKilometre({...context,teams:[escape,pacer],
    resolutionVersion:MOTOR_PAID_PACE_VERSION});
  assert.equal(v80.paidBunchPace,null);
  assert.equal(v81.paidBunchPace?.teamId,'pacer');
  assert.equal(v81.paidBunchPace?.riderIds.length,2);
  assert.ok(v81.passiveGapDelta<v80.passiveGapDelta);
  assert.equal(v81.passiveGapDelta,small.passiveGapDelta);
  assert.equal(v81.energyCosts.filter(row=>row.teamId==='pacer'&&row.reason==='cruise').length,2);
  const quiet=prepared(team('quiet',98));
  const noWorker=resolveTacticalKilometre({...context,teams:[escape,quiet,...weak],
    resolutionVersion:MOTOR_PAID_PACE_VERSION});
  assert.equal(noWorker.paidBunchPace,null);
  assert.equal(noWorker.energyCosts.some(row=>row.reason==='cruise'),false);
  const capped=resolveTacticalKilometre({...context,
    teams:[prepared(team('slow-break',40)),pacer,quiet],
    breakawayTeamIds:['slow-break'],breakawayRiderIds:['slow-break-7'],
    rearRoadGroupRiderIds:['slow-break-7'],
    resolutionVersion:MOTOR_PAID_PACE_VERSION});
  assert.equal(capped.paidBunchPace,null);
  assert.equal(capped.energyCosts.some(row=>row.reason==='cruise'),false);
});

test('v81 recording identifies paid workers and rejects forged pace',()=>{
  const stage={distance_km:20,profile_points:[[0,100],[20,100]],
    keypoints:[{km:11,kind:'SPRINT'}]};
  const teams=[
    team('escape',90,{phases:[{atKm:10,attack:'selective',attackRiderId:'escape-7'}]}),
    team('pacer',98,{effort:'hard'}),team('weak',55)];
  const race=simulateTacticalTour({stage,teams,seed:'paid-pace-proof',
    motorVersion:MOTOR_PAID_PACE_VERSION});
  const prior=simulateTacticalTour({stage,teams,seed:'paid-pace-proof',
    motorVersion:MOTOR_CANDIDATE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  const frame=race.frames.find(row=>row.paidBunchPace!==null);
  assert.ok(frame);
  const priorFrame=prior.frames[frame.km-1];
  assert.ok(frame.passiveGapDelta<priorFrame.passiveGapDelta);
  assert.ok(frame.riderGroups.find(row=>row.id===frame.paidBunchPace.riderIds[0]).energy<
    priorFrame.riderGroups.find(row=>row.id===frame.paidBunchPace.riderIds[0]).energy);
  const forged=structuredClone(race);
  forged.frames[frame.km-1].paidBunchPace.riderIds[0]='escape-7';
  assert.throws(()=>validateRecordedTour(forged),/paid bunch pace/);
});

test('v81 keeps an explicitly named final move valid',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage,teams:[
    team('planned',80,{phases:[{atKm:39,attack:'selective',
      attackRiderId:'planned-7'}]}),team('quiet',70)],
  seed:'paid-pace-named-finale',motorVersion:MOTOR_PAID_PACE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(race.frames.at(-1).attackReasons,
    [{riderId:'planned-7',reason:'named_order'}]);
});

test('v82 bounds a named last-kilometre move without suppressing it',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('planned',82,{phases:[{atKm:39,
    attack:'selective',attackRiderId:'planned-7'}]}),team('quiet',70)];
  const prior=simulateTacticalTour({stage,teams,seed:'bounded-finale',
    motorVersion:MOTOR_PAID_PACE_VERSION});
  const bounded=simulateTacticalTour({stage,teams,seed:'bounded-finale',
    motorVersion:MOTOR_FINALE_VERSION});
  const bridgeBounded=simulateTacticalTour({stage,teams,seed:'bounded-finale',
    motorVersion:MOTOR_BRIDGE_FINALE_VERSION});
  const earnedBridge=simulateTacticalTour({stage,teams,seed:'bounded-finale',
    motorVersion:MOTOR_EARNED_BRIDGE_VERSION});
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(bounded),true);
  assert.equal(validateRecordedTour(bridgeBounded),true);
  assert.equal(validateRecordedTour(earnedBridge),true);
  const before=prior.frames.at(-1),after=bounded.frames.at(-1);
  assert.deepEqual(before.attackReasons,
    [{riderId:'planned-7',reason:'named_order'}]);
  assert.deepEqual(after.attackReasons,before.attackReasons);
  assert.ok(after.joinedBreakawayRiderIds.includes('planned-7'));
  assert.ok(after.gapSeconds>0&&after.gapSeconds<=5);
  assert.ok(before.gapSeconds>after.gapSeconds);
  assert.deepEqual(bounded.frames.slice(0,-1),prior.frames.slice(0,-1));
  assert.deepEqual(bridgeBounded.frames,bounded.frames);
  assert.deepEqual(bridgeBounded.provisionalResults,bounded.provisionalResults);
  assert.deepEqual(earnedBridge.frames,bounded.frames);
  assert.deepEqual(earnedBridge.provisionalResults,bounded.provisionalResults);
});

test('v82 retains a full kilometre for a planned five-kilometre finale move',()=>{
  const raw=team('attacker',90,{phases:[{atKm:255,attack:'selective',
    attackRiderId:'attacker-7',effort:'hard'}]});
  const attacker=prepared(raw,260),quiet=prepared(team('quiet',70),260);
  const context={teams:[attacker,quiet],distanceKm:260,
    terrain:'flat',isKeypoint:true,resolutionVersion:MOTOR_FINALE_VERSION};
  const fiveToGo=resolveTacticalKilometre({...context,km:256});
  const lastKm=resolveTacticalKilometre({...context,km:260});
  assert.equal(fiveToGo.attackers[0].reason,'named_order');
  assert.equal(lastKm.attackers[0].reason,'named_order');
  assert.ok(fiveToGo.gapSeconds>lastKm.gapSeconds);
  assert.ok(lastKm.gapSeconds<=5);
});

test('v83 also bounds a last-kilometre attack behind a distant break',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:11,kind:'SPRINT'},{km:39,kind:'SPRINT'}]};
  const teams=[
    team('escape',95,{phases:[{atKm:10,attack:'selective',attackRiderId:'escape-7'}]}),
    team('planned',85,{phases:[{atKm:39,attack:'selective',attackRiderId:'planned-7'}]}),
    team('quiet',60),
  ];
  const prior=simulateTacticalTour({stage,teams,seed:'bounded-bridge-finale',
    motorVersion:MOTOR_FINALE_VERSION});
  const bounded=simulateTacticalTour({stage,teams,seed:'bounded-bridge-finale',
    motorVersion:MOTOR_BRIDGE_FINALE_VERSION});
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(bounded),true);
  const before=prior.frames.at(-1),after=bounded.frames.at(-1);
  assert.ok(prior.frames.at(-2).gapSeconds>12);
  assert.deepEqual(after.attackReasons,[{riderId:'planned-7',reason:'named_order'}]);
  assert.deepEqual(after.attackReasons,before.attackReasons);
  assert.ok(before.formedChaseGroupId);
  assert.ok(after.formedChaseGroupId);
  assert.ok(before.pelotonGapSeconds>after.pelotonGapSeconds);
  assert.ok(after.pelotonGapSeconds>0&&after.pelotonGapSeconds<=5);
  assert.deepEqual(bounded.frames.slice(0,-1),prior.frames.slice(0,-1));
});

test('v84 requires a final attacker to earn the gap before joining a break',()=>{
  const teams=[prepared(team('escape',95),40),
    prepared(team('planned',85,{phases:[{atKm:35,attack:'selective',
      attackRiderId:'planned-7'}]}),40),
    prepared(team('pacer',70,{chase:'all'}),40)];
  const context={teams,km:40,distanceKm:40,gapSeconds:4.1,
    leadingGapSeconds:4.1,breakawayTeamIds:['escape'],
    breakawayRiderIds:['escape-7'],rearRoadGroupRiderIds:['escape-7']};
  const v83=resolveTacticalKilometre({...context,
    resolutionVersion:MOTOR_BRIDGE_FINALE_VERSION});
  const v84=resolveTacticalKilometre({...context,
    resolutionVersion:MOTOR_EARNED_BRIDGE_VERSION});
  assert.deepEqual(v83.attackers.map(row=>row.riderId),['planned-7']);
  assert.deepEqual(v84.attackers.map(row=>row.riderId),['planned-7']);
  assert.ok(v83.joinedBreakawayRiderIds.includes('planned-7'));
  assert.deepEqual(v84.joinedBreakawayRiderIds,[]);
  assert.deepEqual(v84.failedBridgeRiderIds,['planned-7']);
  assert.ok(v84.gapSeconds<v83.gapSeconds);
});
