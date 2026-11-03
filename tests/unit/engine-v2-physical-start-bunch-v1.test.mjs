import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {TUNING} from '../../lib/engine/v2/tuning.mjs';
import {normalizeOrders,orderAt} from
  '../../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../../lib/engine/v2/rear-solo-commitment-v1.mjs';
import {physicalRearIntentAtKmV2} from
  '../../lib/engine/v2/physical-rear-intent-v2.mjs';
import {probePhysicalOrderedSoloBunchContactV1,
  validatePhysicalOrderedSoloBunchContactV1} from
  '../../lib/engine/v2/physical-ordered-solo-bunch-contact-v1.mjs';
import {finishPhysicalOrderedSoloBunchJoinKmV1,
  validatePhysicalOrderedSoloBunchJoinKmV1} from
  '../../lib/engine/v2/physical-ordered-solo-bunch-join-v1.mjs';
import {replayPhysicalOrderedSoloBunchRaceV1,
  validatePhysicalOrderedSoloBunchRaceV1} from
  '../../lib/engine/v2/physical-ordered-solo-bunch-race-v1.mjs';
import {startPhysicalBunchV1,advancePhysicalStartBunchV1,
  validatePhysicalStartBunchV1,runPhysicalBunchV1,
  validatePhysicalBunchRunV1,runPhysicalBunchToPaceLossV1,
  validatePhysicalBunchPaceLossV1,
  runPhysicalBunchAfterPaceLossV1,
  validatePhysicalBunchAfterPaceLossV1,
  runPhysicalStaggeredBunchLossV1,
  validatePhysicalStaggeredBunchLossV1,
  runPhysicalNamedAttackV1,
  validatePhysicalNamedAttackV1,
  runPhysicalBunchAfterNamedAttackV1,
  validatePhysicalBunchAfterNamedAttackV1,
  advancePhysicalBunchAfterPerceivedCatchKmV1,
  advancePhysicalBunchAfterStageJoinKmV1,
  advancePhysicalBunchAfterCaughtSlideLossKmV1} from
  '../../lib/engine/v2/physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1,
  completePhysicalStaggeredLossKmV1,
  partitionPhysicalStaggeredLossArrivalsV1,
  validatePhysicalStaggeredLossArrivalsV1,
  validatePhysicalPaceLossCompletionV1} from
  '../../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {runPhysicalStaggeredDetachedSoloV1,
  validatePhysicalStaggeredDetachedSoloV1,
  probePhysicalStaggeredSoloFieldV1,
  validatePhysicalStaggeredSoloFieldV1} from
  '../../lib/engine/v2/physical-staggered-detached-solo-v1.mjs';
import {inspectFirstStaggeredSoloFieldContactV1,
  validateFirstStaggeredSoloFieldContactV1} from
  '../../lib/engine/v2/physical-staggered-solo-field-contact-v1.mjs';
import {inspectPhysicalStaggeredLossKmContactsV1,
  validatePhysicalStaggeredLossKmContactsV1} from
  '../../lib/engine/v2/physical-staggered-loss-km-contact-v1.mjs';
import {finishPhysicalLossKmContactV1,
  finishPhysicalSoloFieldContactKmV1,
  validatePhysicalSoloFieldContactKmV1} from
  '../../lib/engine/v2/physical-loss-km-contact-road-v1.mjs';
import {runPhysicalLossKmRearPairV1,
  runPhysicalSoloFieldRearPairV1,
  validatePhysicalSoloFieldRearPairV1} from
  '../../lib/engine/v2/physical-loss-km-rear-pair-v1.mjs';
import {inspectNextRearPairFieldContactV1,
  validateNextRearPairFieldContactV1} from
  '../../lib/engine/v2/physical-rear-pair-field-contact-v1.mjs';
import {finishPhysicalSecondRearPairContactV1} from
  '../../lib/engine/v2/physical-second-rear-pair-v1.mjs';
import {inspectTwoRearPairsFieldContactV1} from
  '../../lib/engine/v2/physical-two-rear-pairs-field-contact-v1.mjs';
import {finishPhysicalThirdRearContactV1} from
  '../../lib/engine/v2/physical-third-rear-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1,
  pricePhysicalRearSoloTrackV1,
  pricePhysicalRearSoloFromContactV1} from
  '../../lib/engine/v2/physical-rear-event-track-v1.mjs';
import {replayPhysicalStaggeredRearEventsV1,
  validatePhysicalStaggeredRearEventsV1,
  inspectPhysicalRearEventEndStateV1,
  validatePhysicalRearEventEndStateV1} from
  '../../lib/engine/v2/physical-staggered-rear-event-replay-v1.mjs';
import {decidePhysicalRearContactV1} from
  '../../lib/engine/v2/physical-rear-contact-choice-v1.mjs';
import {replayPhysicalStaggeredRaceV1,
  validatePhysicalStaggeredRaceV1} from
  '../../lib/engine/v2/physical-staggered-race-replay-v1.mjs';
import {contactPhysicalStaggeredSolosV1,
  validatePhysicalStaggeredSoloContactV1} from
  '../../lib/engine/v2/physical-staggered-solo-contact-v1.mjs';
import {finishPhysicalStaggeredContactKmV1,
  validatePhysicalStaggeredContactKmV1} from
  '../../lib/engine/v2/physical-staggered-contact-road-v1.mjs';
import {runPhysicalStaggeredRearGroupV1,
  validatePhysicalStaggeredRearGroupV1} from
  '../../lib/engine/v2/physical-staggered-rear-group-v1.mjs';
import {replayPhysicalStaggeredContactRaceV1,
  validatePhysicalStaggeredContactRaceV1} from
  '../../lib/engine/v2/physical-staggered-contact-race-replay-v1.mjs';
import {runPhysicalDetachedSoloV1,
  validatePhysicalDetachedSoloV1} from
  '../../lib/engine/v2/physical-detached-solo-run-v1.mjs';
import {contactPhysicalRearSolosV1,
  validatePhysicalRearSoloContactV1} from
  '../../lib/engine/v2/physical-rear-solo-contact-v1.mjs';
import {finishPhysicalRearContactKmV1,
  validatePhysicalRearContactRoadV1} from
  '../../lib/engine/v2/physical-rear-contact-road-v1.mjs';
import {priceRearEnergyDemandV1} from
  '../../lib/engine/v2/rear-energy-demand-v1.mjs';
import {runPhysicalFrontSoloV1,
  validatePhysicalFrontSoloV1} from
  '../../lib/engine/v2/physical-front-solo-run-v1.mjs';
import {advancePhysicalChasedFrontStepV1} from
  '../../lib/engine/v2/physical-chased-front-step-v1.mjs';
import {replayPhysicalFrontFirstRearLossKmV1,
  validatePhysicalFrontFirstRearLossKmV1} from
  '../../lib/engine/v2/physical-front-first-rear-loss-v1.mjs';
import {advancePhysicalFrontRearClearKmV1,
  replayPhysicalFrontRearNextKmV1,
  validatePhysicalFrontRearNextKmV1} from
  '../../lib/engine/v2/physical-front-rear-next-km-v1.mjs';
import {catchPhysicalFrontSoloV1,
  validatePhysicalFrontBunchCatchV1} from
  '../../lib/engine/v2/physical-front-bunch-catch-v1.mjs';
import {slideCaughtBreakRiderV1,
  validateCaughtBreakSlideV1} from
  '../../lib/engine/v2/physical-caught-break-slide-v1.mjs';
import {runPhysicalBunchAfterCaughtSlideV1,
  validatePhysicalBunchAfterCaughtSlideV1} from
  '../../lib/engine/v2/physical-bunch-after-caught-slide-v1.mjs';
import {runPhysicalSlidBreakSoloV1,
  validatePhysicalSlidBreakSoloV1} from
  '../../lib/engine/v2/physical-slid-break-solo-run-v1.mjs';
import {replayPhysicalCaughtBreakRaceV1,
  validatePhysicalCaughtBreakRaceV1} from
  '../../lib/engine/v2/physical-caught-break-race-replay-v1.mjs';
import {replayPhysicalEarlyCaughtFollowerLossV1,
  validatePhysicalEarlyCaughtFollowerLossV1} from
  '../../lib/engine/v2/physical-early-caught-follower-loss-v1.mjs';
import {replayPhysicalEarlyCaughtNextRearKmV1,
  validatePhysicalEarlyCaughtNextRearKmV1} from
  '../../lib/engine/v2/physical-early-caught-next-rear-km-v1.mjs';
import {replayPhysicalEarlyCaughtRearFinishV1,
  validatePhysicalEarlyCaughtRearFinishV1} from
  '../../lib/engine/v2/physical-early-caught-rear-finish-v1.mjs';
import {replayPhysicalCommittedStageReleaseKmV1,
  validatePhysicalCommittedStageReleaseKmV1,
  replayPhysicalCommittedStageReleaseFinishV1,
  validatePhysicalCommittedStageReleaseFinishV1} from
  '../../lib/engine/v2/physical-committed-stage-release-km-v1.mjs';
import {probePhysicalCommittedStageBunchContactV1,
  validatePhysicalCommittedStageBunchContactV1} from
  '../../lib/engine/v2/physical-committed-stage-bunch-contact-v1.mjs';
import {finishPhysicalCommittedStageBunchJoinKmV1,
  validatePhysicalCommittedStageBunchJoinKmV1} from
  '../../lib/engine/v2/physical-committed-stage-bunch-join-v1.mjs';
import {replayPhysicalCommittedStageJoinRaceV1,
  validatePhysicalCommittedStageJoinRaceV1} from
  '../../lib/engine/v2/physical-committed-stage-join-race-v1.mjs';
import {replayPhysicalCommittedStagePostjoinLossV1,
  validatePhysicalCommittedStagePostjoinLossV1} from
  '../../lib/engine/v2/physical-committed-stage-postjoin-loss-v1.mjs';
import {replayPhysicalFrontRaceV1,
  validatePhysicalFrontRaceV1} from
  '../../lib/engine/v2/physical-front-race-replay-v1.mjs';
import {replayPhysicalSingleLossRaceV1,
  validatePhysicalSingleLossRaceV1} from
  '../../lib/engine/v2/physical-single-loss-race-replay-v1.mjs';
import {decidePhysicalFrontThreatV1,
  validatePhysicalFrontThreatV1} from
  '../../lib/engine/v2/physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseKmV1,
  validatePhysicalPerceivedChaseKmV1} from
  '../../lib/engine/v2/physical-perceived-chase-km-v1.mjs';
import {runPhysicalPerceivedChaseV1,
  validatePhysicalPerceivedChaseRunV1} from
  '../../lib/engine/v2/physical-perceived-chase-run-v1.mjs';
import {replayPhysicalPerceivedChaseRaceV1,
  validatePhysicalPerceivedChaseRaceV1} from
  '../../lib/engine/v2/physical-perceived-chase-race-replay-v1.mjs';
import {catchPhysicalPerceivedChaseV1,
  validatePhysicalPerceivedChaseContactV1} from
  '../../lib/engine/v2/physical-perceived-chase-contact-v1.mjs';
import {slidePerceivedChaseCaughtFrontV1,
  validatePerceivedChaseCaughtSlideV1} from
  '../../lib/engine/v2/physical-perceived-chase-slide-v1.mjs';
import {replayPhysicalPerceivedChaseSlideRaceV1,
  validatePhysicalPerceivedChaseSlideRaceV1} from
  '../../lib/engine/v2/physical-perceived-chase-slide-race-v1.mjs';
import {estimatePhysicalObserverPursuitHorizonV1,
  validatePhysicalObserverPursuitHorizonV1} from
  '../../lib/engine/v2/physical-observer-pursuit-horizon-v1.mjs';
import {runPhysicalManagerChaseCounterfactualV1,
  validatePhysicalManagerChaseCounterfactualV1} from
  '../../lib/engine/v2/physical-manager-chase-counterfactual-v1.mjs';
import {completePhysicalManagerChaseContactKmV1,
  validatePhysicalManagerChaseContactKmV1} from
  '../../lib/engine/v2/physical-manager-chase-contact-km-v1.mjs';
import {replayPhysicalManagerChaseRaceV1,
  validatePhysicalManagerChaseRaceV1} from
  '../../lib/engine/v2/physical-manager-chase-race-replay-v1.mjs';
import {runPhysicalRearGroupV1,
  validatePhysicalRearGroupV1} from
  '../../lib/engine/v2/physical-rear-group-run-v1.mjs';
import {replayPhysicalRearRaceV1,
  validatePhysicalRearRaceV1} from
  '../../lib/engine/v2/physical-rear-race-replay-v1.mjs';

