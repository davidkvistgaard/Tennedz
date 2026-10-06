// Read-only paired diagnostic for energy timing on a very long flat race.
// Run: node tests/support/p03-v2-long-race-tactics-probe.mjs [distance 220–400] [seed]
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';

const distance=Number(process.argv[2]??300);
if(!Number.isInteger(distance)||distance<220||distance>400)
  throw new Error('Distance must be 220–400 km.');
const seed=process.argv[3]??'fixed';
if(!seed.trim())throw new Error('Seed must not be empty.');
const marker=Math.floor(distance*.65/10)*10;
const skills=['sprint','flat','hills','mountain','cobbles','timetrial',
  'endurance','strength','wind'];
const spread=[-8,-6,-4,-2,2,4,6,8];
function team(id,level,baseline,phases=[]){
  return {id,riders:spread.map((offset,index)=>({id:`${id}-${index}`,
    gender:'M',form:70,fatigue:10,...Object.fromEntries(skills.map(skill=>
      [skill,Math.min(100,level+offset)]))})),
  orders:{captainId:`${id}-7`,preset:'balanced',
    baseline:{effort:baseline,attack:'none',chase:'ignore'},phases}};
}
const plans=[
  {name:'steady throughout',baseline:'steady',phases:[]},
  {name:'hard throughout',baseline:'hard',phases:[]},
  {name:'hard then conserve',baseline:'hard',phases:[{atKm:marker,effort:'conserve'}]},
  {name:'conserve then hard',baseline:'conserve',phases:[{atKm:marker,effort:'hard'}]},
];
function run(plan,size){
  const teams=[team('weak',80,'steady'),team('strong',96,plan.baseline,plan.phases),
    ...Array.from({length:size-2},(_,index)=>
      team(`neutral-${index}`,76+index%13,'steady'))];
  const race=simulateTacticalTour({stage:{distance_km:distance,
    profile_points:[[0,0],[distance,0]],tags:['FLAT']},teams,seed,
  weather:{temp_c:18,wind_kph:5,precipitation_mm:0}});
  const winner=race.provisionalResults[0];
  const weak=race.provisionalResults.find(row=>row.teamId==='weak');
  const strong=race.provisionalResults.find(row=>row.teamId==='strong');
  return {plan:plan.name,teams:size,winnerTeamId:winner.teamId,
    weakMinusStrongSeconds:+(weak.timeSeconds-strong.timeSeconds).toFixed(2),
    strongMeanEnergy:race.frames.at(-1).teamEnergy.find(row=>row.teamId==='strong').mean,
    weakMeanEnergy:race.frames.at(-1).teamEnergy.find(row=>row.teamId==='weak').mean,
    strongHardWorkerKm:race.frames.filter(frame=>
      frame.hardBunchWorkTeamIds.includes('strong')).length,
    strongSteadyWorkerKm:race.frames.filter(frame=>
      frame.steadyBunchWorkTeamIds.includes('strong')).length,
    finalWeakCaptainDeficitSeconds:race.frames.at(-1).riderGroups.find(row=>
      row.id==='weak-7').deficitSeconds};
}
console.log(JSON.stringify({probe:'v2 long-race timing',distanceKm:distance,markerKm:marker,
  seed,runs:plans.flatMap(plan=>[run(plan,2),run(plan,15)])},null,2));
