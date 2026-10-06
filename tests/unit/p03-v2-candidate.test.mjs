import test from 'node:test';
import assert from 'node:assert/strict';
import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {previewRecordedDivisions,previewLockedV2RecordedDivisions}
  from '../../lib/race/v2-candidate.mjs';
import {projectV2OneDayAwards} from '../../lib/race/v2-points.mjs';
import {buildV2OneDayResultContract,validateV2OneDayResultContract,
  validateV2OneDayResultAgainstLock,validateV2OneDayDivisionSlice}
  from '../../lib/race/v2-result-contract.mjs';
import {selectV2RecordedDivision,projectV2RecordedDivisionForTeam,
  projectV2RecordedDivisionSliceForTeam}
  from '../../lib/race/v2-viewer.mjs';
import {normalizeEnteredV2Orders} from '../../lib/race/v2-tactics.mjs';
import {weatherForV2TacticsLock} from '../../lib/race/v2-lock-weather.mjs';
import {buildV2OneDayLedgerRows} from '../../lib/race/v2-ledger.mjs';
import {loadStoredV2SettlementPreflight}
  from '../../lib/race/v2-settlement-preflight.mjs';
import {loadV2SettlementReadiness}
  from '../../lib/race/v2-settlement-readiness.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';
import {defaultOrders} from '../../lib/race/orders.mjs';

function snapshot(count){
  const teams=Array.from({length:count},(_,index)=>{
    const id=`team-${String(index).padStart(2,'0')}`;
    const selected=Array.from({length:8},(_,rider)=>`${id}-r${rider}`);
    return {id,name:`Team ${index+1}`,riders:selected.map(riderId=>({id:riderId,name:riderId,gender:'M',
      flat:40+index,sprint:48,hills:45,mountain:45,cobbles:45,timetrial:45,
      endurance:48,strength:45,wind:45,form:55,fatigue:0})),
      entry:{selected_riders:selected,captain_id:selected[0],orders:defaultOrders(selected,selected[0])}};
  });
  const reveal=assignPointDivisions({eventId:'candidate-race',seasonYear:2026,gender:'M',
    entrants:teams.map((team,index)=>({teamId:team.id,earnedPoints:count-index}))});
  return {event:{id:'candidate-race',kind:'one_day',gender:'M',
    scheduled_at:'2026-10-08T12:00:00Z',weather_locked:{temp_c:15,wind_kph:10,precipitation_mm:0}},
    stage:{distance_km:20,profile_points:[[0,25],[20,25]]},game_date:'2026-10-08',
    teams,locked_division_reveal:reveal};
}

test('saved 45-team reveal produces three separate deterministic v2 recordings without changing inputs',()=>{
  const input=snapshot(45),original=structuredClone(input);
  const first=previewRecordedDivisions(input);
  assert.deepEqual(first,previewRecordedDivisions(input));
  assert.deepEqual(input,original);
  assert.deepEqual(first.divisions.map(division=>division.teamIds.length),[15,15,15]);
  assert.equal(new Set(first.divisions.flatMap(division=>division.teamIds)).size,45);
  assert.equal(new Set(first.divisions.map(division=>division.recording.raceSeed)).size,3);
  for(const division of first.divisions){
    validateRecordedTour(division.recording);
    assert.ok(division.recording.committedInputs.teams.every(team=>
      team.name===input.teams.find(source=>source.id===team.id).name));
    assert.equal(division.recording.frames.length,20);
    assert.deepEqual(new Set(division.recording.provisionalResults.map(row=>row.teamId)),
      new Set(division.teamIds));
    assert.equal(division.recording.provisionalResults.length,division.teamIds.length*8);
  }
  const invalidName=structuredClone(first.divisions[0].recording);
  invalidName.committedInputs.teams[0].name='';
  assert.throws(()=>validateRecordedTour(invalidName),/Invalid committed team input/);
});