const route=(terrain='flat')=>Array.from({length:20},(_,index)=>({
  km:index+1,terrain,gradientPct:terrain==='climb'?6:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=(fatigue=20)=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>[skill,70]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>
    [rider.id,100-fatigue*.4])),orders:{
    captainId:riders[0].id,helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},phases:[]}};
});
const source=(teams=field(),routeKilometres=route(),
  stakeByTeam={sprint:'sprint_finish'},keypoints=[])=>{
  for(const team of teams)team.orders=normalizeOrders(team.orders,{
    riderIds:team.riders.map(rider=>rider.id),
    distanceKm:routeKilometres.length,keypoints,
    allowFrontWork:true,allowNamedFrontWorker:true});
  const commitment=commitTeamChaseStakesV1({teams,
    distanceKm:routeKilometres.length,
    keypoints,
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:stakeByTeam[team.id]??'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,
    raceSeed:'physical-start-1'};
  const start=startPhysicalBunchV1(startInput);
  return {startInput,start,segment:routeKilometres[0]};
};

test('emergency front worker needs a precommitted named helper',()=>{
  const {startInput}=source();
  const plan={version:1,teamId:'control',
    unavailableRiderId:'control-2',
    replacementRiderId:'control-3'};
  const committed=startPhysicalBunchV1({...startInput,
    emergencyFrontWorkers:[plan]});
  assert.deepEqual(committed.committedSource
    .emergencyFrontWorkers,[plan]);
  assert.throws(()=>startPhysicalBunchV1({...startInput,
    emergencyFrontWorkers:[plan,plan]}),
  /named emergency front workers/);
  assert.throws(()=>startPhysicalBunchV1({...startInput,
    emergencyFrontWorkers:[{...plan,
      replacementRiderId:'control-0'}]}),
  /named emergency front workers/);
});

test('next rear solo pays terrain from recorded energy and clock',()=>{
  const base=source();
  const startInput={...base.startInput,
    physicalDraftVersion:4,
    physicalRearIntentVersion:2};
  const input={startInput,riderId:'other-2',
    energyBefore:90,km:2,startClock:80,
    groupId:'solo-other-2'};
  const paid=pricePhysicalRearSoloTrackV1(input);
  assert.equal(paid.rows.length,1);
  assert.equal(paid.rows[0].role,'solo');
  assert.equal(paid.rows[0].decision.effort,
    'steady');
  assert.equal(paid.clockAt(0),80);
  assert.equal(paid.clockAt(1000),
    paid.endClock);
  assert.ok(paid.rows[0].energyAfter<90);
  assert.ok(Math.abs(paid.energyAt(1000)-
    paid.rows[0].energyAfter)<.002);
  const climb={...startInput,
    routeKilometres:startInput.routeKilometres
      .map((segment,index)=>index===1?{
        ...segment,terrain:'climb',
        gradientPct:6}:segment)};
  const climbPaid=pricePhysicalRearSoloTrackV1({
    ...input,startInput:climb});
  assert.ok(climbPaid.rows[0].energyAfter<
    paid.rows[0].energyAfter);
  assert.throws(()=>
    pricePhysicalRearSoloTrackV1({
      ...input,groupId:'peloton'}),
  /recorded road state/);
});

test('opt-in rear road decisions carry their paid source version',()=>{
  const base=source();
  const legacy=pricePhysicalRearSoloTrackV1({
    startInput:base.startInput,riderId:'other-2',
    energyBefore:90,km:2,startClock:80,
    groupId:'solo-other-2'});
  assert.equal(legacy.rows[0].decision.version,
    undefined);
  const startInput={...base.startInput,
    physicalDecisionVersion:1};
  const solo=pricePhysicalRearSoloTrackV1({
    startInput,riderId:'other-2',energyBefore:90,
    km:2,startClock:80,groupId:'solo-other-2'});
  const continuation=pricePhysicalRearSoloFromContactV1({
    startInput,riderId:'other-2',energyBefore:90,
    km:2,startM:500,startClock:80,
    groupId:'solo-other-2'});
  const group=pricePhysicalRearEventTrackV1({
    startInput,riderIds:['other-2','other-3'],
    energyByRider:{'other-2':90,'other-3':90},
    km:2,startM:0,startClock:80,
    groupId:'rear-pair'});
  for(const road of [solo,continuation,group]){
    assert.match(road.version,/-decisions-1$/);
    assert.ok(road.rows.every(row=>
      row.decision.version===road.version&&
      row.decision.teamOrderEffort==='steady'));
  }
  assert.equal(solo.endClock,legacy.endClock);
  assert.equal(solo.rows[0].energyAfter,
    legacy.rows[0].energyAfter);
});

test('opt-in rear contact choice versions each rider decision',()=>{
  const base=source();
  const input={startInput:base.startInput,km:2,
    roadIds:['solo-other-2','solo-other-3'],
    riderIdsByRoad:{'solo-other-2':['other-2'],
      'solo-other-3':['other-3']},
    catchingRoadId:null,
    observedSecondsPerKmByRoad:{
      'solo-other-2':90,'solo-other-3':91},
    leaderRiderId:'other-2'};
  const legacy=decidePhysicalRearContactV1(input);
  assert.ok(legacy.riderDecisions.every(row=>
    row.version===undefined));
  const choice=decidePhysicalRearContactV1({
    ...input,startInput:{...base.startInput,
      physicalDecisionVersion:1}});
  assert.match(choice.version,/-decisions-1$/);
  assert.deepEqual(choice.riderDecisions.map(row=>
    row.choice),['pull','join_shelter']);
  assert.ok(choice.riderDecisions.every(row=>
    row.version===choice.version&&
    row.teamOrderEffort==='steady'));
});

test('start line pays one named leader and all 23 sheltered riders',()=>{
  const input=source();
  const road=advancePhysicalStartBunchV1(input);
  assert.equal(road.leaderRiderId,'control-2');
  assert.equal(road.riderDecisions.length,24);
  assert.equal(road.riders.length,24);
  assert.equal(road.physicalGroup.riderIds.length,24);
  assert.equal(road.riders.filter(row=>row.role==='leader').length,1);
  assert.equal(road.riderDecisions.filter(row=>
    row.choice==='pull').length,1);
  assert.ok(road.riders.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.ok(road.riders.find(row=>row.riderId==='control-2')
    .energySpent>road.riders.find(row=>row.riderId==='sprint-2')
      .energySpent);
  assert.equal(road.riderDecisions.find(row=>
    row.riderId==='sprint-0').goal,'sprint_finish');
  assert.equal(road.endDistanceM,1000);
  assert.ok(road.elapsedSeconds>0);
  assert.equal(validatePhysicalStartBunchV1(input,road),true);
  const forged=structuredClone(road);
  forged.riders[0].energySpent=0;
  assert.throws(()=>validatePhysicalStartBunchV1(input,forged),
    /differs/);
});

test('opt-in bunch decisions record source version and manager effort',()=>{
  const legacy=source();
  const legacyRoad=advancePhysicalStartBunchV1(legacy);
  assert.equal(legacy.start.version,
    'v2-physical-start-bunch-1');
  assert.ok(legacyRoad.riderDecisions.every(row=>
    row.version===undefined&&
    row.teamOrderEffort===undefined));
  const startInput={...legacy.startInput,
    physicalDecisionVersion:1};
  const start=startPhysicalBunchV1(startInput);
  assert.equal(start.committedSource
    .physicalDecisionVersion,1);
  const road=advancePhysicalStartBunchV1({
    startInput,start,segment:legacy.segment});
  assert.match(start.version,/-decisions-1$/);
  assert.match(road.version,/-decisions-1$/);
  assert.ok(road.riderDecisions.every(row=>
    row.version===road.version&&
    row.teamOrderEffort===orderAt(
      startInput.teams.find(team=>team.id===row.teamId)
        .orders,0).effort));
  assert.deepEqual(road.riders,legacyRoad.riders);
  assert.equal(road.elapsedSeconds,
    legacyRoad.elapsedSeconds);
  assert.equal(validatePhysicalStartBunchV1({
    startInput,start,segment:legacy.segment},road),true);
  assert.throws(()=>startPhysicalBunchV1({
    ...legacy.startInput,physicalDecisionVersion:2}),
  /committed field and route/);
});

test('simultaneous paid splits choose and pay one rear leader',()=>{
  const teams=field(30);
  const dropped=['control-3','sprint-3','other-3'];
  for(const id of dropped)
    teams.flatMap(team=>team.riders)
      .find(rider=>rider.id===id).mountain=30;
  const kilometres=route();
  kilometres[0]={...kilometres[0],terrain:'climb',
    gradientPct:6};
  const base=source(teams,kilometres);
  const startInput={...base.startInput,
    physicalDraftVersion:4};
  const start=startPhysicalBunchV1(startInput);
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:20});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    startInput,start,staggered,throughKm:20});
  const input={startInput,start,staggered,soloField,
    throughKm:20};
  const race=replayPhysicalStaggeredRearEventsV1(input);
  const split=staggered.road[0].splits.filter(row=>
    dropped.includes(row.riderId));
  assert.equal(split.length,3);
  assert.ok(split.every(row=>row.atDistanceM===
    split[0].atDistanceM));
  const shared=race.contacts.filter(row=>
    row.source==='paid_simultaneous_split');
  assert.equal(shared.length,2);
  const contact=shared.at(-1);
  assert.ok(contact);
  assert.ok(Math.abs(contact.atDistanceM-
    split[0].atDistanceM)<1e-5);
  assert.equal(contact.catchingRoadId,null);
  assert.equal(contact.contactDecisions.filter(row=>
    row.choice==='pull').length,1);
  assert.equal(contact.physicalGroup.riderIds.length,3);
  assert.equal(race.kilometres[0].segments.find(row=>
    row.roadId===contact.physicalGroup.id)
    .riders.filter(row=>row.role==='leader').length,1);
  assert.equal(Object.keys(race
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    input,race),true);
  const forged=structuredClone(race);
  forged.contacts.find(row=>row.source===
    'paid_simultaneous_split').leaderRiderId='control-2';
  assert.throws(()=>validatePhysicalStaggeredRearEventsV1(
    input,forged),/differs from paid source/);
  const orderedInput={...startInput,
    physicalRearIntentVersion:2};
  const orderedStart=startPhysicalBunchV1(
    orderedInput);
  const orderedStaggered=
    runPhysicalStaggeredBunchLossV1({
      startInput:orderedInput,start:orderedStart,
      throughKm:3});
  const orderedSolo=probePhysicalStaggeredSoloFieldV1({
    startInput:orderedInput,start:orderedStart,
    staggered:orderedStaggered,
    throughKm:3});
  const orderedRace=replayPhysicalStaggeredRearEventsV1({
    startInput:orderedInput,start:orderedStart,
    staggered:orderedStaggered,
    soloField:orderedSolo,throughKm:3});
  assert.ok(orderedRace.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(orderedRace.contacts.filter(row=>
    row.source==='paid_simultaneous_split').length,2);
  assert.ok(orderedRace.kilometres.flatMap(row=>
    row.segments).filter(row=>row.kind==='group')
    .every(row=>row.riders.every(rider=>
      rider.decision.effort==='steady'&&
      rider.decision.intentSource===
        'committed_manager_order_and_stake')));
});

test('versioned bunch pace match pays sheltered cost with one leader',()=>{
  const teams=field();
  teams[2].riders[3].mountain=40;
  teams[2].riders[3].timetrial=100;
  const base=source(teams,route('climb'));
  const roadFor=physicalDraftVersion=>{
    const startInput={...base.startInput,
      physicalDraftVersion};
    return advancePhysicalStartBunchV1({
      startInput,start:startPhysicalBunchV1(
        startInput),segment:base.segment});
  };
  const oldRoad=roadFor(2);
  const sheltered=roadFor(3);
  const classified=roadFor(4);
  const old=oldRoad.riders.find(row=>
    row.riderId==='other-3');
  const next=sheltered.riders.find(row=>
    row.riderId==='other-3');
  assert.equal(old.role,'pace_match');
  assert.equal(next.role,'sheltered');
  assert.ok(next.energySpent<old.energySpent);
  assert.equal(sheltered.riders.filter(row=>
    row.role==='leader').length,1);
  assert.ok(sheltered.physicalGroup.riderIds.every(id=>
    ['leader','sheltered'].includes(
      sheltered.riders.find(row=>
        row.riderId===id).role)));
  assert.equal(sheltered.riderDecisions.find(row=>
    row.riderId==='other-3').reason,
  'paid_individual_pace_match_in_shelter');
  assert.notEqual(oldRoad.version,sheltered.version);
  assert.notEqual(classified.version,sheltered.version);
  assert.deepEqual(classified.riders,sheltered.riders);
  assert.deepEqual(classified.riderDecisions,
    sheltered.riderDecisions);
});

test('same-seed terrain and fatigue change paid start road',()=>{
  const flat=advancePhysicalStartBunchV1(source());
  const climbing=advancePhysicalStartBunchV1(
    source(field(),route('climb')));
  const tired=advancePhysicalStartBunchV1(
    source(field(70)));
  assert.ok(climbing.riders[0].energySpent>
    flat.riders[0].energySpent);
  assert.ok(tired.riders[0].energyBefore<
    flat.riders[0].energyBefore);
  assert.notEqual(tired.bunchSpeedKph,flat.bunchSpeedKph);
  assert.equal(climbing.riderDecisions.length,24);
  assert.equal(tired.riderDecisions.length,24);
});

