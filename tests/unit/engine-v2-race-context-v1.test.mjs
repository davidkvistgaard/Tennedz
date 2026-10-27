import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceContext,projectedCatchKm,breakSituationForTeam,
  automaticCadenceAttackAllowed,observedFrontClosingSecondsPerKm,
  settledFrontRotation} from
  '../../lib/engine/v2/race-context-v1.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION,MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV94RivalIntent} from
  '../../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

test('race format is explicit and stage number cannot leak into a one-day race',()=>{
  assert.deepEqual(normalizeRaceContext({format:'one_day'}),{format:'one_day'});
  assert.deepEqual(normalizeRaceContext({format:'stage',stageNumber:12}),
    {format:'stage',stageNumber:12});
  assert.throws(()=>normalizeRaceContext({format:'stage'}),/Invalid race context/);
  assert.throws(()=>normalizeRaceContext({format:'one_day',stageNumber:1}),
    /Invalid race context/);
  assert.deepEqual(normalizeRaceContext({format:'one_day',
    frontRotationVersion:2}),{format:'one_day',frontRotationVersion:2});
  assert.deepEqual(normalizeRaceContext({format:'one_day',
    frontRotationVersion:3}),{format:'one_day',frontRotationVersion:3});
  assert.throws(()=>normalizeRaceContext({format:'one_day',
    frontRotationVersion:4}),/Invalid race context/);
  assert.deepEqual(normalizeRaceContext({format:'one_day',
    frontObservationVersion:2}),{format:'one_day',frontObservationVersion:2});
  assert.throws(()=>normalizeRaceContext({format:'one_day',
    frontObservationVersion:3}),/Invalid race context/);
  assert.deepEqual(normalizeRaceContext({format:'one_day',
    controlPursuitVersion:2}),{format:'one_day',controlPursuitVersion:2});
  assert.throws(()=>normalizeRaceContext({format:'one_day',
    controlPursuitVersion:3}),/Invalid race context/);
});

test('committed control coalition delays its first paid chase without cycling off',()=>{
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'flat',
    teamCount:20,fatigue:0,attack:'none',chase:'ignore',
    seed:'manager-goal-1',defaultRivalPlan:'passive'});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:[{teamId:'rival-1',role:'control'}]});
  const run=version=>simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:version===1?plan.raceContext:{...plan.raceContext,
      controlPursuitVersion:version},rivalIntent:plan.intent});
  const prior=run(1),collective=run(2);
  const firstChase=race=>race.frames.find(frame=>
    frame.chasers.includes('rival-1'))?.km;
  assert.equal(firstChase(prior),44);
  assert.equal(firstChase(collective),75);
  assert.equal(collective.frames.filter(frame=>frame.km>100&&frame.km<200&&
    frame.chasers.includes('rival-1')).length,99);
  assert.ok(collective.frames[199].teamEnergy.find(row=>
    row.teamId==='rival-1').mean>prior.frames[199].teamEnergy.find(row=>
    row.teamId==='rival-1').mean);
  assert.equal(validateRecordedTour(prior),true);
  assert.equal(validateRecordedTour(collective),true);
  assert.ok(replayRaceDynamicsRecording(collective));
  const switched=structuredClone(collective);
  switched.committedInputs.raceContext.controlPursuitVersion=1;
  assert.throws(()=>replayRaceDynamicsRecording(switched),
    /Race-dynamics replay differs at km/);
});

test('catch estimate is a consequence of paid relative road speed',()=>{
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),50);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:40,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),null);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:89,bunchSecondsPerKm:95}),null);
});

