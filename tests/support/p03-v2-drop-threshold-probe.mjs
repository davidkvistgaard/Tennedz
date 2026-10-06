// Read-only sporting sensitivity probe. Run with:
// node tests/support/p03-v2-drop-threshold-probe.mjs
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';

const skills=['sprint','flat','hills','mountain','cobbles',
  'timetrial','endurance','strength','wind'];
const routes={
  flat:[[0,0],[140,0]],
  hilly:[[0,0],[35,0],[45,600],[55,0],[90,0],[100,600],[110,0],[140,0]],
};
function team(id,level){
  const riders=Array.from({length:8},(_,index)=>({
    id:`${id}-r${index}`,gender:'M',form:70,fatigue:10,
    ...Object.fromEntries(skills.map(skill=>[skill,level])),
  }));
  return {id,riders,orders:{captainId:riders[0].id,preset:'balanced'}};
}
function field(size,strongLevel){
  const neutral=Array.from({length:size-2},(_,index)=>
    team(`neutral-${index}`,76+index%13));
  return [team('weak',80),team('strong',strongLevel),...neutral];
}
const rows=[];
for(const [route,profile_points] of Object.entries(routes)){
  for(const size of [2,3,5,15]){
    for(const strongLevel of [90,94,96,98,100]){
      const gaps=[],droppedAt70=[],finishDropped=[];
      for(const seed of ['fixed','alternate-1','alternate-2']){
        const recording=simulateTacticalTour({
          stage:{distance_km:140,profile_points,tags:[route.toUpperCase()]},
          teams:field(size,strongLevel),seed,
          weather:{temp_c:18,wind_kph:5,precipitation_mm:0},
        });
        const firstWeak=recording.provisionalResults.find(result=>result.teamId==='weak');
        const firstStrong=recording.provisionalResults.find(result=>result.teamId==='strong');
        gaps.push(+(firstWeak.timeSeconds-firstStrong.timeSeconds).toFixed(2));
        droppedAt70.push(recording.frames[69].riderGroups.filter(rider=>
          rider.teamId==='weak'&&rider.group==='dropped').length);
        finishDropped.push(recording.frames.at(-1).riderGroups.filter(rider=>
          rider.teamId==='weak'&&rider.group==='dropped').length);
      }
      rows.push({route,teams:size,strongLevel,weakSkill:80,
        gapSeconds:gaps,droppedAt70,finishDropped});
    }
  }
}
console.log(JSON.stringify({probe:'v2 drop threshold across field sizes',rows},null,2));