test('candidate rejects changed reveal, invalid lineup and unmappable legacy orders',()=>{
  const input=snapshot(2);
  input.points_at_registration_lock={eventId:'candidate-race',seasonYear:2026,gender:'M',
    entrants:input.teams.map((team,index)=>({teamId:team.id,earnedPoints:20-index}))};
  assert.throws(()=>previewRecordedDivisions(input),/registration lock/);
  delete input.points_at_registration_lock;
  input.locked_division_reveal.assignments[0].divisionIndex=2;
  assert.throws(()=>previewRecordedDivisions(input),/saved division reveal/);
  input.locked_division_reveal=assignPointDivisions({eventId:'candidate-race',seasonYear:2026,
    gender:'M',entrants:input.teams.map((team,index)=>({teamId:team.id,earnedPoints:2-index}))});
  input.teams[0].entry.orders.riders[input.teams[0].entry.captain_id].effort='aggressive';
  assert.throws(()=>previewRecordedDivisions(input),/cannot yet be translated/);
  input.teams[0].entry.orders=null;
  input.teams[0].entry.selected_riders[1]='foreign';
  assert.throws(()=>previewRecordedDivisions(input),/foreign, injured, or duplicate/);
});

test('explicit v2 orders are complete, roster-bound and recorded by phase',()=>{
  const input=snapshot(2),original=structuredClone(input);
  const orders=Object.fromEntries(input.teams.map((team,index)=>[
    team.id,{captainId:team.entry.captain_id,
      preset:index===0?'protect':'balanced',
      ...(index===0?{phases:[{atKm:10,effort:'hard',chase:'all'}]}:{})},
  ]));
  const source=structuredClone(orders);
  const candidate=previewRecordedDivisions(input,{v2OrdersByTeamId:orders});
  const recorded=candidate.divisions[0].recording.committedInputs.teams
    .find(team=>team.id===input.teams[0].id).orders;
  assert.equal(recorded.baseline.effort,'conserve');
  assert.deepEqual(recorded.phases,[{atKm:10,effort:'hard',chase:'all'}]);
  assert.deepEqual(input,original);
  assert.deepEqual(orders,source);
  assert.throws(()=>previewRecordedDivisions(input,{v2OrdersByTeamId:{[input.teams[0].id]:orders[input.teams[0].id]}}),
    /cover exactly/);
  orders[input.teams[1].id].captainId=input.teams[0].entry.captain_id;
  assert.throws(()=>previewRecordedDivisions(input,{v2OrdersByTeamId:orders}),
    /Both captains must belong/);
});

test('v2 candidate consumes every manager plan from a separate locked snapshot',()=>{
  const input=snapshot(2),original=structuredClone(input);
  input.v2_input_version=1;
  input.v2_orders_by_team_id=Object.fromEntries(input.teams.map((team,index)=>[
    team.id,{captainId:team.entry.captain_id,preset:index?'aggressive':'protect',
      phases:[{atKm:10,effort:index?'hard':'conserve'}]},
  ]));
  const candidate=previewLockedV2RecordedDivisions(input);
  assert.deepEqual(candidate.divisions[0].recording.committedInputs.teams
    .map(team=>team.orders.preset).sort(),['aggressive','protect']);
  assert.deepEqual(input.teams,original.teams);
  delete input.v2_orders_by_team_id[input.teams[1].id];
  assert.throws(()=>previewLockedV2RecordedDivisions(input),/cover exactly/);
  input.v2_input_version=2;
  assert.throws(()=>previewLockedV2RecordedDivisions(input),/saved v2 tactics lock/);
});

test('player-selectable break and support orders survive the lock into a recording',()=>{
  const lock=snapshot(2),captain=lock.teams[0].entry.captain_id;
  lock.v2_input_version=1;
  lock.v2_orders_by_team_id={
    [lock.teams[0].id]:{captainId:captain,roadCaptainId:lock.teams[0].riders[1].id,
      backupId:lock.teams[0].riders[2].id,
      helperIds:[lock.teams[0].riders[3].id],preset:'protect',
      baseline:{breakWork:'sit_on',breakFinale:'attack_if_outsprinted',
        helperAttackPolicy:'hold_for_captain',captainSupport:'drop_back_if_dropped'},
      contingency:'backup_if_captain_exhausted',breakResponse:'chase_if_threatened',
      forwardResponse:'chase_if_fading',
      phases:[{atKm:10,breakAttackRiderId:lock.teams[0].riders[4].id,
        breakWork:'drive',attackRiderId:null}]},
    [lock.teams[1].id]:{captainId:lock.teams[1].entry.captain_id,
      preset:'balanced'},
  };
  const candidate=previewLockedV2RecordedDivisions(lock);
  const recorded=candidate.divisions[0].recording.committedInputs.teams
    .find(team=>team.id===lock.teams[0].id).orders;
  assert.equal(recorded.baseline.breakWork,'sit_on');
  assert.equal(recorded.baseline.breakFinale,'attack_if_outsprinted');
  assert.equal(recorded.baseline.helperAttackPolicy,'hold_for_captain');
  assert.equal(recorded.baseline.captainSupport,'drop_back_if_dropped');
  assert.equal(recorded.breakResponse,'chase_if_threatened');
  assert.equal(recorded.forwardResponse,'chase_if_fading');
  assert.deepEqual(recorded.phases,[{atKm:10,attackRiderId:null,
    breakAttackRiderId:lock.teams[0].riders[4].id,breakWork:'drive'}]);
  assert.equal(validateRecordedTour(candidate.divisions[0].recording),true);
});

