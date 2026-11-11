import {createPhysicalGameRaceDocumentV1} from
  '../../lib/viewer/physical-game-race-source-v1.mjs';

export const physicalViewerEventId=
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const abilities={sprint:65,flat:65,hills:65,mountain:65,
  cobbles:65,timetrial:65,endurance:65,strength:65,
  wind:65,leadership:65,form:50,fatigue:0};

const fixtureUuid=(teamNumber,riderNumber=0)=>{
  const team=teamNumber.toString(16).padStart(8,'0');
  const rider=riderNumber.toString(16).padStart(12,'0');
  return `${team}-0000-4000-8000-${rider}`;
};

export function physicalGameViewerInputsV1({teamCount=2,
  category='men'}={}){
  if(!Number.isInteger(teamCount)||teamCount<2||teamCount>18||
    !['men','women'].includes(category))
    throw new Error('The fixture needs 2–18 teams and one rider category.');
  const gender=category==='women'?'F':'M';
  const event={id:physicalViewerEventId,kind:'one_day',
    gender,seed:`fixture-saved-race-seed-${category}-${teamCount}`,
    weather_locked:{temp_c:16,wind_kph:0,
      precipitation_mm:0}};
  const stage={distance_km:20,profile_points:[[0,100],[20,100]],
    keypoints:[]};
  const teams=Array.from({length:teamCount},(_,index)=>{
    const id=fixtureUuid(index+1);
    const riders=Array.from({length:8},(_,number)=>({
      ...abilities,id:fixtureUuid(index+1,number+1),
      name:`Fixture rider ${index+1}-${number+1}`,gender}));
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
  return {snapshot,rows};
}

export function physicalGameViewerFixture(options){
  const {snapshot,rows}=physicalGameViewerInputsV1(options);
  return createPhysicalGameRaceDocumentV1(snapshot,rows);
}
