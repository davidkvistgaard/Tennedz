import test from 'node:test';
import assert from 'node:assert/strict';
import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {previewRecordedDivisions} from '../../lib/race/v2-candidate.mjs';
import {projectV2OneDayAwards} from '../../lib/race/v2-points.mjs';
import {selectV2RecordedDivision} from '../../lib/race/v2-viewer.mjs';
import {normalizeEnteredV2Orders} from '../../lib/race/v2-tactics.mjs';
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
