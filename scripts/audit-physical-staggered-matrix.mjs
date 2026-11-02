// Read-only same-seed stress matrix for two paid losses on later kilometres.
// Unsupported contact or finish branches are reported, never filled in.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1,
  runPhysicalStaggeredBunchLossV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {replayPhysicalStaggeredRaceV1,
  validatePhysicalStaggeredRaceV1} from
  '../lib/engine/v2/physical-staggered-race-replay-v1.mjs';
import {contactPhysicalStaggeredSolosV1} from
  '../lib/engine/v2/physical-staggered-solo-contact-v1.mjs';
import {replayPhysicalStaggeredContactRaceV1,
  validatePhysicalStaggeredContactRaceV1} from
  '../lib/engine/v2/physical-staggered-contact-race-replay-v1.mjs';

const raceSeed='same-staggered-matrix-seed';
const riderIds=['control-2','other-3'];

function source({climberMountain,fatigue,climbPct}){
  const teams=['control','sprint','other'].map(id=>{
    const riders=Array.from({length:8},(_,number)=>({
      id:`${id}-${number}`,form:50,fatigue,
      ...Object.fromEntries(SPORTING_SKILLS.map(skill=>
        [skill,96]))}));
    return {id,riders,
      energy:Object.fromEntries(riders.map(row=>
        [row.id,100-fatigue*.4])),
      orders:{captainId:riders[0].id,
        helperIds:riders.slice(2).map(row=>row.id),
        baseline:{effort:'steady',attack:'none',chase:'ignore',
          ...(id==='control'?{frontWork:'rotate',
            frontWorkRiderId:'control-2'}:{})},phases:[]}};
  });
  for(const skill of SPORTING_SKILLS)
    teams[0].riders[2][skill]=90;
  teams[2].riders[3].mountain=climberMountain;
  teams[0].orders.phases=[{atKm:5,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:5,frontWork:'rotate',
    frontWorkRiderId:'sprint-2'}];
  const routeKilometres=Array.from({length:20},(_,index)=>({
    km:index+1,terrain:index<10?'flat':'climb',
    gradientPct:index<10?0:climbPct,
    surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}}));
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm:20,keypoints:[{km:5}],
      allowFrontWork:true,allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:20,keypoints:[{km:5}],
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,raceSeed};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

function audit(parameters){
  try{
    const input=source(parameters);
    const throughKm=20;
    const staggered=runPhysicalStaggeredBunchLossV1({
      ...input,throughKm});
    if(staggered.losses.length!==2||
      staggered.losses[0].riderId!==riderIds[0]||
      staggered.losses[1].riderId!==riderIds[1])
      return {...parameters,status:'other_loss_shape',
        losses:staggered.losses.map(row=>({
          riderId:row.riderId,sourceKm:row.sourceKm}))};
    const sourceLossKm=staggered.losses.map(row=>row.sourceKm);
    try{
      const raceInput={...input,throughKm};
      const race=replayPhysicalStaggeredRaceV1(raceInput);
      validatePhysicalStaggeredRaceV1(raceInput,race);
      return {...parameters,status:'separate_finish',
        sourceLossKm,riderKilometres:race.kilometres.reduce(
          (sum,row)=>sum+row.riderStates.length,0),
        decisionRows:race.kilometres.reduce((sum,row)=>sum+
          row.riderStates.reduce((count,state)=>count+
            state.decisions.length,0),0),
        minFinishEnergy:+Math.min(...race.kilometres.at(-1)
          .riderStates.map(row=>row.energyAfter)).toFixed(3),
        finishRiders:Object.keys(
          race.observedFinishSecondsByRider).length};
    }catch(error){
      if(!/paid contact road/.test(error.message))
        throw error;
    }
    const contacts=[];
    let lastError='';
    for(let contactKm=Math.max(...sourceLossKm)+1;
      contactKm<throughKm;contactKm++){
      try{contacts.push({contactKm,
        contact:contactPhysicalStaggeredSolosV1({
          ...input,staggered,riderIds,contactKm})});}
      catch(error){lastError=error.message;}
    }
    if(contacts.length!==1)
      return {...parameters,status:'contact_unresolved',
        sourceLossKm,contactCandidates:contacts.length,
        lastError};
    const {contactKm,contact}=contacts[0];
    const raceInput={...input,riderIds,contactKm,throughKm};
    const race=replayPhysicalStaggeredContactRaceV1(raceInput);
    validatePhysicalStaggeredContactRaceV1(raceInput,race);
    return {...parameters,status:'rear_finish',sourceLossKm,
      contactKm,contactAtM:+contact.contactAtDistanceM.toFixed(1),
      riderKilometres:race.kilometres.reduce((sum,row)=>
        sum+row.riderStates.length,0),
      decisionRows:race.kilometres.reduce((sum,row)=>sum+
        row.riderStates.reduce((count,state)=>count+
          state.decisions.length,0),0),
      minFinishEnergy:+Math.min(...race.kilometres.at(-1)
        .riderStates.map(row=>row.energyAfter)).toFixed(3),
      finishRiders:Object.keys(
        race.observedFinishSecondsByRider).length};
  }catch(error){return {...parameters,status:'refused',
    reason:error.message};}
}

const results=[];
for(const climberMountain of [30,45,60,75,80])
  for(const fatigue of [10,20,40])
    for(const climbPct of [4,6])
      results.push(audit({climberMountain,fatigue,climbPct}));
const statusCounts=Object.fromEntries([...new Set(results.map(row=>
  row.status))].map(status=>[status,results.filter(row=>
    row.status===status).length]));
if(process.argv.includes('--assert')){
  assert.equal(results.length,30);
  assert.equal(statusCounts.separate_finish,12);
  assert.equal(statusCounts.rear_finish,18);
  assert.ok(results.every(row=>row.riderKilometres===480&&
    row.finishRiders===24&&row.minFinishEnergy>=0&&
    row.decisionRows===(row.status==='rear_finish'?482:480)));
}
process.stdout.write(JSON.stringify({version:1,raceSeed,
  statusCounts,results},null,2)+'\n');