test('different paid kilometres remove only physically dropped riders',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[0].riders[2][skill]=90;
  teams[2].riders[3].mountain=80;
  teams[0].orders.phases=[{atKm:5,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:5,
    frontWork:'rotate',frontWorkRiderId:'sprint-2'}];
  const kilometres=route();
  for(const segment of kilometres.slice(10)){
    segment.terrain='climb';segment.gradientPct=6;
  }
  const input=source(teams,kilometres);
  const recording=runPhysicalStaggeredBunchLossV1({
    ...input,throughKm:20});
  assert.deepEqual(recording.losses.map(row=>[
    row.sourceKm,row.riderId]),[[6,'control-2'],
    [11,'other-3']]);
  assert.equal(recording.physicalGroup.riderIds.length,22);
  assert.ok(recording.road.every(row=>
    row.riderDecisions.length===row.riders.length));
  assert.ok(recording.road.slice(11).every(row=>
    !row.physicalGroup.riderIds.includes('control-2')&&
    !row.physicalGroup.riderIds.includes('other-3')));
  assert.equal(validatePhysicalStaggeredBunchLossV1({
    ...input,throughKm:20},recording),true);
  const arrivalsInput={...input,staggered:recording};
  const arrivals=partitionPhysicalStaggeredLossArrivalsV1(
    arrivalsInput);
  assert.equal(arrivals.completions.length,2);
  assert.deepEqual(arrivals.arrivals.map(row=>[
    row.sourceKm,row.riderIds]),[
    [6,['control-2']],[11,['other-3']]]);
  assert.equal(arrivals.nearCoincidentArrivals.length,0);
  assert.equal(validatePhysicalStaggeredLossArrivalsV1(
    arrivalsInput,arrivals),true);
  const forgedArrivals=structuredClone(arrivals);
  forgedArrivals.completions[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalStaggeredLossArrivalsV1(
    arrivalsInput,forgedArrivals),/differ/);
  const lossContacts=inspectPhysicalStaggeredLossKmContactsV1(
    arrivalsInput);
  assert.deepEqual(lossContacts.contacts,[]);
  assert.equal(validatePhysicalStaggeredLossKmContactsV1(
    arrivalsInput,lossContacts),true);
  const forgedLossContacts=structuredClone(lossContacts);
  forgedLossContacts.contacts.push({sourceKm:6});
  assert.throws(()=>validatePhysicalStaggeredLossKmContactsV1(
    arrivalsInput,forgedLossContacts),/differ/);
  assert.throws(()=>finishPhysicalLossKmContactV1({
    ...arrivalsInput,contact:{sourceKm:6}}),
  /exact paid source/);
  assert.throws(()=>runPhysicalLossKmRearPairV1({
    ...arrivalsInput,contact:{sourceKm:6},
    contactRoad:{},throughKm:20}),
  /exact paid/);
  const fieldInput={...arrivalsInput,throughKm:20};
  const fieldProbe=probePhysicalStaggeredSoloFieldV1(
    fieldInput);
  assert.equal(fieldProbe.candidates.length,2);
  assert.deepEqual(fieldProbe.refusals,[]);
  assert.equal(validatePhysicalStaggeredSoloFieldV1(
    fieldInput,fieldProbe),true);
  const fieldContactInput={...arrivalsInput,
    soloField:fieldProbe};
  const fieldContact=
    inspectFirstStaggeredSoloFieldContactV1(
      fieldContactInput);
  assert.equal(fieldContact.firstContact,null);
  assert.equal(validateFirstStaggeredSoloFieldContactV1(
    fieldContactInput,fieldContact),true);
  const partialField=probePhysicalStaggeredSoloFieldV1({
    ...arrivalsInput,throughKm:11});
  assert.equal(partialField.candidates.length,2);
  assert.equal(partialField.candidates.find(row=>
    row.riderId==='other-3').steps.length,0);
  assert.equal(inspectFirstStaggeredSoloFieldContactV1({
    ...arrivalsInput,soloField:partialField})
    .firstContact,null);
  for(const riderId of ['control-2','other-3']){
    const completion=completePhysicalStaggeredLossKmV1({
      ...input,staggered:recording,riderId});
    assert.equal(completion.riderId,riderId);
    assert.ok(completion.startDistanceM<
      completion.endDistanceM);
    const soloInput={...input,staggered:recording,
      riderId,throughKm:20};
    const solo=runPhysicalStaggeredDetachedSoloV1(soloInput);
    assert.deepEqual(fieldProbe.candidates.find(row=>
      row.riderId===riderId),solo);
    assert.equal(solo.steps.length,20-completion.sourceKm);
    assert.ok(solo.steps.every(row=>
      row.energyAfter>=0&&row.gapSecondsToBunch>0));
    assert.equal(validatePhysicalStaggeredDetachedSoloV1(
      soloInput,solo),true);
  }
  const raceInput={...input,throughKm:20};
  const race=replayPhysicalStaggeredRaceV1(raceInput);
  assert.equal(race.kilometres.reduce((sum,row)=>sum+
    row.riderStates.length,0),480);
  assert.equal(Object.keys(
    race.observedFinishSecondsByRider).length,24);
  assert.ok(race.observedFinishSecondsByRider['control-2']>
    race.observedFinishSecondsByRider['control-0']);
  assert.ok(race.observedFinishSecondsByRider['other-3']>
    race.observedFinishSecondsByRider['control-0']);
  assert.ok(race.kilometres.slice(10).every(row=>
    row.riderStates.find(state=>state.riderId==='control-2')
      .physicalGroupId==='solo-control-2'&&
    row.riderStates.find(state=>state.riderId==='other-3')
      .physicalGroupId==='solo-other-3'));
  assert.equal(validatePhysicalStaggeredRaceV1(
    raceInput,race),true);
  const forgedRace=structuredClone(race);
  forgedRace.kilometres[10].riderStates.find(row=>
    row.riderId==='other-3').elapsedSeconds+=1;
  assert.throws(()=>validatePhysicalStaggeredRaceV1(
    raceInput,forgedRace),/differs/);
  const catchingTeams=structuredClone(teams);
  catchingTeams[2].riders[3].mountain=30;
  const catchingInput=source(catchingTeams,kilometres);
  assert.throws(()=>replayPhysicalStaggeredRaceV1({
    ...catchingInput,throughKm:20}),/paid contact road/);
  const catchingSource=runPhysicalStaggeredBunchLossV1({
    ...catchingInput,throughKm:20});
  const contacts=[];
  for(let contactKm=12;contactKm<=20;contactKm++){
    const contactInput={...catchingInput,
      staggered:catchingSource,
      riderIds:['control-2','other-3'],contactKm};
    try{contacts.push({contactKm,
      contact:contactPhysicalStaggeredSolosV1(contactInput),
      contactInput});}catch(error){
      assert.match(error.message,/contact|met before/);
    }
  }
  assert.equal(contacts.length,1);
  const catchingFieldInput={...catchingInput,
    staggered:catchingSource,throughKm:20};
  const catchingField=probePhysicalStaggeredSoloFieldV1(
    catchingFieldInput);
  const rearEventInput={...catchingFieldInput,
    soloField:catchingField};
  const rearEvents=replayPhysicalStaggeredRearEventsV1(
    rearEventInput);
  assert.equal(rearEvents.kilometres.length,20);
  assert.ok(rearEvents.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(Object.keys(rearEvents
    .observedFinishSecondsByRider).length,24);
  const firstRearEvent=rearEvents.contacts[0];
  const rearCatcher=firstRearEvent.catchingRoadId
    .slice('solo-'.length);
  const catcherDecision=firstRearEvent
    .contactDecisions.find(row=>
      row.riderId===rearCatcher);
  assert.ok(catcherDecision.observedOwnSecondsPerKm<
    catcherDecision.observedRivalSecondsPerKm);
  const passStartInput={...catchingInput.startInput,
    soloCommitments:[commitRearSoloPlanV1({
      riderId:rearCatcher,distanceKm:20,
      stageNumber:1,stageCount:1,
      baseline:{goal:'rejoin_bunch',
        effort:'conserve'}})]};
  const passRoadIds=firstRearEvent.roadIds;
  const passChoiceInput={startInput:passStartInput,
    km:firstRearEvent.sourceKm,
    roadIds:passRoadIds,
    riderIdsByRoad:Object.fromEntries(
      passRoadIds.map(id=>[id,[id.slice(5)]])),
    catchingRoadId:firstRearEvent.catchingRoadId,
    observedSecondsPerKmByRoad:
      Object.fromEntries(passRoadIds.map(id=>[
        id,firstRearEvent.contactDecisions.find(
          row=>row.riderId===id.slice(5))
          .observedOwnSecondsPerKm])),
    leaderRiderId:rearCatcher};
  const passChoice=decidePhysicalRearContactV1(
    passChoiceInput);
  assert.equal(passChoice.outcome,'pass_through');
  const hiddenChanged=structuredClone(passStartInput);
  const rivalId=passRoadIds.find(id=>
    id!==firstRearEvent.catchingRoadId).slice(5);
  const rival=hiddenChanged.teams.flatMap(team=>
    team.riders).find(row=>row.id===rivalId);
  rival.mountain=1;
  assert.deepEqual(decidePhysicalRearContactV1({
    ...passChoiceInput,startInput:hiddenChanged}),
  passChoice);
  const catcherTeam=catchingInput.startInput.teams
    .find(team=>team.riders.some(row=>
      row.id===rearCatcher));
  const stakeInput={...catchingInput.startInput,
    commitment:commitTeamChaseStakesV1({
      teams:catchingInput.startInput.teams,
      distanceKm:20,
      intentions:catchingInput.startInput.teams
        .map(team=>({teamId:team.id,
          baseline:{goal:team.id===catcherTeam.id?
            'sprint_finish':'none',
          captainId:team.id===catcherTeam.id?
            rearCatcher:team.orders.captainId},
          phases:[]}))})};
  assert.equal(decidePhysicalRearContactV1({
    ...passChoiceInput,startInput:stakeInput})
    .outcome,'pass_through');
  const passStart=startPhysicalBunchV1(
    passStartInput);
  const passStaggered=
    runPhysicalStaggeredBunchLossV1({
      startInput:passStartInput,start:passStart,
      throughKm:20});
  const passSolo=probePhysicalStaggeredSoloFieldV1({
    startInput:passStartInput,start:passStart,
    staggered:passStaggered,throughKm:20});
  const passedRace=replayPhysicalStaggeredRearEventsV1({
    startInput:passStartInput,start:passStart,
    staggered:passStaggered,soloField:passSolo,
    throughKm:20});
  assert.equal(validatePhysicalStaggeredRearEventsV1({
    startInput:passStartInput,start:passStart,
    staggered:passStaggered,soloField:passSolo,
    throughKm:20},passedRace),true);
  assert.equal(passedRace.contacts[0].outcome,
    'pass_through');
  assert.ok(passedRace.kilometres[
    passedRace.contacts[0].sourceKm-1]
    .riderStates.find(row=>row.riderId===
      rearCatcher).decisions.some(row=>
      row.choice==='pass_through'));
  assert.equal(passedRace.kilometres.at(-1)
    .riderStates.find(row=>row.riderId===
      rearCatcher).physicalGroupId,
  `solo-${rearCatcher}`);
  assert.throws(()=>commitRearSoloPlanV1({
    riderId:rearCatcher,distanceKm:20,
    stageNumber:1,stageCount:2,
    baseline:{goal:'save_for_stage',
      effort:'conserve'}}),
  /pre-race goal/);
  const savedStartInput={...catchingInput.startInput,
    soloCommitments:[commitRearSoloPlanV1({
      riderId:rearCatcher,distanceKm:20,
      stageNumber:1,stageCount:2,
      baseline:{goal:'save_for_stage',
        effort:'conserve',
        committedStagePlan:{riderId:rearCatcher,
          currentStageNumber:1,
          targetStageNumber:2,
          currentGoal:'finish_safely',
          futureGoal:'target_stage',
          reserveEnergy:80}}})]};
  const savedStart=startPhysicalBunchV1(
    savedStartInput);
  const savedStaggered=
    runPhysicalStaggeredBunchLossV1({
      startInput:savedStartInput,start:savedStart,
      throughKm:20});
  const savedSolo=probePhysicalStaggeredSoloFieldV1({
    startInput:savedStartInput,start:savedStart,
    staggered:savedStaggered,throughKm:20});
  const savedRace=replayPhysicalStaggeredRearEventsV1({
    startInput:savedStartInput,start:savedStart,
    staggered:savedStaggered,soloField:savedSolo,
    throughKm:20});
  assert.equal(savedRace.contacts[0].outcome,'join');
  assert.notEqual(savedRace.contacts[0]
    .leaderRiderId,rearCatcher);
  assert.ok(savedRace.kilometres.slice(
    savedRace.contacts[0].sourceKm-1)
    .flatMap(row=>row.segments)
    .filter(segment=>segment.kind==='group'&&
      segment.riders.some(rider=>
        rider.riderId===rearCatcher))
    .every(segment=>segment.riders.find(
      rider=>rider.riderId===rearCatcher)
      .role==='sheltered'));
  assert.ok(savedRace.kilometres.at(-1)
    .riderStates.find(row=>row.riderId===
      rearCatcher).energyAfter>=80);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    rearEventInput,rearEvents),true);
  const forgedRearEvents=structuredClone(rearEvents);
  forgedRearEvents.contacts[0].clockSeconds+=1;
  assert.throws(()=>validatePhysicalStaggeredRearEventsV1(
    rearEventInput,forgedRearEvents),
  /differs from paid source/);
  const catchingFieldContact=
    inspectFirstStaggeredSoloFieldContactV1({
      ...catchingInput,staggered:catchingSource,
      soloField:catchingField});
  const firstCatchingContact=catchingFieldContact
    .firstContact;
  assert.equal(firstCatchingContact.sourceKm,
    contacts[0].contactKm);
  assert.ok(Math.abs(firstCatchingContact.atDistanceM-
    contacts[0].contact.contactAtDistanceM)<1e-5);
  const fieldRoadInput={...catchingInput,
    staggered:catchingSource,soloField:catchingField,
    fieldContact:catchingFieldContact};
  const fieldRoad=finishPhysicalSoloFieldContactKmV1(
    fieldRoadInput);
  const genericTrack=pricePhysicalRearEventTrackV1({
    startInput:catchingInput.startInput,
    riderIds:firstCatchingContact.riderIds,
    energyByRider:Object.fromEntries(
      firstCatchingContact.riders.map(row=>[
        row.riderId,row.energyAtContact])),
    km:firstCatchingContact.sourceKm,
    startM:firstCatchingContact.atDistanceM-
      (firstCatchingContact.sourceKm-1)*1000,
    startClock:firstCatchingContact.clockSeconds,
    contactLeaderRiderId:fieldRoad.leaderRiderId,
    groupId:fieldRoad.physicalGroup.id});
  assert.ok(Math.abs(genericTrack.endClock-
    fieldRoad.elapsedSeconds)<1e-7);
  assert.deepEqual(genericTrack.rows.map(row=>
    [row.riderId,row.role,row.energyAfter]),
  fieldRoad.riders.map(row=>
    [row.riderId,row.role,row.energyAfter]));
  assert.equal(fieldRoad.riders.filter(row=>
    row.role==='leader').length,1);
  assert.equal(fieldRoad.riders.filter(row=>
    row.role==='sheltered').length,1);
  assert.equal(validatePhysicalSoloFieldContactKmV1(
    fieldRoadInput,fieldRoad),true);
  const fieldPairInput={...fieldRoadInput,
    contactRoad:fieldRoad,throughKm:20};
  const fieldPair=runPhysicalSoloFieldRearPairV1(
    fieldPairInput);
  assert.equal(fieldPair.steps.length,
    20-firstCatchingContact.sourceKm);
  assert.ok(fieldPair.steps.every(step=>
    step.riders.filter(row=>
      row.role==='leader').length===1));
  assert.equal(validatePhysicalSoloFieldRearPairV1(
    fieldPairInput,fieldPair),true);
  const nextInput={...catchingFieldInput,
    soloField:catchingField,
    firstFieldContact:catchingFieldContact,
    contactRoad:fieldRoad,pair:fieldPair};
  const next=inspectNextRearPairFieldContactV1(
    nextInput);
  assert.deepEqual(next.nextContacts,[]);
  assert.throws(()=>finishPhysicalSecondRearPairContactV1({
    ...nextInput,secondContact:{kind:
      'two_other_solos_meet'}}),
  /exact paid solo contact/);
  assert.throws(()=>inspectTwoRearPairsFieldContactV1({
    ...nextInput,secondContact:{kind:
      'two_other_solos_meet'}}),
  /paid second contact/);
  assert.throws(()=>finishPhysicalThirdRearContactV1({
    ...nextInput,thirdContact:{kind:
      'rear_pair_meets_solo'}}),
  /paid second contact/);
  assert.equal(validateNextRearPairFieldContactV1(
    nextInput,next),true);
  const forgedNext=structuredClone(next);
  forgedNext.candidateOtherRiders=1;
  assert.throws(()=>validateNextRearPairFieldContactV1(
    nextInput,forgedNext),/differs/);
  assert.equal(validatePhysicalStaggeredSoloContactV1(
    contacts[0].contactInput,contacts[0].contact),true);
  assert.ok(contacts[0].contact.contactAtDistanceM>
    (contacts[0].contactKm-1)*1000);
  assert.ok(contacts[0].contact.contactAtDistanceM<
    contacts[0].contactKm*1000);
  assert.ok(contacts[0].contact.behindBunchSeconds>0);
  const forgedContact=structuredClone(contacts[0].contact);
  forgedContact.riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalStaggeredSoloContactV1(
    contacts[0].contactInput,forgedContact),/differs/);
  const contactRoadInput={...contacts[0].contactInput,
    contact:contacts[0].contact};
  const contactRoad=finishPhysicalStaggeredContactKmV1(
    contactRoadInput);
  assert.equal(contactRoad.riders.filter(row=>
    row.role==='leader').length,1);
  assert.equal(contactRoad.riders.filter(row=>
    row.role==='sheltered').length,1);
  assert.ok(contactRoad.riders.every(row=>
    row.energySpent>0&&row.energyAfter>=0));
  assert.equal(validatePhysicalStaggeredContactKmV1(
    contactRoadInput,contactRoad),true);
  const rearInput={...contactRoadInput,contactRoad,
    throughKm:20};
  const rear=runPhysicalStaggeredRearGroupV1(rearInput);
  assert.equal(rear.steps.length,20-contacts[0].contactKm);
  assert.ok(rear.steps.every(row=>
    row.riders.filter(rider=>rider.role==='leader').length===1&&
    row.riders.filter(rider=>rider.role==='sheltered').length===1));
  assert.equal(validatePhysicalStaggeredRearGroupV1(
    rearInput,rear),true);
  const contactRaceInput={...catchingInput,
    riderIds:['control-2','other-3'],
    contactKm:contacts[0].contactKm,throughKm:20};
  const contactRace=replayPhysicalStaggeredContactRaceV1(
    contactRaceInput);
  assert.equal(contactRace.kilometres.reduce((sum,row)=>
    sum+row.riderStates.length,0),480);
  assert.equal(Object.keys(contactRace
    .observedFinishSecondsByRider).length,24);
  assert.equal(contactRace.kilometres[
    contacts[0].contactKm-1].riderStates.filter(row=>
    row.physicalGroupId===contactRoad.physicalGroup.id)
    .length,2);
  assert.equal(validatePhysicalStaggeredContactRaceV1(
    contactRaceInput,contactRace),true);
  const forgedContactRace=structuredClone(contactRace);
  forgedContactRace.kilometres.at(-1).riderStates.find(row=>
    row.riderId==='control-2').energyAfter+=1;
  assert.throws(()=>validatePhysicalStaggeredContactRaceV1(
    contactRaceInput,forgedContactRace),/differs/);
  const forged=structuredClone(recording);
  forged.losses[1].atDistanceM=11000;
  assert.throws(()=>validatePhysicalStaggeredBunchLossV1({
    ...input,throughKm:20},forged),/differ/);
});

test('unsupported orders and physical inability refuse before movement',()=>{
  const input=source();
  const noLeader=structuredClone(input.startInput.teams);
  delete noLeader[0].orders.baseline.frontWork;
  delete noLeader[0].orders.baseline.frontWorkRiderId;
  assert.throws(()=>advancePhysicalStartBunchV1(source(noLeader)),
    /one ordered front worker/);
  const attack=structuredClone(input.startInput.teams);
  attack[1].orders.baseline.attack='opportunistic';
  assert.throws(()=>advancePhysicalStartBunchV1(source(attack)),
    /Invalid attack rule/);
  const invalidPhase=field();
  invalidPhase[0].orders.phases=[{atKm:2,
    frontWork:'sit_in'}];
  assert.throws(()=>source(invalidPhase),
    /Phase changes must be at a 5 km or route marker/);
  const weak=structuredClone(input.startInput.teams);
  for(const skill of SPORTING_SKILLS)weak[2].riders[3][skill]=10;
  assert.throws(()=>advancePhysicalStartBunchV1(source(weak)),
    /cannot hold paid pace/);
  const forged=structuredClone(input.start);
  forged.energyByRider['control-2']=100;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    start:forged}),/replayed start source/);
  const changedRoute=structuredClone(input.startInput);
  changedRoute.routeKilometres[0].gradientPct=4;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedRoute}),/replayed start source/);
  const changedOrders=structuredClone(input.startInput);
  changedOrders.teams[0].orders.baseline.effort='hard';
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedOrders}),/replayed start source/);
});

test('consecutive paid road rotates named leader and replays every rider',()=>{
  const teams=field();
  teams[0].orders.phases=[{atKm:1,frontWork:'sit_in'},
    {atKm:3,frontWork:'rotate',frontWorkRiderId:'control-3'}];
  teams[1].orders.phases=[{atKm:1,frontWork:'rotate',
    frontWorkRiderId:'sprint-2'},
  {atKm:3,frontWork:'sit_in'}];
  const input=source(teams,route(),undefined,[{km:1},{km:3}]);
  const road=runPhysicalBunchV1({...input,throughKm:5});
  assert.deepEqual(road.road.map(row=>row.leaderRiderId),
    ['control-2','sprint-2','sprint-2','control-3','control-3']);
  assert.deepEqual(road.road.map(row=>row.sourceKm),[1,2,3,4,5]);
  assert.equal(road.physicalGroup.atDistanceM,5000);
  assert.equal(road.road.reduce((sum,row)=>sum+
    row.riderDecisions.length,0),120);
  assert.ok(road.elapsedSeconds>road.road[0].elapsedSeconds);
  for(let index=1;index<road.road.length;index++)for(const rider of
    road.road[index].riders){
    assert.equal(rider.energyBefore,
      road.road[index-1].energyByRider[rider.riderId]);
  }
  assert.equal(validatePhysicalBunchRunV1({...input,
    throughKm:5},road),true);
  const forged=structuredClone(road);
  forged.road[2].riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalBunchRunV1({...input,
    throughKm:5},forged),/differs/);
});

