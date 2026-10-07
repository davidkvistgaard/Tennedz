import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {updateRiderGroups} from '../../lib/engine/v2/groups.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_CANDIDATE_VERSION,MOTOR_PAID_PACE_VERSION,
  MOTOR_FINALE_VERSION,MOTOR_BRIDGE_FINALE_VERSION,
  MOTOR_EARNED_BRIDGE_VERSION,MOTOR_NEUTRAL_PACE_VERSION,
  MOTOR_EXPLICIT_FRONT_VERSION,MOTOR_DRAFT_SHELTER_VERSION,
  MOTOR_DISTANCE_LOAD_VERSION,MOTOR_RECOVERY_CEILING_VERSION,
  MOTOR_PHASE_ATTACK_VERSION,MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

function team(id,level,{effort='conserve',attack='none',chase='ignore',
  frontWork,phases=[]}={}){
  const riders=Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
    form:70,fatigue:0,...Object.fromEntries(['sprint','flat','hills','mountain',
      'cobbles','timetrial','endurance','strength','wind'].map(skill=>[skill,level]))}));
  return {id,riders,orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort,attack,chase,...(frontWork===undefined?{}:{frontWork})},phases}};
}
function prepared(raw,distanceKm=20,allowFrontWork=false){
  return {...raw,orders:normalizeOrders(raw.orders,{riderIds:raw.riders.map(r=>r.id),
    distanceKm,keypoints:[],allowFrontWork}),
  energy:Object.fromEntries(raw.riders.map(r=>[r.id,100]))};
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

test('v85 charges neutral front workers and excludes weak passive passengers',()=>{
  const escape=prepared(team('escape',90));
  const pacer=prepared(team('pacer',98));
  const weak=Array.from({length:13},(_,index)=>prepared(team(`weak-${index}`,20)));
  const context={km:11,terrain:'flat',gapSeconds:40,breakawayTeamIds:['escape'],
    breakawayRiderIds:['escape-7'],rearRoadGroupRiderIds:['escape-7'],distanceKm:20,
    resolutionVersion:MOTOR_NEUTRAL_PACE_VERSION};
  const small=resolveTacticalKilometre({...context,teams:[escape,pacer]});
  const large=resolveTacticalKilometre({...context,teams:[escape,pacer,...weak]});
  assert.equal(small.paidBunchPace,null);
  assert.equal(large.paidBunchPace?.teamId,'pacer');
  assert.equal(large.paidBunchPace?.effort,'conserve');
  assert.ok(Math.abs(large.passiveGapDelta-small.passiveGapDelta)<.5);
  assert.deepEqual(large.energyCosts.filter(row=>row.reason==='cruise').map(row=>row.cost),
    [.06,.06]);

  const stage={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:11,kind:'SPRINT'}]};
  const teams=[team('escape',95,{phases:[{atKm:10,attack:'selective',
    attackRiderId:'escape-7'}]}),team('pacer',83),
  ...Array.from({length:13},(_,index)=>team(`weak-${index}`,20))];
  const race=simulateTacticalTour({stage,teams,seed:'neutral-front-work',
    motorVersion:MOTOR_NEUTRAL_PACE_VERSION});
  const prior=simulateTacticalTour({stage,teams,seed:'neutral-front-work',
    motorVersion:MOTOR_EARNED_BRIDGE_VERSION});
  assert.equal(validateRecordedTour(race),true);
  const frame=race.frames.find(row=>row.paidBunchPace?.effort==='conserve');
  assert.ok(frame);
  assert.ok(frame.riderGroups.find(row=>row.id===frame.paidBunchPace.riderIds[0]).energy<
    prior.frames[frame.km-1].riderGroups.find(row=>
      row.id===frame.paidBunchPace.riderIds[0]).energy);
  const forged=structuredClone(race);
  forged.frames[frame.km-1].paidBunchPace.riderIds[0]='escape-7';
  assert.throws(()=>validateRecordedTour(forged),/paid bunch pace/);
});

