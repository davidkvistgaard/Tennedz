// Read-only same-seed calibration witness for the opt-in caught-break road.
// Refused cases are reported as limits, not changed into scripted gaps.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {catchPhysicalFrontSoloV1} from
  '../lib/engine/v2/physical-front-bunch-catch-v1.mjs';
import {replayPhysicalCaughtBreakRaceV1,
  validatePhysicalCaughtBreakRaceV1} from
  '../lib/engine/v2/physical-caught-break-race-replay-v1.mjs';

const route=()=>Array.from({length:20},(_,index)=>({
  km:index+1,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=()=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>
      [skill,96]))}));
  for(const skill of SPORTING_SKILLS)
    if(id==='control')riders[3][skill]=100;
  for(const skill of SPORTING_SKILLS)
    if(id==='other')riders[2][skill]=95;
  return {id,riders,orders:{
    captainId:riders[0].id,
    helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},
    phases:id==='control'?[{atKm:5,
      frontWorkRiderId:'control-3',effort:'hard'}]:
      id==='sprint'?[{atKm:5,effort:'hard'}]:
      [{atKm:1,attack:'selective',
        attackRiderId:'other-2',effort:'hard'}]}};
});

function source(scenario){
  const teams=field();
  const kilometres=route();
  scenario.modify({teams,kilometres,
    attacker:teams[2].riders[2],
    nextLeader:teams[0].riders[3]});
  for(const team of teams){
    team.energy=Object.fromEntries(team.riders.map(rider=>
      [rider.id,100-rider.fatigue*.4]));
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(rider=>rider.id),
      distanceKm:20,keypoints:[{km:1}],
      allowFrontWork:true,allowNamedFrontWorker:true});
  }
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:20,keypoints:[{km:1}],
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='other'?
        scenario.stake:'none',
      captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres:kilometres,
    commitment,raceSeed:'same-caught-break-seed'};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

const scenarios=[
  {name:'base',stake:'break_stage',modify:()=>{}},
  {name:'attacker_more_fatigued',stake:'break_stage',
    modify:({attacker})=>{attacker.fatigue=40;}},
  {name:'attacker_fresher',stake:'break_stage',
    modify:({attacker})=>{attacker.fatigue=5;}},
  {name:'later_climb',stake:'break_stage',
    modify:({kilometres})=>{
      for(const row of kilometres.slice(6,11)){
        row.terrain='climb';row.gradientPct=5;
      }}},
  {name:'windy_flat',stake:'break_stage',
    modify:({kilometres})=>{
      for(const row of kilometres.slice(5)){
        row.exposed=true;row.weather.windKph=25;
      }}},
  {name:'cobbled_km_7',stake:'break_stage',
    modify:({kilometres})=>{
      kilometres[6].surface='cobbles';}},
  {name:'weaker_later_leader',stake:'break_stage',
    modify:({nextLeader})=>{
      for(const skill of SPORTING_SKILLS)
        nextLeader[skill]=96;}},
  {name:'summit_stake',stake:'summit_attack',modify:()=>{}},
];

const results=scenarios.map(scenario=>{
  try{
    const {startInput,start}=source(scenario);
    let catchKm=null;
    const refusals=new Map();
    for(let km=4;km<=19;km++){
      try{
        catchPhysicalFrontSoloV1({startInput,start,
          attackKm:2,catchKm:km});
        catchKm=km;break;
      }catch(error){
        refusals.set(error.message,
          (refusals.get(error.message)??0)+1);
      }
    }
    if(catchKm===null)
      throw new Error('No supported paid catch by km 19: '+
        JSON.stringify([...refusals]));
    const input={startInput,start,attackKm:2,
      catchKm,throughKm:20};
    const race=replayPhysicalCaughtBreakRaceV1(input);
    validatePhysicalCaughtBreakRaceV1(input,race);
    const last=race.kilometres.at(-1);
    return {scenario:scenario.name,status:'replayed',catchKm,
      contactAtM:+race.sources.contact.contact.atDistanceM
        .toFixed(1),
      riderKm:race.kilometres.reduce((sum,row)=>
        sum+row.riderStates.length,0),
      decisionRows:race.kilometres.reduce((sum,row)=>
        sum+row.riderStates.reduce((n,state)=>n+
          state.decisions.length,0),0),
      bunchFinishSeconds:+race.observedFinishSecondsByRider[
        'control-0'].toFixed(1),
      soloFinishSeconds:+race.observedFinishSecondsByRider[
        'other-2'].toFixed(1),
      minFinishEnergy:+Math.min(...last.riderStates.map(row=>
        row.energyAfter)).toFixed(2),
      blockedAttackAfterCatch:race.sources.bunch.road[0]
        .blockedAttacks[0].reason};
  }catch(error){
    return {scenario:scenario.name,status:'refused',
      reason:error.message};
  }
});
if(process.argv.includes('--assert')){
  const byName=Object.fromEntries(results.map(row=>[
    row.scenario,row]));
  assert.equal(byName.base.status,'replayed');
  assert.equal(byName.base.riderKm,480);
  assert.equal(byName.base.decisionRows,481);
  assert.equal(byName.base.blockedAttackAfterCatch,
    'dropped_after_paid_catch');
  assert.equal(byName.summit_stake.status,'replayed');
  assert.equal(byName.later_climb.status,'replayed');
  assert.equal(byName.windy_flat.status,'replayed');
  assert.equal(byName.cobbled_km_7.status,'replayed');
  assert.ok(byName.later_climb.bunchFinishSeconds>
    byName.base.bunchFinishSeconds);
  assert.ok(byName.windy_flat.bunchFinishSeconds>
    byName.base.bunchFinishSeconds);
  assert.notEqual(byName.cobbled_km_7.contactAtM,
    byName.base.contactAtM);
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-caught-break-seed',results},null,2)+'\n');
