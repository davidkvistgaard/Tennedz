import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {commitTeamChaseStakesV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../../lib/engine/v2/rear-solo-commitment-v1.mjs';
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
  validatePhysicalBunchAfterNamedAttackV1} from
  '../../lib/engine/v2/physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1,
  completePhysicalStaggeredLossKmV1,
  validatePhysicalPaceLossCompletionV1} from
  '../../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {runPhysicalStaggeredDetachedSoloV1,
  validatePhysicalStaggeredDetachedSoloV1} from
  '../../lib/engine/v2/physical-staggered-detached-solo-v1.mjs';
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
  const commitment=commitTeamChaseStakesV1({teams,distanceKm:20,
    keypoints,
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:stakeByTeam[team.id]??'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,
    raceSeed:'physical-start-1'};
  const start=startPhysicalBunchV1(startInput);
  return {startInput,start,segment:routeKilometres[0]};
};

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
  for(const riderId of ['control-2','other-3']){
    const completion=completePhysicalStaggeredLossKmV1({
      ...input,staggered:recording,riderId});
    assert.equal(completion.riderId,riderId);
    assert.ok(completion.startDistanceM<
      completion.endDistanceM);
    const soloInput={...input,staggered:recording,
      riderId,throughKm:20};
    const solo=runPhysicalStaggeredDetachedSoloV1(soloInput);
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
    for(const skill of SPORTING_SKILLS)rider[skill]=100;
  for(const rider of teams[2].riders)
    if(rider.id!=='other-2')
      for(const skill of SPORTING_SKILLS)rider[skill]=100;
  teams[2].orders.phases=[{atKm:1,attack:'selective',
    attackRiderId:'other-2',effort:'hard'},
  {atKm:10,effort:'conserve'}];
  teams[0].orders.phases=[{atKm:8,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:8,
    frontWork:'rotate',frontWorkRiderId:'sprint-2',
    chase:'selective'}];
  const original=source(teams,route(),{
    sprint:'sprint_finish',other:'break_stage'},
  [{km:1},{km:8}]);
  const startInput={...original.startInput,
    raceSeed:'same-threat-window-seed'};
  const input={startInput,
    start:startPhysicalBunchV1(startInput),
    attackKm:2,choiceKm:9,observerTeamId:'sprint',
    nominatedChaseTeamIds:['sprint']};
  assert.equal(decidePhysicalFrontThreatV1(input)
    .choice.choice.assessments[0].action,'commit_now');
  let catchKm=null;
  for(let km=10;km<=20;km++){
    try{runPhysicalPerceivedChaseV1({...input,
      throughKm:km});}
    catch(error){
      assert.match(error.message,/paid contact road/);
      catchKm=km;break;
    }
  }
  assert.ok(catchKm!==null);
  const contactInput={...input,catchKm};
  const contact=catchPhysicalPerceivedChaseV1(contactInput);
  assert.ok(contact.contact.atDistanceM>
    (catchKm-1)*1000&&contact.contact.atDistanceM<
    catchKm*1000);
  assert.equal(contact.bunchPartial.leaderRiderId,
    'sprint-2');
  assert.ok(contact.frontPartial.energySpent>0);
  assert.equal(validatePhysicalPerceivedChaseContactV1(
    contactInput,contact),true);
  const forged=structuredClone(contact);
  forged.contact.clockSeconds+=1;
  assert.throws(()=>validatePhysicalPerceivedChaseContactV1(
    contactInput,forged),/differs/);
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
