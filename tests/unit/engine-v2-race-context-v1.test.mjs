import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeRaceContext,projectedCatchKm,breakSituationForTeam,
  automaticCadenceAttackAllowed} from
  '../../lib/engine/v2/race-context-v1.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION,MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

test('race format is explicit and stage number cannot leak into a one-day race',()=>{
  assert.deepEqual(normalizeRaceContext({format:'one_day'}),{format:'one_day'});
  assert.deepEqual(normalizeRaceContext({format:'stage',stageNumber:12}),
    {format:'stage',stageNumber:12});
  assert.throws(()=>normalizeRaceContext({format:'stage'}),/Invalid race context/);
  assert.throws(()=>normalizeRaceContext({format:'one_day',stageNumber:1}),
    /Invalid race context/);
});

test('catch estimate is a consequence of paid relative road speed',()=>{
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),50);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:40,
    frontSecondsPerKm:95,bunchSecondsPerKm:89}),null);
  assert.equal(projectedCatchKm({gapSeconds:300,remainingKm:60,
    frontSecondsPerKm:89,bunchSecondsPerKm:95}),null);
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
  assert.equal('raceContext' in old.committedInputs,false);
  assert.throws(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION,raceContext}),
  /explicit race context/);
  const candidate=simulateTacticalTour({...source,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext});
  assert.deepEqual(candidate.committedInputs.raceContext,raceContext);
  assert.equal(candidate.frames.length,40);
  assert.ok(candidate.frames.every(frame=>
    Array.isArray(frame.bunchEaseTeamIds)));
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
    raceContext:{format:'stage',stageNumber:8,teamRoles}}),
  /Unresolved front exhaustion at km 136: you-7/);
  assert.doesNotThrow(()=>simulateTacticalTour({...source,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION}));
});
