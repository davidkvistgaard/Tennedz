// Read-only search for a paid-front pursuit decision window. It reports
// source-derived gaps and perceived actions without moving road groups.
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../lib/engine/v2/team-chase-stake-v1.mjs';
import {startPhysicalBunchV1,
  validatePhysicalBunchAfterCaughtSlideLossKmV1} from
  '../lib/engine/v2/physical-start-bunch-v1.mjs';
import {validatePhysicalPostCatchLossKmV1} from
  '../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
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
import {estimatePhysicalObserverPursuitHorizonV1,
  validatePhysicalObserverPursuitHorizonV1} from
  '../lib/engine/v2/physical-observer-pursuit-horizon-v1.mjs';
import {runPhysicalManagerChaseCounterfactualV1,
  validatePhysicalManagerChaseCounterfactualV1} from
  '../lib/engine/v2/physical-manager-chase-counterfactual-v1.mjs';
import {completePhysicalManagerChaseContactKmV1,
  validatePhysicalManagerChaseContactKmV1} from
  '../lib/engine/v2/physical-manager-chase-contact-km-v1.mjs';
import {replayPhysicalManagerChaseRaceV1,
  validatePhysicalManagerChaseRaceV1} from
  '../lib/engine/v2/physical-manager-chase-race-replay-v1.mjs';
import {replayPhysicalManagerPostcatchLossV1,
  validatePhysicalManagerPostcatchLossV1,
  advancePhysicalManagerPostcatchBunchKmV1,
  validatePhysicalManagerPostcatchBunchKmV1} from
  '../lib/engine/v2/physical-manager-postcatch-loss-v1.mjs';
import {advancePhysicalManagerPostcatchSoloPairV1,
  validatePhysicalManagerPostcatchSoloPairV1,
  replayPhysicalManagerSeparatedRoadV1,
  validatePhysicalManagerSeparatedRoadV1} from
  '../lib/engine/v2/physical-manager-postcatch-solo-pair-v1.mjs';
import {validatePhysicalPostcatchSplitContactV1} from
  '../lib/engine/v2/physical-postcatch-split-contact-v1.mjs';
import {finishPhysicalPostcatchContactKmV1,
  validatePhysicalPostcatchContactKmV1} from
  '../lib/engine/v2/physical-postcatch-contact-road-v1.mjs';
import {replayPhysicalManagerPostcatchContactV1,
  validatePhysicalManagerPostcatchContactV1} from
  '../lib/engine/v2/physical-manager-postcatch-contact-v1.mjs';