test('named manager attack forms front solo only by paid faster road',()=>{
  const teams=field();
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[2][skill]=95;
  const input=source(teams,route(),{
    sprint:'sprint_finish',other:'break_stage'},[{km:1}]);
  const attack=runPhysicalNamedAttackV1({...input,
    attackKm:2});
  assert.equal(attack.frontSolo.riderIds[0],'other-2');
  assert.equal(attack.bunch.riderIds.length,23);
  assert.ok(!attack.bunch.riderIds.includes('other-2'));
  assert.ok(attack.frontGapSeconds>0);
  assert.ok(attack.frontSolo.elapsedSeconds<
    attack.bunch.elapsedSeconds);
  assert.equal(attack.step.riderDecisions.length,24);
  assert.equal(attack.step.riderDecisions.find(row=>
    row.riderId==='other-2').goal,'break_stage');
  assert.ok(attack.step.riders.find(row=>
    row.riderId==='other-2').energySpent>0);
  assert.equal(validatePhysicalNamedAttackV1({...input,
    attackKm:2},attack),true);
  const forged=structuredClone(attack);
  forged.frontGapSeconds+=1;
  assert.throws(()=>validatePhysicalNamedAttackV1({...input,
    attackKm:2},forged),/differs/);
  assert.throws(()=>runPhysicalBunchV1({...input,
    throughKm:2}),/one ordered front worker/);
  const noStake=source(teams,route(),undefined,[{km:1}]);
  assert.throws(()=>runPhysicalNamedAttackV1({...noStake,
    attackKm:2}),/actual sporting stake/);
  const weakTeams=field();
  weakTeams[2].orders.baseline={
    ...weakTeams[2].orders.baseline,
    attack:'selective',attackRiderId:'other-2',
    effort:'hard'};
  for(const skill of SPORTING_SKILLS)
    weakTeams[2].riders[2][skill]=20;
  const weak=source(weakTeams,route(),{
    other:'break_stage'});
  assert.throws(()=>runPhysicalNamedAttackV1({...weak,
    attackKm:1}),/cannot establish physical gap/);
  const bunchInput={...input,attackKm:2,throughKm:4};
  const continued=runPhysicalBunchAfterNamedAttackV1(
    bunchInput);
  assert.equal(continued.road.length,2);
  assert.ok(continued.road.every(row=>
    row.physicalGroup.riderIds.length===23&&
    row.riderDecisions.length===23&&
    row.blockedAttacks.length===1&&
    row.blockedAttacks[0].reason==='already_ahead'));
  assert.ok(!Object.hasOwn(continued.energyByRider,
    'other-2'));
  assert.equal(validatePhysicalBunchAfterNamedAttackV1(
    bunchInput,continued),true);
  const falseBunch=structuredClone(continued);
  falseBunch.road[0].blockedAttacks=[];
  assert.throws(()=>validatePhysicalBunchAfterNamedAttackV1(
    bunchInput,falseBunch),/differs/);
  const secondOrder=structuredClone(teams);
  secondOrder[2].orders.phases.push({atKm:2,
    attackRiderId:'other-3'});
  const changedAttack=source(secondOrder,route(),{
    other:'break_stage'},[{km:1},{km:2}]);
  assert.throws(()=>runPhysicalBunchAfterNamedAttackV1({
    ...changedAttack,attackKm:2,throughKm:3}),
  /one ordered front worker/);
  const frontInput={...input,attackKm:2,throughKm:20};
  const front=runPhysicalFrontSoloV1(frontInput);
  assert.equal(front.steps.length,18);
  assert.ok(front.steps.every(row=>
    row.gapSecondsToBunch>0&&row.energySpent>0&&
    row.recoveryAward===0&&
    row.decision.teamOrderEffort==='hard'));
  assert.equal(front.physicalGroup.atDistanceM,20000);
  assert.ok(front.observedFinishSeconds>0);
  assert.equal(validatePhysicalFrontSoloV1(frontInput,front),true);
  assert.ok(front.steps.every(row=>
    row.decision.version===undefined));
  const versionedStartInput={...input.startInput,
    physicalDecisionVersion:1};
  const versionedFront=runPhysicalFrontSoloV1({
    startInput:versionedStartInput,
    start:startPhysicalBunchV1(versionedStartInput),
    attackKm:2,throughKm:4});
  assert.ok(versionedFront.steps.every(row=>
    row.decision.version===row.version&&
    row.decision.teamOrderEffort==='hard'));
  assert.equal(versionedFront.steps[0].energyAfter,
    front.steps[0].energyAfter);
  const chasedInput={frontRiderId:'other-2',
    priorFront:front.steps[0],
    segment:input.startInput.routeKilometres[3]};
  const legacyChased=advancePhysicalChasedFrontStepV1({
    ...chasedInput,startInput:input.startInput});
  const versionedChased=advancePhysicalChasedFrontStepV1({
    ...chasedInput,startInput:versionedStartInput});
  assert.equal(legacyChased.decision.version,
    undefined);
  assert.equal(versionedChased.decision.version,
    versionedChased.version);
  assert.equal(versionedChased.energyAfter,
    legacyChased.energyAfter);
  const forgedFront=structuredClone(front);
  forgedFront.steps[0].gapSecondsToBunch+=1;
  assert.throws(()=>validatePhysicalFrontSoloV1(
    frontInput,forgedFront),/differs/);
  const full=replayPhysicalFrontRaceV1(frontInput);
  assert.equal(full.kilometres.length,20);
  assert.ok(full.kilometres.every(row=>
    row.riderStates.length===24&&row.riderStates.every(state=>
      state.decisions.length>0&&state.energyAfter>=0)));
  assert.equal(Object.keys(full.observedFinishSecondsByRider)
    .length,24);
  assert.ok(full.observedFinishSecondsByRider['other-2']<
    full.observedFinishSecondsByRider['control-0']);
  assert.equal(validatePhysicalFrontRaceV1(frontInput,full),true);
  const falseFull=structuredClone(full);
  falseFull.kilometres[10].riderStates[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalFrontRaceV1(
    frontInput,falseFull),/differs/);
});

test('front rider and first rear split keep separate paid sources',()=>{
  const teams=field(10);
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[1][skill]=100;
  teams[0].riders[3].mountain=30;
  teams[2].orders.baseline={
    ...teams[2].orders.baseline,
    attack:'selective',attackRiderId:'other-1',
    effort:'hard'};
  teams[2].orders.phases=[{atKm:1,
    attack:'none',effort:'steady'}];
  const kilometres=route();
  kilometres[2]={...kilometres[2],
    terrain:'climb',gradientPct:6};
  const base=source(teams,kilometres,{
    other:'break_stage'},[{km:1}]);
  const startInput={...base.startInput,
    physicalDraftVersion:4,
    physicalRearIntentVersion:2};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,attackKm:1,
    lossKm:3};
  const result=replayPhysicalFrontFirstRearLossKmV1(
    input);
  assert.equal(result.sourceKm,3);
  assert.equal(result.sourcedRiderCount,24);
  assert.equal(result.endFrontState.riderId,
    'other-1');
  assert.ok(result.candidateRearSolos.some(row=>
    row.riderId==='control-3'));
  assert.equal(result.fieldKilometreIncomplete,
    false);
  assert.equal(result.riderCount,24);
  assert.equal(result.riderStates.length,24);
  assert.equal(validatePhysicalFrontFirstRearLossKmV1(
    input,result),true);
  const next=replayPhysicalFrontRearNextKmV1(input);
  assert.equal(next.sourceKm,4);
  assert.equal(next.riderCount,24);
  assert.equal(next.fieldKilometreIncomplete,
    false);
  assert.equal(next.endRearEntities.length,
    result.endRearSolos.length);
  assert.equal(validatePhysicalFrontRearNextKmV1(
    input,next),true);
  const fifth=advancePhysicalFrontRearClearKmV1({
    startInput,prior:next});
  assert.equal(fifth.sourceKm,5);
  assert.equal(fifth.riderCount,24);
  const forged=structuredClone(result);
  forged.sources.frontStep.energyAfter+=1;
  assert.throws(()=>(
    validatePhysicalFrontFirstRearLossKmV1(
      input,forged)),/differs/);
  const simultaneous=structuredClone(startInput);
  for(const riderId of ['sprint-3','other-3'])
    simultaneous.teams.flatMap(team=>team.riders)
      .find(row=>row.id===riderId).mountain=30;
  const pending=replayPhysicalFrontFirstRearLossKmV1({
    ...input,startInput:simultaneous,
    start:startPhysicalBunchV1(simultaneous)});
  assert.ok(pending.candidateEventCount>0);
  assert.equal(pending.fieldKilometreIncomplete,
    true);
  assert.equal(pending.riderStates,undefined);
  assert.throws(()=>(
    replayPhysicalFrontRearNextKmV1({
      ...input,startInput:simultaneous,
      start:startPhysicalBunchV1(simultaneous)})),
  /settled prior road/);
});

test('stronger later bunch worker creates an energy-priced catch window',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[2][skill]=95;
  for(const skill of SPORTING_SKILLS)
    teams[0].riders[3][skill]=100;
  teams[0].orders.phases=[{atKm:5,frontWorkRiderId:'control-3',
    effort:'hard'}];
  teams[1].orders.phases=[{atKm:5,effort:'hard'}];
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  const input=source(teams,route(),{
    other:'break_stage'},[{km:1}]);
  let catchKm=null;
  for(let throughKm=3;throughKm<=20;throughKm++){
    try{runPhysicalFrontSoloV1({...input,attackKm:2,
      throughKm});}
    catch(error){
      assert.match(error.message,/physical catch road/);
      catchKm=throughKm;
      break;
    }
  }
  assert.ok(catchKm>5&&catchKm<20);
  const before=runPhysicalFrontSoloV1({...input,
    attackKm:2,throughKm:catchKm-1});
  assert.ok(before.gapSecondsToBunch>0);
  const catchInput={...input,attackKm:2,catchKm};
  const contact=catchPhysicalFrontSoloV1(catchInput);
  assert.equal(contact.contact.kind,
    'bunch_catches_front_solo');
  assert.ok(contact.contact.atDistanceM>
    (catchKm-1)*1000&&
    contact.contact.atDistanceM<catchKm*1000);
  assert.equal(contact.bunchPartial.physicalGroup.riderIds.length,23);
  assert.ok(!contact.bunchPartial.physicalGroup.riderIds
    .includes('other-2'));
  assert.ok(contact.frontPartial.energySpent>0);
  assert.ok(contact.bunchPartial.riders.every(row=>
    row.energySpent>0));
  assert.equal(validatePhysicalFrontBunchCatchV1(
    catchInput,contact),true);
  const forged=structuredClone(contact);
  forged.contact.clockSeconds+=1;
  assert.throws(()=>validatePhysicalFrontBunchCatchV1(
    catchInput,forged),/differs/);
  assert.throws(()=>catchPhysicalFrontSoloV1({...input,
    attackKm:2,catchKm:catchKm-1}),
  /no paid bunch catch here/);
  const slideInput={...catchInput,catchRecord:contact};
  const slide=slideCaughtBreakRiderV1(slideInput);
  assert.equal(slide.decision.choice,'slide_through');
  assert.equal(slide.decision.goal,'finish_safely');
  assert.ok(slide.holdAbility<slide.bunchLeaderAbility);
  assert.ok(slide.gapSecondsToBunch>0);
  assert.ok(slide.energySpent>0);
  assert.equal(slide.physicalGroup.riderIds[0],'other-2');
  assert.equal(validateCaughtBreakSlideV1(slideInput,slide),true);
  const falseSlide=structuredClone(slide);
  falseSlide.gapSecondsToBunch=0;
  assert.throws(()=>validateCaughtBreakSlideV1(
    slideInput,falseSlide),/differs/);
  const afterInput={...catchInput,catchRecord:contact,
    slideRecord:slide,throughKm:catchKm+1};
  const after=runPhysicalBunchAfterCaughtSlideV1(afterInput);
  assert.equal(after.road.length,1);
  assert.equal(after.road[0].riderDecisions.length,23);
  assert.ok(!after.physicalGroup.riderIds.includes('other-2'));
  assert.deepEqual(after.road[0].blockedAttacks,[{
    teamId:'other',riderId:'other-2',
    reason:'dropped_after_paid_catch'}]);
  assert.equal(validatePhysicalBunchAfterCaughtSlideV1(
    afterInput,after),true);
  const falseAfter=structuredClone(after);
  falseAfter.road[0].blockedAttacks[0].reason='already_ahead';
  assert.throws(()=>validatePhysicalBunchAfterCaughtSlideV1(
    afterInput,falseAfter),/differs/);
  const solo=runPhysicalSlidBreakSoloV1(afterInput);
  assert.deepEqual(solo.steps.map(row=>row.sourceKm),
    [catchKm+1]);
  assert.ok(solo.steps[0].gapSecondsToBunch>0&&
    solo.steps[0].energySpent>0&&
    solo.steps[0].recoveryAward===0);
  assert.equal(solo.steps[0].decision.teamOrderEffort,'hard');
  assert.equal(validatePhysicalSlidBreakSoloV1(
    afterInput,solo),true);
  const falseSolo=structuredClone(solo);
  falseSolo.steps[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalSlidBreakSoloV1(
    afterInput,falseSolo),/differs/);
  const finishInput={...afterInput,throughKm:20};
  const finished=runPhysicalSlidBreakSoloV1(finishInput);
  assert.equal(finished.steps.length,20-catchKm);
  assert.equal(finished.physicalGroup.atDistanceM,20000);
  assert.ok(finished.observedFinishSeconds>
    finished.steps.at(-1).bunchElapsedSeconds);
  assert.equal(validatePhysicalSlidBreakSoloV1(
    finishInput,finished),true);
  const raceInput={...input,attackKm:2,catchKm,
    throughKm:20};
  const race=replayPhysicalCaughtBreakRaceV1(raceInput);
  assert.equal(race.kilometres.length,20);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===24&&row.riderStates.every(state=>
      state.decisions.length>0&&state.energyAfter>=0)));
  assert.equal(Object.keys(race.observedFinishSecondsByRider)
    .length,24);
  assert.ok(race.observedFinishSecondsByRider['other-2']>
    race.observedFinishSecondsByRider['control-0']);
  assert.equal(validatePhysicalCaughtBreakRaceV1(
    raceInput,race),true);
  const falseRace=structuredClone(race);
  falseRace.kilometres[catchKm-1].riderStates[18]
    .elapsedSeconds+=1;
  assert.throws(()=>validatePhysicalCaughtBreakRaceV1(
    raceInput,falseRace),/differs/);
});

test('front catch can be paid in first kilometre after attack',()=>{
  const teams=field(0);
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  teams[2].riders[2].mountain=30;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'},
  {atKm:2,effort:'conserve'}];
  teams[0].orders.phases=[{atKm:3,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:3,chase:'selective',
    frontWork:'rotate',frontWorkRiderId:'sprint-2'}];
  const road=route();
  road[2]={...road[2],terrain:'climb',gradientPct:6};
  const input=source(teams,road,{
    other:'break_stage',sprint:'sprint_finish'},
  [{km:1},{km:2},{km:3}]);
  const attack=runPhysicalFrontSoloV1({...input,
    attackKm:2,throughKm:2});
  assert.equal(attack.steps.length,0);
  assert.equal(attack.sourceKm,2);
  assert.equal(attack.physicalGroup.riderIds[0],'other-2');
  assert.equal(validatePhysicalFrontSoloV1({...input,
    attackKm:2,throughKm:2},attack),true);
  const contact=catchPhysicalFrontSoloV1({...input,
    attackKm:2,catchKm:3});
  assert.ok(contact.contact.atDistanceM>2000&&
    contact.contact.atDistanceM<3000);
  assert.ok(contact.frontPartial.energySpent>0);
  assert.equal(validatePhysicalFrontBunchCatchV1({
    ...input,attackKm:2,catchKm:3},contact),true);
  const race=replayPhysicalCaughtBreakRaceV1({...input,
    attackKm:2,catchKm:3,throughKm:20});
  assert.equal(race.kilometres.length,20);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(Object.keys(race.observedFinishSecondsByRider)
    .length,24);
  assert.equal(race.sources.bunch.road[0]
    .resolvedChase.teamId,'sprint');
  assert.equal(race.sources.bunch.road[0]
    .resolvedChase.caughtRiderId,'other-2');
  assert.equal(race.sources.bunch.road[0]
    .resolvedChase.order,'selective');
  assert.equal(race.sources.bunch.road[0]
    .riderDecisions.find(row=>row.riderId==='sprint-2')
    .choice,'pull');
  assert.equal(validatePhysicalCaughtBreakRaceV1({...input,
    attackKm:2,catchKm:3,throughKm:20},race),true);
});

