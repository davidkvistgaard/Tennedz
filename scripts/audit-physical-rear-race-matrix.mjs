// Read-only calibration witness for the opt-in physical rear model.
// It never changes guided races, production data or official results.
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import assert from 'node:assert/strict';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../lib/engine/v2/rear-solo-commitment-v1.mjs';
import {startPhysicalBunchV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {contactPhysicalRearSolosV1} from
  '../lib/engine/v2/physical-rear-solo-contact-v1.mjs';
import {replayPhysicalRearRaceV1} from
  '../lib/engine/v2/physical-rear-race-replay-v1.mjs';

const route=()=>Array.from({length:20},(_,index)=>({
  km:index+1,terrain:index===0?'climb':'flat',
  gradientPct:index===0?6:0,surface:'road',
  exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=()=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:id+'-'+number,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>[skill,70]))}));
  return {id,riders,orders:{
    captainId:riders[0].id,
    helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},phases:[]}};
});

function source(scenario){
  const teams=field();
  const kilometres=route();
  const ahead=teams[2].riders[3];
  const catching=teams[2].riders[4];
  for(const skill of SPORTING_SKILLS){
    ahead[skill]=50;
    catching[skill]=50;
  }
  ahead.mountain=55;
  ahead.flat=20;
  ahead.timetrial=40;
  catching.mountain=10;
  catching.flat=90;
  catching.timetrial=65;
  scenario.modify({teams,kilometres,ahead,catching});
  for(const team of teams)team.energy=Object.fromEntries(
    team.riders.map(rider=>[rider.id,100-rider.fatigue*.4]));
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:20,intentions:teams.map(team=>({
      teamId:team.id,baseline:{
        goal:team.id==='sprint'?'sprint_finish':
          team.id==='other'?scenario.otherStake:'none',
        captainId:team.riders[0].id},phases:[]}))});
  const soloCommitments=[['other-3','conserve'],
    ['other-4','steady']].map(([riderId,effort])=>
    commitRearSoloPlanV1({riderId,distanceKm:20,
      stageNumber:1,stageCount:1,
      baseline:{goal:'finish_safely',effort}}));
  const startInput={teams,routeKilometres:kilometres,
    commitment,soloCommitments,raceSeed:'same-physical-seed'};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

const scenarios=[
  {name:'base',otherStake:'none',modify:()=>{}},
  {name:'climb_8pct',otherStake:'none',modify:({kilometres})=>{
    kilometres[0].gradientPct=8;}},
  {name:'climb_4pct',otherStake:'none',modify:({kilometres})=>{
    kilometres[0].gradientPct=4;}},
  {name:'tired_rear',otherStake:'none',modify:({ahead,catching})=>{
    ahead.fatigue=45;catching.fatigue=45;}},
  {name:'windy_flat',otherStake:'none',modify:({kilometres})=>{
    for(const row of kilometres.slice(1)){
      row.exposed=true;row.weather.windKph=25;
    }}},
  {name:'cobbled_km_2',otherStake:'none',modify:({kilometres})=>{
    kilometres[1].surface='cobbles';}},
  {name:'front_rotation',otherStake:'none',modify:({teams})=>{
    teams[0].orders.phases=[{atKm:5,frontWork:'sit_in'},
      {atKm:10,frontWork:'rotate',
        frontWorkRiderId:'control-2'}];
    teams[1].orders.phases=[{atKm:5,frontWork:'rotate',
      frontWorkRiderId:'sprint-2'},
    {atKm:10,frontWork:'sit_in'}];
    teams[1].riders[2].flat=75;}},
  {name:'summit_stake',otherStake:'summit_attack',modify:()=>{}},
];

const results=scenarios.map(scenario=>{
  try{
    const {startInput,start}=source(scenario);
    let contactKm=null;
    let lastContactError='';
    for(let km=2;km<=6;km++){
      try{
        contactPhysicalRearSolosV1({startInput,start,
          lossKm:1,contactKm:km,
          riderIds:['other-3','other-4']});
        contactKm=km;
        break;
      }catch(error){lastContactError=error.message;}
    }
    if(contactKm===null)
      throw new Error('No supported paid rear contact by km 6: '+
        lastContactError);
    const recording=replayPhysicalRearRaceV1({startInput,start,
      lossKm:1,contactKm,
      riderIds:['other-3','other-4'],throughKm:20});
    const last=recording.kilometres.at(-1);
    return {scenario:scenario.name,status:'replayed',contactKm,
      contactAtM:+recording.sources.contact.contactAtDistanceM
        .toFixed(1),
      riderKm:recording.kilometres.reduce((sum,row)=>
        sum+row.riderStates.length,0),
      decisionRows:recording.kilometres.reduce((sum,row)=>
        sum+row.riderStates.reduce((n,state)=>n+
          state.decisions.length,0),0),
      bunchFinishSeconds:+recording.observedFinishSecondsByRider[
        'control-0'].toFixed(1),
      rearFinishSeconds:+recording.observedFinishSecondsByRider[
        'other-3'].toFixed(1),
      minFinishEnergy:+Math.min(...last.riderStates.map(row=>
        row.energyAfter)).toFixed(2),
      bunchLeaders:[...new Set([
        ...recording.sources.bunch.loss.priorRoad,
        recording.sources.bunch.loss.step,
        ...recording.sources.bunch.road].map(row=>
        row.leaderRiderId))],
      otherStakeAtKm1:recording.kilometres[0].riderStates.find(
        row=>row.riderId==='other-0').decisions[0].goal};
  }catch(error){
    return {scenario:scenario.name,status:'refused',
      reason:error.message};
  }
});
if(process.argv.includes('--assert')){
  const byName=Object.fromEntries(results.map(row=>[
    row.scenario,row]));
  assert.ok(results.every(row=>row.status==='replayed'&&
    row.riderKm===480&&row.decisionRows===482));
  assert.ok(byName.climb_8pct.bunchFinishSeconds>
    byName.climb_4pct.bunchFinishSeconds);
  assert.ok(byName.tired_rear.rearFinishSeconds>
    byName.base.rearFinishSeconds);
  assert.ok(byName.windy_flat.bunchFinishSeconds>
    byName.base.bunchFinishSeconds);
  assert.notEqual(byName.cobbled_km_2.contactAtM,
    byName.base.contactAtM);
  assert.deepEqual(byName.front_rotation.bunchLeaders,
    ['control-2','sprint-2']);
  assert.equal(byName.summit_stake.otherStakeAtKm1,
    'summit_attack');
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-physical-seed',results},null,2)+'\n');
