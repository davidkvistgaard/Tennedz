// Read-only sensitivity probe: neutral bunch versus one team deliberately
// setting a hard pace. No database, browser or live result is changed.
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const routes={flat:[[0,0],[140,0]],
  hilly:[[0,0],[35,0],[45,600],[55,0],[90,0],[100,600],[110,0],[140,0]]};
function team(id,level,hard=false){
  const riders=Array.from({length:8},(_,index)=>({id:`${id}-r${index}`,
    gender:'M',form:70,fatigue:10,
    ...Object.fromEntries(skills.map(skill=>[skill,level]))}));
  return {id,riders,orders:{captainId:riders[0].id,preset:'balanced',
    baseline:{effort:hard?'hard':'steady',attack:'none',chase:'ignore'}}};
}
function field(size,strongLevel,hard){
  return [team('weak',80),team('strong',strongLevel,hard),
    ...Array.from({length:size-2},(_,index)=>team(`neutral-${index}`,76+index%13))];
}
const rows=[];
for(const [route,profile_points] of Object.entries(routes))
  for(const teams of [2,3,5,15])for(const strongLevel of [90,96,98])
    for(const hard of [false,true]){
      const gaps=[],droppedAt70=[],finishDropped=[],strongEnergy=[];
      for(const seed of ['fixed','alternate-1','alternate-2']){
        const recording=simulateTacticalTour({stage:{distance_km:140,profile_points,
          tags:[route.toUpperCase()]},teams:field(teams,strongLevel,hard),seed,
        weather:{temp_c:18,wind_kph:5,precipitation_mm:0}});
        const weak=recording.provisionalResults.find(result=>result.teamId==='weak');
        const strong=recording.provisionalResults.find(result=>result.teamId==='strong');
        gaps.push(+(weak.timeSeconds-strong.timeSeconds).toFixed(2));
        droppedAt70.push(recording.frames[69].riderGroups.filter(rider=>
          rider.teamId==='weak'&&rider.group==='dropped').length);
        finishDropped.push(recording.frames.at(-1).riderGroups.filter(rider=>
          rider.teamId==='weak'&&rider.group==='dropped').length);
        strongEnergy.push(recording.frames.at(-1).teamEnergy.find(row=>
          row.teamId==='strong').mean);
      }
      rows.push({route,teams,strongLevel,hard,gaps,droppedAt70,
        finishDropped,strongEnergy});
    }
console.log(JSON.stringify({probe:'v2 pace work across field sizes',rows},null,2));