import {replayPhysicalManagerPostcatchGroupV1,
  validatePhysicalManagerPostcatchGroupV1} from
  '../lib/engine/v2/physical-manager-postcatch-group-v1.mjs';
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
  roleVariant='uniform',
  terrainStartOverride=null,
  emergencyWorkerPlan=true,
  roleStrengthOffset=0,
  rotateLongLeaders=false,assessHorizon=false,
  assessCounterfactual=false}){
  const terrainStartKm=terrainStartOverride??
    (distanceKm<=25?14:distanceKm-12);
  const terrainEndKm=terrainStartOverride===null?
    distanceKm<=25?18:distanceKm-7:
    terrainStartOverride+5;
  const road=Array.from({length:distanceKm},(_,index)=>({
    ...route[0],km:index+1,
    ...(index+1>=terrainStartKm&&
      index+1<=terrainEndKm&&
      roadVariant==='hill_mid'?{
      terrain:'hill',gradientPct:4}:{}),
    ...(index+1>=terrainStartKm&&
      index+1<=terrainEndKm&&
      roadVariant==='climb_mid'?{
      terrain:'climb',gradientPct:6}:{}),
    ...(index+1>=terrainStartKm&&
      index+1<=terrainEndKm&&
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
  if(['mixed','closing','moderate_closing']
    .includes(roleVariant)){
    Object.assign(teams[1].riders[2],{hills:82,
      mountain:72,endurance:84,wind:80});
    Object.assign(teams[1].riders[3],{hills:99,
      mountain:99,endurance:92,wind:99});
    Object.assign(teams[2].riders[2],{hills:88,
      mountain:68,endurance:88,wind:84});
    if(roleVariant==='closing'){
      Object.assign(teams[1].riders[2],{hills:25,
        mountain:10});
      Object.assign(teams[2].riders[2],{hills:100,
        mountain:100});
    }
    if(roleVariant==='moderate_closing'){
      Object.assign(teams[1].riders[2],{hills:40,
        mountain:30});
      Object.assign(teams[2].riders[2],{
        hills:Math.max(0,Math.min(100,
          90+roleStrengthOffset)),
        mountain:Math.max(0,Math.min(100,
          85+roleStrengthOffset))});
    }
  }else if(roleVariant!=='uniform')
    throw new Error('Unknown early long-race role variant.');
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
    raceSeed:'same-threat-window-seed',
    ...(roleVariant==='moderate_closing'&&
      emergencyWorkerPlan?{
      emergencyFrontWorkers:[{version:1,teamId:'sprint',
        unavailableRiderId:'sprint-2',
        replacementRiderId:'sprint-3'}]}:{})};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,
    attackKm,choiceKm,observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  const recording=decidePhysicalFrontThreatV1(input);
  const action=recording.choice.choice.assessments[0].action;
  const horizon=assessHorizon?
    estimatePhysicalObserverPursuitHorizonV1({
      ...input,throughKm:distanceKm}):null;
  let counterfactual;
  if(assessCounterfactual){
    const paidInput={...input,throughKm:distanceKm};
    try{
      const paid=runPhysicalManagerChaseCounterfactualV1(
        paidInput);
      validatePhysicalManagerChaseCounterfactualV1(
        paidInput,paid);
      counterfactual={status:paid.contact?'paid_contact':
        paid.stoppedReason?'order_stopped':'front_ahead',
      contactKm:paid.contact?.sourceKm??null,
      contactAtM:paid.contact?
        +paid.contact.atDistanceM.toFixed(1):null,
      steps:paid.steps.length};
      if(paid.contact){
        const contactInput={...paidInput,paidProbe:paid};
        try{
          const completion=completePhysicalManagerChaseContactKmV1(
            contactInput);
          validatePhysicalManagerChaseContactKmV1(
            contactInput,completion);
          counterfactual.contactKmCompletion={status:'slide',
            fullFieldRiders:completion.riderStates.length,
            gapSeconds:+completion.gapSecondsToBunch
              .toFixed(3)};
          try{
            const race=replayPhysicalManagerChaseRaceV1(
              paidInput);
            validatePhysicalManagerChaseRaceV1(paidInput,race);
            counterfactual.finish={status:'paid_finish',
              riderKilometres:race.kilometres.reduce(
                (sum,row)=>sum+row.riderStates.length,0),
              finishRiders:Object.keys(race
                .observedFinishSecondsByRider).length,
              fastestSeconds:Math.min(...Object.values(
                race.observedFinishSecondsByRider)),
              slowestSeconds:Math.max(...Object.values(
                race.observedFinishSecondsByRider)),
              minimumEnergy:Math.min(...race.kilometres
                .flatMap(row=>row.riderStates.map(rider=>
                  rider.energyAfter)))};
          }catch(error){
            let nextBunch;
            let nextPair;
            let separatedStatus;
            let paidPostcatchContact;
            if(error.paidPostcatchContact){
              const {contactInput,contact}=
                error.paidPostcatchContact;
              assert.equal(
                validatePhysicalPostcatchSplitContactV1(
                  contactInput,contact),true);
              const forged=structuredClone(contact);
              forged.contactClockSeconds+=1;
              assert.throws(()=>
                validatePhysicalPostcatchSplitContactV1(
                  contactInput,forged),
              /differs from paid source/);
              paidPostcatchContact={
                sourceKm:contact.sourceKm,
                atDistanceM:contact.contactAtDistanceM,
                behindBunchSeconds:
                  contact.behindBunchSeconds,
                phase:contact.phase,
                riderIds:contact.riders.map(row=>
                  row.riderId),
                energySpent:contact.riders.map(row=>
                  row.energySpent)};
              const roadInput={contactInput,contact,
                leaderRiderId:contact.detachedRiderId};
              let road;
              try{
                road=finishPhysicalPostcatchContactKmV1(
                  roadInput);
              }catch(roadError){
                paidPostcatchContact.groupRoad={
                  status:'refused',reason:roadError.message};
              }
              if(road){
                assert.equal(validatePhysicalPostcatchContactKmV1(
                  roadInput,road),true);
                const forgedRoad=structuredClone(road);
                forgedRoad.riders[0].energySpent+=1;
                assert.throws(()=>
                  validatePhysicalPostcatchContactKmV1(
                    roadInput,forgedRoad),
                /differs from paid source/);
                paidPostcatchContact.groupRoad={
                  status:'paid',leaderRiderId:
                    road.leaderRiderId,
                  gapSecondsToBunch:
                    road.gapSecondsToBunch,
                  riderIds:road.riders.map(row=>
                    row.riderId),
                  energySpent:road.riders.map(row=>
                    row.energySpent)};
                const fullInput={input:paidInput,
                  leaderRiderId:road.leaderRiderId};
                const full=
                  replayPhysicalManagerPostcatchContactV1(
                    fullInput);
                assert.equal(
                  validatePhysicalManagerPostcatchContactV1(
                    fullInput,full),true);
                const forgedFull=structuredClone(full);
                forgedFull.kilometres.at(-1)
                  .riderStates[0].energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalManagerPostcatchContactV1(
                    fullInput,forgedFull),
                /differs from source/);
                paidPostcatchContact.groupRoad
                  .riderKilometres=full.kilometres.reduce(
                    (sum,row)=>sum+row.riderStates.length,0);
                paidPostcatchContact.groupRoad
                  .allRiders=full.kilometres.at(-1)
                    .riderStates.length;
                const nextInput={...fullInput,
                  throughKm:contact.sourceKm+1};
                const next=replayPhysicalManagerPostcatchGroupV1(
                  nextInput);
                assert.equal(
                  validatePhysicalManagerPostcatchGroupV1(
                    nextInput,next),true);
                const forgedNext=structuredClone(next);
                forgedNext.kilometres.at(-1)
                  .riderStates[0].energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalManagerPostcatchGroupV1(
                    nextInput,forgedNext),
                /differs from source/);
                paidPostcatchContact.groupRoad
                  .nextKilometre={
                    leaderRiderId:next.sources.later[0]
                      .leaderRiderId,
                    gapSecondsToBunch:next.sources
                      .later[0].gapSecondsToBunch,
                    riderCount:next.kilometres.at(-1)
                      .riderStates.length};
                try{
                  const finish=
                    replayPhysicalManagerPostcatchGroupV1({
                      ...fullInput,
                      throughKm:paidInput.throughKm});
                  const finishInput={...fullInput,
                    throughKm:paidInput.throughKm};
                  assert.equal(
                    validatePhysicalManagerPostcatchGroupV1(
                      finishInput,finish),true);
                  const forgedFinish=structuredClone(finish);
                  forgedFinish.kilometres.at(-1)
                    .riderStates[0].energyAfter+=1;
                  assert.throws(()=>
                    validatePhysicalManagerPostcatchGroupV1(
                      finishInput,forgedFinish),
                  /differs from source/);
                  assert.ok(finish.kilometres.every(row=>
                    row.riderStates.length===24&&
                    row.riderStates.every(rider=>
                      rider.decisions.length>0&&
                      rider.energyAfter>=0)));
                  assert.ok(finish.sources.later.every(row=>
                    row.gapSecondsToBunch>0&&
                    row.rearRows.filter(item=>
                      item.role==='leader').length===1&&
                    row.rearRows.filter(item=>
                      item.role==='sheltered').length===1));
                  paidPostcatchContact.groupRoad.finish={
                    status:'paid_finish',
                    finishRiders:Object.keys(finish
                      .observedFinishSecondsByRider)
                      .length,
                    riderKilometres:finish.kilometres.reduce(
                      (sum,row)=>sum+
                        row.riderStates.length,0),
                    distinctRearLeaders:new Set(finish
                      .sources.later.map(row=>
                        row.leaderRiderId)).size,
                    emergencyFrontKm:finish.sources.later
                      .filter(row=>row.bunch
                        .emergencyFrontWorker)
                      .map(row=>row.sourceKm),
                    finalGapSeconds:finish.sources.later
                      .at(-1).gapSecondsToBunch,
                    fastestFinishSeconds:Math.min(
                      ...Object.values(finish
                        .observedFinishSecondsByRider)),
                    slowestFinishSeconds:Math.max(
                      ...Object.values(finish
                        .observedFinishSecondsByRider)),
                    minimumEnergy:Math.min(...finish
                      .kilometres.flatMap(row=>row
                        .riderStates.map(rider=>
                          rider.energyAfter)))};
                }catch(finishError){
                  paidPostcatchContact.groupRoad.finish={
                    status:'unsettled',
                    reason:finishError.message,
                    sourceKm:finishError.sourceKm};
                }
              }
            }
            if(error.physicalLoss){
              const source=error.physicalLoss;
              const partial=replayPhysicalManagerPostcatchLossV1(
                paidInput);
              assert.equal(validatePhysicalManagerPostcatchLossV1(
                paidInput,partial),true);
              const forgedPartial=structuredClone(partial);
              forgedPartial.kilometres.at(-1).riderStates[0]
                .energyAfter+=1;
              assert.throws(()=>
                validatePhysicalManagerPostcatchLossV1(
                  paidInput,forgedPartial),
              /differs from paid source/);
              assert.equal(partial.sourceKm,source.sourceKm);
              const nextInput={input:paidInput,partial,
                segment:paidInput.startInput.routeKilometres[
                  partial.sourceKm]};
              nextBunch=advancePhysicalManagerPostcatchBunchKmV1(
                nextInput);
              assert.equal(
                validatePhysicalManagerPostcatchBunchKmV1(
                  nextInput,nextBunch),true);
              const forgedNext=structuredClone(nextBunch);
              forgedNext.step.riders[0].energyAfter+=1;
              assert.throws(()=>
                validatePhysicalManagerPostcatchBunchKmV1(
                  nextInput,forgedNext),
              /differs from replayed loss/);
              assert.equal(nextBunch.step.physicalGroup
                .riderIds.length,22);
              assert.equal(nextBunch.step.leaderRiderId===
                source.loss.splits[0].riderId,false);
              nextPair=advancePhysicalManagerPostcatchSoloPairV1({
                ...nextInput,bunch:nextBunch});
              assert.equal(
                validatePhysicalManagerPostcatchSoloPairV1({
                  ...nextInput,bunch:nextBunch},nextPair),true);
              assert.equal(nextPair.riderStates.length,24);
              assert.equal(nextPair.sources.solos.length,2);
              const forgedPair=structuredClone(nextPair);
              forgedPair.riderStates.at(-1).energyAfter+=1;
              assert.throws(()=>
                validatePhysicalManagerPostcatchSoloPairV1({
                  ...nextInput,bunch:nextBunch},forgedPair),
              /differs from paid road/);
              try{
                const separated=
                  replayPhysicalManagerSeparatedRoadV1(
                    paidInput);
                assert.equal(
                  validatePhysicalManagerSeparatedRoadV1(
                    paidInput,separated),true);
                assert.ok(separated.kilometres.every(row=>
                  row.riderStates.length===24&&
                  row.riderStates.every(rider=>
                    rider.decisions.length>0&&
                    rider.energyAfter>=0)));
                assert.ok(separated.sources.later.every(row=>
                  row.sources.solos.length===2&&
                  row.sources.solos.every(solo=>
                    solo.energySpent>0&&
                    solo.recoveryAward===0)&&
                  row.sources.bunch.step.riders.filter(
                    rider=>rider.role==='leader')
                    .length===1));
                const forgedSeparated=structuredClone(
                  separated);
                forgedSeparated.kilometres.at(-1)
                  .riderStates[0].energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalManagerSeparatedRoadV1(
                    paidInput,forgedSeparated),
                /differs from paid source/);
                separatedStatus={status:'paid_finish',
                  riderKilometres:separated.kilometres.reduce(
                    (sum,row)=>sum+row.riderStates.length,0),
                  finishRiders:Object.keys(separated
                    .observedFinishSecondsByRider).length,
                  minimumEnergy:Math.min(...separated
                    .kilometres.flatMap(row=>
                      row.riderStates.map(rider=>
                        rider.energyAfter))),
                  initialSoloGapSeconds:separated.kilometres[
                    separated.lossKm-1].riderStates.find(row=>
                    row.riderId===partial.caughtRiderId)
                    .elapsedSeconds-
                    separated.kilometres[
                      separated.lossKm-1].riderStates
                      .find(row=>row.riderId===
                        source.loss.splits[0].riderId)
                      .elapsedSeconds,
                  finishSoloGapSeconds:separated.kilometres
                    .at(-1).riderStates.find(row=>row.riderId===
                      partial.caughtRiderId).elapsedSeconds-
                    separated.kilometres.at(-1).riderStates
                      .find(row=>row.riderId===
                        source.loss.splits[0].riderId)
                      .elapsedSeconds,
                  distinctLeaders:new Set(separated
                    .sources.later.map(row=>row.sources
                      .bunch.step.leaderRiderId)).size};
              }catch(separatedError){
                separatedStatus={status:'unsettled',
                  reason:separatedError.message};
              }
              assert.equal(source.priorKilometres.length,
                source.sourceKm-1);
              assert.equal(source.lossKilometre.riderStates
                .length,24);
              assert.ok(source.lossKilometre.riderStates
                .every(row=>row.decisions.length>0&&
                  row.energyAfter>=0&&
                  row.atDistanceM===source.sourceKm*1000));
              assert.equal(
                validatePhysicalBunchAfterCaughtSlideLossKmV1(
                  source.roadInput,source.loss),true);
              for(let i=0;i<source.completions.length;i++){
                assert.equal(validatePhysicalPostCatchLossKmV1(
                  source.completionInputs[i],
                  source.completions[i]),true);
                const forged=structuredClone(
                  source.completions[i]);
                forged.energyAfter+=1;
                assert.throws(()=>
                  validatePhysicalPostCatchLossKmV1(
                    source.completionInputs[i],forged),
                /differs from source/);
              }
            }
            counterfactual.finish={
            status:'unsettled',reason:error.message,
            ...(paidPostcatchContact?{
              paidPostcatchContact}:{}),
            ...(error.physicalLoss?{
              physicalLoss:{sourceKm:error.physicalLoss
                .sourceKm,
              riderKilometresBeforeLoss:error.physicalLoss
                .priorKilometres.reduce((sum,row)=>
                  sum+row.riderStates.length,0),
              lossRiderStates:error.physicalLoss
                .lossKilometre.riderStates.length,
              caughtSoloEnergyAfter:error.physicalLoss
                .caughtSoloEnergyAfter,
              nextBunchRiders:nextBunch.step.physicalGroup
                .riderIds.length,
              nextBunchLeader:nextBunch.step.leaderRiderId,
              nextPairRiderStates:nextPair.riderStates.length,
              nextSoloEnergy:nextPair.sources.solos.map(
                row=>({riderId:row.riderId,
                  energySpent:row.energySpent,
                  energyAfter:row.energyAfter})),
              separatedStatus,
              paidSplits:error.physicalLoss.loss.splits.map(
                row=>({riderId:row.riderId,
                  atDistanceM:row.atDistanceM,
                  behindBunchM:row.behindBunchM,
                  energyBefore:error.physicalLoss.loss.riders
                    .find(rider=>rider.riderId===row.riderId)
                    .energyBefore,
                  energySpent:error.physicalLoss.loss.riders
                    .find(rider=>rider.riderId===row.riderId)
                    .energySpent,
                  energyAfter:error.physicalLoss.loss.riders
                    .find(rider=>rider.riderId===row.riderId)
                    .energyAfter})),
              completions:error.physicalLoss.completions.map(
                row=>({riderId:row.riderId,
                  endDistanceM:row.endDistanceM,
                  gapSecondsToBunch:row.gapSecondsToBunch,
                  energySpent:row.energySpent,
                  recoveryAward:row.recoveryAward,
                  energyAfter:row.energyAfter})),
              caughtSoloEndClock:error.physicalLoss
                .caughtSoloEndClock}}:{})};}
        }catch(error){
          counterfactual.contactKmCompletion={
            status:'unsettled',reason:error.message};
        }
      }
    }catch(error){counterfactual={status:'refused',
      reason:error.message};}
  }
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
              const horizonInput={...input,
                throughKm:distanceKm};
              const horizon=
                estimatePhysicalObserverPursuitHorizonV1(
                  horizonInput);
              validatePhysicalObserverPursuitHorizonV1(
                horizonInput,horizon);
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
                paidLeaderKilometres:finish.kilometres
                  .filter(row=>row.riderStates.filter(state=>
                    state.physicalGroupId==='peloton'&&
                    state.decisions.some(decision=>
                      ['pull','chase'].includes(
                        decision.choice))).length===1).length,
                allEnergyAndDecisionsSourced:finish.kilometres
                  .every(row=>row.riderStates.every(state=>
                    state.energyAfter>=0&&
                    state.decisions.length>0&&
                    state.decisions.every(decision=>
                      decision&&typeof decision.choice===
                        'string'))),
                distinctPaidLeaders:new Set(finish.kilometres
                  .flatMap(row=>row.riderStates)
                  .filter(row=>row.decisions.some(decision=>
                    ['pull','chase'].includes(decision.choice)))
                  .map(row=>row.riderId)).size,
                projectedCatchKm:horizon.predictedContact
                  ?.sourceKm??null,
                projectedCatchAtM:horizon.predictedContact?
                  +horizon.predictedContact.atDistanceM
                    .toFixed(1):null,
                projectedStopReason:horizon.stoppedReason};
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
    ...(assessHorizon?{
      horizonCatchKm:horizon.predictedContact?.sourceKm??null,
      horizonStopReason:horizon.stoppedReason}:{}),
    ...(assessCounterfactual?{counterfactual}:{}),
    ...(fatigue===20?{}:{fatigue}),
    ...(roadVariant==='flat'?{}:{roadVariant}),
    ...(roleVariant==='uniform'?{}:{roleVariant}),
    ...(terrainStartOverride===null?{}:{
      terrainStartOverride}),
    ...(emergencyWorkerPlan?{}:{
      emergencyWorkerPlan:false}),
    ...(roleStrengthOffset===0?{}:{
      roleStrengthOffset}),
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
          settleFinish:true,assessHorizon:true,
          assessCounterfactual:process.argv.includes(
            '--counterfactual')};
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
        rotateLongLeaders:true,settleFinish:true,
        assessHorizon:true,
        assessCounterfactual:process.argv.includes(
          '--counterfactual')};
      try{return choice(input);}
      catch(error){return {...input,refused:error.message};}
    }))):undefined;