test('observed front closing uses only unchanged completed road groups',()=>{
  const front={id:'road-1',riderIds:['a','b'],gapSeconds:80};
  const frames=Array.from({length:6},(_,index)=>({
    roadGroups:[{...front,gapSeconds:100-index*4}]}));
  assert.equal(observedFrontClosingSecondsPerKm({frames,frontGroup:front}),4);
  assert.equal(observedFrontClosingSecondsPerKm({frames:frames.slice(1),
    frontGroup:front}),null);
  assert.equal(observedFrontClosingSecondsPerKm({frames:frames.map((frame,index)=>
    index===2?{roadGroups:[{...front,riderIds:['a','c'],gapSeconds:92}]}:frame),
  frontGroup:front}),null);
  const reordered=frames.map((frame,index)=>index===2?{
    roadGroups:[{...front,riderIds:['b','a'],gapSeconds:92}]}:frame);
  assert.equal(observedFrontClosingSecondsPerKm({frames:reordered,
    frontGroup:front}),null);
  assert.equal(observedFrontClosingSecondsPerKm({frames:reordered,
    frontGroup:front,membershipVersion:2}),4);
  assert.equal(observedFrontClosingSecondsPerKm({frames:frames.map((frame,index)=>
    index===2?{roadGroups:[{...front,riderIds:['a','a'],gapSeconds:92}]}:
      frame),frontGroup:front,membershipVersion:2}),null);
});

test('a stable front shares maintenance turns, but urgent and declared work stays',()=>{
  const frontGroup={id:'road-1',riderIds:['a','b','c','d','e'],gapSeconds:120};
  const input={frontGroup,pullRiderIds:['a','b','c','d','e','rear'],
    driveRiderIds:['e'],km:20,remainingKm:150,
    observedClosingSecondsPerKm:-1,priorChaserCount:0};
  const settled=settledFrontRotation(input);
  assert.equal(settled.pullRiderIds.length,4);
  assert.equal(settled.restRiderIds.length,2);
  assert.ok(settled.pullRiderIds.includes('e'));
  assert.ok(settled.pullRiderIds.includes('rear'));
  assert.notDeepEqual(settledFrontRotation({...input,km:21}).restRiderIds,
    settled.restRiderIds);
  assert.deepEqual(settledFrontRotation({...input,priorChaserCount:1}),settled);
  assert.deepEqual(settledFrontRotation({...input,
    observedClosingSecondsPerKm:2}),
  {pullRiderIds:input.pullRiderIds,restRiderIds:[]});
  assert.deepEqual(settledFrontRotation({...input,priorChaserCount:1,
    observedClosingSecondsPerKm:2}),
  {pullRiderIds:input.pullRiderIds,restRiderIds:[]});
});

test('opt-in front rotation pays fewer pulls without changing the old policy',()=>{
  const input={frontGroup:{id:'road-1',riderIds:['a','b','c','d','e'],
    gapSeconds:120},pullRiderIds:['a','b','c','d','e','rear'],
    driveRiderIds:['e'],km:20,remainingKm:150,
    observedClosingSecondsPerKm:-1,priorChaserCount:0};
  assert.deepEqual(settledFrontRotation({...input,policyVersion:2}),{
    pullRiderIds:['e','rear'],restRiderIds:['a','b','c','d']});
  const challenged=settledFrontRotation({...input,policyVersion:2,
    priorChaserCount:1});
  assert.equal(challenged.pullRiderIds.length,3);
  assert.ok(challenged.pullRiderIds.includes('e'));
  assert.deepEqual(settledFrontRotation({...input,policyVersion:2,
    observedClosingSecondsPerKm:1}),{
    pullRiderIds:input.pullRiderIds,restRiderIds:[]});
  assert.equal(settledFrontRotation(input).pullRiderIds.length,4);
});

test('maintenance rotation keeps one paid front worker even without a chase',()=>{
  const input={frontGroup:{id:'road-1',riderIds:['a','b','c','d'],
    gapSeconds:120},pullRiderIds:['a','b','c','d'],driveRiderIds:[],
    km:20,remainingKm:150,observedClosingSecondsPerKm:-1,
    priorChaserCount:0};
  const settled=settledFrontRotation({...input,policyVersion:3});
  assert.equal(settled.pullRiderIds.length,1);
  assert.equal(settled.restRiderIds.length,3);
  assert.deepEqual(settledFrontRotation({...input,policyVersion:2}),{
    pullRiderIds:[],restRiderIds:['a','b','c','d']});
  assert.equal(settledFrontRotation({...input,policyVersion:3,km:21})
    .pullRiderIds.length,1);
});

