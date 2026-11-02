// Read-only search for a paid-front pursuit decision window. It reports
// source-derived gaps and perceived actions without moving road groups.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {decidePhysicalFrontThreatV1} from
  '../lib/engine/v2/physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseKmV1} from
  '../lib/engine/v2/physical-perceived-chase-km-v1.mjs';
import {replayPhysicalPerceivedChaseRaceV1,
  validatePhysicalPerceivedChaseRaceV1} from
  '../lib/engine/v2/physical-perceived-chase-race-replay-v1.mjs';
import {catchPhysicalPerceivedChaseV1} from
  '../lib/engine/v2/physical-perceived-chase-contact-v1.mjs';
import {slidePerceivedChaseCaughtFrontV1} from
  '../lib/engine/v2/physical-perceived-chase-slide-v1.mjs';
import {replayPhysicalPerceivedChaseSlideRaceV1,
  validatePhysicalPerceivedChaseSlideRaceV1} from
  '../lib/engine/v2/physical-perceived-chase-slide-race-v1.mjs';
import {riderKilometreEffect} from
  '../lib/engine/v2/physiology.mjs';
import {TUNING} from '../lib/engine/v2/tuning.mjs';

const route=Array.from({length:20},(_,index)=>({km:index+1,
  terrain:'flat',gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=(fatigue=20)=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>
      [skill,96]))}));
  return {id,riders,
    energy:Object.fromEntries(riders.map(row=>[
      row.id,100-fatigue*.4])),
    orders:{captainId:riders[0].id,
      helperIds:riders.slice(2).map(row=>row.id),
      baseline:{effort:'steady',attack:'none',chase:'ignore',
        ...(id==='control'?{frontWork:'rotate',
          frontWorkRiderId:'control-2'}:{})},phases:[]}};
});