const longTerrainCalibration=process.argv.includes(
  '--long-calibration')?[
  {distanceKm:160,attackerSkill:95,observerSkill:98},
  {distanceKm:260,attackerSkill:95,observerSkill:99},
].flatMap(variant=>['hill_mid','climb_mid','wind_mid']
  .map(roadVariant=>{
    const input={...variant,roadVariant,
      choiceKm:variant.distanceKm-12,
      attackKm:variant.distanceKm-20,
      frontConserveAtKm:variant.distanceKm-15,
      stopChaseAtKm:variant.distanceKm-5,
      rotateLongLeaders:true,settleFinish:true,
      assessHorizon:true,
      assessCounterfactual:process.argv.includes(
        '--counterfactual')};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  })):undefined;
const earlyLongCalibration=process.argv.includes(
  '--early-long-calibration')?[160,260].flatMap(
  distanceKm=>[
    {fatigue:20,roadVariant:'flat'},
    {fatigue:40,roadVariant:'flat'},
    ...['hill_mid','climb_mid','wind_mid'].map(
      roadVariant=>({fatigue:20,roadVariant})),
  ].map(({fatigue,roadVariant})=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue,roadVariant,rotateLongLeaders:true,
      assessHorizon:true,assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  })):undefined;
const earlyRoleCalibration=process.argv.includes(
  '--role-long-calibration')?[160,260].flatMap(
  distanceKm=>[
    ...['flat','hill_mid','climb_mid',
      'wind_mid'].map(roadVariant=>({roadVariant,
      fatigue:20})),
    {roadVariant:'flat',fatigue:40},
    {roadVariant:'climb_mid',fatigue:40},
  ].map(({roadVariant,fatigue})=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue,roadVariant,roleVariant:'mixed',
      rotateLongLeaders:true,assessHorizon:true,
      assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  })):undefined;