test('opt-in front rotation is committed, validated and source-replayable',()=>{
  const prepared=prepareV91Playtest({distanceKm:120,terrain:'flat',
    teamCount:20,attack:'none',chase:'ignore',seed:'v94-rotation-2',
    defaultRivalPlan:'passive'});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:Array.from({length:5},(_,index)=>({teamId:
      `rival-${index+1}`,role:'break'})),frontRotationVersion:2});
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{...plan.raceContext,frontObservationVersion:2},
    rivalIntent:plan.intent});
  assert.equal(race.committedInputs.raceContext.frontRotationVersion,2);
  assert.equal(race.committedInputs.raceContext.frontObservationVersion,2);
  assert.ok(race.frames.some(frame=>
    frame.settledFrontRestRiderIds.length>=3));
  assert.equal(validateRecordedTour(race),true);
  assert.ok(replayRaceDynamicsRecording(race));
  const switched=structuredClone(race);
  switched.committedInputs.raceContext.frontRotationVersion=1;
  assert.throws(()=>validateRecordedTour(switched),
    /Invalid recorded settled-front work/);
});

test('paid maintenance rotation remains bound to its committed policy',()=>{
  const prepared=prepareV91Playtest({distanceKm:120,terrain:'flat',
    teamCount:20,attack:'none',chase:'ignore',seed:'v94-rotation-3',
    defaultRivalPlan:'passive'});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:Array.from({length:5},(_,index)=>({teamId:
      `rival-${index+1}`,role:'break'})),frontRotationVersion:3});
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:plan.raceContext,rivalIntent:plan.intent});
  assert.equal(race.committedInputs.raceContext.frontRotationVersion,3);
  assert.ok(race.frames.some(frame=>
    frame.settledFrontRestRiderIds.length>=2&&
    frame.roadGroupWorkerRiderIds.length>=1));
  assert.equal(validateRecordedTour(race),true);
  assert.ok(replayRaceDynamicsRecording(race));
  const switched=structuredClone(race);
  switched.committedInputs.raceContext.frontRotationVersion=2;
  assert.throws(()=>validateRecordedTour(switched),
    /Invalid recorded settled-front work/);
});

test('break composition records whose interests are affected without declaring a chase',()=>{
  const situation=breakSituationForTeam({teamId:'team-a',
    frontTeamIds:['team-a','team-c'],frontRiderIds:['a-2','c-7'],
    protectedLeaderIds:['c-7'],gcThreatRiderIds:['c-7']});
  assert.deepEqual(situation,{ownRiderAhead:true,protectedLeaderAhead:true,
    gcThreatAhead:true});
  assert.equal('contentWithComposition' in situation,false);
});

test('settled front restrains routine attacks while manager orders remain separate',()=>{
  const base={context:{format:'one_day'},km:60,distanceKm:260,
    frontRiderCount:3,ownRiderAhead:false};
  assert.equal(automaticCadenceAttackAllowed(base),false);
  assert.equal(automaticCadenceAttackAllowed({...base,frontRiderCount:2}),true);
  assert.equal(automaticCadenceAttackAllowed({...base,km:220}),true);
  assert.equal(automaticCadenceAttackAllowed({...base,ownRiderAhead:true}),false);
  assert.equal(automaticCadenceAttackAllowed({...base,
    context:{format:'stage',stageNumber:8}}),true);
});