test('caught break and later follower loss have paid rider states',()=>{
  const teams=field(0);
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  teams[2].riders[2].wind=30;
  teams[1].riders[2].mountain=30;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'},
  {atKm:2,effort:'conserve'}];
  teams[0].orders.phases=[{atKm:3,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:3,chase:'selective',
    frontWork:'rotate',frontWorkRiderId:'sprint-2'},
  {atKm:13,chase:'ignore',
    frontWorkRiderId:'sprint-3'}];
  const road=route();
  road[2]={...road[2],exposed:true,
    weather:{temperatureC:16,windKph:30,rainMm:0}};
  road[13]={...road[13],terrain:'climb',gradientPct:6};
  const input=source(teams,road,{
    other:'break_stage',sprint:'sprint_finish'},
  [{km:1},{km:2},{km:3},{km:13}]);
  const lossInput={...input,attackKm:2,catchKm:3,
    lossKm:14};
  const replay=replayPhysicalEarlyCaughtFollowerLossV1(
    lossInput);
  assert.equal(replay.kilometres.length,14);
  assert.equal(replay.kilometres.at(-1)
    .riderStates.length,24);
  assert.ok(replay.sources.loss.splits.length===1);
  assert.equal(validatePhysicalEarlyCaughtFollowerLossV1(
    lossInput,replay),true);
  const next=replayPhysicalEarlyCaughtNextRearKmV1(
    lossInput);
  assert.equal(next.sourceKm,15);
  assert.equal(next.kilometres.length,15);
  assert.equal(next.kilometres.at(-1)
    .riderStates.length,24);
  assert.equal(next.kilometres.at(-1)
    .riderStates.filter(row=>row.physicalGroupId===
      'peloton').length,22);
  assert.equal(next.sources.contact,undefined);
  assert.equal(next.sources.rearSegments.length,2);
  assert.equal(validatePhysicalEarlyCaughtNextRearKmV1(
    lossInput,next),true);
  const contactRoad=structuredClone(road);
  contactRoad[14]={...contactRoad[14],terrain:'climb',
    gradientPct:6};
  const contactSource=source(teams,contactRoad,{
    other:'break_stage',sprint:'sprint_finish'},
  [{km:1},{km:2},{km:3},{km:13}]);
  const contactInput={...contactSource,
    attackKm:2,catchKm:3,lossKm:14};
  const contactNext=replayPhysicalEarlyCaughtNextRearKmV1(
    contactInput);
  assert.equal(contactNext.sources.contact.outcome,'join');
  assert.equal(contactNext.sources.contact.catchingRiderId,
    'other-2');
  assert.ok(contactNext.sources.contact.atDistanceM>14000&&
    contactNext.sources.contact.atDistanceM<15000);
  assert.equal(contactNext.sources.group.rows.filter(row=>
    row.role==='leader').length,1);
  assert.equal(contactNext.sources.group.rows.filter(row=>
    row.role==='sheltered').length,1);
  assert.equal(contactNext.sources.rearSegments.length,4);
  assert.ok(contactNext.sources.rearSegments.every(row=>
    row.endDistanceM>row.startDistanceM&&
    row.endClock>row.startClock&&
    row.energySpent>=0));
  assert.ok(contactNext.sources.group.rows.every(row=>
    Math.abs(row.energyBefore-
      contactNext.sources.contact.riders.find(item=>
        item.riderId===row.riderId)
        .energyAtContact)<1e-6));
  assert.ok(contactNext.sources.group.rows.find(row=>
    row.role==='leader').energySpent>
    contactNext.sources.group.rows.find(row=>
      row.role==='sheltered').energySpent);
  assert.equal(contactNext.kilometres.at(-1)
    .riderStates.length,24);
  assert.equal(new Set(contactNext.kilometres.at(-1)
    .riderStates.filter(row=>row.physicalGroupId
      .startsWith('rear-event-')).map(row=>
      row.physicalGroupId)).size,1);
  assert.equal(validatePhysicalEarlyCaughtNextRearKmV1(
    contactInput,contactNext),true);
  assert.ok(JSON.stringify(contactNext).includes(
    'rear-event-other-2-sprint-2'));
  const finishInput={...contactInput,throughKm:20};
  const finished=replayPhysicalEarlyCaughtRearFinishV1(
    finishInput);
  assert.equal(finished.kilometres.length,20);
  assert.ok(finished.kilometres.every(row=>
    row.riderStates.length===24&&
    row.riderStates.every(state=>
      state.decisions.length>0&&
      state.energyAfter>=0)));
  assert.deepEqual(finished.sources.later.map(row=>
    row.rear.leaderRiderId),
  ['sprint-2','other-2','sprint-2',
    'other-2','sprint-2']);
  assert.equal(Object.keys(finished
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalEarlyCaughtRearFinishV1(
    finishInput,finished),true);
  const draftTeams=structuredClone(teams);
  draftTeams[1].orders.phases.at(-1).effort='hard';
  const draftSource=source(draftTeams,
    structuredClone(contactRoad),{
      other:'break_stage',sprint:'sprint_finish'},
  [{km:1},{km:2},{km:3},{km:13}]);
  const draftStartInput={...draftSource.startInput,
    physicalDraftVersion:3};
  const draftInput={...draftSource,
    startInput:draftStartInput,
    start:startPhysicalBunchV1(draftStartInput),
    attackKm:2,catchKm:3,lossKm:14};
  const draftPrior=replayPhysicalCaughtBreakRaceV1({
    ...draftInput,throughKm:13});
  const draftPriorStep=draftPrior.sources.bunch.road.at(-1);
  const draftLoss=advancePhysicalBunchAfterCaughtSlideLossKmV1({
    startInput:draftStartInput,
    prior:{riderIds:draftPriorStep.physicalGroup.riderIds,
      energyByRider:draftPriorStep.energyByRider,
      quietKmByRider:draftPriorStep.quietKmByRider},
    segment:contactRoad[13],caughtRiderId:'other-2'});
  assert.equal(draftLoss.splits.length,16);
  assert.ok(new Set(draftLoss.splits.map(row=>
    row.atDistanceM)).size<draftLoss.splits.length);
  const draftLeader=draftLoss.riders.find(row=>
    row.riderId===draftLoss.leaderRiderId);
  const couldMatchAtHard=draftLoss.splits.filter(split=>{
    const rider=draftLoss.riders.find(row=>
      row.riderId===split.riderId);
    const team=draftStartInput.teams.find(row=>
      row.riders.some(item=>item.id===split.riderId));
    const ordered=orderAt(team.orders,13).effort;
    return rider.holdAbility+20*(
      TUNING.effortPressure.hard-
      TUNING.effortPressure[ordered])>=
      draftLeader.holdAbility;
  });
  assert.equal(couldMatchAtHard.length,15);
  const classifiedStartInput={...draftStartInput,
    physicalDraftVersion:4};
  const classifiedInput={...draftInput,
    startInput:classifiedStartInput,
    start:startPhysicalBunchV1(classifiedStartInput)};
  const classifiedPrior=replayPhysicalCaughtBreakRaceV1({
    ...classifiedInput,throughKm:13});
  const classifiedPriorStep=classifiedPrior.sources.bunch
    .road.at(-1);
  const classifiedLoss=advancePhysicalBunchAfterCaughtSlideLossKmV1({
    startInput:classifiedStartInput,
    prior:{riderIds:classifiedPriorStep.physicalGroup.riderIds,
      energyByRider:classifiedPriorStep.energyByRider,
      quietKmByRider:classifiedPriorStep.quietKmByRider},
    segment:contactRoad[13],caughtRiderId:'other-2'});
  assert.equal(classifiedLoss.splits.length,16);
  assert.deepEqual(classifiedLoss.splits.map(row=>
    row.atDistanceM),draftLoss.splits.map(row=>
    row.atDistanceM));
  assert.equal(classifiedLoss.elapsedSeconds,
    draftLoss.elapsedSeconds);
  assert.equal(classifiedLoss.splits.filter(row=>
    row.orderLimited).length,15);
  assert.equal(classifiedLoss.riderDecisions.filter(row=>
    row.reason==='team_effort_ceiling'&&
    row.choice==='try_hold_within_order').length,15);
  assert.equal(classifiedLoss.riderDecisions.find(row=>
    row.riderId==='sprint-2').reason,
  'cannot_hold_even_at_hard_effort');
  assert.equal(classifiedLoss.riderDecisions.find(row=>
    row.riderId==='sprint-2').choice,
  'pace_loss');
  assert.ok(draftLoss.riderDecisions.filter(row=>
    row.reason==='cannot_hold_paid_front_pace').length>=16);
  assert.throws(()=>replayPhysicalEarlyCaughtNextRearKmV1(
    draftInput),/one priced follower loss/);
  assert.throws(()=>replayPhysicalEarlyCaughtNextRearKmV1(
    classifiedInput),/one priced follower loss/);
  const forgedFinish=structuredClone(finished);
  forgedFinish.kilometres.at(-1).riderStates.find(row=>
    row.riderId==='sprint-2').elapsedSeconds+=1;
  assert.throws(()=>validatePhysicalEarlyCaughtRearFinishV1(
    finishInput,forgedFinish),/differs/);
  const passCommitment=commitTeamChaseStakesV1({
    teams:contactSource.startInput.teams,
    distanceKm:contactRoad.length,
    keypoints:[{km:1},{km:2},{km:3},{km:13}],
    intentions:contactSource.startInput.teams.map(team=>({
      teamId:team.id,baseline:{
        goal:team.id==='other'?'break_stage':
          team.id==='sprint'?'sprint_finish':'none',
        captainId:team.id==='other'?'other-2':
          team.riders[0].id},phases:[]}))});
  const passStartInput={...contactSource.startInput,
    commitment:passCommitment};
  const passInput={...contactInput,
    startInput:passStartInput,
    start:startPhysicalBunchV1(passStartInput)};
  const passed=replayPhysicalEarlyCaughtNextRearKmV1(
    passInput);
  assert.equal(passed.sources.contact.outcome,
    'pass_through');
  assert.equal(passed.sources.contact.atDistanceM,
    contactNext.sources.contact.atDistanceM);
  assert.equal(passed.sources.contact.clockSeconds,
    contactNext.sources.contact.clockSeconds);
  assert.deepEqual(passed.sources.contact.riders,
    contactNext.sources.contact.riders);
  assert.equal(passed.sources.group,undefined);
  assert.equal(new Set(passed.kilometres.at(-1)
    .riderStates.filter(row=>
      ['other-2','sprint-2'].includes(row.riderId))
    .map(row=>row.physicalGroupId)).size,2);
  assert.equal(validatePhysicalEarlyCaughtNextRearKmV1(
    passInput,passed),true);
  const forgedNext=structuredClone(next);
  forgedNext.kilometres.at(-1).riderStates.find(
    row=>row.riderId==='other-2').energyAfter+=1;
  assert.throws(()=>validatePhysicalEarlyCaughtNextRearKmV1(
    lossInput,forgedNext),/differs/);
  const forged=structuredClone(replay);
  forged.kilometres.at(-1).riderStates[0]
    .energyAfter+=1;
  assert.throws(()=>validatePhysicalEarlyCaughtFollowerLossV1(
    lossInput,forged),/differs from source/);
});

