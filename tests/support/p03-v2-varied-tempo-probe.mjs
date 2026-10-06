// Read-only v2 balance probe with unequal riders and both flat and hilly roads.
// No game state, database row or browser fixture is changed.
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';

const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const spread=[-8,-6,-4,-2,2,4,6,8];
const routes={flat:[[0,0],[140,0]],
  hilly:[[0,0],[35,0],[45,600],[55,0],[90,0],[100,600],[110,0],[140,0]]};
const seeds=['fixed','alternate-1','alternate-2'];
function team(id,level,hard=false,captainIndex=0){
  const riders=spread.map((offset,index)=>({id:`${id}-${index}`,gender:'M',
    form:70,fatigue:10,...Object.fromEntries(skills.map(skill=>
      [skill,Math.min(100,Math.max(0,level+offset))]))}));
  return {id,riders,orders:{captainId:riders[captainIndex].id,preset:'balanced',
    baseline:{effort:hard?'hard':'steady',attack:'none',chase:'ignore'}}};
}
function field(size,strongLevel,hard,captainIndex){
  return [team('weak',80,false,captainIndex),
    team('strong',strongLevel,hard,captainIndex),
    ...Array.from({length:size-2},(_,index)=>
      team(`neutral-${index}`,76+index%13,false,captainIndex))];
}
const rows=[];
for(const [route,profile_points] of Object.entries(routes))
  for(const teams of [2,5,15])for(const strongLevel of [90,94,96,98])
    for(const captainIndex of [0,7])for(const hard of [false,true]){
      const gaps=[],captainGaps=[],weakDropped=[],strongEnergy=[];
      for(const seed of seeds){
        const recording=simulateTacticalTour({stage:{distance_km:140,profile_points,
          tags:[route.toUpperCase()]},
        teams:field(teams,strongLevel,hard,captainIndex),seed,
        weather:{temp_c:18,wind_kph:5,precipitation_mm:0}});
        const weak=recording.provisionalResults.find(result=>result.teamId==='weak');
        const strong=recording.provisionalResults.find(result=>result.teamId==='strong');
        gaps.push(+(weak.timeSeconds-strong.timeSeconds).toFixed(2));
        const weakCaptain=recording.provisionalResults.find(result=>
          result.riderId===`weak-${captainIndex}`);
        const strongCaptain=recording.provisionalResults.find(result=>
          result.riderId===`strong-${captainIndex}`);
        captainGaps.push(+(weakCaptain.timeSeconds-strongCaptain.timeSeconds).toFixed(2));
        weakDropped.push(recording.frames.at(-1).riderGroups.filter(rider=>
          rider.teamId==='weak'&&rider.group==='dropped').length);
        strongEnergy.push(recording.frames.at(-1).teamEnergy.find(row=>
          row.teamId==='strong').mean);
      }
      rows.push({route,teams,strongLevel,captainIndex,hard,
        gaps,captainGaps,weakDropped,strongEnergy});
    }
console.log(JSON.stringify({probe:'varied-rider bunch tempo',rows},null,2));