test('v94 requires a complete declared role map and keeps older motor inputs unchanged',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:40,
    teamCount:4,attack:'none',defaultRivalPlan:'passive',seed:'v94-role-inputs'});
  const source={stage,weather,teams,seed};
  const roles=Object.fromEntries(teams.map(team=>[team.id,'protect']));
  const raceContext={format:'one_day',teamRoles:roles};
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION}),/explicit race context/);
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'one_day'}}),/role for every team/);
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'one_day',teamRoles:{...roles,unknown:'control'}}}),
  /role for every team/);
  const old=simulateTacticalTour({...source,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(old),true);
  assert.equal('raceContext' in old.committedInputs,false);
  assert.ok(old.frames.every(frame=>!('observedPriorFront' in frame)));
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION,raceContext}),
  /explicit race context/);
  const candidate=simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext});
  assert.deepEqual(candidate.committedInputs.raceContext,raceContext);
  assert.equal(candidate.frames.length,40);
  assert.ok(candidate.frames.every(frame=>
    Array.isArray(frame.bunchEaseTeamIds)));
  assert.ok(candidate.frames.every(frame=>'observedPriorFront' in frame));
});

test('a named manager attack survives a protective team role',()=>{
  const input={distanceKm:40,teamCount:4,attack:'none',
    defaultRivalPlan:'passive',seed:'v94-named-order',
    managerFinaleOrders:[{teamId:'you',atKm:39,
      attack:'selective',attackRiderId:'you-4'}]};
  const {stage,weather,teams,seed}=prepareV91Playtest(input);
  const raceContext={format:'one_day',teamRoles:Object.fromEntries(
    teams.map(team=>[team.id,'protect']))};
  const race=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext});
  assert.ok(race.frames.some(frame=>frame.attackers.includes('you-4')));
});

test('v94 paid bunch pace is checked against the committed front-work order',()=>{
  const input={distanceKm:40,terrain:'flat',teamCount:4,
    attack:'none',defaultRivalPlan:'passive',seed:'v94-front-work-recording',
    managerTacticalOrdersV4:[{teamId:'you',atKm:10,
      effort:'hard',frontWork:'rotate'}]};
  const {stage,weather,teams,seed}=prepareV91Playtest(input);
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,'protect']));
  const race=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'one_day',teamRoles}});
  const paceFrame=race.frames.find(frame=>frame.paidBunchPace);
  assert.ok(paceFrame);
  assert.equal(validateRecordedTour(race),true);
  const altered=structuredClone(race);
  altered.frames[paceFrame.km-1].paidBunchPace.riderIds=['you-1','you-2'];
  assert.throws(()=>validateRecordedTour(altered),/paid bunch pace/);
});

test('selective captain teams pursue a one-day finale but can leave a stage break',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:40,
    teamCount:4,attack:'repeated',chase:'ignore',
    defaultRivalPlan:'neutral',seed:'v94-format-pursuit'});
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,
    team.id==='you'?'break':'protect']));
  const input={stage,weather,teams,seed,motorVersion:MOTOR_RACE_DYNAMICS_VERSION};
  const oneDay=simulateTacticalTour({...input,
    raceContext:{format:'one_day',teamRoles}});
  const stageRace=simulateTacticalTour({...input,
    raceContext:{format:'stage',stageNumber:8,teamRoles}});
  const firstPursuit=oneDay.frames.find(frame=>frame.chaseReasons.some(row=>
    row.reason==='one_day_captain_pursuit'));
  assert.ok(firstPursuit);
  assert.ok(stageRace.frames.every(frame=>frame.chaseReasons.every(row=>
    row.reason!=='one_day_captain_pursuit')));
  const pursuingTeamId=firstPursuit.chaseReasons.find(row=>
    row.reason==='one_day_captain_pursuit').teamId;
  const helperIds=oneDay.committedInputs.teams.find(team=>
    team.id===pursuingTeamId).orders.helperIds;
  const stageLedger=stageRace.frames[firstPursuit.km-1].energyLedger;
  assert.ok(helperIds.some(helperId=>
    firstPursuit.energyLedger.find(row=>row.riderId===helperId).workDemand>
    stageLedger.find(row=>row.riderId===helperId).workDemand));
  assert.equal(validateRecordedTour(oneDay),true);
  const changedCapacity=structuredClone(oneDay);
  changedCapacity.frames[firstPursuit.km-1].chaseContributions[0].capacity+=1;
  assert.throws(()=>validateRecordedTour(changedCapacity),/chase contribution/);
  const changedHelpers=structuredClone(oneDay);
  changedHelpers.frames[firstPursuit.km-1].chaseContributions[0]
    .riderIds=['you-1'];
  assert.throws(()=>validateRecordedTour(changedHelpers),/chase contribution/);
  const changedGap=structuredClone(oneDay);
  changedGap.frames[firstPursuit.km-1].paidRearGapSeconds+=2;
  assert.throws(()=>validateRecordedTour(changedGap),/paid rear gap/);
  const changedDrift=structuredClone(oneDay);
  changedDrift.frames[firstPursuit.km-1].passiveGapDelta+=1;
  changedDrift.frames[firstPursuit.km-1].paidRearGapSeconds+=1;
  assert.throws(()=>validateRecordedTour(changedDrift),
    /passive road movement/);
  const changedAttackPower=structuredClone(oneDay);
  const attackFrame=changedAttackPower.frames.find(frame=>frame.attackers.length);
  assert.ok(attackFrame);
  attackFrame.attackPower+=1;
  assert.throws(()=>validateRecordedTour(changedAttackPower),
    /attack contribution/);
});

