// Offline three-stage condition diagnostic. Provisional lab times are used only
// to exercise the accounting path; they are not official event classification.
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {createStageHandoff} from '../lib/engine/v2/stage-race.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';

const samples=process.argv[2]===undefined?10:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>100)
  throw new Error('Usage: node scripts/engine-v2-stage-series.mjs [samples: 1-100]');
const opposition=process.argv[3]??'fixed';
if(!['fixed','late_hard'].includes(opposition))
  throw new Error('Opposition must be fixed or late_hard.');
const roster=process.argv[4]??'uniform';
if(!['uniform','varied'].includes(roster))
  throw new Error('Roster must be uniform or varied.');
const stages=[
  {distance_km:120,profile_points:[[0,100],[120,100]],keypoints:[]},
  {distance_km:120,profile_points:[[0,100],[40,280],[80,100],[120,100]],keypoints:[]},
  {distance_km:120,profile_points:[[0,400],[50,1500],[80,700],[120,400]],keypoints:[]},
];
const strategies=['hard','steady','conserve','late_hard'];
const report={samples,opposition,roster,
  description:'fictional riders, three stages and explicit laboratory-only times',
  categories:{}};

function startingTeams(effort,gender,sample){
  const skill=(base,teamIndex,riderIndex,salt)=>roster==='uniform'?base:
    base+(sample*17+teamIndex*11+riderIndex*7+salt*13)%31-15;
  return ['a','b','c','d'].map((id,index)=>({id,riders:Array.from({length:8},(_,riderIndex)=>({
    id:`${id}-${riderIndex}`,gender,
    flat:skill(70,index,riderIndex,0),strength:skill(70,index,riderIndex,1),
    endurance:skill(70,index,riderIndex,2),hills:skill(70,index,riderIndex,3),
    mountain:skill(70,index,riderIndex,4),sprint:skill(65,index,riderIndex,5),
    leadership:skill(55,index,riderIndex,6),
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:index===1?'aggressive':index===3?'protect':'balanced',
    ...(index===0?{baseline:{effort:effort==='late_hard'?'conserve':effort},
      ...(effort==='late_hard'?{phases:[{atKm:110,effort:'hard'}]}:{})}:
      opposition==='late_hard'?{baseline:{effort:'conserve'},
        phases:[{atKm:110,effort:'hard'}]}:{})}}));
}

for(const gender of ['M','F']){
  report.categories[gender]={};
  for(const effort of strategies){
    const fatigueTotals=[0,0,0],energyTotals=[0,0,0],winTotals=[0,0,0];
    for(let sample=0;sample<samples;sample++){
      const orders=startingTeams(effort,gender,sample);
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