test('v2 tactics lock fixes deterministic weather without changing the event',()=>{
  const input=snapshot(2);
  input.event.deadline='2026-10-07T12:00:00Z';
  input.event.country_code='DK';
  delete input.event.weather_locked;
  const original=structuredClone(input);
  const first=weatherForV2TacticsLock(input);
  assert.equal(first.source,'LOCKED_SIM');
  assert.deepEqual(first,weatherForV2TacticsLock(input));
  assert.deepEqual(input,original);
  input.event.weather_locked=first;
  assert.deepEqual(weatherForV2TacticsLock(input),first);
  input.event.weather_locked={...first,wind_kph:-1};
  assert.throws(()=>weatherForV2TacticsLock(input),/valid fixed weather/);
});

test('v2 entry contract binds a phase plan to its saved lineup and captain',()=>{
  const input=snapshot(2),team=input.teams[0],ids=team.entry.selected_riders;
  const orders=normalizeEnteredV2Orders(team.entry,input.stage,{
    captainId:ids[0],helperIds:[ids[1]],preset:'protect',
    phases:[{atKm:10,effort:'hard',attackRiderId:ids[2]}],
  });
  assert.equal(orders.version,2);
  assert.deepEqual(orders.phases,[{atKm:10,effort:'hard',attackRiderId:ids[2]}]);
  assert.throws(()=>normalizeEnteredV2Orders(team.entry,input.stage,{
    captainId:ids[1],preset:'protect',
  }),/differs from the entered captain/);
  assert.throws(()=>normalizeEnteredV2Orders(team.entry,input.stage,{
    captainId:ids[0],phases:[{atKm:10,attackRiderId:'foreign'}],
  }),/planned attacker must belong/);
  assert.throws(()=>normalizeEnteredV2Orders({...team.entry,selected_riders:ids.slice(1)},
    input.stage,{captainId:ids[0]}),/eight selected riders/);
});

test('45-team v2 recording projects unique tier points without writing a ledger',()=>{
  const candidate=previewRecordedDivisions(snapshot(45));
  const first=projectV2OneDayAwards(candidate,{tier:3});
  assert.deepEqual(first,projectV2OneDayAwards(candidate,{tier:3}));
  assert.equal(first.policyVersion,'v0.1');
  assert.deepEqual(first.divisions.map(division=>division.awards.length),[20,20,20]);
  assert.equal(first.divisions[0].multiplier,1);
  assert.ok(first.divisions[1].multiplier<1);
  assert.ok(first.divisions[2].multiplier<first.divisions[1].multiplier);
  const awards=first.divisions.flatMap(division=>division.awards);
  assert.equal(new Set(awards.map(award=>award.awardKey)).size,60);
  for(const division of first.divisions){
    const winner=division.awards.find(award=>award.placing===1);
    assert.equal(winner.points,pointsForDivisionResult({tier:3,resultType:'ONE_DAY',
      placing:1,multiplier:division.multiplier}));
    assert.equal(winner.divisionIndex,division.index);
  }
  const foreign=structuredClone(candidate);
  foreign.divisions[0].teamIds[0]='foreign';
  assert.throws(()=>projectV2OneDayAwards(foreign,{tier:3}),/differ from the division reveal/);
  const swapped=structuredClone(candidate);
  const swappedFirst=swapped.divisionReveal.assignments.find(row=>row.divisionIndex===1);
  const swappedSecond=swapped.divisionReveal.assignments.find(row=>row.divisionIndex===2);
  [swappedFirst.divisionIndex,swappedSecond.divisionIndex]=
    [swappedSecond.divisionIndex,swappedFirst.divisionIndex];
  assert.throws(()=>projectV2OneDayAwards(swapped,{tier:3}),
    /differ from the division reveal/);
  const wrongEvent=structuredClone(candidate);
  wrongEvent.divisionReveal.eventId='other-race';
  assert.throws(()=>projectV2OneDayAwards(wrongEvent,{tier:3}),/saved division reveal/);
  assert.throws(()=>projectV2OneDayAwards(candidate,{tier:7}),/recorded race and tier/);
});