test('measured slow closing alerts one-day protectors despite a small front gap',()=>{
  const managerTactics=Array.from({length:19},(_,index)=>index<5?
    {effort:'steady',attack:'repeated',chase:'ignore'}:
    {effort:'steady',attack:'none',chase:'selective'});
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:260,
    terrain:'flat',fatigue:30,teamCount:20,attack:'none',chase:'ignore',
    seed:'sample-flat-finish',managerTactics});
  const teamRoles=Object.fromEntries(teams.map((team,index)=>[
    team.id,index===0?'protect':index<=5?'break':index<=11?'control':'protect']));
  const race=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'one_day',teamRoles}});
  assert.ok(race.frames[209].gapSeconds<30);
  assert.ok(race.frames.slice(210).some(frame=>
    Number.isFinite(frame.observedPriorFront?.closingSecondsPerKm)));
  const settled=race.frames.find(frame=>frame.settledFrontRestRiderIds.length>0);
  assert.ok(settled);
  assert.ok(settled.settledFrontRestRiderIds.every(id=>
    !settled.roadGroupWorkerRiderIds.includes(id)));
  const restingRider=settled.settledFrontRestRiderIds[0];
  assert.ok(settled.energyLedger.find(row=>row.riderId===restingRider).workDemand<
    race.frames[settled.km-2].energyLedger.find(row=>
      row.riderId===restingRider).workDemand);
  assert.ok(race.frames.slice(210).some(frame=>frame.chaseReasons.some(row=>
    row.reason==='one_day_captain_pursuit')));
  assert.ok(race.frames.some(frame=>frame.caughtBreakawayRiderIds.length>0));
  assert.equal(validateRecordedTour(race),true);
  const alteredWork=structuredClone(race);
  alteredWork.frames[settled.km-1].settledFrontRestRiderIds=[];
  assert.throws(()=>validateRecordedTour(alteredWork),
    /settled-front work/);
  const alteredObservation=structuredClone(race);
  alteredObservation.frames[settled.km-1].observedPriorFront.closingSecondsPerKm=0;
  assert.throws(()=>validateRecordedTour(alteredObservation),
    /front observation/);
  const alteredEnergy=structuredClone(race);
  alteredEnergy.frames[settled.km-1].energyLedger.find(row=>
    row.riderId===restingRider).workDemand=0;
  assert.throws(()=>validateRecordedTour(alteredEnergy),
    /energy ledger/);
  const alteredEase=structuredClone(race);
  const eased=alteredEase.frames.find(frame=>frame.bunchEaseTeamIds.length>0);
  assert.ok(eased);
  eased.bunchEaseTeamIds=[];
  assert.throws(()=>validateRecordedTour(alteredEase),/bunch easing/);
  const alteredRoles=structuredClone(race);
  delete alteredRoles.committedInputs.raceContext.teamRoles['rival-1'];
  assert.throws(()=>validateRecordedTour(alteredRoles),/race roles/);
});

