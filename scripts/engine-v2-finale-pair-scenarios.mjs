// Offline sensitivity probe for the uncalibrated two-worker finale. These are
// fictional riders and imposed starting gaps, not observed race outcomes.
import {buildKilometreRoute} from '../lib/engine/v2/route.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {buildFinaleWorkerPlan} from '../lib/engine/v2/finale-worker.mjs';
import {simulateFinalePair,validateFinalePair} from
  '../lib/engine/v2/finale-pair.mjs';

function team(id,skill,effort,chase){
  const base=typeof skill==='number'?skill:skill.base;
  const overrides=typeof skill==='number'?{}:Object.fromEntries(
    Object.entries(skill).filter(([key])=>key!=='base'));
  const riders=Array.from({length:8},(_,index)=>({id:`${id}-${index}`,
    flat:base,hills:base,mountain:base,timetrial:base,
    strength:base,endurance:base,form:50,fatigue:0,...overrides}));
  return {id,riders,orders:normalizeOrders({captainId:riders[0].id,
    baseline:{effort,chase}},{riderIds:riders.map(rider=>rider.id),distanceKm:300})};
}
const routes={
  flat:buildKilometreRoute({distance_km:300,
    profile_points:[[0,100],[300,100]]},{seed:'pair-probe'}),
  uphill:buildKilometreRoute({distance_km:300,
    profile_points:[[0,100],[295,100],[300,350]]},{seed:'pair-probe'}),
};
const specialist={base:65,mountain:90,hills:85,timetrial:60,
  strength:60,endurance:70};
const flatChaser={base:75,flat:85,mountain:50,strength:80,endurance:75};
const situations=[
  {name:'strong chaser of a small gap',route:'flat',frontSkill:65,
    chaseSkill:85,frontEnergy:35,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'hard',chase:'all',initialGapSeconds:4},
  {name:'strong solo rider against selective chase',route:'flat',frontSkill:90,
    chaseSkill:60,frontEnergy:35,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'steady',chase:'selective',initialGapSeconds:4},
  {name:'fresh solo rider against equal chase',route:'flat',frontSkill:75,
    chaseSkill:75,frontEnergy:35,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'steady',chase:'selective',initialGapSeconds:4},
  {name:'low-energy solo rider against equal chase',route:'flat',frontSkill:75,
    chaseSkill:75,frontEnergy:12,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'steady',chase:'selective',initialGapSeconds:4},
  {name:'climbing specialist on flat finale',route:'flat',frontSkill:specialist,
    chaseSkill:flatChaser,frontEnergy:35,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'steady',chase:'selective',initialGapSeconds:4},
  {name:'same riders on uphill finale',route:'uphill',frontSkill:specialist,
    chaseSkill:flatChaser,frontEnergy:35,chaseEnergy:35,frontEffort:'steady',
    chaseEffort:'steady',chase:'selective',initialGapSeconds:4},
];

const report=situations.map(situation=>{
  const route=routes[situation.route];
  const frontTeam=team('front',situation.frontSkill,situation.frontEffort,'ignore');
  const rearTeam=team('rear',situation.chaseSkill,situation.chaseEffort,situation.chase);
  const input={route,initialGapSeconds:situation.initialGapSeconds,
    front:buildFinaleWorkerPlan({route,team:frontTeam,
      riderId:frontTeam.riders[0].id,energy:situation.frontEnergy,role:'front'}),
    rear:buildFinaleWorkerPlan({route,team:rearTeam,
      riderId:rearTeam.riders[1].id,energy:situation.chaseEnergy,role:'chase'})};
  const recording=simulateFinalePair(input);
  validateFinalePair(input,recording);
  return {name:situation.name,route:situation.route,
    startingGapSeconds:situation.initialGapSeconds,
    firstFrontKph:+input.front.steps[0].speedKph.toFixed(2),
    firstChaseKph:+input.rear.steps[0].speedKph.toFixed(2),
    outcome:recording.outcome,finalGapSeconds:+recording.finishGapSeconds.toFixed(2),
    recordedSlices:recording.frames.length,
    frontEnergySpent:+(situation.frontEnergy-recording.frames.at(-1).frontEnergy).toFixed(2),
    chaseEnergySpent:+(situation.chaseEnergy-recording.frames.at(-1).rearEnergy).toFixed(2)};
});
console.log(JSON.stringify({description:'fictional, uncalibrated 300 km routes with imposed energy at 5 km to go',
  situations:report},null,2));