test('one versioned v2 result contract binds each replay, captain placing and award',()=>{
  const candidate=previewRecordedDivisions(snapshot(45));
  const contract=buildV2OneDayResultContract(candidate,{tier:3});
  assert.equal(contract.schemaVersion,1);
  assert.equal(contract.engineVersion,2);
  assert.equal(contract.pointsPolicyVersion,'v0.1');
  assert.deepEqual(contract.divisions.map(division=>division.teamIds.length),[15,15,15]);
  assert.equal(contract.divisions.flatMap(division=>division.teamResults).length,45);
  assert.equal(contract.divisions.flatMap(division=>division.riderResults).length,360);
  assert.equal(contract.divisions.flatMap(division=>division.awards).length,60);
  assert.equal(validateV2OneDayResultContract(contract),contract);
  assert.deepEqual(contract,
    buildV2OneDayResultContract(previewRecordedDivisions(snapshot(45)),{tier:3}));
  for(const division of contract.divisions){
    const awardByRider=new Map(division.awards.map(award=>[award.riderId,award]));
    for(const result of division.riderResults)
      assert.equal(result.rankingPoints,awardByRider.get(result.riderId)?.points??0);
    for(const team of division.teamResults){
      const captain=division.riderResults.find(result=>result.riderId===team.captainId);
      assert.equal(captain.teamId,team.teamId);
      assert.equal(captain.timeSeconds,team.timeSeconds);
    }
  }
  const changedPoints=structuredClone(contract);
  changedPoints.divisions[1].awards[0].points++;
  assert.throws(()=>validateV2OneDayResultContract(changedPoints),/disagree/);
  const changedPlacing=structuredClone(contract);
  changedPlacing.divisions[2].teamResults[0].position=9;
  assert.throws(()=>validateV2OneDayResultContract(changedPlacing),/disagree/);
  const changedRecording=structuredClone(contract);
  changedRecording.divisions[0].recording.provisionalResults[0].timeSeconds++;
  assert.throws(()=>validateV2OneDayResultContract(changedRecording));
  const wrongVersion=structuredClone(contract);
  wrongVersion.schemaVersion=2;
  assert.throws(()=>validateV2OneDayResultContract(wrongVersion),/Unsupported/);
});

test('division-only v2 read validates replay, points and reveal without rival recordings',()=>{
  const contract=buildV2OneDayResultContract(previewRecordedDivisions(snapshot(45)),
    {tier:3});
  const {divisions,...header}=contract;
  const slice={...header,divisionCount:divisions.length,division:divisions[2]};
  const teamId=slice.division.teamIds[0];
  assert.equal(validateV2OneDayDivisionSlice(slice),slice);
  const persistedReveal=structuredClone(slice);
  persistedReveal.divisionReveal.revealedAt='2026-10-06T08:28:39.418597+00:00';
  persistedReveal.divisionReveal.pointsPolicyVersion=
    'provisional-zero-point-id-tiebreak-v1';
  assert.equal(validateV2OneDayDivisionSlice(persistedReveal),persistedReveal);
  const wrongRevealPolicy=structuredClone(persistedReveal);
  wrongRevealPolicy.divisionReveal.pointsPolicyVersion='unexpected-policy';
  assert.throws(()=>validateV2OneDayDivisionSlice(wrongRevealPolicy),/saved reveal/);
  const wrongRevealTimestamp=structuredClone(persistedReveal);
  wrongRevealTimestamp.divisionReveal.revealedAt='invalid-date';
  assert.throws(()=>validateV2OneDayDivisionSlice(wrongRevealTimestamp),/saved reveal/);
  const unexpectedRevealMetadata=structuredClone(persistedReveal);
  unexpectedRevealMetadata.divisionReveal.extra='surprise';
  assert.throws(()=>validateV2OneDayDivisionSlice(unexpectedRevealMetadata),/saved reveal/);
  assert.deepEqual(projectV2RecordedDivisionSliceForTeam(slice,teamId),
    projectV2RecordedDivisionForTeam(contract,teamId));
  assert.throws(()=>projectV2RecordedDivisionSliceForTeam(slice,divisions[0].teamIds[0]),
    /not in the selected/);
  const wrongAward=structuredClone(slice);
  wrongAward.division.awards[0].points++;
  assert.throws(()=>validateV2OneDayDivisionSlice(wrongAward),/disagree/);
  const wrongResult=structuredClone(slice);
  wrongResult.division.riderResults[0].timeSeconds++;
  assert.throws(()=>validateV2OneDayDivisionSlice(wrongResult),/disagree/);
  const wrongReveal=structuredClone(slice);
  wrongReveal.divisionReveal.assignments.find(row=>row.teamId===teamId)
    .divisionIndex=1;
  assert.throws(()=>validateV2OneDayDivisionSlice(wrongReveal),/saved reveal/);
});