test('v94 refuses unpayable front work before exposing an unsupported road clock',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:260,
    teamCount:4,terrain:'mountain',fatigue:30,effort:'hard',
    attack:'repeated',chase:'ignore',defaultRivalPlan:'passive',
    seed:'front-exhaustion-probe'});
  teams[0].orders.baseline.breakWork='drive';
  const source={stage,weather,teams,seed};
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,
    team.id==='you'?'break':'protect']));
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'stage',stageNumber:8,teamRoles}}),error=>{
    assert.match(error.message,/Unresolved front exhaustion at km 136: you-7/);
    assert.equal(error.cause?.phase,'before_road_movement');
    assert.ok(error.cause.workDemand>error.cause.energyBefore);
    return true;
  });
  assert.doesNotThrow(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION}));
});

test('opt-in solo front exhaustion pays road delay and can be caught',()=>{
  const {stage,weather,teams,seed}=prepareV91Playtest({distanceKm:260,
    teamCount:4,terrain:'mountain',fatigue:30,effort:'hard',
    attack:'repeated',chase:'ignore',defaultRivalPlan:'passive',
    seed:'front-exhaustion-probe'});
  teams[0].orders.baseline.breakWork='drive';
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,
    team.id==='you'?'break':'protect']));
  const race=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'stage',stageNumber:8,teamRoles,
      frontExhaustionVersion:2}});
  assert.equal(race.frames.length,260);
  const first=race.frames[135],last=race.frames[137];
  assert.deepEqual(first.frontCoast.map(row=>row.riderId),['you-7']);
  assert.equal(first.roadGroups[0].riderIds.length,1);
  assert.equal(first.frontCoast[0].groupId,first.roadGroups[0].id);
  assert.equal(first.gapSeconds,
    +(first.paidRearGapSeconds-first.frontCoast[0].delaySeconds).toFixed(2));
  assert.ok(first.frontCoast[0].delaySeconds>0);
  assert.equal(first.energyLedger.find(row=>row.riderId==='you-7').unmetEnergyDemand,0);
  assert.ok(last.caughtBreakawayRiderIds.includes('you-7'));
  assert.equal(last.riderGroups.find(row=>row.id==='you-7').group,'dropped');
  assert.ok(last.riderGroups.find(row=>row.id==='you-7').deficitSeconds>=
    last.frontCoast[0].residualSeconds);
  assert.doesNotThrow(()=>validateRecordedTour(race));
  assert.doesNotThrow(()=>replayRaceDynamicsRecording(race));
  const altered=structuredClone(race);
  altered.frames[135].frontCoast[0].delaySeconds+=1;
  assert.throws(()=>validateRecordedTour(altered),/front coast/);
  const forgedResidual=structuredClone(race);
  forgedResidual.frames[137].frontCoast[0].residualSeconds=0;
  assert.throws(()=>validateRecordedTour(forgedResidual),/front coast/);
});

test('front exhaustion opt-in preserves the earlier v94 recording policy',()=>{
  const source=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,seed:'front-coast-version-parity'});
  const teamRoles=Object.fromEntries(source.teams.map(team=>[team.id,
    team.id==='you'?'protect':'opportunistic']));
  const base={...source,motorVersion:MOTOR_RACE_DYNAMICS_VERSION};
  const raceContext={format:'one_day',teamRoles};
  const earlier=simulateTacticalTour({...base,raceContext});
  const explicit=simulateTacticalTour({...base,raceContext:{...raceContext,
    frontExhaustionVersion:1}});
  assert.deepEqual(earlier.frames,explicit.frames);
  assert.ok(earlier.frames.every(frame=>!Object.hasOwn(frame,'frontCoast')));
  assert.doesNotThrow(()=>validateRecordedTour(earlier));
  assert.doesNotThrow(()=>validateRecordedTour(explicit));
  assert.throws(()=>simulateTacticalTour({...base,raceContext:{...raceContext,
    frontExhaustionVersion:3}}),/race context/);
});