const closingCalibration=process.argv.includes(
  '--closing-calibration')?[160,260].map(distanceKm=>{
  const input={attackerSkill:96,observerSkill:98,
    choiceKm:11,attackKm:2,frontConserveAtKm:5,
    distanceKm,stopChaseAtKm:20,
    fatigue:20,roadVariant:'climb_mid',
    roleVariant:'closing',rotateLongLeaders:true,
    assessHorizon:true,assessCounterfactual:true};
  try{return choice(input);}
  catch(error){return {...input,refused:error.message};}
}):undefined;
const earlyTerrainCalibration=process.argv.includes(
  '--early-terrain-calibration')?[160,260].map(
  distanceKm=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue:20,roadVariant:'climb_mid',
      terrainStartOverride:30,
      roleVariant:'moderate_closing',rotateLongLeaders:true,
      assessHorizon:true,assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  }):undefined;
const earlyNoEmergency=process.argv.includes(
  '--early-no-emergency')?[160,260].map(
  distanceKm=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue:20,roadVariant:'climb_mid',
      terrainStartOverride:30,
      roleVariant:'moderate_closing',
      emergencyWorkerPlan:false,
      rotateLongLeaders:true,
      assessHorizon:true,assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  }):undefined;
const postcatchMatrix=process.argv.includes(
  '--postcatch-matrix')?[160,260].flatMap(distanceKm=>
  [0,20,40].flatMap(fatigue=>
  ['hill_mid','climb_mid'].map(roadVariant=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue,roadVariant,terrainStartOverride:30,
      roleVariant:'moderate_closing',
      rotateLongLeaders:true,assessHorizon:true,
      assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  }))):undefined;