test('v2 result can only cross the storage boundary with its exact locked manager input',()=>{
  const lock=snapshot(2);
  lock.event.race_tier=3;
  lock.v2_input_version=1;
  lock.v2_orders_by_team_id=Object.fromEntries(lock.teams.map((team,index)=>[
    team.id,{captainId:team.entry.captain_id,preset:index?'aggressive':'protect'},
  ]));
  const candidate=previewLockedV2RecordedDivisions(lock);
  const contract=buildV2OneDayResultContract(candidate,{tier:3});
  assert.equal(validateV2OneDayResultAgainstLock(lock,contract),contract);
  const otherTier=structuredClone(lock);
  otherTier.event.race_tier=4;
  assert.throws(()=>validateV2OneDayResultAgainstLock(otherTier,contract),
    /another locked race or tier/);
  const otherWeather=structuredClone(lock);
  otherWeather.event.weather_locked.wind_kph=40;
  assert.throws(()=>validateV2OneDayResultAgainstLock(otherWeather,contract),
    /saved manager tactics lock/);
  const otherOrders=structuredClone(lock);
  otherOrders.v2_orders_by_team_id[lock.teams[0].id].preset='balanced';
  assert.throws(()=>validateV2OneDayResultAgainstLock(otherOrders,contract),
    /saved manager tactics lock/);
  const otherRace=structuredClone(lock);
  otherRace.event.id='other-race';
  assert.throws(()=>validateV2OneDayResultAgainstLock(otherRace,contract),
    /another locked race or tier/);
});

test('JSONB weather zeroes still match the immutable v2 recording',()=>{
  const lock=snapshot(2);
  lock.event.seed='negative-zero-1';
  lock.event.weather_locked.temp_c=0;
  lock.event.race_tier=3;
  lock.stage={distance_km:140,profile_points:[[0,25],[140,25]]};
  lock.v2_input_version=1;
  lock.v2_orders_by_team_id=Object.fromEntries(lock.teams.map(team=>[
    team.id,{captainId:team.entry.captain_id,preset:'balanced'},
  ]));
  const calculated=buildV2OneDayResultContract(
    previewLockedV2RecordedDivisions(lock),{tier:3});
  assert.ok(calculated.divisions[0].recording.route.kilometres.some(row=>
    Object.is(row.weather.temperatureC,-0)));
  const stored=JSON.parse(JSON.stringify(calculated));
  assert.equal(validateV2OneDayResultAgainstLock(lock,stored),stored);
});

test('45-team v2 candidate maps to exact unique sporting-ledger rows without writing them',()=>{
  const lock=snapshot(45);
  lock.event.race_tier=3;
  lock.event.calendar_source='PELOTONIA';
  lock.v2_input_version=1;
  lock.v2_orders_by_team_id=Object.fromEntries(lock.teams.map(team=>[
    team.id,{captainId:team.entry.captain_id,preset:'balanced'},
  ]));
  const contract=buildV2OneDayResultContract(
    previewLockedV2RecordedDivisions(lock),{tier:3});
  const rows=buildV2OneDayLedgerRows(lock,contract);
  assert.equal(rows.length,60);
  assert.equal(new Set(rows.map(row=>row.award_key)).size,60);
  assert.equal(new Set(rows.map(row=>row.rider_id)).size,60);
  assert.ok(rows.every(row=>row.event_id===lock.event.id&&
    row.season_year===2026&&row.gender==='M'&&
    row.calendar_source==='PELOTONIA'&&row.event_format==='ONE_DAY'&&
    row.race_tier===3&&row.result_type==='ONE_DAY'&&
    row.points_policy_version==='v0.1'&&row.points>0));
  const missingSource=structuredClone(lock);
  delete missingSource.event.calendar_source;
  assert.throws(()=>buildV2OneDayLedgerRows(missingSource,contract),
    /sporting-ledger metadata/);
  const wrongYear=structuredClone(lock);
  wrongYear.event.scheduled_at='2027-10-08T12:00:00Z';
  assert.throws(()=>buildV2OneDayLedgerRows(wrongYear,contract));
});