test('paid solo slowdown and an ordered chase resolve contact in the same road clock',()=>{
  const source=prepareV91Playtest({distanceKm:260,teamCount:4,
    terrain:'mountain',fatigue:30,effort:'hard',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'passive',seed:'front-exhaustion-probe'});
  source.teams[0].orders.baseline.breakWork='drive';
  source.teams[1].orders.phases=[{atKm:135,chase:'all'}];
  const teamRoles=Object.fromEntries(source.teams.map(team=>[team.id,
    team.id==='you'?'break':'protect']));
  const race=simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'stage',stageNumber:8,teamRoles,
      frontExhaustionVersion:2}});
  const caught=race.frames[137];
  assert.ok(caught.chasers.includes('rival-1'));
  assert.ok(caught.frontCoast.some(event=>event.riderId==='you-7'&&
    event.residualSeconds>0));
  assert.equal(caught.gapSeconds,0);
  assert.ok(caught.caughtBreakawayRiderIds.includes('you-7'));
  assert.equal(caught.riderGroups.find(row=>row.id==='you-7').group,'dropped');
  assert.doesNotThrow(()=>validateRecordedTour(race));
  assert.doesNotThrow(()=>replayRaceDynamicsRecording(race));
});

test('shared-front exhaustion still refuses before an unsupported separation',()=>{
  const source=prepareV91Playtest({distanceKm:260,teamCount:4,
    terrain:'mountain',fatigue:30,effort:'hard',attack:'repeated',
    chase:'ignore',defaultRivalPlan:'passive',
    seed:'front-exhaustion-probe',managerTactics:[
      {effort:'hard',attack:'repeated',chase:'ignore'}]});
  source.teams[0].orders.baseline.breakWork='drive';
  const teamRoles=Object.fromEntries(source.teams.map(team=>[team.id,
    ['you','rival-1'].includes(team.id)?'break':'protect']));
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'stage',stageNumber:8,teamRoles,
      frontExhaustionVersion:2}}),error=>{
    assert.match(error.message,/Unresolved front exhaustion at km 139: you-7/);
    assert.equal(error.cause?.phase,'before_road_movement');
    assert.equal(error.cause?.groupRiderCount,2);
    assert.equal(error.cause?.otherActivePullerCount,1);
    return true;
  });
});

test('v94 validates paid worker membership without inventing wheel order',()=>{
  const seed='sample-flat-finish',terrain='flat',fatigue=0;
  const managerTactics=resolveRandomRivalTactics({teamCount:20,
    random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
  const {stage,weather,teams}=prepareV91Playtest({distanceKm:260,terrain,
    fatigue,teamCount:20,seed,attack:'none',chase:'ignore',managerTactics});
  const teamRoles=Object.fromEntries(teams.map(team=>[team.id,
    team.orders.baseline.chase==='all'?'control':
      team.orders.baseline.attack!=='none'&&
      team.orders.baseline.chase==='ignore'?'break':
        team.orders.baseline.chase==='selective'?'protect':'opportunistic']));
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:{format:'one_day',teamRoles}});
  assert.equal(validateRecordedTour(recording),true);
  const reordered=structuredClone(recording);
  assert.ok(reordered.frames[220].pullRiderIds.length>1);
  reordered.frames[220].pullRiderIds.reverse();
  reordered.frames[220].roadGroupWorkerRiderIds.reverse();
  assert.equal(validateRecordedTour(reordered),true);
  const forged=structuredClone(recording);
  forged.frames[220].roadGroupWorkerRiderIds[0]=
    forged.frames[220].roadGroupWorkerRiderIds[1];
  assert.throws(()=>validateRecordedTour(forged),/settled-front work/);
});