test('v86 front work is an explicit phase order and cannot be forged in playback',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const teams=[team('alpha',80,{frontWork:'rotate',phases:[
    {atKm:20,frontWork:'sit_in'}]}),
  team('beta',80,{frontWork:'rotate'}),team('passenger',50)];
  const race=simulateTacticalTour({stage,teams,seed:'front-rotation',
    motorVersion:MOTOR_EXPLICIT_FRONT_VERSION});
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(race.frames.slice(0,4).map(frame=>frame.paidBunchPace?.teamId),
    ['alpha','beta','alpha','beta']);
  assert.ok(race.frames.slice(21).every(frame=>frame.paidBunchPace?.teamId==='beta'));
  assert.ok(race.frames.every(frame=>frame.paidBunchPace?.riderIds.length===2));
  const historicalTeams=teams.map(team=>({...team,orders:{...team.orders,
    baseline:{...team.orders.baseline},phases:team.orders.phases.map(phase=>({...phase}))}}));
  for(const team of historicalTeams){
    delete team.orders.baseline.frontWork;
    for(const phase of team.orders.phases)delete phase.frontWork;
    team.orders.phases=team.orders.phases.filter(phase=>Object.keys(phase).length>1);
  }
  const historical=simulateTacticalTour({stage,teams:historicalTeams,seed:'front-rotation',
    motorVersion:MOTOR_NEUTRAL_PACE_VERSION});
  assert.ok(historical.frames.every(frame=>frame.paidBunchPace===null));
  const forged=structuredClone(race);
  forged.committedInputs.teams.find(team=>team.id==='alpha').orders.baseline.frontWork='sit_in';
  assert.throws(()=>validateRecordedTour(forged),/paid bunch pace/);
});

test('v86 teams that sit in do not create paid pace',()=>{
  const context={km:1,terrain:'flat',gapSeconds:0,distanceKm:20,
    resolutionVersion:MOTOR_EXPLICIT_FRONT_VERSION};
  const quiet=resolveTacticalKilometre({...context,teams:[
    prepared(team('a',90)),prepared(team('b',50))]});
  const worked=resolveTacticalKilometre({...context,teams:[
    prepared(team('a',90,{frontWork:'rotate'}),20,true),prepared(team('b',50))]});
  assert.equal(quiet.paidBunchPace,null);
  assert.equal(worked.paidBunchPace?.teamId,'a');
  assert.deepEqual(worked.energyCosts.filter(row=>row.reason==='cruise').map(row=>row.cost),
    [.18,.18]);
  assert.throws(()=>prepared(team('a',90,{frontWork:'free_speed'}),20,true),/front work/);
  assert.throws(()=>prepared(team('a',90,{frontWork:'rotate'})),/baseline fields/);
});

test('v86 weak front work cannot slow group attachment below its unworked pace',()=>{
  const states=[{id:'slow',ability:40,group:'peloton',lowKilometres:0,
    deficitSeconds:0},...Array.from({length:7},(_,index)=>({id:`fast-${index}`,
    ability:70,group:'peloton',lowKilometres:0,deficitSeconds:0}))];
  const afterFour=(options)=>{
    let current=states;
    for(let km=0;km<4;km++)current=updateRiderGroups(current,[],options);
    return current.find(state=>state.id==='slow');
  };
  assert.equal(afterFour({unworkedFront:true}).group,'dropped');
  assert.equal(afterFour({unworkedFront:true,frontPaceAbility:40}).group,'dropped');
  assert.equal(afterFour({unworkedFront:true,frontPaceAbility:40,
    shelteredToleranceBonus:10}).group,'dropped');
  assert.equal(afterFour({frontPaceAbility:40}).group,'peloton');
});

test('v86 can rotate between planned attacks without simultaneous work',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const teams=[team('flex',90,{frontWork:'rotate',attack:'selective',
    chase:'selective'}),team('other',50)];
  const race=simulateTacticalTour({stage,teams,seed:'flexible-front-plan',
    motorVersion:MOTOR_EXPLICIT_FRONT_VERSION});
  assert.equal(validateRecordedTour(race),true);
  assert.equal(race.frames[0].paidBunchPace?.teamId,'flex');
  assert.ok(race.frames.some(frame=>frame.attackers.includes('flex-7')||
    frame.attackers.some(id=>id.startsWith('flex-'))));
  assert.ok(race.frames.every(frame=>!frame.paidBunchPace||
    !frame.attackers.some(id=>id.startsWith(`${frame.paidBunchPace.teamId}-`))&&
    !frame.chasers.includes(frame.paidBunchPace.teamId)));
});