test('45 distinct v2 plans survive reveal, three recordings and award projection',()=>{
  const input=snapshot(45),original=structuredClone(input);
  const presets=['protect','aggressive','balanced'];
  const orders=Object.fromEntries(input.teams.map((team,index)=>[
    team.id,{captainId:team.entry.captain_id,preset:presets[index%3],
      ...(index%3===1?{phases:[{atKm:10,effort:'conserve',chase:'selective'}]}:{})},
  ]));
  const candidate=previewRecordedDivisions(input,{v2OrdersByTeamId:orders});
  const replayed=previewRecordedDivisions(input,{v2OrdersByTeamId:orders});
  assert.deepEqual(candidate,replayed);
  const balanced=previewRecordedDivisions(input);
  assert.deepEqual(candidate.divisions.map(division=>division.teamIds.length),[15,15,15]);
  const recordedTeams=candidate.divisions.flatMap(division=>division.recording.committedInputs.teams);
  assert.equal(recordedTeams.length,45);
  for(const team of recordedTeams){
    assert.equal(team.orders.preset,orders[team.id].preset);
    assert.deepEqual(team.orders.phases,orders[team.id].phases??[]);
  }
  const awards=projectV2OneDayAwards(candidate,{tier:3}).divisions
    .flatMap(division=>division.awards);
  assert.deepEqual(projectV2OneDayAwards(candidate,{tier:3}),
    projectV2OneDayAwards(replayed,{tier:3}));
  assert.equal(awards.length,60);
  assert.equal(new Set(awards.map(award=>award.awardKey)).size,60);
  assert.notDeepEqual(candidate.divisions[0].recording.frames[0].teamEnergy,
    balanced.divisions[0].recording.frames[0].teamEnergy);
  assert.notDeepEqual(candidate.divisions[0].recording.provisionalResults,
    balanced.divisions[0].recording.provisionalResults);
  const changedPlaces=candidate.divisions.reduce((count,division,index)=>{
    const prior=new Map(balanced.divisions[index].recording.provisionalResults.map(row=>
      [row.riderId,row.position]));
    return count+division.recording.provisionalResults.filter(row=>
      row.position!==prior.get(row.riderId)).length;
  },0);
  assert.ok(changedPlaces>0,`Expected tactical orders to change a placing; changed ${changedPlaces}.`);
  assert.deepEqual(input,original);
});

test('viewer selection exposes only the entered team’s saved division',()=>{
  const candidate=previewRecordedDivisions(snapshot(45));
  const assignment=candidate.divisionReveal.assignments.find(row=>row.divisionIndex===3);
  const selected=selectV2RecordedDivision(candidate,assignment.teamId);
  assert.equal(selected.divisionIndex,3);
  assert.equal(selected.eventId,candidate.eventId);
  assert.equal(selected.recording.committedInputs.teams.length,15);
  assert.deepEqual(new Set(selected.recording.committedInputs.teams.map(team=>team.id)),
    new Set(candidate.divisionReveal.assignments.filter(row=>row.divisionIndex===3)
      .map(row=>row.teamId)));
  assert.equal(JSON.stringify(selected).includes(candidate.divisions[0].teamIds[0]),false);
  assert.throws(()=>selectV2RecordedDivision(candidate,'foreign'),/no unique saved division/);
  assert.throws(()=>selectV2RecordedDivision(null,assignment.teamId),
    /needs a saved reveal and team identity/);
  const malformed=structuredClone(candidate);
  malformed.divisionReveal.assignments[0]=null;
  assert.throws(()=>selectV2RecordedDivision(malformed,assignment.teamId),
    /needs a saved reveal and team identity/);
  const outOfRange=structuredClone(candidate);
  outOfRange.divisionReveal.assignments.find(row=>row.teamId===assignment.teamId)
    .divisionIndex=0;
  assert.throws(()=>selectV2RecordedDivision(outOfRange,assignment.teamId),
    /needs a saved reveal and team identity/);
  const duplicate=structuredClone(candidate);
  duplicate.divisionReveal.assignments[0].teamId=assignment.teamId;
  assert.throws(()=>selectV2RecordedDivision(duplicate,assignment.teamId),
    /needs a saved reveal and team identity/);
  const wrongCategory=structuredClone(candidate);
  wrongCategory.divisionReveal.gender=wrongCategory.divisionReveal.gender==='M'?'F':'M';
  assert.throws(()=>selectV2RecordedDivision(wrongCategory,assignment.teamId),
    /differs from the saved reveal/);
  const tampered=structuredClone(candidate);
  tampered.divisionReveal.assignments.find(row=>row.teamId===assignment.teamId)
    .divisionIndex=2;
  assert.throws(()=>selectV2RecordedDivision(tampered,assignment.teamId),
    /differs from the saved reveal/);
});