test('committed later-stage plan releases only a rider able to hold',()=>{
  const initial=source();
  const plan=commitRearSoloPlanV1({
    riderId:'other-3',distanceKm:20,
    stageNumber:1,stageCount:2,
    baseline:{goal:'finish_safely',
      effort:'steady'},
    phases:[{atKm:5,goal:'save_for_stage',
      effort:'conserve',
      committedStagePlan:{riderId:'other-3',
        currentStageNumber:1,
        targetStageNumber:2,
        currentGoal:'finish_safely',
        futureGoal:'target_stage',
        reserveEnergy:80}}]});
  const startInput={...initial.startInput,
    physicalDraftVersion:4,
    soloCommitments:[plan]};
  const input={startInput,
    start:startPhysicalBunchV1(startInput),
    riderId:'other-3',releaseKm:6};
  const released=replayPhysicalCommittedStageReleaseKmV1(
    input);
  assert.equal(released.kilometres.length,6);
  assert.ok(released.kilometres.every(row=>
    row.riderStates.length===24&&
    row.riderStates.every(state=>
      state.decisions.length>0)));
  assert.equal(released.sources.release.decision.choice,
    'chose_to_release');
  assert.equal(released.sources.release.decision
    .committedStagePlan.targetStageNumber,2);
  assert.ok(released.sources.release.decision
    .orderedHoldAbility>=released.sources.release
      .decision.leaderAbility);
  assert.ok(released.sources.release.gapSecondsToBunch>0);
  assert.equal(released.sources.release.startDistanceM,
    5000);
  assert.ok(released.sources.release.energyAfter>=80);
  assert.equal(validatePhysicalCommittedStageReleaseKmV1(
    input,released),true);
  const forged=structuredClone(released);
  forged.sources.release.energyAfter+=1;
  assert.throws(()=>validatePhysicalCommittedStageReleaseKmV1(
    input,forged),/differs/);
  const unplannedStartInput={...startInput,
    soloCommitments:[]};
  assert.throws(()=>replayPhysicalCommittedStageReleaseKmV1({
    ...input,startInput:unplannedStartInput,
    start:startPhysicalBunchV1(
      unplannedStartInput)}),
  /committed bunch rider/);
  const weakTeams=field();
  weakTeams[2].riders[3].mountain=10;
  const weakRoute=route();
  weakRoute[5]={...weakRoute[5],
    terrain:'climb',gradientPct:6};
  const weakInitial=source(weakTeams,weakRoute);
  const weakStartInput={...weakInitial.startInput,
    physicalDraftVersion:4,
    soloCommitments:[plan]};
  assert.throws(()=>
    replayPhysicalCommittedStageReleaseKmV1({
      ...input,startInput:weakStartInput,
      start:startPhysicalBunchV1(
        weakStartInput)}),
  /rider able to hold/);
  const attackTeams=field();
  attackTeams[2].orders.phases=[{atKm:5,
    attack:'selective',attackRiderId:'other-3'}];
  const attackInput=source(attackTeams,route(),
    {other:'break_stage'},[{km:5}]);
  const attackStartInput={...attackInput.startInput,
    physicalDraftVersion:4,soloCommitments:[plan]};
  assert.throws(()=>
    replayPhysicalCommittedStageReleaseKmV1({
      ...input,startInput:attackStartInput,
      start:startPhysicalBunchV1(
        attackStartInput)}),
  /conflicts with named manager attack/);
  const captainPlan=commitRearSoloPlanV1({
    ...plan,riderId:'other-0',
    phases:[{...plan.phases[0],
      committedStagePlan:{...plan.phases[0]
        .committedStagePlan,riderId:'other-0'}}]});
  const captainInitial=source(field(),route(),
    {other:'sprint_finish'});
  const captainStartInput={...captainInitial.startInput,
    physicalDraftVersion:4,
    soloCommitments:[captainPlan]};
  assert.throws(()=>
    replayPhysicalCommittedStageReleaseKmV1({
      startInput:captainStartInput,
      start:startPhysicalBunchV1(
        captainStartInput),
      riderId:'other-0',releaseKm:6}),
  /conflicts with current captain stake/);
  const finished=replayPhysicalCommittedStageReleaseFinishV1(
    input);
  assert.equal(finished.kilometres.length,20);
  assert.ok(finished.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(Object.keys(finished
    .observedFinishSecondsByRider).length,24);
  assert.ok(finished.sources.later.every(row=>
    row.gapSecondsToBunch>0&&
    row.solo.energySpent>0&&
    row.solo.energyAfter>=80&&
    row.bunch.riders.filter(rider=>
      rider.role==='leader').length===1));
  assert.ok(finished.observedFinishSecondsByRider
    ['other-3']>finished.observedFinishSecondsByRider
      ['control-0']);
  assert.equal(validatePhysicalCommittedStageReleaseFinishV1(
    input,finished),true);
  const falseFinish=structuredClone(finished);
  falseFinish.observedFinishSecondsByRider
    ['other-3']+=1;
  assert.throws(()=>
    validatePhysicalCommittedStageReleaseFinishV1(
      input,falseFinish),/differs/);
  const catchTeams=field();
  catchTeams[0].riders[2].mountain=10;
  catchTeams[2].riders[3].mountain=100;
  const catchRoute=route();
  catchRoute[6]={...catchRoute[6],
    terrain:'climb',gradientPct:6};
  const catchInitial=source(catchTeams,catchRoute);
  const catchStartInput={...catchInitial.startInput,
    physicalDraftVersion:4,
    soloCommitments:[plan]};
  assert.throws(()=>
    replayPhysicalCommittedStageReleaseFinishV1({
      ...input,startInput:catchStartInput,
      start:startPhysicalBunchV1(
        catchStartInput)}),
  /needs paid bunch contact/);
  const catchInput={...input,
    startInput:catchStartInput,
    start:startPhysicalBunchV1(
      catchStartInput),throughKm:20};
  const contact=probePhysicalCommittedStageBunchContactV1(
    catchInput);
  assert.equal(contact.contact.sourceKm,7);
  assert.ok(contact.contact.atDistanceM>6000&&
    contact.contact.atDistanceM<7000);
  assert.equal(contact.contact.bunchRiders.length,23);
  assert.equal(contact.contact.bunchRiders.filter(row=>
    row.role==='leader').length,1);
  assert.ok(contact.contact.soloEnergySpentToContact>0&&
    contact.contact.soloEnergyAtContact>=80);
  assert.equal(contact.contact.physicalGroupsStillSeparate,true);
  assert.equal(validatePhysicalCommittedStageBunchContactV1(
    catchInput,contact),true);
  const fullSolo=priceRearEnergyDemandV1({
    rider:catchTeams[2].riders[3],
    segment:catchRoute[6],
    energyBefore:contact.contact.soloEnergyBefore,
    effort:'conserve',role:'solo',
    distanceM:1000});
  const partialReserve=(fullSolo.energyAfter+
    contact.contact.soloEnergyAtContact)/2;
  assert.ok(partialReserve>fullSolo.energyAfter);
  const partialPlan=commitRearSoloPlanV1({
    ...plan,phases:[{...plan.phases[0],
      committedStagePlan:{...plan.phases[0]
        .committedStagePlan,
        reserveEnergy:partialReserve}}]});
  const partialInput={...catchInput,
    startInput:{...catchStartInput,
      soloCommitments:[partialPlan]}};
  partialInput.start=startPhysicalBunchV1(
    partialInput.startInput);
  assert.ok(probePhysicalCommittedStageBunchContactV1(
    partialInput).contact.soloEnergyAtContact>=
      partialReserve);
  const forgedContact=structuredClone(contact);
  forgedContact.contact.metresIntoKm+=1;
  assert.throws(()=>
    validatePhysicalCommittedStageBunchContactV1(
      catchInput,forgedContact),/differs/);
  const joined=finishPhysicalCommittedStageBunchJoinKmV1(
    catchInput);
  assert.equal(joined.sourceKm,7);
  assert.equal(joined.riderStates.length,24);
  assert.equal(joined.riderStates.find(row=>
    row.riderId==='other-3').decisions.length,2);
  assert.equal(joined.physicalGroup.riderIds.length,24);
  assert.ok(joined.shelteredEnergySpent<
    joined.exposedAlternativeEnergyDemand);
  assert.ok(joined.energyAfter>=80);
  assert.ok(joined.holdAbility>=joined.leaderAbility);
  assert.equal(validatePhysicalCommittedStageBunchJoinKmV1(
    catchInput,joined),true);
  const forgedJoin=structuredClone(joined);
  forgedJoin.energyAfter+=1;
  assert.throws(()=>
    validatePhysicalCommittedStageBunchJoinKmV1(
      catchInput,forgedJoin),/differs/);
  const joinedRace=replayPhysicalCommittedStageJoinRaceV1(
    catchInput);
  assert.equal(joinedRace.kilometres.length,20);
  assert.ok(joinedRace.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(joinedRace.sources.later.length,13);
  assert.ok(joinedRace.sources.later.every(step=>{
    const saver=step.riderDecisions.find(row=>
      row.riderId==='other-3');
    return saver.goal==='save_for_stage'&&
      saver.effort==='conserve'&&
      saver.teamOrderEffort==='steady'&&
      saver.reason==='committed_stage_plan_shelter'&&
      step.riders.find(row=>row.riderId===
        'other-3').role==='sheltered'&&
      step.riders.filter(row=>row.role===
        'leader').length===1;
  }));
  assert.equal(Object.keys(joinedRace
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalCommittedStageJoinRaceV1(
    catchInput,joinedRace),true);
  const falseRace=structuredClone(joinedRace);
  falseRace.observedFinishSecondsByRider
    ['other-3']+=1;
  assert.throws(()=>
    validatePhysicalCommittedStageJoinRaceV1(
      catchInput,falseRace),/differs/);
});

test('stage saver can be forced off a later faster climb',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    rider.mountain=100;
  teams[0].orders.phases=[{atKm:6,
    effort:'conserve'},
  {atKm:7,effort:'steady',
    frontWorkRiderId:'control-3'}];
  const kilometres=route();
  for(const index of [6,7])
    kilometres[index]={...kilometres[index],
      terrain:'climb',gradientPct:6};
  const base=source(teams,kilometres,
    {},[{km:6},{km:7}]);
  const riderId='other-3';
  const plan=commitRearSoloPlanV1({
    riderId,distanceKm:20,
    stageNumber:1,stageCount:2,
    baseline:{goal:'finish_safely',
      effort:'steady'},
    phases:[{atKm:5,
      goal:'save_for_stage',
      effort:'conserve',
      committedStagePlan:{riderId,
        currentStageNumber:1,
        targetStageNumber:2,
        currentGoal:'finish_safely',
        futureGoal:'target_stage',
        reserveEnergy:80}}]});
  const startInput={...base.startInput,
    physicalDraftVersion:4,
    soloCommitments:[plan]};
  const input={startInput,
    start:startPhysicalBunchV1(startInput),
    riderId,releaseKm:6,
    throughKm:20};
  const join=finishPhysicalCommittedStageBunchJoinKmV1(
    input);
  assert.equal(join.sourceKm,7);
  const prior={riderIds:join.physicalGroup.riderIds,
    energyByRider:{...join.sources.bunch
      .energyByRider,[riderId]:join.energyAfter},
    quietKmByRider:{...join.sources.bunch
      .quietKmByRider,[riderId]:0}};
  const loss=advancePhysicalBunchAfterStageJoinKmV1({
    startInput,prior,segment:kilometres[7],
    riderId,contactKm:7,allowPaceLoss:true});
  assert.deepEqual(loss.splits.map(row=>
    row.riderId),[riderId]);
  assert.equal(loss.splits[0].orderLimited,true);
  const lossDecision=loss.riderDecisions.find(row=>
    row.riderId===riderId);
  assert.equal(lossDecision.choice,
    'try_hold_stage_reserve');
  assert.equal(lossDecision.reason,
    'committed_stage_effort_ceiling');
  assert.equal(lossDecision.effort,'conserve');
  assert.equal(lossDecision.teamOrderEffort,'steady');
  assert.throws(()=>
    replayPhysicalCommittedStageJoinRaceV1(input),
  /cannot hold paid pace/);
  const lossInput={...input,lossKm:8};
  const race=replayPhysicalCommittedStagePostjoinLossV1(
    lossInput);
  assert.equal(race.kilometres.length,20);
  assert.equal(race.sources.loss.splits.length,1);
  assert.equal(race.sources.completion
    .decision.reason,
  'committed_stage_effort_ceiling');
  assert.ok(race.sources.completion
    .energySpent>0&&
    race.sources.completion.energyAfter>=80);
  assert.ok(race.sources.later.every(row=>
    row.gapSecondsToBunch>0&&
    row.solo.energyAfter>=80));
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(Object.keys(race
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalCommittedStagePostjoinLossV1(
    lossInput,race),true);
  const forged=structuredClone(race);
  forged.sources.completion.energyAfter+=1;
  assert.throws(()=>
    validatePhysicalCommittedStagePostjoinLossV1(
      lossInput,forged),/differs/);
});

test('perceived chase choice reads a replayed physical front gap',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[2][skill]=95;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  teams[1].orders.phases=[{atKm:9,chase:'selective'}];
  const initial=source(teams,route(),{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:9}]);
  const input={...initial,attackKm:2,choiceKm:10,
    observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  const choice=decidePhysicalFrontThreatV1(input);
  assert.equal(choice.sourceKm,10);
  assert.equal(choice.frontRiderId,'other-2');
  assert.ok(choice.observedGapSeconds>0);
  assert.ok(Math.abs(choice.observedGapSeconds-
    choice.physicalSource.front.gapSecondsToBunch)<1e-7);
  assert.ok(!Object.hasOwn(choice,'choiceInput'));
  assert.equal(choice.choice.stake.goal,'sprint_finish');
  assert.equal(choice.choice.choice.assessments[0].action,
    'watch');
  assert.equal(choice.movesRoad,false);
  assert.throws(()=>advancePhysicalPerceivedChaseKmV1(input),
    /has not committed paid chase/);
  assert.equal(validatePhysicalFrontThreatV1(input,choice),true);
  const forged=structuredClone(choice);
  forged.observedGapSeconds+=1;
  assert.throws(()=>validatePhysicalFrontThreatV1(
    input,forged),/differs/);
  const lateTeams=field();
  for(const team of lateTeams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    lateTeams[2].riders[2][skill]=95;
  lateTeams[2].orders.phases=[{atKm:1,
    attack:'selective',attackRiderId:'other-2',
    effort:'hard'}];
  lateTeams[1].orders.phases=[{atKm:15,
    chase:'selective'}];
  const lateSource=source(lateTeams,route(),{
    sprint:'sprint_finish',other:'break_stage'},[{km:1}]);
  const late=decidePhysicalFrontThreatV1({...lateSource,
    attackKm:2,choiceKm:16,
    observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']});
  assert.equal(late.choice.choice.assessments[0].action,
    'capacity_shortfall');
  assert.ok(late.observedGapSeconds>
    choice.observedGapSeconds);
});

test('perceived urgency pays one named chase leader and full field',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const rider of teams[1].riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=99;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  teams[0].orders.phases=[{atKm:7,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:7,
    frontWork:'rotate',frontWorkRiderId:'sprint-2',
    chase:'selective'}];
  const initial=source(teams,route(),{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:7}]);
  const startInput={...initial.startInput,
    raceSeed:'same-threat-window-seed'};
  const input={startInput,start:startPhysicalBunchV1(startInput),
    attackKm:2,choiceKm:8,
    observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  assert.equal(decidePhysicalFrontThreatV1(input)
    .choice.choice.assessments[0].action,
  'commit_now');
  const paid=advancePhysicalPerceivedChaseKmV1(input);
  assert.equal(paid.threat.choice.choice.assessments[0].action,
    'commit_now');
  assert.equal(paid.bunchStep.leaderRiderId,'sprint-2');
  assert.equal(paid.bunchStep.riderDecisions.find(row=>
    row.riderId==='sprint-2').choice,'chase');
  assert.equal(paid.riderStates.length,24);
  assert.ok(paid.riderStates.every(row=>
    row.energyAfter>=0&&row.decisions.length===1));
  assert.ok(paid.gapSecondsToBunch>0);
  assert.ok(paid.gapSecondsToBunch>
    paid.threat.observedGapSeconds);
  assert.equal(paid.threat.paceEstimate.leaderRiderId,
    'sprint-2');
  assert.equal(paid.threat.paceEstimate.basis,
    'observed_front_pace_and_perceived_rival_strength');
  assert.ok(Math.abs(paid.threat.paceEstimate
    .estimatedGapChangeSeconds-(paid.gapSecondsToBunch-
      paid.threat.observedGapSeconds))<.1);
  assert.equal(validatePhysicalPerceivedChaseKmV1(
    input,paid),true);
  const forged=structuredClone(paid);
  forged.bunchStep.riders[2].energyAfter+=1;
  assert.throws(()=>validatePhysicalPerceivedChaseKmV1(
    input,forged),/differs/);
  const chaseInput={...input,throughKm:20};
  const chase=runPhysicalPerceivedChaseV1(chaseInput);
  assert.equal(chase.steps.length,13);
  assert.equal(Object.keys(
    chase.observedFinishSecondsByRider).length,24);
  assert.ok(chase.steps.every(row=>row.riderStates.length===24&&
    row.gapSecondsToBunch>0&&
    row.bunchStep.riders.filter(rider=>
      rider.role==='leader').length===1));
  assert.equal(validatePhysicalPerceivedChaseRunV1(
    chaseInput,chase),true);
  const rotationSource=structuredClone(startInput);
  rotationSource.teams[1].orders.phases.push({atKm:10,
    frontWork:'rotate',frontWorkRiderId:'sprint-3',
    chase:'selective'});
  const rotationInput={...chaseInput,startInput:rotationSource,
    start:startPhysicalBunchV1(rotationSource)};
  const rotated=runPhysicalPerceivedChaseV1(rotationInput);
  assert.equal(rotated.steps[0].bunchStep.leaderRiderId,
    'sprint-2');
  assert.equal(rotated.steps.find(row=>row.sourceKm===11)
    .bunchStep.leaderRiderId,'sprint-3');
  assert.equal(Object.keys(rotated.observedFinishSecondsByRider)
    .length,24);
  const race=replayPhysicalPerceivedChaseRaceV1(rotationInput);
  assert.equal(race.kilometres.length,20);
  assert.equal(race.kilometres.reduce((sum,row)=>sum+
    row.riderStates.length,0),480);
  assert.equal(Object.keys(
    race.observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalPerceivedChaseRaceV1(
    rotationInput,race),true);
  const shelteredSource={...rotationSource,
    physicalDraftVersion:3};
  const shelteredInput={...rotationInput,
    startInput:shelteredSource,
    start:startPhysicalBunchV1(shelteredSource)};
  const shelteredRace=replayPhysicalPerceivedChaseRaceV1(
    shelteredInput);
  assert.equal(shelteredRace.kilometres.length,20);
  assert.equal(shelteredRace.kilometres.reduce((sum,row)=>
    sum+row.riderStates.length,0),480);
  assert.ok(shelteredRace.kilometres.every(kilometre=>
    kilometre.riderStates.every(row=>
      row.decisions.length>0&&row.energyAfter>=0)));
  assert.ok(shelteredRace.sources.chase.steps.every(row=>
    row.bunchStep.riders.filter(rider=>
      rider.role==='leader').length===1&&
    row.bunchStep.riders.every(rider=>
      ['leader','sheltered'].includes(rider.role))));
  assert.equal(validatePhysicalPerceivedChaseRaceV1(
    shelteredInput,shelteredRace),true);
  const forgedRace=structuredClone(race);
  forgedRace.kilometres[11].riderStates.find(row=>
    row.riderId==='sprint-3').energyAfter+=1;
  assert.throws(()=>validatePhysicalPerceivedChaseRaceV1(
    rotationInput,forgedRace),/differs/);
  const stoppedSource=structuredClone(rotationSource);
  stoppedSource.teams[1].orders.phases[1].chase='ignore';
  assert.throws(()=>runPhysicalPerceivedChaseV1({
    ...rotationInput,startInput:stoppedSource,
    start:startPhysicalBunchV1(stoppedSource)}),
  /has not committed paid chase|active manager order/);
  const hardInputSource=structuredClone(startInput);
  hardInputSource.teams[1].orders.phases[0].effort='hard';
  const hardInput={...input,startInput:hardInputSource,
    start:startPhysicalBunchV1(hardInputSource)};
  assert.equal(decidePhysicalFrontThreatV1(hardInput)
    .choice.choice.assessments[0].action,
  'capacity_shortfall');
  assert.throws(()=>advancePhysicalPerceivedChaseKmV1(
    hardInput),/has not committed paid chase/);
});

test('committed physical chase catches a slowing front on paid road',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const rider of teams[1].riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=98;
  for(const rider of teams[2].riders)
    if(rider.id!=='other-2')
      for(const skill of SPORTING_SKILLS)rider[skill]=100;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'},
  {atKm:5,effort:'conserve'}];
  teams[0].orders.phases=[{atKm:12,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:12,
    frontWork:'rotate',frontWorkRiderId:'sprint-2',
    chase:'selective'},{atKm:20,chase:'ignore'}];
  const longRoute=Array.from({length:25},(_,index)=>({
    ...route()[0],km:index+1}));
  const original=source(teams,longRoute,{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:12}]);
  const startInput={...original.startInput,
    raceSeed:'same-threat-window-seed'};
  const input={startInput,
    start:startPhysicalBunchV1(startInput),
    attackKm:2,choiceKm:13,observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  assert.equal(decidePhysicalFrontThreatV1(input)
    .choice.choice.assessments[0].action,'commit_now');
  let catchKm=null;
  for(let km=14;km<=25;km++){
    try{runPhysicalPerceivedChaseV1({...input,
      throughKm:km});}
    catch(error){
      assert.match(error.message,/paid contact road/);
      catchKm=km;break;
    }
  }
  assert.equal(catchKm,16);
  const contactInput={...input,catchKm};
  const contact=catchPhysicalPerceivedChaseV1(contactInput);
  const horizonInput={...input,throughKm:25};
  const horizon=estimatePhysicalObserverPursuitHorizonV1(
    horizonInput);
  assert.equal(horizon.predictedContact.sourceKm,catchKm);
  assert.ok(Math.abs(horizon.predictedContact.atDistanceM-
    contact.contact.atDistanceM)<15);
  assert.equal(horizon.movesRoad,false);
  assert.equal(validatePhysicalObserverPursuitHorizonV1(
    horizonInput,horizon),true);
  const privateFuture=structuredClone(startInput);
  privateFuture.teams[2].orders.phases.push({atKm:20,
    effort:'hard'});
  assert.deepEqual(estimatePhysicalObserverPursuitHorizonV1({
    ...horizonInput,startInput:privateFuture,
    start:startPhysicalBunchV1(privateFuture)}),horizon);
  const forgedHorizon=structuredClone(horizon);
  forgedHorizon.predictedContact.atDistanceM+=100;
  assert.throws(()=>
    validatePhysicalObserverPursuitHorizonV1(
      horizonInput,forgedHorizon),/differs/);
  assert.ok(contact.contact.atDistanceM>
    (catchKm-1)*1000&&contact.contact.atDistanceM<
    catchKm*1000);
  assert.equal(contact.bunchPartial.leaderRiderId,
    'sprint-2');
  assert.ok(contact.frontPartial.energySpent>0);
  assert.equal(validatePhysicalPerceivedChaseContactV1(
    contactInput,contact),true);
  const slideInput={...contactInput,catchRecord:contact};
  const slide=slidePerceivedChaseCaughtFrontV1(slideInput);
  assert.equal(slide.decision.reason,
    'cannot_hold_paid_bunch_pace');
  assert.ok(slide.gapSecondsToBunch>0);
  assert.ok(slide.energyAfter>=0);
  assert.equal(validatePerceivedChaseCaughtSlideV1(
    slideInput,slide),true);
  const forged=structuredClone(contact);
  forged.contact.clockSeconds+=1;
  assert.throws(()=>validatePhysicalPerceivedChaseContactV1(
    contactInput,forged),/differs/);
  assert.throws(()=>slidePerceivedChaseCaughtFrontV1({
    ...slideInput,catchRecord:forged}),/replayed paid contact/);
  const raceInput={...contactInput,throughKm:25};
  const race=replayPhysicalPerceivedChaseSlideRaceV1(raceInput);
  assert.equal(race.kilometres.length,25);
  assert.ok(race.kilometres.every(km=>
    km.riderStates.length===24));
  assert.equal(race.sources.later[0].bunchStep.resolvedChase
    .caughtRiderId,'other-2');
  const afterContactPrior={
    riderIds:contact.bunchStep.physicalGroup.riderIds,
    energyByRider:contact.bunchStep.energyByRider,
    quietKmByRider:contact.bunchStep.quietKmByRider};
  const nextSegment=startInput.routeKilometres[catchKm];
  assert.throws(()=>
    advancePhysicalBunchAfterPerceivedCatchKmV1({
      startInput,prior:afterContactPrior,
      segment:nextSegment,caughtRiderId:'other-2',
      chasingTeamId:'control'}),
  /one ordered front worker|named working team/);
  assert.throws(()=>
    advancePhysicalBunchAfterPerceivedCatchKmV1({
      startInput,prior:{...afterContactPrior,
        riderIds:[...afterContactPrior.riderIds,'other-2']},
      segment:nextSegment,caughtRiderId:'other-2',
      chasingTeamId:'sprint'}),
  /cannot regain bunch without contact/);
  assert.equal(race.sources.later[0].bunchStep.riderDecisions
    .find(row=>row.riderId==='sprint-2').reason,
  'caught_chase_target_continued_front_work');
  assert.equal(race.sources.later.find(row=>
    row.sourceKm===21).bunchStep.resolvedChase,
  undefined);
  assert.ok(race.kilometres.slice(catchKm-1).every(km=>
    km.riderStates.find(row=>row.riderId==='other-2')
      .physicalGroupId==='solo-other-2'));
  assert.equal(Object.keys(
    race.observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalPerceivedChaseSlideRaceV1(
    raceInput,race),true);
  const draftSource={...startInput,physicalDraftVersion:3};
  const draftInput={...input,startInput:draftSource,
    start:startPhysicalBunchV1(draftSource)};
  let draftCatchKm=null;
  for(let km=14;km<=25;km++){
    try{runPhysicalPerceivedChaseV1({...draftInput,
      throughKm:km});}
    catch(error){
      assert.match(error.message,/paid contact road/);
      draftCatchKm=km;
      break;
    }
  }
  assert.ok(draftCatchKm!==null);
  const draftRaceInput={...draftInput,
    catchKm:draftCatchKm,throughKm:25};
  const draftRace=replayPhysicalPerceivedChaseSlideRaceV1(
    draftRaceInput);
  assert.equal(draftRace.kilometres.length,25);
  assert.ok(draftRace.kilometres.every(km=>
    km.riderStates.length===24));
  assert.ok(draftRace.sources.later.every(row=>
    row.bunchStep.riders.filter(rider=>
      rider.role==='leader').length===1&&
    row.bunchStep.riders.every(rider=>
      ['leader','sheltered'].includes(rider.role))));
  assert.equal(Object.keys(draftRace
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalPerceivedChaseSlideRaceV1(
    draftRaceInput,draftRace),true);
  const forgedRace=structuredClone(race);
  forgedRace.kilometres.at(-1).riderStates[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalPerceivedChaseSlideRaceV1(
    raceInput,forgedRace),/differs/);
  const handoffTeams=structuredClone(teams);
  handoffTeams[0].orders.phases.push({atKm:20,
    frontWork:'rotate',frontWorkRiderId:'control-3'});
  handoffTeams[1].orders.phases.at(-1).frontWork='sit_in';
  const handoffSource=source(handoffTeams,longRoute,{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:12}]);
  const handoffInput={...raceInput,
    startInput:{...handoffSource.startInput,
      raceSeed:'same-threat-window-seed'},
    start:startPhysicalBunchV1({
      ...handoffSource.startInput,
      raceSeed:'same-threat-window-seed'})};
  const handoffRace=replayPhysicalPerceivedChaseSlideRaceV1(
    handoffInput);
  assert.equal(handoffRace.sources.later.find(row=>
    row.sourceKm===21).bunchStep.leaderRiderId,'control-3');
  assert.equal(Object.keys(handoffRace
    .observedFinishSecondsByRider).length,24);
  const hillRoute=longRoute.map(segment=>
    segment.km>=14&&segment.km<=18?{
      ...segment,terrain:'hill',gradientPct:4}:segment);
  const hillSource=source(structuredClone(teams),hillRoute,{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:12}]);
  const hillStartInput={...hillSource.startInput,
    raceSeed:'same-threat-window-seed'};
  const hillInput={...raceInput,
    startInput:hillStartInput,
    start:startPhysicalBunchV1(hillStartInput)};
  assert.equal(decidePhysicalFrontThreatV1(hillInput)
    .choice.choice.assessments[0].action,
  'capacity_shortfall');
  assert.throws(()=>advancePhysicalPerceivedChaseKmV1(
    hillInput),/has not committed paid chase/);
  const managerRoad=runPhysicalManagerChaseCounterfactualV1(
    hillInput);
  assert.equal(managerRoad.perceivedAction,
    'capacity_shortfall');
  assert.equal(managerRoad.contact.sourceKm,16);
  assert.ok(managerRoad.contact.frontEnergySpent>0);
  assert.equal(managerRoad.movesGuidedRace,false);
  assert.equal(validatePhysicalManagerChaseCounterfactualV1(
    hillInput,managerRoad),true);
  const forgedManagerRoad=structuredClone(managerRoad);
  forgedManagerRoad.contact.clockSeconds+=1;
  assert.throws(()=>validatePhysicalManagerChaseCounterfactualV1(
    hillInput,forgedManagerRoad),/differs/);
  const managerContactInput={...hillInput,
    paidProbe:managerRoad};
  const managerContact=completePhysicalManagerChaseContactKmV1(
    managerContactInput);
  assert.equal(managerContact.riderStates.length,24);
  assert.ok(managerContact.gapSecondsToBunch>0);
  assert.equal(managerContact.riderStates.find(row=>
    row.riderId==='other-2').physicalGroupId,
  'solo-other-2');
  assert.equal(validatePhysicalManagerChaseContactKmV1(
    managerContactInput,managerContact),true);
  assert.throws(()=>completePhysicalManagerChaseContactKmV1({
    ...managerContactInput,paidProbe:forgedManagerRoad}),
  /replayed paid meeting/);
  const managerRace=replayPhysicalManagerChaseRaceV1(
    hillInput);
  assert.equal(managerRace.perceivedAction,
    'capacity_shortfall');
  assert.equal(managerRace.kilometres.length,25);
  assert.ok(managerRace.kilometres.every(km=>
    km.riderStates.length===24));
  assert.equal(Object.keys(managerRace
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalManagerChaseRaceV1(
    hillInput,managerRace),true);
  const acceptedManagerRace=replayPhysicalManagerChaseRaceV1(
    raceInput);
  assert.equal(acceptedManagerRace.perceivedAction,
    'commit_now');
  assert.equal(acceptedManagerRace.kilometres.length,25);
  assert.equal(Object.keys(acceptedManagerRace
    .observedFinishSecondsByRider).length,24);
  assert.equal(validatePhysicalManagerChaseRaceV1(
    raceInput,acceptedManagerRace),true);
  const handoffManagerRace=replayPhysicalManagerChaseRaceV1(
    handoffInput);
  assert.equal(handoffManagerRace.sources.later.find(row=>
    row.sourceKm===21).bunchStep.leaderRiderId,
  'control-3');
  assert.equal(validatePhysicalManagerChaseRaceV1(
    handoffInput,handoffManagerRace),true);
  const forgedManagerRace=structuredClone(managerRace);
  forgedManagerRace.kilometres.at(-1)
    .riderStates[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalManagerChaseRaceV1(
    hillInput,forgedManagerRace),/differs/);
});

test('early climb weakness records a paid partial solo and no rear group',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:1});
  const split=loss.step.splits.find(row=>
    row.riderId==='other-3');
  const rider=loss.step.riders.find(row=>
    row.riderId==='other-3');
  assert.ok(split.atDistanceM>0&&split.atDistanceM<1000);
  assert.equal(rider.role,'solo_partial');
  assert.ok(rider.energySpent>0&&rider.energyAfter<
    rider.energyBefore);
  assert.equal(rider.recoveryAward,0);
  assert.ok(!loss.step.physicalGroup.riderIds.includes('other-3'));
  assert.ok(loss.step.rearSolos.some(row=>
    row.riderId==='other-3'&&
    row.atDistanceM===split.atDistanceM));
  assert.equal(loss.step.riderDecisions.length,24);
  const whole=replayPhysicalSingleLossRaceV1({...input,
    lossKm:1,riderId:'other-3',throughKm:20});
  assert.equal(whole.kilometres.length,20);
  assert.ok(whole.observedFinishSecondsByRider['other-3']>
    whole.observedFinishSecondsByRider['control-0']);
  assert.equal(validatePhysicalBunchPaceLossV1({...input,
    lossKm:1},loss),true);
  const staggered=runPhysicalStaggeredBunchLossV1({
    ...input,throughKm:20});
  assert.deepEqual(staggered.losses.map(row=>[
    row.sourceKm,row.riderId]),[[1,'other-3']]);
  const soloField=probePhysicalStaggeredSoloFieldV1({
    ...input,staggered,throughKm:20});
  const rearInput={...input,staggered,soloField,
    throughKm:20};
  const rearRace=replayPhysicalStaggeredRearEventsV1(
    rearInput);
  assert.equal(rearRace.contactCount,0);
  assert.ok(rearRace.kilometres.every(row=>
    row.riderStates.length===24));
  assert.equal(rearRace.observedFinishSecondsByRider[
    'other-3'],whole.observedFinishSecondsByRider[
      'other-3']);
  assert.equal(validatePhysicalStaggeredRearEventsV1(
    rearInput,rearRace),true);
  const forged=structuredClone(loss);
  forged.step.splits[0].atDistanceM+=1;
  assert.throws(()=>validatePhysicalBunchPaceLossV1({...input,
    lossKm:1},forged),/differs/);
});

test('former paid bunch worker can lose a later faster leader',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[0].riders[2][skill]=90;
  teams[0].orders.phases=[{atKm:1,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:1,frontWork:'rotate',
    frontWorkRiderId:'sprint-2',effort:'hard'}];
  for(const skill of SPORTING_SKILLS)
    teams[1].riders[2][skill]=97;
  const input=source(teams,route(),undefined,[{km:1}]);
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:2});
  assert.equal(loss.step.splits.length,1);
  assert.equal(loss.priorRoad[0].leaderRiderId,'control-2');
  assert.ok(loss.step.splits.some(row=>row.riderId==='control-2'));
  assert.equal(loss.step.leaderRiderId,'sprint-2');
  assert.equal(loss.priorRoad[0].physicalGroup.riderIds.length,24);
  const completed=completePhysicalPaceLossKmV1({
    startInput:input.startInput,start:input.start,
    lossKm:2,loss,riderId:'control-2'});
  assert.equal(completed.sourceKm,2);
  assert.ok(completed.elapsedSeconds>loss.elapsedSeconds);
  const full=replayPhysicalSingleLossRaceV1({...input,
    lossKm:2,riderId:'control-2',throughKm:20});
  assert.equal(full.kilometres.length,20);
  assert.ok(full.kilometres.every(row=>
    row.riderStates.length===24));
  assert.ok(full.observedFinishSecondsByRider['control-2']>
    full.observedFinishSecondsByRider['sprint-0']);
  teams[0].orders.phases.push({atKm:2,frontWork:'rotate',
    frontWorkRiderId:'control-2'});
  teams[1].orders.phases.push({atKm:2,frontWork:'sit_in'});
  const later=source(teams,route(),undefined,[{km:1},{km:2}]);
  assert.throws(()=>runPhysicalBunchAfterPaceLossV1({...later,
    lossKm:2,throughKm:3}),/no longer in bunch/);
});

