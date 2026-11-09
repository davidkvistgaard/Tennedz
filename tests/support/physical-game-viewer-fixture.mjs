import {createPhysicalGameRaceDocumentV1} from
  '../../lib/viewer/physical-game-race-source-v1.mjs';

export const physicalViewerEventId=
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const abilities={sprint:65,flat:65,hills:65,mountain:65,
  cobbles:65,timetrial:65,endurance:65,strength:65,
  wind:65,leadership:65,form:50,fatigue:0};

export function physicalGameViewerFixture(){
  const event={id:physicalViewerEventId,kind:'one_day',
    gender:'M',seed:'fixture-saved-race-seed',
    weather_locked:{temp_c:16,wind_kph:0,
      precipitation_mm:0}};
  const stage={distance_km:20,profile_points:[[0,100],[20,100]],
    keypoints:[]};
  const teams=['b','d'].map((prefix,index)=>{
    const id=`${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${prefix.repeat(12)}`;
    const riders=Array.from({length:8},(_,number)=>({
      ...abilities,id:`${prefix.repeat(8)}-${prefix.repeat(4)}-4${prefix.repeat(3)}-8${prefix.repeat(3)}-${String(number+1).padStart(12,'0')}`,
      name:`Fixture rider ${index+1}-${number+1}`,gender:'M'}));
    return {id,name:`Fixture team ${index+1}`,riders,
      entry:{selected_riders:riders.map(rider=>rider.id),
        captain_id:riders[6].id}};
  });
  const snapshot={event,stage,teams,game_date:'2026-11-09'};
  const rows=teams.map((team,index)=>({
    event_id:event.id,team_id:team.id,
    schema_version:'physical-entry-input-v1',
    selected_riders:team.entry.selected_riders,
    captain_id:team.entry.captain_id,
    orders:{version:2,captainId:team.entry.captain_id,
      roadCaptainId:team.riders[0].id,
      helperIds:team.riders.filter(rider=>
        rider.id!==team.entry.captain_id&&
        rider.id!==team.riders[0].id).map(rider=>rider.id),
      baseline:{effort:'steady',attack:'none',
        chase:'selective',frontWork:index?'sit_in':'rotate',
        frontWorkRiderId:index?null:team.riders[1].id}},
    stake:{sportingGoal:'sprint_finish',
      sportingCaptainId:team.entry.captain_id},
    team_style:{id:team.id,name:team.name,
      color:index?'#664422':'#224466',
      accent:'#ffffff',pattern:'band'},
    rider_numbers:Object.fromEntries(team.riders.map((rider,n)=>
      [rider.id,index*8+n+1]))}));
  return createPhysicalGameRaceDocumentV1(snapshot,rows);
}