test('player viewer projection hides other divisions and rival private plans',()=>{
  const input=snapshot(45);
  const candidate=previewRecordedDivisions(input);
  const contract=buildV2OneDayResultContract(candidate,{tier:3});
  const teamId=candidate.divisionReveal.assignments
    .find(row=>row.divisionIndex===3).teamId;
  const projected=projectV2RecordedDivisionForTeam(contract,teamId);
  assert.equal(projected.divisionIndex,3);
  assert.equal(projected.focusTeamId,teamId);
  assert.equal(projected.settled,false);
  assert.equal(projected.teamResults.length,15);
  assert.equal(projected.riderResults.length,120);
  assert.equal(projected.projectedAwards.length,20);
  assert.equal(JSON.stringify(projected).includes(candidate.divisions[0].teamIds[0]),false);
  const teams=projected.recording.committedInputs.teams;
  assert.equal(teams.length,15);
  assert.ok(teams.find(team=>team.id===teamId).orders.version===2);
  assert.ok(teams.filter(team=>team.id!==teamId).every(team=>
    Object.keys(team.orders).join(',')==='captainId'&&
    team.riders.every(rider=>Object.keys(rider).every(key=>['id','name'].includes(key)))));
  assert.ok(projected.recording.frames.every(frame=>
    !('teamEnergy' in frame)&&!('teamPace' in frame)&&
    frame.riderGroups.filter(rider=>rider.teamId!==teamId)
      .every(rider=>!('energy' in rider))));
  assert.ok(projected.recording.provisionalResults
    .filter(result=>result.teamId!==teamId)
    .every(result=>!('energy' in result)&&!('finaleAbility' in result)));
  assert.equal(contract.divisions[2].recording.committedInputs.teams[1].orders.version,2);
  assert.throws(()=>projectV2RecordedDivisionForTeam(contract,'foreign'),
    /no unique saved division/);
});

test('private v2 viewer shows only the manager’s own hard bunch work',()=>{
  const input=snapshot(2),[steady,hard]=input.teams;
  const orders={
    [steady.id]:{captainId:steady.entry.captain_id,preset:'balanced',
      baseline:{effort:'steady',attack:'none',chase:'ignore'}},
    [hard.id]:{captainId:hard.entry.captain_id,preset:'balanced',
      baseline:{effort:'hard',attack:'none',chase:'ignore'}},
  };
  const candidate=previewRecordedDivisions(input,{v2OrdersByTeamId:orders});
  const contract=buildV2OneDayResultContract(candidate,{tier:3});
  const first=contract.divisions[0].recording.frames[0];
  assert.deepEqual(first.hardBunchWorkTeamIds,[hard.id]);
  assert.equal(first.hardBunchWorkRiderIds.length,2);
  const hardView=projectV2RecordedDivisionForTeam(contract,hard.id);
  const steadyView=projectV2RecordedDivisionForTeam(contract,steady.id);
  assert.deepEqual(hardView.recording.frames[0].hardBunchWorkTeamIds,[hard.id]);
  assert.deepEqual(hardView.recording.frames[0].hardBunchWorkRiderIds,
    first.hardBunchWorkRiderIds);
  assert.ok(steadyView.recording.frames.every(frame=>
    frame.hardBunchWorkTeamIds.length===0&&
    frame.hardBunchWorkRiderIds.length===0));
});

