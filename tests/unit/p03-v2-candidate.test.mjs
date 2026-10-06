import test from 'node:test';
import assert from 'node:assert/strict';
import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {previewRecordedDivisions} from '../../lib/race/v2-candidate.mjs';
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
