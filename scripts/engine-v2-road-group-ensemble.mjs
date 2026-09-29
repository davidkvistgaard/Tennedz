// Offline, reproducible stress cases for staggered groups and a precommitted
// attack from a pursuing group. No account, database or production access.
import seedrandom from 'seedrandom';
import {simulateTacticalTour} from '../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../lib/engine/v2/recording.mjs';

const samples=process.argv[2]===undefined?20:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>100)
  throw new Error('Usage: node scripts/engine-v2-road-group-ensemble.mjs [samples: 1-100]');

const stage={distance_km:80,profile_points:[[0,100],[80,100]],
  keypoints:[10,20,30,40,50,60,70].map(km=>({km,kind:'SPRINT'}))};
const plans={
  a:{baselineAttack:'selective',phases:[{atKm:10,attack:'none'}]},
  b:{baselineAttack:'none',phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
    {atKm:30,attack:'none',breakAttackRiderId:'b-0'}]},
  c:{baselineAttack:'none',phases:[{atKm:20,attack:'selective',attackRiderId:'c-0'},
    {atKm:30,attack:'none'}]},
  d:{baselineAttack:'none',phases:[{atKm:40,attack:'selective',attackRiderId:'d-0'},
    {atKm:50,attack:'none'}]},
  e:{baselineAttack:'none',phases:[{atKm:50,attack:'selective',attackRiderId:'e-0'},
    {atKm:60,attack:'none'}]},
  f:{baselineAttack:'none',phases:[{atKm:60,attack:'selective',attackRiderId:'f-0'},
    {atKm:70,attack:'none'}]},
};

function teamsFor(sample,gender,oneChaser,attackPattern){
  const rng=seedrandom(`road-group-cast:${sample}`);
  const attackers=Object.entries(plans).map(([id,plan])=>{
    const rating=Math.round(75+rng()*25);
    const riders=Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender,
      flat:index===0?rating:50,strength:index===0?rating:60,
      endurance:index===0?rating:60,timetrial:index===0?rating:50,
      acceleration:index===0?rating:50,sprint:50,leadership:50}));
    return {id,riders,orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
      preset:'balanced',baseline:attackPattern==='repeated'?
        {attack:'repeated',chase:'ignore',effort:'hard'}:
        {attack:plan.baselineAttack,chase:'ignore'},
      phases:attackPattern==='repeated'?[]:plan.phases}};
  });
  if(!oneChaser)return attackers;
  const riders=Array.from({length:8},(_,index)=>({id:`g-${index}`,gender,
    flat:85,strength:85,endurance:85,timetrial:80,acceleration:70,
    sprint:index===0?90:55,leadership:65}));
  return [...attackers,{id:'g',riders,orders:{captainId:'g-0',roadCaptainId:'g-1',
    preset:'protect',baseline:{attack:'none',chase:'all',effort:'hard'}}}];
}

const report={samples,scenario:'six fictional attackers: staggered moves with and without a chaser, plus repeated chaos against one chaser',
  categories:{}};
for(const gender of ['M','F']){
  report.categories[gender]={};
  for(const [scenario,oneChaser,attackPattern] of [
    ['staggered',false,'staggered'],['staggeredWithChaser',true,'staggered'],
    ['repeatedChaosWithChaser',true,'repeated']]){
    const totals={maxGroups:0,multiGroupFinishes:0,chaseSplits:0,chaseBridges:0,
      blockedByCap:0,catches:0,merges:0,frontBreakFinishes:0,chaserEnergy:0,
      breakFinishes:0,attackAttempts:0,breakAdmissions:0};
    for(let sample=0;sample<samples;sample++){
      const race=simulateTacticalTour({stage,teams:teamsFor(sample,gender,oneChaser,attackPattern),
        seed:`road-group-ensemble:${sample}`});
      validateRecordedTour(race);
      report.tuningVersion??=race.tuningVersion;
      totals.maxGroups+=Math.max(...race.frames.map(frame=>frame.roadGroups.length));
      totals.multiGroupFinishes+=Number(race.frames.at(-1).roadGroups.length>1);
      totals.frontBreakFinishes+=Number(race.frames.at(-1).roadGroups.some(group=>
        group.riderIds.includes('a-0')));
      totals.breakFinishes+=Number(race.frames.at(-1).roadGroups.length>0);
      if(oneChaser)totals.chaserEnergy+=race.frames.at(-1).teamEnergy.find(team=>
        team.teamId==='g').mean;
      for(const [index,frame] of race.frames.entries()){
        const previous=race.frames[index-1];
        const wasChasing=previous?.roadGroups.findIndex(group=>
          group.riderIds.includes(frame.splitAttack?.riderId))>0;
        totals.chaseSplits+=Number(wasChasing&&frame.splitAttack?.status==='split');
        totals.chaseBridges+=Number(wasChasing&&
          frame.splitAttack?.status==='joined_group_ahead');
        totals.blockedByCap+=frame.blockedBreakAttacks.filter(event=>
          event.reason==='road_group_limit').length;
        totals.catches+=frame.caughtBreakawayRiderIds.length;
        totals.merges+=frame.mergedRoadGroupIds.length;
        totals.attackAttempts+=frame.attackers.length;
        totals.breakAdmissions+=frame.joinedBreakawayRiderIds.length;
      }
    }
    report.categories[gender][scenario]={
      meanMaxGroups:+(totals.maxGroups/samples).toFixed(2),
      multiGroupFinishRate:totals.multiGroupFinishes/samples,
      frontBreakFinishRate:totals.frontBreakFinishes/samples,
      anyBreakFinishRate:totals.breakFinishes/samples,
      meanChaseSplits:+(totals.chaseSplits/samples).toFixed(2),
      meanChaseBridges:+(totals.chaseBridges/samples).toFixed(2),
      meanCapBlocks:+(totals.blockedByCap/samples).toFixed(2),
      meanCaughtRiders:+(totals.catches/samples).toFixed(2),
      meanGroupMerges:+(totals.merges/samples).toFixed(2),
      meanAttackAttempts:+(totals.attackAttempts/samples).toFixed(2),
      meanBreakAdmissions:+(totals.breakAdmissions/samples).toFixed(2),
      ...(oneChaser?{chaserMeanFinalEnergy:+(totals.chaserEnergy/samples).toFixed(2)}:{}),
    };
  }
}
console.log(JSON.stringify(report,null,2));