test('settlement preflight rebuilds saved split or legacy results without writing points',async()=>{
  const lock=snapshot(45);
  lock.event.calendar_source='PELOTONIA';
  lock.event.race_tier=3;
  lock.event.status='OPEN';
  lock.event.registration_deadline='2026-10-08T10:00:00Z';
  lock.event.tactics_deadline='2026-10-08T11:00:00Z';
  lock.v2_input_version=1;
  lock.v2_orders_by_team_id=Object.fromEntries(lock.teams.map(team=>[
    team.id,{captainId:team.entry.captain_id,preset:'balanced'},
  ]));
  const candidate=previewLockedV2RecordedDivisions(lock);
  const contract=buildV2OneDayResultContract(candidate,{tier:3});
  const expectedRows=buildV2OneDayLedgerRows(lock,contract);
  assert.equal(contract.divisions.length,3);
  assert.equal(expectedRows.length,60);
  const recordedAt='2026-10-08T12:01:00Z';
  const header=structuredClone(contract);
  delete header.divisions;
  const divisionRows=contract.divisions.map((division,index)=>({
    division_index:index+1,result_division:division}));
  const fakeDb=(candidateRow,rows)=>({from(table){
    const query={select(){return this;},eq(){return this;},
      maybeSingle:async()=>({data:candidateRow,error:null}),
      order:async()=>{
        assert.equal(table,'recovery_v2_recorded_divisions');
        return {data:rows,error:null};
      },limit:async()=>{
        assert.equal(table,'recovery_v2_recorded_divisions');
        return {data:rows.slice(0,1),error:null};
      }};
    assert.ok(['recovery_v2_recorded_candidates',
      'recovery_v2_recorded_divisions'].includes(table));
    return query;
  }});
  const splitRow={event_id:lock.event.id,contract_header:header,
    result_contract:null,recorded_at:recordedAt};
  const split=await loadStoredV2SettlementPreflight(fakeDb(splitRow,divisionRows),lock);
  assert.deepEqual(split,{eventId:lock.event.id,recordedAt,
    contract,ledgerRows:expectedRows});
  const legacyRow={...splitRow,contract_header:null,result_contract:contract};
  const legacy=await loadStoredV2SettlementPreflight(fakeDb(legacyRow,[]),lock);
  assert.deepEqual(legacy,split);
  await assert.rejects(loadStoredV2SettlementPreflight(
    fakeDb(legacyRow,divisionRows),lock),/ambiguous storage format/);
  await assert.rejects(loadStoredV2SettlementPreflight(fakeDb(splitRow,[]),lock),
    /divisions are incomplete/);
  const changed=structuredClone(divisionRows);
  changed[0].result_division.awards[0].points+=1;
  await assert.rejects(loadStoredV2SettlementPreflight(fakeDb(splitRow,changed),lock),
    /recording and awards disagree|result differs/);
  const older=structuredClone(divisionRows);
  older[0].result_division.recording.tuningVersion='v2-prototype-75';
  await assert.rejects(loadStoredV2SettlementPreflight(fakeDb(splitRow,older),lock),
    /original engine version/);
  const readinessDb=(event,occupiedTable,storedLock=lock)=>({from(table){
    if(['recovery_v2_recorded_candidates',
      'recovery_v2_recorded_divisions'].includes(table))
      return fakeDb(splitRow,divisionRows).from(table);
    return {select(){return this;},eq(){return this;},
      maybeSingle:async()=>({data:table==='recovery_v2_tactics_commits'?
        (storedLock?{event_id:lock.event.id,input_snapshot:storedLock}:null):event,
      error:null}),
      limit:async()=>({data:table===occupiedTable?[{event_id:lock.event.id}]:[],
        error:null})};
  }});
  const now=Date.parse('2026-10-08T12:01:00Z');
  const ready=await loadV2SettlementReadiness(readinessDb(lock.event),lock.event.id,{now});
  assert.deepEqual(ready,split);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb({...lock.event,status:'FINISHED'}),lock.event.id,{now}),
  /not ready for settlement/);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb({...lock.event,scheduled_at:'2026-10-08T12:00:30Z'}),
    lock.event.id,{now}),/not ready for settlement/);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb({...lock.event,tactics_deadline:'2026-10-08T11:30:00Z'}),
    lock.event.id,{now}),/not ready for settlement/);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb(lock.event,'recovery_ranking_awards'),lock.event.id,{now}),
  /ranking_awards rows require manual review/);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb(lock.event),lock.event.id,{now:now-120000}),
  /not ready for settlement/);
  await assert.rejects(loadV2SettlementReadiness(
    readinessDb(lock.event,null,null),lock.event.id,{now}),
  /saved v2 tactics lock/);
});
