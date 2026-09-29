// Reproducible, offline balance matrix with fictional riders and routes.
// Every strategy in a paired comparison uses the same roster, route and seed.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';
import {SPORTING_SKILLS} from '../lib/engine/v2/physiology.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>100)
  throw new Error('Usage: node scripts/engine-v2-ensemble.mjs [paired samples: 1–100]');

const ROUTES={
  flat:{distance_km:120,profile_points:[[0,60],[40,60],[80,75],[120,60]],
    exposed_segments:[{from_km:30,to_km:70}]},
  rolling:{distance_km:120,profile_points:[[0,90],[20,240],[40,90],[60,300],[80,110],[100,230],[120,90]],
    surface_segments:[{from_km:38,to_km:43,surface:'cobbles'}]},
  mountain:{distance_km:120,profile_points:[[0,400],[30,700],[50,1500],[70,800],[95,1900],[120,450]],
    surface_segments:[{from_km:75,to_km:80,surface:'gravel'}]},
};
const WEATHER={flat:{temp_c:18,wind_kph:22,precipitation_mm:.4},
  rolling:{temp_c:22,wind_kph:16,precipitation_mm:1},
  mountain:{temp_c:9,wind_kph:13,precipitation_mm:1.5}};
const STRATEGIES=['protect','aggressive','balanced'];
const ROLE_BONUSES=[
  {sprint:20,acceleration:16,positioning:12},
  {mountain:20,hills:13,endurance:12},
  {flat:17,timetrial:16,strength:11},
  {cobbles:17,handling:14,wind:12},
];
const clamp=value=>Math.max(15,Math.min(95,value));

function fictionalTeams(sample,gender){
  return Array.from({length:4},(_,teamIndex)=>{
    const id=`team-${teamIndex}`;
    const riders=Array.from({length:8},(_,riderIndex)=>{
      const rng=seedrandom(`v2-ensemble-rider:${sample}:${teamIndex}:${riderIndex}`);
      const role=ROLE_BONUSES[riderIndex%ROLE_BONUSES.length];
      const skills=Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,clamp(Math.round(50+(role[skill]??0)+(rng()-.5)*26))]));
      return {id:`${id}-${riderIndex}`,gender,...skills,
        leadership:clamp(Math.round(35+rng()*50)),form:Math.round(40+rng()*45),
        fatigue:Math.round(rng()*25)};
    });
    return {id,riders};
  });
}

const report={pairedSamples:samples,description:'fictional varied riders and routes; no live data',courses:{}};
for(const [course,stage] of Object.entries(ROUTES)){
  report.courses[course]={};
  for(const gender of ['M','F']){
    report.courses[course][gender]={};
    for(const strategy of STRATEGIES){
      const totals={amberWins:0,amberPodiums:0,breakWins:0,positiveFinalGaps:0,
        caughtBreaks:0,finishLineCatches:0,droppedRiders:0,amberEnergy:0,finalGaps:[]};
      for(let sample=0;sample<samples;sample++){
        const teams=fictionalTeams(sample,gender).map((team,index)=>({
          ...team,orders:{captainId:team.riders[0].id,roadCaptainId:team.riders[1].id,
            preset:index===0?strategy:STRATEGIES[index-1]},
        }));
        const rng=seedrandom(`v2-ensemble-weather:${course}:${sample}`);
        const base=WEATHER[course];
        const weather={temp_c:base.temp_c+(rng()-.5)*8,
          wind_kph:Math.max(0,base.wind_kph+(rng()-.5)*16),
          precipitation_mm:Math.max(0,base.precipitation_mm+(rng()-.5)*2)};
        const race=simulateTacticalTour({stage,teams,weather,seed:`v2-ensemble:${course}:${sample}`});
        validateRecordedTour(race);
        report.tuningVersion??=race.tuningVersion;
        const amber=race.provisionalResults.filter(rider=>rider.teamId==='team-0');
        const best=Math.min(...amber.map(rider=>rider.position));
        totals.amberWins+=Number(best===1);
        totals.amberPodiums+=Number(best<=3);
        totals.breakWins+=Number(race.provisionalResults[0].group==='breakaway');
        totals.positiveFinalGaps+=Number(race.frames.at(-1).gapSeconds>0);
        totals.finalGaps.push(race.frames.at(-1).gapSeconds);
        totals.caughtBreaks+=race.frames.filter(frame=>frame.caughtBreakawayRiderIds.length>0).length;
        totals.finishLineCatches+=Number(race.frames.at(-1).finishLineCatch);
        totals.droppedRiders+=race.provisionalResults.filter(rider=>rider.group==='dropped').length;
        totals.amberEnergy+=amber.reduce((sum,rider)=>sum+rider.energy,0)/amber.length;
      }
      const sortedGaps=[...totals.finalGaps].sort((a,b)=>a-b);
      report.courses[course][gender][strategy]={
        amberWinRate:totals.amberWins/samples,
        amberPodiumRate:totals.amberPodiums/samples,
        breakWinRate:totals.breakWins/samples,
        finalGapRate:totals.positiveFinalGaps/samples,
        medianFinalGapSeconds:sortedGaps[Math.floor((samples-1)/2)],
        p90FinalGapSeconds:sortedGaps[Math.ceil(samples*.9)-1],
        meanCatches:+(totals.caughtBreaks/samples).toFixed(2),
        finishLineCatchRate:totals.finishLineCatches/samples,
        meanDroppedRiders:+(totals.droppedRiders/samples).toFixed(2),
        amberMeanEnergy:+(totals.amberEnergy/samples).toFixed(2),
      };
    }
  }
}
console.log(JSON.stringify(report,null,2));