test('v87 paid front shelters followers but leaves exposed workers responsible',()=>{
  const states=[{id:'follower',ability:60,group:'peloton',lowKilometres:0,
    deficitSeconds:0},{id:'worker',ability:60,group:'peloton',lowKilometres:0,
    deficitSeconds:0},{id:'other-follower',ability:60,group:'peloton',
    lowKilometres:0,deficitSeconds:0},...Array.from({length:5},(_,index)=>({id:`strong-${index}`,
    ability:78,group:'peloton',lowKilometres:0,deficitSeconds:0}))];
  const afterTen=options=>{
    let current=states;
    for(let km=0;km<10;km++)current=updateRiderGroups(current,[],options);
    return current;
  };
  const v86=afterTen({unworkedFront:true,frontPaceAbility:78});
  const v87=afterTen({unworkedFront:true,frontPaceAbility:78,
    shelteredToleranceBonus:10,frontWorkerRiderIds:['worker']});
  assert.equal(v86.find(row=>row.id==='follower').group,'dropped');
  assert.equal(v87.find(row=>row.id==='follower').group,'peloton');
  assert.equal(v87.find(row=>row.id==='worker').group,'dropped');
  const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const teams=[team('front',90,{effort:'hard',frontWork:'rotate'}),team('other',60)];
  const recorded=simulateTacticalTour({stage,teams,seed:'v87-shelter',
    motorVersion:MOTOR_DRAFT_SHELTER_VERSION});
  assert.equal(validateRecordedTour(recorded),true);
  assert.equal(recorded.frames[0].paidBunchPace?.teamId,'front');
  assert.equal(recorded.tuningVersion,MOTOR_DRAFT_SHELTER_VERSION);
});

test('v88 additive long-distance recording stays reproducible after rejection',()=>{
  const stage={distance_km:200,profile_points:[[0,100],[200,100]]};
  const teams=[team('strong',80),team('weak',80)];
  for(const rider of teams[0].riders)rider.endurance=95;
  for(const rider of teams[1].riders)rider.endurance=30;
  const race=simulateTacticalTour({stage,teams,seed:'long-distance-load',
    motorVersion:MOTOR_DISTANCE_LOAD_VERSION});
  assert.equal(validateRecordedTour(race),true);
  assert.equal(race.tuningVersion,MOTOR_DISTANCE_LOAD_VERSION);
  assert.deepEqual(race,simulateTacticalTour({stage,teams,
    seed:'long-distance-load',motorVersion:MOTOR_DISTANCE_LOAD_VERSION}));
});

test('v89 lowers the recovery ceiling only after a very long distance',()=>{
  const stage={distance_km:200,profile_points:[[0,100],[200,100]]};
  const strong=team('strong',80),weak=team('weak',80);
  for(const rider of strong.riders)rider.endurance=95;
  for(const rider of weak.riders)rider.endurance=30;
  const input={stage,teams:[strong,weak],seed:'long-distance-load'};
  const v87=simulateTacticalTour({...input,motorVersion:MOTOR_DRAFT_SHELTER_VERSION});
  const v89=simulateTacticalTour({...input,motorVersion:MOTOR_RECOVERY_CEILING_VERSION});
  assert.equal(validateRecordedTour(v89),true);
  const energy=(race,km,id)=>race.frames[km-1].riderGroups.find(row=>row.id===id).energy;
  assert.equal(energy(v89,160,'strong-7'),energy(v87,160,'strong-7'));
  assert.equal(energy(v89,160,'weak-7'),energy(v87,160,'weak-7'));
  assert.ok(energy(v89,200,'strong-7')<energy(v87,200,'strong-7'));
  assert.ok(energy(v89,200,'weak-7')<energy(v89,200,'strong-7'));
  assert.ok(energy(v89,200,'weak-7')<energy(v87,200,'weak-7'));
  const shortInput={...input,stage:{distance_km:120,
    profile_points:[[0,100],[120,100]]}};
  const short87=simulateTacticalTour({...shortInput,
    motorVersion:MOTOR_DRAFT_SHELTER_VERSION});
  const short89=simulateTacticalTour({...shortInput,
    motorVersion:MOTOR_RECOVERY_CEILING_VERSION});
  assert.deepEqual(short89.frames,short87.frames);
  assert.deepEqual(short89.provisionalResults,short87.provisionalResults);
  const tiredInput={stage,teams:[team('hard',80,{effort:'hard'}),
    team('quiet',80)],seed:'already-tired-rider'};
  const tired87=simulateTacticalTour({...tiredInput,
    motorVersion:MOTOR_DRAFT_SHELTER_VERSION});
  const tired89=simulateTacticalTour({...tiredInput,
    motorVersion:MOTOR_RECOVERY_CEILING_VERSION});
  assert.ok(energy(tired87,200,'hard-7')<80);
  assert.equal(energy(tired89,200,'hard-7'),energy(tired87,200,'hard-7'));
});