const postcatchStrengthMatrix=process.argv.includes(
  '--postcatch-strength-matrix')?[160,260].flatMap(
  distanceKm=>[-10,10].flatMap(
  roleStrengthOffset=>
  ['hill_mid','climb_mid'].map(roadVariant=>{
    const input={attackerSkill:96,observerSkill:98,
      choiceKm:11,attackKm:2,frontConserveAtKm:5,
      distanceKm,stopChaseAtKm:20,
      fatigue:20,roadVariant,
      terrainStartOverride:30,
      roleVariant:'moderate_closing',
      roleStrengthOffset,rotateLongLeaders:true,
      assessHorizon:true,assessCounterfactual:true};
    try{return choice(input);}
    catch(error){return {...input,refused:error.message};}
  }))):undefined;
const policyCross=calibration&&longCalibration&&
  longTerrainCalibration?{
  rows:[...calibration,...longCalibration,
    ...longTerrainCalibration].length,
  projectedCatchByAction:Object.fromEntries(
    ['watch','commit_now','capacity_shortfall']
      .map(action=>[action,
        [...calibration,...longCalibration,
          ...longTerrainCalibration].filter(row=>
          row.action===action&&
          row.horizonCatchKm!==null).length])),
  shortfallWithoutProjectedCatch:[...calibration,
    ...longCalibration,...longTerrainCalibration]
    .filter(row=>row.action==='capacity_shortfall'&&
      row.horizonCatchKm===null).length}:null;