test('physically dropped planned attacker cannot launch from rear',()=>{
  const teams=field();
  for(const team of teams)for(const rider of team.riders)
    for(const skill of SPORTING_SKILLS)rider[skill]=96;
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[2][skill]=95;
  teams[2].riders[2].fatigue=40;
  teams[2].energy['other-2']=84;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'}];
  const input=source(teams,route(),{
    other:'break_stage'},[{km:1}]);
  const loss=runPhysicalBunchToPaceLossV1({...input,
    lossKm:1});
  assert.deepEqual(loss.step.splits.map(row=>row.riderId),
    ['other-2']);
  const bunch=runPhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3});
  assert.deepEqual(bunch.road[0].blockedAttacks,[{
    teamId:'other',riderId:'other-2',
    reason:'rider_dropped_before_attack'}]);
  const solo=runPhysicalDetachedSoloV1({...input,lossKm:1,
    throughKm:3,riderId:'other-2'});
  assert.ok(solo.steps.every(row=>
    row.decision.goal==='finish_safely'&&
    row.decision.effort==='conserve'&&
    row.decision.reason==='cannot_hold_paid_front_pace'&&
    row.energySpent>0));
  assert.equal(validatePhysicalDetachedSoloV1({...input,
    lossKm:1,throughKm:3,riderId:'other-2'},solo),true);
  const finished=runPhysicalDetachedSoloV1({...input,
    lossKm:1,throughKm:20,riderId:'other-2'});
  assert.equal(finished.physicalGroup.atDistanceM,20000);
  assert.ok(finished.elapsedSeconds>
    finished.steps.at(-1).bunchElapsedSeconds);
  const raceInput={...input,lossKm:1,
    riderId:'other-2',throughKm:20};
  const race=replayPhysicalSingleLossRaceV1(raceInput);
  assert.equal(race.kilometres.length,20);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===24&&row.riderStates.every(state=>
      state.decisions.length>0&&state.energyAfter>=0)));
  assert.equal(race.sources.bunch.road[0]
    .blockedAttacks[0].reason,'rider_dropped_before_attack');
  assert.ok(race.observedFinishSecondsByRider['other-2']>
    race.observedFinishSecondsByRider['control-0']);
  assert.equal(validatePhysicalSingleLossRaceV1(
    raceInput,race),true);
  const forged=structuredClone(race);
  forged.kilometres[3].riderStates[18].energyAfter+=1;
  assert.throws(()=>validatePhysicalSingleLossRaceV1(
    raceInput,forged),/differs/);
});

test('pace-loss branch refuses a fictional split or incomplete route',()=>{
  const input=source();
  assert.throws(()=>runPhysicalBunchToPaceLossV1({...input,
    lossKm:1}),/no physical pace loss/);
  const changed=structuredClone(input.startInput);
  changed.routeKilometres[0].weather.windKph=Number.NaN;
  assert.throws(()=>startPhysicalBunchV1(changed),
    /committed field and route/);
});

test('detached rider pays remaining climb road and finishes kilometre late',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:1});
  const completionInput={startInput:input.startInput,
    start:input.start,lossKm:1,loss,riderId:'other-3'};
  const completed=completePhysicalPaceLossKmV1(completionInput);
  assert.equal(completed.endDistanceM,1000);
  assert.ok(completed.elapsedSeconds>loss.elapsedSeconds);
  assert.ok(completed.gapSecondsToBunch>0);
  assert.ok(completed.energySpent>0);
  assert.ok(completed.totalKmEnergySpent>
    completed.energySpent);
  assert.equal(completed.physicalGroup.riderIds.length,1);
  assert.equal(completed.recoveryAward,0);
  assert.equal(validatePhysicalPaceLossCompletionV1(
    completionInput,completed),true);
  const forged=structuredClone(completed);
  forged.gapSecondsToBunch=0;
  assert.throws(()=>validatePhysicalPaceLossCompletionV1(
    completionInput,forged),/differs/);
  assert.throws(()=>completePhysicalPaceLossKmV1({...completionInput,
    riderId:'other-2'}),/detached source rider/);
});

test('surviving bunch pays later leaders without reclaiming detached rider',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const continued=runPhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3});
  assert.equal(continued.road.length,2);
  assert.deepEqual(continued.road.map(row=>row.sourceKm),[2,3]);
  assert.ok(!continued.physicalGroup.riderIds.includes('other-3'));
  assert.ok(!Object.hasOwn(continued.bunchEnergyByRider,'other-3'));
  assert.equal(continued.road[0].riderDecisions.length,
    continued.loss.step.physicalGroup.riderIds.length);
  assert.ok(continued.elapsedSeconds>
    continued.loss.elapsedSeconds);
  assert.equal(validatePhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3},continued),true);
  const forged=structuredClone(continued);
  forged.road[0].physicalGroup.riderIds.push('other-3');
  assert.throws(()=>validatePhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3},forged),/differs/);
});