function choice({attackerSkill,observerSkill,choiceKm,
  frontConserveAtKm=null,distanceKm=20,
  stopChaseAtKm=null,settleFinish=false,
  fatigue=20,roadVariant='flat',attackKm=2,
  rotateLongLeaders=false}){
  const road=Array.from({length:distanceKm},(_,index)=>({
    ...route[0],km:index+1,
    ...(index+1>=14&&index+1<=18&&
      roadVariant==='hill_mid'?{
      terrain:'hill',gradientPct:4}:{}),
    ...(index+1>=14&&index+1<=18&&
      roadVariant==='climb_mid'?{
      terrain:'climb',gradientPct:6}:{}),
    ...(index+1>=14&&index+1<=18&&
      roadVariant==='wind_mid'?{
      exposed:true,weather:{temperatureC:16,
        windKph:20,rainMm:0}}:{})}));
  const teams=field(fatigue);
  for(const skill of SPORTING_SKILLS){
    teams[2].riders[2][skill]=attackerSkill;
    for(const rider of teams[1].riders)
      rider[skill]=observerSkill;
    if(frontConserveAtKm!==null)
      for(const rider of teams[2].riders)
        if(rider.id!=='other-2')rider[skill]=100;
  }
  teams[2].orders.phases=[{atKm:attackKm-1,
    attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  if(frontConserveAtKm!==null)
    teams[2].orders.phases.push({atKm:frontConserveAtKm,
      effort:'conserve'});
  teams[0].orders.phases=[{atKm:choiceKm-1,
    frontWork:'sit_in'}];
  if(rotateLongLeaders){
    const rotations=[];
    for(let atKm=5;atKm<choiceKm-1;atKm+=10)
      rotations.push({atKm,
        frontWork:'rotate',
        frontWorkRiderId:`control-${2+
          Math.floor(atKm/10)%6}`});
    teams[0].orders.phases=[...rotations,
      ...teams[0].orders.phases];
  }
  teams[1].orders.phases=[{atKm:choiceKm-1,
    chase:'selective',frontWork:'rotate',
    frontWorkRiderId:'sprint-2'}];
  if(stopChaseAtKm!==null)
    teams[1].orders.phases.push({atKm:stopChaseAtKm,
      chase:'ignore'});
  if(rotateLongLeaders)
    for(let atKm=stopChaseAtKm??choiceKm+10;
      atKm<distanceKm;atKm+=10)
      if(atKm!==stopChaseAtKm)
        teams[1].orders.phases.push({atKm,
          frontWorkRiderId:`sprint-${2+
            Math.floor(atKm/10)%6}`});
  const keypoints=[{km:1},{km:choiceKm-1},
    {km:attackKm-1},
    ...(stopChaseAtKm===null?[]:[{km:stopChaseAtKm}])];
  for(const team of teams)team.orders=normalizeOrders(team.orders,{
    riderIds:team.riders.map(rider=>rider.id),
    distanceKm,keypoints,
    allowFrontWork:true,allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm,keypoints,
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':
        team.id==='other'?'break_stage':'none',
      captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres:road,commitment,
    raceSeed:'same-threat-window-seed'};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,
    attackKm,choiceKm,observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  const recording=decidePhysicalFrontThreatV1(input);
  const action=recording.choice.choice.assessments[0].action;
  let paidGapChangeSeconds;
  let chaseRace;
  if(['commit_now','commit_and_request_help'].includes(action)){
    const paid=advancePhysicalPerceivedChaseKmV1(input);
    paidGapChangeSeconds=+(paid.gapSecondsToBunch-
      recording.observedGapSeconds).toFixed(3);
    try{
      const raceInput={...input,throughKm:distanceKm};
      const race=replayPhysicalPerceivedChaseRaceV1(raceInput);
      validatePhysicalPerceivedChaseRaceV1(raceInput,race);
      chaseRace={status:'front_finish',
        riderKilometres:race.kilometres.reduce((sum,row)=>
          sum+row.riderStates.length,0),
        finishRiders:Object.keys(
          race.observedFinishSecondsByRider).length,
        finishGapSeconds:+race.sources.chase
          .gapSecondsToBunch.toFixed(3)};
    }catch(error){
      chaseRace={status:'refused',reason:error.message};
      if(/Later pursuit needs paid contact road/.test(
        error.message)){
        for(let catchKm=choiceKm+1;catchKm<=distanceKm;
          catchKm++){
          try{
            const contact=catchPhysicalPerceivedChaseV1({
              ...input,catchKm});
            const frontRider=teams.flatMap(team=>team.riders)
              .find(rider=>rider.id===contact.contact.riderId);
            const segment=startInput.routeKilometres[catchKm-1];
            const holdAbility=riderKilometreEffect(frontRider,
              segment,{phase:'cruise',
                energy:contact.frontPartial.energyAtContact,
                exposed:segment.exposed}).ability+
              (TUNING.effortPressure[
                contact.frontDecision.teamOrderEffort]-1)*20+
              TUNING.breakaway.bunchDraftAdvantage;
            const leaderAbility=contact.bunchStep.riders.find(
              row=>row.riderId===contact.bunchStep.leaderRiderId)
              .holdAbility;
            const slide=slidePerceivedChaseCaughtFrontV1({
              ...input,catchKm,catchRecord:contact});
            chaseRace={status:'paid_contact',catchKm,
              contactAtM:+contact.contact.atDistanceM.toFixed(1),
              holdMargin:+(holdAbility-leaderAbility).toFixed(3),
              slideGapSeconds:+slide.gapSecondsToBunch.toFixed(3),
              remainingKmUnsettled:true};
            if(settleFinish){
              const finishInput={...input,catchKm,
                throughKm:distanceKm};
              const finish=replayPhysicalPerceivedChaseSlideRaceV1(
                finishInput);
              validatePhysicalPerceivedChaseSlideRaceV1(
                finishInput,finish);
              chaseRace={...chaseRace,
                status:'paid_contact_finish',
                remainingKmUnsettled:false,
                riderKilometres:finish.kilometres.reduce(
                  (sum,row)=>sum+row.riderStates.length,0),
                finishRiders:Object.keys(
                  finish.observedFinishSecondsByRider).length,
                minFinishEnergy:+Math.min(...finish.kilometres
                  .at(-1).riderStates.map(row=>row.energyAfter))
                  .toFixed(3),
                distinctPaidLeaders:new Set(finish.kilometres
                  .flatMap(row=>row.riderStates)
                  .filter(row=>row.decisions.some(decision=>
                    ['pull','chase'].includes(decision.choice)))
                  .map(row=>row.riderId)).size};
            }
            break;
          }catch{continue;}
        }
      }
    }
  }
  return {attackerSkill,observerSkill,choiceKm,
    ...(attackKm===2?{}:{attackKm}),
    ...(rotateLongLeaders?{rotateLongLeaders:true}:{}),
    ...(fatigue===20?{}:{fatigue}),
    ...(roadVariant==='flat'?{}:{roadVariant}),
    ...(distanceKm===20?{}:{distanceKm}),
    ...(stopChaseAtKm===null?{}:{stopChaseAtKm}),
    ...(settleFinish?{settleFinish:true}:{}),
    ...(frontConserveAtKm===null?{}:{frontConserveAtKm}),
    gapSeconds:+recording.observedGapSeconds.toFixed(3),
    action,
    headroomSeconds:+recording.choice.choice.assessments[0]
      .nominatedHeadroomSeconds.toFixed(3),
    estimatedGapChangeSeconds:recording.paceEstimate
      .estimatedGapChangeSeconds,
    ...(paidGapChangeSeconds===undefined?{}:{
      paidGapChangeSeconds,chaseRace})};
}

const results=[];
for(const attackerSkill of [94,95,96,97])
  for(const observerSkill of [95,96,97,98,99,100])
    for(let choiceKm=4;choiceKm<=19;choiceKm++){
      try{results.push(choice({attackerSkill,observerSkill,
        choiceKm}));}
      catch(error){results.push({attackerSkill,observerSkill,
        choiceKm,refused:error.message});}
    }
const actionCounts=Object.fromEntries([...new Set(results.map(row=>
  row.action??'refused'))].map(action=>[action,results.filter(row=>
    (row.action??'refused')===action).length]));
const commitWindows=results.filter(row=>
  ['commit_now','commit_and_request_help'].includes(row.action));
const frontEffortProbe=[
  {attackerSkill:96,observerSkill:99,choiceKm:8},
  {attackerSkill:96,observerSkill:100,choiceKm:8},
  {attackerSkill:96,observerSkill:100,choiceKm:9},
  {attackerSkill:97,observerSkill:98,choiceKm:5},
].flatMap(variant=>[5,10,15].map(frontConserveAtKm=>{
  try{return choice({...variant,frontConserveAtKm});}
  catch(error){return {...variant,frontConserveAtKm,
    refused:error.message};}
}));
const finishWitness=choice({attackerSkill:96,
  observerSkill:98,choiceKm:13,
  frontConserveAtKm:5,distanceKm:25,
  stopChaseAtKm:20,settleFinish:true});
const calibration=process.argv.includes('--calibration')?
  [
    {attackerSkill:94,observerSkill:97,choiceKm:13,
      frontConserveAtKm:10},
    {attackerSkill:95,observerSkill:100,choiceKm:13,
      frontConserveAtKm:10},
    {attackerSkill:96,observerSkill:98,choiceKm:13,
      frontConserveAtKm:5},
    {attackerSkill:97,observerSkill:99,choiceKm:9,
      frontConserveAtKm:5},
    {attackerSkill:97,observerSkill:100,choiceKm:13,
      frontConserveAtKm:5},
  ].flatMap(variant=>[10,20,40].flatMap(fatigue=>
    ['flat','hill_mid','climb_mid','wind_mid'].map(
      roadVariant=>{
        const input={...variant,fatigue,roadVariant,
          distanceKm:25,stopChaseAtKm:20,
          settleFinish:true};
        try{return choice(input);}
        catch(error){return {...input,refused:error.message};}
      }))):undefined;
const longCalibration=process.argv.includes('--long-calibration')?
  [80,160,260].flatMap(distanceKm=>
    [94,95,96,97].flatMap(attackerSkill=>
      [97,98,99,100].map(observerSkill=>{
      const input={attackerSkill,observerSkill,
        choiceKm:distanceKm-12,
        attackKm:distanceKm-20,
        frontConserveAtKm:distanceKm-15,
        distanceKm,stopChaseAtKm:distanceKm-5,
        rotateLongLeaders:true,settleFinish:true};
      try{return choice(input);}
      catch(error){return {...input,refused:error.message};}
    }))):undefined;
if(process.argv.includes('--assert')){
  assert.equal(results.length,384);
  assert.equal(actionCounts.refused??0,0);
  const paidContacts=frontEffortProbe.filter(row=>
    row.chaseRace?.status==='paid_contact');
  assert.equal(paidContacts.length,2);
  assert.deepEqual(paidContacts.map(row=>row.chaseRace.catchKm),
    [19,16]);
  assert.ok(paidContacts.every(row=>
    row.chaseRace.holdMargin<0&&
    row.chaseRace.slideGapSeconds>0));
  assert.equal(finishWitness.action,'commit_now');
  assert.equal(finishWitness.chaseRace?.status,
    'paid_contact_finish');
  assert.equal(finishWitness.chaseRace?.catchKm,16);
  assert.equal(finishWitness.chaseRace?.riderKilometres,600);
  assert.equal(finishWitness.chaseRace?.finishRiders,24);
  assert.equal(actionCounts.commit_now,3);
  assert.equal(commitWindows.length,3);
  assert.ok(commitWindows.every(row=>
    Number.isFinite(row.paidGapChangeSeconds)&&
    Math.abs(row.estimatedGapChangeSeconds-
      row.paidGapChangeSeconds)<.1));
  assert.ok(commitWindows.every(row=>
    row.chaseRace.status==='front_finish'&&
    row.chaseRace.riderKilometres===480&&
    row.chaseRace.finishRiders===24));
  assert.ok(actionCounts.watch>0&&
    actionCounts.capacity_shortfall>0);
  if(calibration!==undefined){
    assert.equal(calibration.length,60);
    assert.ok(calibration.every(row=>!row.refused));
    const finishes=calibration.filter(row=>
      row.chaseRace?.status==='paid_contact_finish');
    assert.equal(finishes.length,15);
    assert.ok(finishes.every(row=>
      row.chaseRace.riderKilometres===600&&
      row.chaseRace.finishRiders===24&&
      row.chaseRace.holdMargin<0&&
      row.chaseRace.slideGapSeconds>0));
    assert.ok(finishes.some(row=>row.roadVariant==='hill_mid'));
    assert.ok(finishes.some(row=>row.roadVariant==='wind_mid'));
    assert.ok(finishes.some(row=>row.fatigue===40));
  }
  if(longCalibration!==undefined){
    assert.equal(longCalibration.length,48);
    assert.ok(longCalibration.every(row=>!row.refused));
    const finishes=longCalibration.filter(row=>
      row.chaseRace?.status==='paid_contact_finish');
    assert.deepEqual(finishes.map(row=>row.distanceKm),
      [160,260]);
    assert.ok(finishes.every(row=>
      row.chaseRace.riderKilometres===
        row.distanceKm*24&&
      row.chaseRace.finishRiders===24&&
      row.chaseRace.minFinishEnergy>=0&&
      row.chaseRace.distinctPaidLeaders>=7));
    assert.equal(longCalibration.filter(row=>
      row.action==='watch').length,18);
    assert.equal(longCalibration.filter(row=>
      row.action==='capacity_shortfall').length,28);
  }
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-threat-window-seed',actionCounts,
  commitWindows,frontEffortProbe,finishWitness,
  ...(calibration===undefined?{}:{calibration}),
  ...(longCalibration===undefined?{}:{longCalibration}),
  ...(process.argv.includes('--verbose')?{results}:{})},
null,2)+'\n');