const counterfactualCross=policyCross&&
  process.argv.includes('--counterfactual')?{
  paidContactByAction:Object.fromEntries(
    ['watch','commit_now','capacity_shortfall']
      .map(action=>[action,
        [...calibration,...longCalibration,
          ...longTerrainCalibration].filter(row=>
          row.action===action&&row.counterfactual
            ?.status==='paid_contact').length])),
  orderStopped:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>
    row.counterfactual?.status==='order_stopped').length,
  fullContactKmSlides:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>
    row.counterfactual?.contactKmCompletion?.status===
      'slide'&&row.counterfactual.contactKmCompletion
      .fullFieldRiders===24&&row.counterfactual
      .contactKmCompletion.gapSeconds>0).length,
  paidFinishes:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>
    row.counterfactual?.finish?.status===
      'paid_finish').length,
  completePaidFinishes:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>{
    const finish=row.counterfactual?.finish;
    return finish?.status==='paid_finish'&&
      finish.riderKilometres===row.distanceKm*24&&
      finish.finishRiders===24&&
      finish.minimumEnergy>=0&&
      finish.fastestSeconds>0&&
      finish.slowestSeconds>=finish.fastestSeconds;
  }).length,
  unsettledFinishes:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>
    row.counterfactual?.finish?.status===
      'unsettled').length,
  sameCatchKm:[...calibration,...longCalibration,
    ...longTerrainCalibration].filter(row=>
    row.counterfactual?.status==='paid_contact'&&
    row.horizonCatchKm===row.counterfactual
      .contactKm).length,
  maxCatchKmError:Math.max(...[...calibration,
    ...longCalibration,...longTerrainCalibration]
    .filter(row=>row.counterfactual?.status===
      'paid_contact')
    .map(row=>Math.abs(row.horizonCatchKm-
      row.counterfactual.contactKm)))}:null;
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
      row.chaseRace.paidLeaderKilometres===25&&
      row.chaseRace.allEnergyAndDecisionsSourced&&
      row.chaseRace.projectedCatchKm===
        row.chaseRace.catchKm&&
      Math.abs(row.chaseRace.projectedCatchAtM-
        row.chaseRace.contactAtM)<600&&
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
      row.chaseRace.paidLeaderKilometres===
        row.distanceKm&&
      row.chaseRace.allEnergyAndDecisionsSourced&&
      row.chaseRace.projectedCatchKm===
        row.chaseRace.catchKm&&
      Math.abs(row.chaseRace.projectedCatchAtM-
        row.chaseRace.contactAtM)<15&&
      row.chaseRace.minFinishEnergy>=0&&
      row.chaseRace.distinctPaidLeaders>=7));
    assert.equal(longCalibration.filter(row=>
      row.action==='watch').length,18);
    assert.equal(longCalibration.filter(row=>
      row.action==='capacity_shortfall').length,28);
    assert.equal(longTerrainCalibration.length,6);
    assert.ok(longTerrainCalibration.every(row=>!row.refused));
    assert.deepEqual(longTerrainCalibration.filter(row=>
      row.chaseRace?.status==='paid_contact_finish')
      .map(row=>[row.distanceKm,row.roadVariant]),
    [[260,'wind_mid']]);
    const calm=finishes.find(row=>row.distanceKm===260);
    const wind=longTerrainCalibration.find(row=>
      row.distanceKm===260&&row.roadVariant==='wind_mid');
    assert.equal(wind.chaseRace.paidLeaderKilometres,260);
    assert.equal(wind.chaseRace.allEnergyAndDecisionsSourced,
      true);
    assert.equal(wind.chaseRace.projectedCatchKm,
      wind.chaseRace.catchKm);
    assert.equal(wind.chaseRace.contactAtM,
      calm.chaseRace.contactAtM);
    assert.equal(wind.chaseRace.minFinishEnergy,
      calm.chaseRace.minFinishEnergy);
  }
  if(policyCross!==null){
    assert.equal(policyCross.rows,114);
    assert.deepEqual(policyCross.projectedCatchByAction,{
      watch:59,commit_now:18,capacity_shortfall:15});
    assert.equal(policyCross.shortfallWithoutProjectedCatch,22);
  }
  if(counterfactualCross!==null){
    assert.deepEqual(counterfactualCross
      .paidContactByAction,{watch:59,commit_now:18,
        capacity_shortfall:15});
    assert.equal(counterfactualCross.orderStopped,22);
    assert.equal(counterfactualCross.fullContactKmSlides,92);
    assert.equal(counterfactualCross.paidFinishes,92);
    assert.equal(counterfactualCross.completePaidFinishes,92);
    assert.equal(counterfactualCross.unsettledFinishes,0);
    assert.ok(counterfactualCross.sameCatchKm>0);
    assert.ok(counterfactualCross.maxCatchKmError<=2);
  }
  if(earlyLongCalibration!==undefined){
    assert.equal(earlyLongCalibration.length,10);
    assert.ok(earlyLongCalibration.every(row=>
      !row.refused&&row.action==='watch'&&
      row.horizonCatchKm===15&&
      row.counterfactual.status==='paid_contact'&&
      row.counterfactual.contactKm===15&&
      row.counterfactual.finish.status==='paid_finish'&&
      row.counterfactual.finish.riderKilometres===
        row.distanceKm*24&&
      row.counterfactual.finish.finishRiders===24&&
      row.counterfactual.finish.minimumEnergy>0));
  }
  if(earlyRoleCalibration!==undefined){
    assert.equal(earlyRoleCalibration.length,12);
    assert.ok(earlyRoleCalibration.every(row=>
      !row.refused&&row.action==='watch'&&
      row.horizonCatchKm===11&&
      row.counterfactual.status==='paid_contact'&&
      row.counterfactual.contactKm===11));
    assert.equal(earlyRoleCalibration.filter(row=>
      row.counterfactual.finish.status===
        'paid_finish'&&
      row.counterfactual.finish.riderKilometres===
        row.distanceKm*24&&
      row.counterfactual.finish.finishRiders===24
    ).length,4);
    assert.equal(earlyRoleCalibration.filter(row=>
      row.counterfactual.finish.status===
        'unsettled'&&
      row.counterfactual.finish.physicalLoss?.paidSplits
        .length===1&&
      row.counterfactual.finish.physicalLoss.paidSplits
        [0].riderId==='sprint-2'&&
      row.counterfactual.finish.physicalLoss.paidSplits
        [0].atDistanceM>(row.counterfactual.finish
          .physicalLoss.sourceKm-1)*1000&&
      row.counterfactual.finish.physicalLoss.paidSplits
        [0].behindBunchM>0&&
      row.counterfactual.finish.physicalLoss.paidSplits
        [0].energySpent>0&&
      row.counterfactual.finish.physicalLoss.paidSplits
        [0].energyAfter>=0
      &&row.counterfactual.finish.physicalLoss.completions
        .length===1&&
      row.counterfactual.finish.physicalLoss.completions
        [0].endDistanceM===row.counterfactual.finish
          .physicalLoss.sourceKm*1000&&
      row.counterfactual.finish.physicalLoss.completions
        [0].energySpent>0&&
      row.counterfactual.finish.physicalLoss.completions
        [0].recoveryAward===0&&
      row.counterfactual.finish.physicalLoss.completions
        [0].gapSecondsToBunch>0
      &&row.counterfactual.finish.physicalLoss
        .nextPairRiderStates===24&&
      row.counterfactual.finish.physicalLoss
        .nextSoloEnergy.length===2&&
      row.counterfactual.finish.physicalLoss
        .nextSoloEnergy.every(solo=>
          solo.energySpent>0&&solo.energyAfter>=0)
    ).length,8);
    assert.equal(earlyRoleCalibration.filter(row=>
      row.counterfactual.finish.physicalLoss
        ?.separatedStatus.status==='paid_finish'&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.riderKilometres===
          row.distanceKm*24&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.finishRiders===24&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.minimumEnergy>=0&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.distinctLeaders>0).length,8);
  }
  if(closingCalibration!==undefined){
    assert.equal(closingCalibration.length,2);
    assert.ok(closingCalibration.every(row=>
      !row.refused&&
      row.counterfactual.status==='paid_contact'&&
      row.counterfactual.finish.physicalLoss
        ?.separatedStatus.status==='paid_finish'&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.finishRiders===24&&
      row.counterfactual.finish.physicalLoss
        .separatedStatus.initialSoloGapSeconds>
      row.counterfactual.finish.physicalLoss
        .separatedStatus.finishSoloGapSeconds));
  }
  if(earlyTerrainCalibration!==undefined){
    assert.equal(earlyTerrainCalibration.length,2);
    assert.ok(earlyTerrainCalibration.every(row=>{
      const contact=row.counterfactual.finish
        ?.paidPostcatchContact;
      const group=contact?.groupRoad;
      return !row.refused&&
        row.counterfactual.status==='paid_contact'&&
        row.counterfactual.finish.status===
          'unsettled'&&
        contact?.sourceKm===31&&
        contact.atDistanceM>30000&&
        contact.atDistanceM<31000&&
        contact.behindBunchSeconds>0&&
        contact.phase==='before_bunch_km_end'&&
        contact.riderIds.join(',')===
          'other-2,sprint-2'&&
        contact.energySpent.every(value=>value>0)&&
        group?.status==='paid'&&
          group.leaderRiderId==='sprint-2'&&
          group.gapSecondsToBunch>0&&
          group.riderIds.join(',')===
            'other-2,sprint-2'&&
          group.energySpent[0]<group.energySpent[1]&&
          group.allRiders===24&&
          group.riderKilometres===31*24&&
          group.finish?.status==='paid_finish'&&
          group.finish.finishRiders===24&&
          group.finish.riderKilometres===
            row.distanceKm*24&&
          group.finish.distinctRearLeaders===2&&
          group.finish.emergencyFrontKm.includes(61)&&
          group.finish.minimumEnergy>0;
    }));
  }
  if(earlyNoEmergency!==undefined){
    assert.equal(earlyNoEmergency.length,2);
    assert.ok(earlyNoEmergency.every(row=>
      !row.refused&&row.counterfactual.finish
        .paidPostcatchContact.groupRoad.finish
        .status==='unsettled'&&
      row.counterfactual.finish
        .paidPostcatchContact.groupRoad.finish
        .reason===
          'Ordered front worker is no longer in bunch.'&&
      row.counterfactual.finish
        .paidPostcatchContact.groupRoad.finish
        .sourceKm===61));
  }
  if(postcatchMatrix!==undefined){
    assert.equal(postcatchMatrix.length,12);
    assert.equal(postcatchMatrix.filter(row=>
      row.fatigue===0&&row.refused===
        'Front solo needs separate physical catch road.')
      .length,4);
    assert.equal(postcatchMatrix.filter(row=>
      row.fatigue!==0&&!row.refused&&
      row.counterfactual.finish.paidPostcatchContact
        ?.groupRoad.finish.status==='paid_finish'&&
      row.counterfactual.finish.paidPostcatchContact
        .groupRoad.finish.finishRiders===24&&
      row.counterfactual.finish.paidPostcatchContact
        .groupRoad.finish.finalGapSeconds>0&&
      row.counterfactual.finish.paidPostcatchContact
        .groupRoad.finish.minimumEnergy>0).length,8);
  }
  if(postcatchStrengthMatrix!==undefined){
    assert.equal(postcatchStrengthMatrix.length,8);
    assert.equal(postcatchStrengthMatrix.filter(row=>
      row.roleStrengthOffset===-10&&
      row.roadVariant==='hill_mid'&&
      !row.refused&&!row.counterfactual.finish)
      .length,2);
    assert.equal(postcatchStrengthMatrix.filter(row=>
      row.roleStrengthOffset===10&&
      row.roadVariant==='climb_mid'&&
      row.counterfactual.finish?.reason===
        'Manager slide needs paid return contact.')
      .length,2);
    assert.equal(postcatchStrengthMatrix.filter(row=>
      (row.roleStrengthOffset===-10&&
        row.roadVariant==='climb_mid'||
        row.roleStrengthOffset===10&&
        row.roadVariant==='hill_mid')&&
      row.counterfactual.finish
        ?.paidPostcatchContact?.groupRoad
        .finish.status==='paid_finish')
      .length,4);
  }
}
process.stdout.write(JSON.stringify({version:1,
  raceSeed:'same-threat-window-seed',actionCounts,
  commitWindows,frontEffortProbe,finishWitness,
  ...(calibration===undefined?{}:{calibration}),
  ...(longCalibration===undefined?{}:{longCalibration}),
  ...(longTerrainCalibration===undefined?{}:{
    longTerrainCalibration}),
  ...(earlyLongCalibration===undefined?{}:{
    earlyLongCalibration}),
  ...(earlyRoleCalibration===undefined?{}:{
    earlyRoleCalibration}),
  ...(closingCalibration===undefined?{}:{
    closingCalibration}),
  ...(earlyTerrainCalibration===undefined?{}:{
    earlyTerrainCalibration}),
  ...(earlyNoEmergency===undefined?{}:{
    earlyNoEmergency}),
  ...(postcatchMatrix===undefined?{}:{
    postcatchMatrix}),
  ...(postcatchStrengthMatrix===undefined?{}:{
    postcatchStrengthMatrix}),
  ...(policyCross===null?{}:{policyCross}),
  ...(counterfactualCross===null?{}:{counterfactualCross}),
  ...(process.argv.includes('--verbose')?{results}:{})},
null,2)+'\n');
