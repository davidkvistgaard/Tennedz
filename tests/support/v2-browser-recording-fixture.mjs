import {assignPointDivisions} from '../../lib/calendar/division-reveal.mjs';

export function v2BrowserRecordingLock(eventId){
  const definitions=[['team-v2manager','Manager team','M',57],
    ...Array.from({length:20},(_,index)=>[
      `team-v2bot-${index+1}`,`Fixture team ${index+1}`,
      `B${index+1}`,55+index%5]),
    ['team-v2rival','Rival team','R',60]];
  const teams=definitions.map(([id,name,initial,skill])=>{
    const riders=Array.from({length:8},(_,index)=>({
      id:`fixture-${initial}-${index}`,name:`${name} rider ${index+1}`,
      gender:'M',flat:skill,sprint:skill,hills:skill,mountain:skill,
      cobbles:skill,timetrial:skill,endurance:skill,strength:skill,
      wind:skill,form:60,fatigue:0,
    }));
    return {id,name,riders,entry:{selected_riders:riders.map(rider=>rider.id),
      captain_id:riders[0].id}};
  });
  const reveal=assignPointDivisions({eventId,seasonYear:2026,gender:'M',
    entrants:teams.map((team,index)=>({teamId:team.id,
      earnedPoints:definitions.length-index}))});
  return {v2_input_version:1,
    v2_orders_by_team_id:Object.fromEntries(teams.map((team,index)=>[
      team.id,{captainId:team.entry.captain_id,
        preset:index===0?'protect':team.id==='team-v2rival'?'aggressive':'balanced'},
    ])),
    event:{id:eventId,kind:'one_day',gender:'M',race_tier:3,
      calendar_source:'PELOTONIA',
      registration_deadline:'2026-10-06T10:00:00Z',
      tactics_deadline:'2026-10-06T11:00:00Z',
      scheduled_at:'2026-10-06T12:00:00Z',
      weather_locked:{temp_c:15,wind_kph:8,precipitation_mm:0}},
    stage:{distance_km:20,profile_points:[[0,25],[20,25]]},
    game_date:'2026-10-06',teams,locked_division_reveal:reveal};
}
