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
import {runPhysicalStaggeredDetachedSoloV1} from
  '../lib/engine/v2/physical-staggered-detached-solo-v1.mjs';
import {replayPhysicalStaggeredContactRaceV1,
  validatePhysicalStaggeredContactRaceV1} from
  '../lib/engine/v2/physical-staggered-contact-race-replay-v1.mjs';

const raceSeed='same-staggered-matrix-seed';
const riderIds=['control-2','other-3'];

function source({climberMountain,fatigue,climbPct,
  distanceKm=20,windKph=0}){
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
  if(distanceKm>20){
    let priorTeam=teams[1];
    for(let marker=20;marker<distanceKm;marker+=5){
      const nextTeam=teams[[0,2,1][
        Math.floor((marker-20)/5)%3]];
      priorTeam.orders.phases.push({atKm:marker,
        frontWork:'sit_in'});
      nextTeam.orders.phases.push({atKm:marker,
        frontWork:'rotate',
        frontWorkRiderId:nextTeam.id+'-'+(
          nextTeam.id==='control'?3:
            nextTeam.id==='other'?2:3)});
      priorTeam=nextTeam;
    }
  }
  const routeKilometres=Array.from({length:distanceKm},
    (_,index)=>{
      const terrain=index<10?'flat':index<20?'climb':
        ['flat','hill','descent','flat','climb'][
          Math.floor((index-20)/10)%5];
      return {
    km:index+1,terrain,
    gradientPct:terrain==='climb'?climbPct:
      terrain==='hill'?3:terrain==='descent'?-3:0,
    surface:'road',exposed:windKph>0&&index%15<5,
    weather:{temperatureC:16,windKph,rainMm:0}};});
  for(const team of teams)
    team.orders=normalizeOrders(team.orders,{
      riderIds:team.riders.map(row=>row.id),
      distanceKm,keypoints:[{km:5}],
      allowFrontWork:true,allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,keypoints:[{km:5}],
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,raceSeed};
  return {startInput,start:startPhysicalBunchV1(startInput)};
}

function audit(parameters){
  try{
    const input=source(parameters);
    const throughKm=parameters.distanceKm??20;
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
        lastFinishSeconds:+Math.max(...Object.values(
          race.observedFinishSecondsByRider)).toFixed(1),
        finishRiders:Object.keys(
          race.observedFinishSecondsByRider).length};
    }catch(error){
      if(!/paid contact road/.test(error.message))
        throw error;
    }
    const soloRuns=riderIds.map(riderId=>
      runPhysicalStaggeredDetachedSoloV1({
        ...input,staggered,riderId,throughKm}));
    let contactKm=null;
    for(let km=Math.max(...sourceLossKm)+1;
      km<throughKm;km++){
      const prior=soloRuns.map(solo=>km-1===solo.lossKm?
        solo.completion.elapsedSeconds:solo.steps.find(row=>
          row.sourceKm===km-1).elapsedSeconds);
      const current=soloRuns.map(solo=>solo.steps.find(row=>
        row.sourceKm===km).elapsedSeconds);
      if(Math.sign(prior[0]-prior[1])!==
        Math.sign(current[0]-current[1])){
        contactKm=km;break;
      }
    }
    if(contactKm===null)
      return {...parameters,status:'contact_unresolved',
        sourceLossKm};
    const contact=contactPhysicalStaggeredSolosV1({
      ...input,staggered,riderIds,contactKm});
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
      lastFinishSeconds:+Math.max(...Object.values(
        race.observedFinishSecondsByRider)).toFixed(1),
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
const longResults=[80,160,260].flatMap(distanceKm=>
  [30,60,80].map(climberMountain=>audit({
    distanceKm,climberMountain,fatigue:20,climbPct:6})));
for(const climberMountain of [30,60,80])
  longResults.push(audit({distanceKm:260,climberMountain,
    fatigue:20,climbPct:6,windKph:20}));
if(process.argv.includes('--assert')){
  assert.equal(longResults.length,12);
  assert.ok(longResults.every(row=>
    ['rear_finish','separate_finish'].includes(row.status)&&
    row.riderKilometres===row.distanceKm*24&&
    row.finishRiders===24&&row.minFinishEnergy>=0&&
    Number.isFinite(row.lastFinishSeconds)&&
    row.decisionRows===row.riderKilometres+
      (row.status==='rear_finish'?2:0)));
  const baseline=longResults.find(row=>row.distanceKm===260&&
    row.climberMountain===60&&!row.windKph);
  const windy=longResults.find(row=>row.distanceKm===260&&
    row.climberMountain===60&&row.windKph===20);
  assert.equal(baseline.status,'rear_finish');
  assert.equal(windy.status,'separate_finish');
}
process.stdout.write(JSON.stringify({version:1,raceSeed,
  statusCounts,results,longResults},null,2)+'\n');