test('detached rider follows pre-race solo plan with paid later road',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const initial=source(teams,route('climb'));
  const plan=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'finish_safely',effort:'conserve'}});
  const startInput={...initial.startInput,
    soloCommitments:[plan]};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,lossKm:1,
    throughKm:3,riderId:'other-3'};
  const run=runPhysicalDetachedSoloV1(input);
  assert.deepEqual(run.steps.map(row=>row.sourceKm),[2,3]);
  assert.ok(run.steps.every(row=>
    row.decision.goal==='finish_safely'&&
    row.energySpent>0&&row.recoveryAward===0&&
    row.gapSecondsToBunch>0));
  assert.equal(run.physicalGroup.riderIds[0],'other-3');
  assert.ok(run.elapsedSeconds>
    run.steps.at(-1).bunchElapsedSeconds);
  assert.equal(validatePhysicalDetachedSoloV1(input,run),true);
  const forged=structuredClone(run);
  forged.steps[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalDetachedSoloV1(input,forged),
    /differs/);
  const changed=structuredClone(startInput);
  changed.soloCommitments[0].baseline.effort='hard';
  assert.throws(()=>runPhysicalDetachedSoloV1({...input,
    startInput:changed}),/replayed committed start/);
  const phased=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'finish_safely',effort:'conserve'},
    phases:[{atKm:5,goal:'rejoin_bunch',effort:'steady'}]});
  const phasedInput={...initial.startInput,
    soloCommitments:[phased]};
  const changedGoal=runPhysicalDetachedSoloV1({
    startInput:phasedInput,start:startPhysicalBunchV1(phasedInput),
    lossKm:1,throughKm:6,riderId:'other-3'});
  assert.equal(changedGoal.steps[3].decision.goal,'finish_safely');
  assert.equal(changedGoal.steps[4].decision.goal,'rejoin_bunch');
});

test('opt-in rear intent follows committed effort and sporting stake',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)
    teams[2].riders[3][skill]=10;
  const initial=source(teams,route('climb'));
  const startInput={...initial.startInput,
    physicalDraftVersion:4,
    physicalRearIntentVersion:2};
  const start=startPhysicalBunchV1(startInput);
  assert.equal(start.version,
    'v2-physical-start-bunch-4-rear-intent-2');
  assert.equal(start.committedSource
    .physicalRearIntentVersion,2);
  const intent=physicalRearIntentAtKmV2({
    startInput,riderId:'other-3',km:2});
  assert.equal(intent.action,'finish_safely');
  assert.equal(intent.effort,'steady');
  assert.equal(intent.committedTeamStake,'none');
  assert.equal(intent.source,
    'committed_manager_order_and_stake');
  const captain=physicalRearIntentAtKmV2({
    startInput,riderId:'sprint-0',km:2});
  assert.equal(captain.action,'rejoin_bunch');
  assert.equal(captain.committedTeamStake,
    'sprint_finish');
  const stagePlan=commitRearSoloPlanV1({
    riderId:'other-3',distanceKm:20,
    stageNumber:1,stageCount:2,
    baseline:{goal:'save_for_stage',
      effort:'conserve',committedStagePlan:{
        riderId:'other-3',
        currentStageNumber:1,
        targetStageNumber:2,
        currentGoal:'finish_safely',
        futureGoal:'target_stage',
        reserveEnergy:20}}});
  const planned=physicalRearIntentAtKmV2({
    startInput:{...startInput,
      soloCommitments:[stagePlan]},
    riderId:'other-3',km:2});
  assert.equal(planned.action,'save_for_stage');
  assert.equal(planned.effort,'conserve');
  assert.equal(planned.source,
    'precommitted_rider_plan');
  assert.equal(planned.committedStagePlan
    .targetStageNumber,2);
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:3});
  const solo=runPhysicalStaggeredDetachedSoloV1({
    startInput,start,staggered,
    riderId:'other-3',throughKm:3});
  assert.equal(solo.steps.length,2);
  assert.ok(solo.steps.every(row=>
    row.decision.effort==='steady'&&
    row.decision.goal==='finish_safely'&&
    row.decision.committedTeamStake==='none'&&
    row.decision.intentSource===
      'committed_manager_order_and_stake'));
  assert.equal(validatePhysicalStaggeredDetachedSoloV1({
    startInput,start,staggered,
    riderId:'other-3',throughKm:3},solo),true);
  const soloField=probePhysicalStaggeredSoloFieldV1({
    startInput,start,staggered,throughKm:3});
  const rearInput={startInput,start,staggered,
    soloField,throughKm:3};
  const endState=inspectPhysicalRearEventEndStateV1(
    rearInput);
  assert.deepEqual(endState.source,
    replayPhysicalStaggeredRearEventsV1(rearInput));
  assert.equal(endState.endEntities.length,1);
  assert.equal(endState.endEntities[0].kind,'solo');
  assert.equal(endState.endEntities[0]
    .energyByRider['other-3'],solo.energyAfter);
  assert.equal(validatePhysicalRearEventEndStateV1(
    rearInput,endState),true);
  const forgedEnd=structuredClone(endState);
  forgedEnd.endEntities[0]
    .energyByRider['other-3']+=1;
  assert.throws(()=>validatePhysicalRearEventEndStateV1(
    rearInput,forgedEnd),/differs from paid source/);
  const legacyInput={...startInput};
  delete legacyInput.physicalRearIntentVersion;
  const legacyStart=startPhysicalBunchV1(
    legacyInput);
  const legacyStaggered=
    runPhysicalStaggeredBunchLossV1({
      startInput:legacyInput,start:legacyStart,
      throughKm:3});
  const legacySolo=
    runPhysicalStaggeredDetachedSoloV1({
      startInput:legacyInput,start:legacyStart,
      staggered:legacyStaggered,
      riderId:'other-3',throughKm:3});
  assert.equal(legacySolo.steps[0].decision.effort,
    'conserve');
  assert.ok(solo.elapsedSeconds<
    legacySolo.elapsedSeconds);
  assert.ok(solo.energyAfter<
    legacySolo.energyAfter);
  assert.throws(()=>runPhysicalStaggeredDetachedSoloV1({
    startInput:legacyInput,start,staggered,
    riderId:'other-3',throughKm:3}),
  /replayed committed start/);
  assert.throws(()=>startPhysicalBunchV1({
    ...initial.startInput,
    physicalRearIntentVersion:2}),
  /committed field and route/);
});

test('ordered rear solo finds paid bunch crossing before rejoin',()=>{
  const teams=field();
  const rider=teams[2].riders[3];
  for(const skill of SPORTING_SKILLS)
    rider[skill]=50;
  rider.mountain=10;
  rider.flat=90;
  rider.timetrial=90;
  const kilometres=route();
  kilometres[0]={...kilometres[0],
    terrain:'climb',gradientPct:6};
  const initial=source(teams,kilometres);
  const startInput={...initial.startInput,
    physicalDraftVersion:4,
    physicalRearIntentVersion:2};
  const start=startPhysicalBunchV1(startInput);
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:20});
  const input={startInput,start,staggered,
    riderId:'other-3',throughKm:20};
  const probe=probePhysicalOrderedSoloBunchContactV1(
    input);
  assert.ok(probe.contact);
  assert.ok(probe.contact.metresIntoKm>0&&
    probe.contact.metresIntoKm<1000);
  assert.equal(probe.contact
    .otherRearRoadsUnsettled,false);
  assert.equal(probe.contact.candidateOnly,false);
  assert.equal(probe.contact.soloDecision
    .effort,'steady');
  assert.ok(probe.contact.soloEnergySpentToContact>0);
  assert.equal(probe.contact.bunchRiders.filter(row=>
    row.role==='leader').length,1);
  assert.equal(validatePhysicalOrderedSoloBunchContactV1(
    input,probe),true);
  const joined=finishPhysicalOrderedSoloBunchJoinKmV1(
    input);
  assert.equal(joined.contactAtDistanceM,
    probe.contact.atDistanceM);
  assert.equal(joined.riderStates.length,24);
  assert.equal(joined.physicalGroup.riderIds
    .length,24);
  assert.equal(joined.nextBunchState
    .riderIds.length,24);
  assert.equal(joined.decision.effort,'steady');
  assert.equal(joined.decision.choice,
    'join_bunch_shelter');
  assert.ok(Math.abs(joined.bunchEndClock-
    staggered.road.slice(0,joined.sourceKm)
      .reduce((sum,row)=>sum+
        row.elapsedSeconds,0))<1e-6);
  assert.ok(joined.shelteredEnergySpent<
    joined.exposedAlternativeEnergyDemand);
  assert.ok(joined.riderStates.find(row=>
    row.riderId==='other-3').decisions.length===2);
  assert.equal(validatePhysicalOrderedSoloBunchJoinKmV1(
    input,joined),true);
  const raceInput={contactInput:input,throughKm:20};
  const race=replayPhysicalOrderedSoloBunchRaceV1(
    raceInput);
  assert.equal(race.kilometres.at(-1).sourceKm,20);
  assert.ok(race.kilometres.every(kilometre=>
    kilometre.riderStates.length===24&&
    kilometre.riderStates.every(state=>
      state.decisions.length>0&&
      state.energyAfter>=0)));
  assert.equal(Object.keys(race
    .observedFinishSecondsByRider).length,24);
  assert.ok(race.sources.steps.every(step=>
    step.riders.filter(row=>
      row.role==='leader').length===1));
  assert.equal(validatePhysicalOrderedSoloBunchRaceV1(
    raceInput,race),true);
  const forgedRace=structuredClone(race);
  forgedRace.kilometres.at(-1)
    .riderStates[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalOrderedSoloBunchRaceV1(
    raceInput,forgedRace),/differs from paid source/);
  const forged=structuredClone(probe);
  forged.contact.clockSeconds+=1;
  assert.throws(()=>validatePhysicalOrderedSoloBunchContactV1(
    input,forged),/differs from paid source/);
  const forgedJoin=structuredClone(joined);
  forgedJoin.energyAfter+=1;
  assert.throws(()=>validatePhysicalOrderedSoloBunchJoinKmV1(
    input,forgedJoin),/differs from paid source/);
});

test('detached solo respects team effort and future-stage reserve',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const initial=source(teams,route('climb'));
  const runWithPlan=plan=>{
    const startInput={...initial.startInput,
      soloCommitments:[plan]};
    return runPhysicalDetachedSoloV1({startInput,
      start:startPhysicalBunchV1(startInput),
      lossKm:1,throughKm:2,riderId:'other-3'});
  };
  const tooHard=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'rejoin_bunch',effort:'hard'}});
  assert.throws(()=>runWithPlan(tooHard),/exceeds the team effort/);
  const save=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:2,
    baseline:{goal:'save_for_stage',effort:'conserve',
      committedStagePlan:{riderId:'other-3',
        currentStageNumber:1,targetStageNumber:2,
        currentGoal:'finish_safely',futureGoal:'target_stage',
        reserveEnergy:95}}});
  assert.throws(()=>runWithPlan(save),/future-stage reserve/);
});

test('two paid rear solos meet on changed terrain before a group forms',()=>{
  const teams=field();
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
  const kilometres=route('flat');
  kilometres[0].terrain='climb';
  kilometres[0].gradientPct=6;
  const initial=source(teams,kilometres);
  const plans=[['other-3','conserve'],
    ['other-4','steady']].map(([riderId,effort])=>
    commitRearSoloPlanV1({riderId,distanceKm:20,
      stageNumber:1,stageCount:1,
      baseline:{goal:'finish_safely',effort}}));
  const startInput={...initial.startInput,
    soloCommitments:plans};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,lossKm:1,contactKm:2,
    riderIds:['other-3','other-4']};
  const contact=contactPhysicalRearSolosV1(input);
  assert.equal(contact.catchingRiderId,'other-4');
  assert.equal(contact.aheadRiderId,'other-3');
  assert.ok(contact.contactAtDistanceM>1000&&
    contact.contactAtDistanceM<2000);
  assert.ok(contact.behindBunchSeconds>0);
  assert.equal(contact.physicalGroup.riderIds.length,2);
  assert.ok(contact.riders.every(row=>row.energySpent>0));
  assert.equal(validatePhysicalRearSoloContactV1(input,contact),true);
  const forged=structuredClone(contact);
  forged.contactClockSeconds+=1;
  assert.throws(()=>validatePhysicalRearSoloContactV1(input,forged),
    /differs/);
  assert.throws(()=>contactPhysicalRearSolosV1({...input,
    contactKm:3}),/met before requested contact/);
  const groupInput={...input,contact};
  const group=finishPhysicalRearContactKmV1(groupInput);
  assert.equal(group.leaderRiderId,'other-3');
  assert.equal(group.endDistanceM,2000);
  assert.equal(group.physicalGroup.riderIds.length,2);
  assert.ok(group.gapSecondsToBunch>0);
  const sheltered=group.riders.find(row=>
    row.riderId==='other-4');
  assert.equal(sheltered.role,'sheltered');
  const soloQuote=priceRearEnergyDemandV1({
    rider:catching,segment:kilometres[1],
    energyBefore:sheltered.energyBefore,
    effort:sheltered.decision.effort,role:'solo',
    distanceM:group.endDistanceM-group.startDistanceM});
  assert.ok(sheltered.energySpent<soloQuote.energyDemand);
  assert.equal(validatePhysicalRearContactRoadV1(
    groupInput,group),true);
  const falseGroup=structuredClone(group);
  falseGroup.riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalRearContactRoadV1(
    groupInput,falseGroup),/differs/);
  const runInput={...groupInput,contactRoad:group,
    throughKm:4};
  const rear=runPhysicalRearGroupV1(runInput);
  assert.deepEqual(rear.steps.map(row=>row.leaderRiderId),
    ['other-4','other-3']);
  assert.ok(rear.steps.every(row=>
    row.riders.length===2&&row.riders.every(rider=>
      rider.energySpent>0&&rider.recoveryAward===0)));
  assert.ok(rear.steps[0].groupAbility<
    rear.steps[0].leaderMaxAbility);
  assert.equal(rear.physicalGroup.atDistanceM,4000);
  assert.equal(validatePhysicalRearGroupV1(runInput,rear),true);
  const forgedRear=structuredClone(rear);
  forgedRear.steps[0].riders[1].energyAfter+=1;
  assert.throws(()=>validatePhysicalRearGroupV1(
    runInput,forgedRear),/differs/);
  const whole=runPhysicalRearGroupV1({...runInput,
    throughKm:20});
  assert.equal(whole.sourceKm,20);
  assert.equal(whole.physicalGroup.atDistanceM,20000);
  assert.ok(whole.elapsedSeconds>rear.elapsedSeconds);
  const raceInput={...input,throughKm:20};
  const race=replayPhysicalRearRaceV1(raceInput);
  assert.equal(race.kilometres.length,20);
  assert.ok(race.kilometres.every(row=>
    row.riderStates.length===24&&row.riderStates.every(state=>
      state.decisions.length>0&&state.energyAfter>=0)));
  assert.equal(Object.keys(race.observedFinishSecondsByRider)
    .length,24);
  assert.equal(race.sources.bunch.road.length,19);
  assert.equal(race.sources.rear.steps.length,18);
  assert.equal(race.sources.contact.riders.length,2);
  assert.equal(race.officialResults,false);
  assert.ok(race.observedFinishSecondsByRider['other-3']>
    race.observedFinishSecondsByRider['control-0']);
  assert.equal(validatePhysicalRearRaceV1(raceInput,race),true);
  const falseRace=structuredClone(race);
  falseRace.kilometres[10].riderStates[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalRearRaceV1(
    raceInput,falseRace),/differs/);
  const aggressiveInput={...startInput,
    soloCommitments:[plans[0],commitRearSoloPlanV1({
      riderId:'other-4',distanceKm:20,stageNumber:1,
      stageCount:1,baseline:{goal:'rejoin_bunch',
        effort:'steady'}})]};
  const aggressiveStart=startPhysicalBunchV1(aggressiveInput);
  const aggressiveContact=contactPhysicalRearSolosV1({
    startInput:aggressiveInput,start:aggressiveStart,
    lossKm:1,contactKm:2,
    riderIds:input.riderIds});
  const aggressiveRoad=finishPhysicalRearContactKmV1({
    startInput:aggressiveInput,start:aggressiveStart,
    lossKm:1,contactKm:2,riderIds:input.riderIds,
    contact:aggressiveContact});
  assert.throws(()=>runPhysicalRearGroupV1({
    startInput:aggressiveInput,start:aggressiveStart,
    lossKm:1,contactKm:2,riderIds:input.riderIds,
    contact:aggressiveContact,contactRoad:aggressiveRoad,
    throughKm:3}),/cannot hold paid leader/);
});
