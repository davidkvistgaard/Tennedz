// Offline three-stage condition diagnostic. Provisional lab times are used only
// to exercise the accounting path; they are not official event classification.
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {createStageHandoff} from '../lib/engine/v2/stage-race.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>100)
  throw new Error('Usage: node scripts/engine-v2-stage-series.mjs [samples: 1-100]');
const stages=[
  {distance_km:120,profile_points:[[0,100],[120,100]],keypoints:[]},
  {distance_km:120,profile_points:[[0,100],[40,280],[80,100],[120,100]],keypoints:[]},
  {distance_km:120,profile_points:[[0,400],[50,1500],[80,700],[120,400]],keypoints:[]},
];
const strategies=['hard','steady','conserve'];
const report={samples,description:'fictional riders, three stages and explicit laboratory-only times',
  categories:{}};

function startingTeams(effort,gender){
  return ['a','b','c','d'].map((id,index)=>({id,riders:Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-${riderIndex}`,gender,flat:70,strength:70,endurance:70,
    hills:70,mountain:70,sprint:65,leadership:55,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:index===1?'aggressive':index===3?'protect':'balanced',
    ...(index===0?{baseline:{effort}}:{})}}));
}

for(const gender of ['M','F']){
  report.categories[gender]={};
  for(const effort of strategies){
    const fatigueTotals=[0,0,0],energyTotals=[0,0,0],winTotals=[0,0,0];
    for(let sample=0;sample<samples;sample++){
      const orders=startingTeams(effort,gender);
      let teams=structuredClone(orders),classification=null;
      for(const [stageIndex,stage] of stages.entries()){
        const recording=simulateTacticalTour({stage,teams,classification,
          seed:`stage-series:${sample}:${stageIndex}`});
        validateRecordedTour(recording);
        if(recording.raceCategory!==gender)
          throw new Error('Stage-series race category changed unexpectedly.');
        report.tuningVersion??=recording.tuningVersion;
        const results=recording.provisionalResults;
        const handoff=createStageHandoff({recording,stageId:`stage-${stageIndex+1}`,
          classifiedTimes:results.map(result=>({riderId:result.riderId,
            timeSeconds:result.timeSeconds}))});
        classification=handoff.classification;
        const active=handoff.condition.teams.find(team=>team.id==='a');
        const final=recording.frames.at(-1).riderGroups.filter(rider=>rider.teamId==='a');
        fatigueTotals[stageIndex]+=active.riders.reduce((sum,rider)=>sum+rider.fatigue,0)/8;
        energyTotals[stageIndex]+=final.reduce((sum,rider)=>sum+rider.energy,0)/8;
        winTotals[stageIndex]+=Number(results[0].teamId==='a');
        teams=handoff.condition.teams.map(team=>({...team,
          orders:structuredClone(orders.find(original=>original.id===team.id).orders)}));
      }
    }
    report.categories[gender][effort]={meanCarriedFatigue:fatigueTotals.map(total=>
      +(total/samples).toFixed(2)),meanFinalEnergy:energyTotals.map(total=>
      +(total/samples).toFixed(2)),stageWinRate:winTotals.map(total=>total/samples)};
  }
}
console.log(JSON.stringify(report,null,2));