test('v90 starts a named phase attack on its committed kilometre',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const attacker=team('planned',90,{phases:[{atKm:35,attack:'selective',
    attackRiderId:'planned-7'}]});
  const opponent=team('other',50);
  const input={stage,teams:[attacker,opponent],seed:'named-phase-boundary'};
  const prior=simulateTacticalTour({...input,
    motorVersion:MOTOR_RECOVERY_CEILING_VERSION});
  const phase=simulateTacticalTour({...input,
    motorVersion:MOTOR_PHASE_ATTACK_VERSION});
  assert.equal(prior.frames[35].attackReasons.some(row=>
    row.riderId==='planned-7'),false);
  assert.deepEqual(phase.frames[35].attackReasons.filter(row=>
    row.riderId==='planned-7'),[{riderId:'planned-7',reason:'named_order'}]);
  assert.equal(phase.frames[36].attackReasons.some(row=>
    row.riderId==='planned-7'),false);
  assert.equal(phase.tuningVersion,MOTOR_PHASE_ATTACK_VERSION);
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(phase),true);
  assert.deepEqual(phase,simulateTacticalTour({...input,
    motorVersion:MOTOR_PHASE_ATTACK_VERSION}));
  const inherited=team('inherited',90,{phases:[{atKm:35,attack:'selective'}]});
  inherited.orders.baseline.attackRiderId='inherited-7';
  const unrelated=team('unrelated',90,{attack:'selective',
    phases:[{atKm:35,effort:'steady'}]});
  unrelated.orders.baseline.attackRiderId='unrelated-7';
  const atBoundary=raw=>resolveTacticalKilometre({
    teams:[prepared(raw,40,true),prepared(opponent,40,true)],
    km:36,distanceKm:40,resolutionVersion:MOTOR_PHASE_ATTACK_VERSION});
  assert.deepEqual(atBoundary(inherited).attackers.map(row=>row.riderId),
    ['inherited-7']);
  assert.deepEqual(atBoundary(unrelated).attackers,[]);
});

test('v91 records each named attacker pressure without changing v90 outcomes',()=>{
  const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const teams=[team('strong',90,{phases:[{atKm:35,attack:'selective',
    attackRiderId:'strong-7'}]}),team('weak',55,{phases:[{atKm:35,
    attack:'selective',attackRiderId:'weak-7'}]}),team('other',65)];
  const input={stage,teams,seed:'shared-attack-trace'};
  const prior=simulateTacticalTour({...input,motorVersion:MOTOR_PHASE_ATTACK_VERSION});
  const traced=simulateTacticalTour({...input,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(traced),true);
  assert.deepEqual(traced.provisionalResults,prior.provisionalResults);
  assert.deepEqual(traced.frames.map(({attackContributions,...frame})=>frame),prior.frames);
  const frame=traced.frames[35];
  assert.equal(frame.attackContributions.length,2);
  assert.ok(frame.attackContributions[0].pressure>frame.attackContributions[1].pressure);
  assert.equal(frame.attackContributions.reduce((sum,row)=>sum+row.pressure,0),
    frame.attackPower);
  const forged=structuredClone(traced);
  forged.frames[35].attackContributions[0].pressure+=1;
  assert.throws(()=>validateRecordedTour(forged),/attack contribution/);
  const misattributed=structuredClone(traced);
  misattributed.frames[35].attackContributions[1].teamId='strong';
  assert.throws(()=>validateRecordedTour(misattributed),/attack contribution/);
  const missing=structuredClone(traced);
  delete missing.frames[35].attackContributions;
  assert.throws(()=>validateRecordedTour(missing),/attack contribution/);
});
