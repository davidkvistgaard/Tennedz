import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentRelativeArrivalsFromTour,
  validateFinaleConcurrentRelativeArrivalsFromTour,
  recordFinaleConcurrentSelectiveRelativeArrivalsFromTour,
  validateFinaleConcurrentSelectiveRelativeArrivalsFromTour,
  FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION,
  recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour,
  validateFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour,
  FINALE_CONCURRENT_MULTI_SELECTIVE_RELATIVE_ARRIVALS_VERSION} from
  '../../lib/engine/v2/finale-concurrent-relative-arrivals.mjs';
import {recordFinaleConcurrentCommonTimeStateFromTour,
  validateFinaleConcurrentCommonTimeStateFromTour,
  FINALE_CONCURRENT_COMMON_TIME_STATE_VERSION} from
  '../../lib/engine/v2/finale-concurrent-common-time-state.mjs';
import {recordFinaleConcurrentSecondArrivalFromTour,
  validateFinaleConcurrentSecondArrivalFromTour,
  FINALE_CONCURRENT_SECOND_ARRIVAL_VERSION} from
  '../../lib/engine/v2/finale-concurrent-second-arrival.mjs';
import {concurrentBunchArrivalEvent,
  recordFinaleConcurrentBunchArrivalFromTour,
  validateFinaleConcurrentBunchArrivalFromTour,
  FINALE_CONCURRENT_BUNCH_ARRIVAL_VERSION} from
  '../../lib/engine/v2/finale-concurrent-bunch-arrival.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour,
  validateFinaleConcurrentNextSlicePlanFromTour,
  FINALE_CONCURRENT_NEXT_SLICE_PLAN_VERSION} from
  '../../lib/engine/v2/finale-concurrent-next-slice-plan.mjs';
import {recordFinaleConcurrentNextBoundaryFromTour,
  validateFinaleConcurrentNextBoundaryFromTour,
  FINALE_CONCURRENT_NEXT_BOUNDARY_VERSION} from
  '../../lib/engine/v2/finale-concurrent-next-boundary.mjs';
import {concurrentContactRoadBands} from
  '../../lib/engine/v2/finale-concurrent-contact-state.mjs';
import {rearCatchFollowupEvent,
  recordFinaleConcurrentRearCatchFollowupFromTour,
  validateFinaleConcurrentRearCatchFollowupFromTour} from
  '../../lib/engine/v2/finale-concurrent-rear-catch-followup.mjs';
import {recordFinaleConcurrentDoubleCatchMergeFromTour} from
  '../../lib/engine/v2/finale-concurrent-double-catch-merge.mjs';
import {rearBunchArrivalEvent,
  recordFinaleConcurrentRearBunchArrivalFromTour,
  validateFinaleConcurrentRearBunchArrivalFromTour,
  FINALE_CONCURRENT_REAR_BUNCH_ARRIVAL_VERSION} from
  '../../lib/engine/v2/finale-concurrent-rear-bunch-arrival.mjs';
import {twoSplitFollowupEvent,
  recordFinaleConcurrentTwoSplitFollowupFromTour,
  validateFinaleConcurrentTwoSplitFollowupFromTour,
  FINALE_CONCURRENT_TWO_SPLIT_FOLLOWUP_VERSION} from
  '../../lib/engine/v2/finale-concurrent-two-split-followup.mjs';
import {concurrentBunch500Event,
  recordFinaleConcurrentBunch500ArrivalFromTour,
  validateFinaleConcurrentBunch500ArrivalFromTour,
  FINALE_CONCURRENT_BUNCH_500_ARRIVAL_VERSION} from
  '../../lib/engine/v2/finale-concurrent-bunch-500-arrival.mjs';
import {recordFinaleConcurrentSelective500StateFromTour,
  validateFinaleConcurrentSelective500StateFromTour,
  FINALE_CONCURRENT_SELECTIVE_500_STATE_VERSION} from
  '../../lib/engine/v2/finale-concurrent-selective-500-state.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour,
  validateFinaleConcurrentSelective500PlanFromTour,
  FINALE_CONCURRENT_SELECTIVE_500_PLAN_VERSION} from
  '../../lib/engine/v2/finale-concurrent-selective-500-plan.mjs';
import {solo500NextEvent,
  recordFinaleConcurrentSolo500StepFromTour,
  validateFinaleConcurrentSolo500StepFromTour,
  FINALE_CONCURRENT_SOLO_500_STEP_VERSION} from
  '../../lib/engine/v2/finale-concurrent-solo-500-step.mjs';
import {recordFinaleConcurrentSolo500CatchMergeFromTour,
  validateFinaleConcurrentSolo500CatchMergeFromTour,
  FINALE_CONCURRENT_SOLO_500_CATCH_MERGE_VERSION} from
  '../../lib/engine/v2/finale-concurrent-solo-500-catch-merge.mjs';

function team(id,skill,gender,{attack=false,
  chase='ignore',rotate=false}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,firstSkill,secondSkill,chaseRule='all'){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,{attack:true}),
    team('b',secondSkill,gender,{attack:true}),
    team('c',100,gender,{chase:chaseRule}),
    team('d',95,gender,{rotate:true})];
  return simulateTacticalTour({stage,teams,
    seed:`relative-arrivals-${gender}-${firstSkill}-${secondSkill}${
      chaseRule==='all'?'':`-${chaseRule}`}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

function multiSource(gender,firstSkill=75,secondSkill=80){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,{attack:true}),
    team('b',secondSkill,gender,{attack:true}),
    team('c',100,gender,{chase:'selective'}),
    team('e',90,gender,{chase:'selective'}),
    team('f',85,gender,{chase:'selective'}),
    team('d',95,gender,{rotate:true})];
  return simulateTacticalTour({stage,teams,
    seed:`multi-relative-arrivals-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('two paid attackers have relative arrival times without fake groups',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,80);
    const original=structuredClone(tour.provisionalResults);
    const relative=recordFinaleConcurrentRelativeArrivalsFromTour(tour);
    assert.equal(relative.endDistanceM,39250);
    assert.equal(relative.arrivals.length,2);
    assert.equal(relative.arrivals[0].riderId,'b-0');
    assert.equal(relative.earlierRiderId,'b-0');
    assert.ok(relative.separationSeconds>0);
    assert.equal(relative.separationSeconds,
      relative.arrivals[1].elapsedSeconds-
        relative.arrivals[0].elapsedSeconds);
    assert.equal(relative.estimatedSeparationM,
      250*relative.separationSeconds/
        relative.arrivals[1].elapsedSeconds);
    assert.equal(relative.riderEnergy.length,32);
    assert.equal(relative.riderAttackLoad.length,32);
    assert.equal(relative.roadRelationshipStatus,'unresolved');
    assert.equal(validateFinaleConcurrentRelativeArrivalsFromTour(tour,
      JSON.parse(JSON.stringify(relative))),true);
    const forged=structuredClone(relative);
    forged.separationSeconds=0;
    assert.throws(()=>validateFinaleConcurrentRelativeArrivalsFromTour(
      tour,forged),/do not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('selective chase retains paid relative arrivals without assigning groups',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,80,'selective');
    const original=structuredClone(tour.provisionalResults);
    const relative=recordFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour);
    assert.equal(relative.version,
      FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION);
    assert.equal(relative.arrivals.length,2);
    assert.equal(relative.selectiveDecision.decision,'engage');
    assert.equal(relative.roadRelationshipStatus,'unresolved');
    assert.ok(relative.separationSeconds>=0);
    assert.equal(relative.riderEnergy.length,32);
    assert.equal(relative.riderAttackLoad.length,32);
    assert.equal(validateFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour,JSON.parse(JSON.stringify(relative))),true);
    const forged=structuredClone(relative);
    forged.selectiveDecision.decision='wait';
    assert.throws(()=>validateFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour,forged),/do not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('multiple selective decisions survive two paid arrival measurements',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const relative=recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
      tour);
    assert.equal(relative.version,
      FINALE_CONCURRENT_MULTI_SELECTIVE_RELATIVE_ARRIVALS_VERSION);
    assert.equal(relative.arrivals.length,2);
    assert.equal(relative.selectiveDecisions.length,3);
    assert.equal(relative.selectiveDecisions.filter(row=>
      row.decision==='working').length,1);
    assert.equal(relative.roadRelationshipStatus,'unresolved');
    assert.equal(relative.riderEnergy.length,48);
    assert.equal(validateFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
      tour,JSON.parse(JSON.stringify(relative))),true);
    const forged=structuredClone(relative);
    forged.selectiveDecisions[0].candidateRiderId='invented';
    assert.throws(()=>(
      validateFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
        tour,forged)),/do not replay/);
  }
});

test('equal measured arrival times do not invent an earlier rider',()=>{
  for(const gender of ['M','F']){
    const relative=recordFinaleConcurrentRelativeArrivalsFromTour(
      source(gender,75,75));
    assert.equal(relative.separationSeconds,0);
    assert.equal(relative.estimatedSeparationM,0);
    assert.equal(relative.earlierRiderId,null);
    assert.equal(relative.roadRelationshipStatus,'unresolved');
  }
});

test('multiple selective chasers leave one paid common-time road state',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const state=recordFinaleConcurrentCommonTimeStateFromTour(tour);
    const relative=recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
      tour);
    assert.equal(state.version,FINALE_CONCURRENT_COMMON_TIME_STATE_VERSION);
    assert.equal(state.eventElapsedSeconds,
      relative.arrivals[0].elapsedSeconds);
    assert.equal(state.riders.length,48);
    assert.equal(state.riderAttackLoad.length,48);
    assert.equal(state.selectiveDecisions.length,3);
    assert.equal(state.attackerPositions.length,2);
    assert.equal(state.attackerPositions[0].positionM,
      state.plannedEndDistanceM);
    assert.ok(state.attackerPositions[1].positionM<
      state.attackerPositions[0].positionM);
    assert.ok(Math.abs(state.separationM-(
      state.attackerPositions[0].positionM-
      state.attackerPositions[1].positionM))<1e-8);
    assert.ok(state.bunchPositionM<state.plannedEndDistanceM);
    const attackers=new Set(state.attackerPositions.map(row=>row.riderId));
    for(const rider of state.riders){
      assert.ok(rider.positionM<=state.plannedEndDistanceM+1e-9);
      assert.ok(rider.positionM>=state.startDistanceM);
      assert.ok(rider.energyAtEvent>=0);
      assert.ok(Math.abs(rider.energyAtEvent-
        rider.energyCostRemainingToBoundary-
        rider.fullSliceEnergyAfter)<1e-8);
      if(!attackers.has(rider.riderId))
        assert.equal(rider.positionM,state.bunchPositionM);
    }
    assert.equal(state.roadRelationshipStatus,'unresolved');
    assert.equal(state.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentCommonTimeStateFromTour(tour,
      JSON.parse(JSON.stringify(state))),true);
    const forged=structuredClone(state);
    forged.riders[0].energyAtEvent+=1;
    assert.throws(()=>validateFinaleConcurrentCommonTimeStateFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('simultaneous attacker arrivals remain ungrouped on the shared clock',()=>{
  for(const gender of ['M','F']){
    const state=recordFinaleConcurrentCommonTimeStateFromTour(
      multiSource(gender,75,75));
    assert.equal(state.separationM,0);
    assert.ok(state.attackerPositions.every(row=>
      row.positionM===state.plannedEndDistanceM));
    assert.equal(state.roadRelationshipStatus,'unresolved');
  }
});

test('later attacker reaches the boundary on one paid clock',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const first=recordFinaleConcurrentCommonTimeStateFromTour(tour);
    const next=recordFinaleConcurrentSecondArrivalFromTour(tour);
    assert.equal(next.version,FINALE_CONCURRENT_SECOND_ARRIVAL_VERSION);
    assert.ok(next.elapsedSinceFirstSeconds>0);
    assert.ok(next.elapsedSinceLaunchSeconds>first.eventElapsedSeconds);
    assert.equal(next.riders.length,first.riders.length);
    assert.equal(new Set(next.riders.map(row=>row.riderId)).size,48);
    assert.ok(next.separationM>=0);
    assert.equal(next.firstRiderId,first.attackerPositions[0].riderId);
    assert.equal(next.secondRiderId,first.attackerPositions[1].riderId);
    assert.ok(next.riders.every(row=>row.energyAtEvent>=0));
    for(const row of next.riders){
      const previous=first.riders.find(rider=>rider.riderId===row.riderId);
      assert.equal(row.energyAtFirstEvent,previous.energyAtEvent);
      assert.ok(Math.abs(row.energyAtFirstEvent-
        row.energySpentSinceFirst-row.energyAtEvent)<1e-8);
      if(row.riderId!==next.firstRiderId)
        assert.ok(row.positionM<=next.plannedFirstBoundaryM+1e-8);
    }
    assert.equal(next.event,'second_attacker_at_first_slice_boundary');
    const second=next.riders.find(row=>row.riderId===next.secondRiderId);
    const firstAtNext=next.riders.find(row=>row.riderId===next.firstRiderId);
    assert.ok(Math.abs(second.positionM-
      next.plannedFirstBoundaryM)<1e-8);
    assert.ok(Math.abs(second.energyAtEvent-
      second.committedFirstSliceEnergyAfter)<1e-8);
    assert.ok(firstAtNext.energyAtEvent<
      firstAtNext.committedFirstSliceEnergyAfter);
    assert.ok(Math.abs(next.separationM-(firstAtNext.positionM-
      next.plannedFirstBoundaryM))<1e-8);
    assert.equal(next.roadRelationshipStatus,'unresolved');
    assert.equal(next.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentSecondArrivalFromTour(tour,
      JSON.parse(JSON.stringify(next))),true);
    const forged=structuredClone(next);
    forged.riders[0].energyAtEvent+=1;
    assert.throws(()=>validateFinaleConcurrentSecondArrivalFromTour(tour,
      forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('a simultaneous boundary needs no fictitious continuation interval',()=>{
  for(const gender of ['M','F'])
    assert.throws(()=>recordFinaleConcurrentSecondArrivalFromTour(
      multiSource(gender,75,75)),/needs distinct paid attacker arrivals/);
});

test('the paid bunch reaches the first boundary on the shared clock',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const second=recordFinaleConcurrentSecondArrivalFromTour(tour);
    const bunch=recordFinaleConcurrentBunchArrivalFromTour(tour);
    assert.equal(bunch.version,FINALE_CONCURRENT_BUNCH_ARRIVAL_VERSION);
    assert.equal(bunch.event,'bunch_at_first_slice_boundary');
    assert.ok(bunch.elapsedSinceLaunchSeconds>
      second.elapsedSinceLaunchSeconds);
    assert.ok(Math.abs(bunch.bunchPositionM-
      bunch.plannedFirstBoundaryM)<1e-8);
    assert.ok(bunch.firstPositionM>bunch.secondPositionM);
    assert.ok(bunch.secondPositionM>bunch.bunchPositionM);
    assert.equal(bunch.contactPositionM,null);
    assert.equal(bunch.riders.length,48);
    assert.equal(new Set(bunch.riders.map(row=>row.riderId)).size,48);
    for(const row of bunch.riders){
      const previous=second.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtSecondEvent,previous.energyAtEvent);
      assert.ok(row.energyAtEvent>=0);
      assert.ok(Math.abs(row.energyAtSecondEvent-
        row.energySpentSinceSecond-row.energyAtEvent)<1e-8);
      if(row.riderId!==bunch.firstRiderId&&
        row.riderId!==bunch.secondRiderId)
        assert.ok(Math.abs(row.energyAtEvent-
          row.committedFirstSliceEnergyAfter)<1e-8);
    }
    assert.equal(bunch.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentBunchArrivalFromTour(tour,
      JSON.parse(JSON.stringify(bunch))),true);
    const forged=structuredClone(bunch);
    forged.riders[0].energyAtEvent+=1;
    assert.throws(()=>validateFinaleConcurrentBunchArrivalFromTour(tour,
      forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('exact next-event solver stops at the earliest physical contact',()=>{
  const positions={firstPositionM:20,secondPositionM:10,
    bunchPositionM:0,bunchArrivalSeconds:5};
  assert.deepEqual(concurrentBunchArrivalEvent({...positions,
    firstSpeedMps:10,secondSpeedMps:13,bunchSpeedMps:11}),
  {kind:'attackers_contact_uncontinued',seconds:10/3});
  assert.deepEqual(concurrentBunchArrivalEvent({...positions,
    firstSpeedMps:13,secondSpeedMps:10,bunchSpeedMps:15}),
  {kind:'second_attacker_bunch_contact_uncontinued',seconds:2});
  assert.deepEqual(concurrentBunchArrivalEvent({...positions,
    firstSpeedMps:13,secondSpeedMps:11,bunchSpeedMps:10}),
  {kind:'bunch_at_first_slice_boundary',seconds:5});
  assert.deepEqual(concurrentBunchArrivalEvent({...positions,
    firstSpeedMps:10,secondSpeedMps:12,bunchSpeedMps:14}),
  {kind:'multiple_contacts_uncontinued',seconds:5});
  assert.throws(()=>concurrentBunchArrivalEvent({...positions,
    secondPositionM:0,firstSpeedMps:10,
    secondSpeedMps:11,bunchSpeedMps:12}),/ordered positions/);
});

test('next slice reselects ordered chase and rotation before charging travel',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const state=recordFinaleConcurrentBunchArrivalFromTour(tour);
    const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
    assert.equal(plan.version,FINALE_CONCURRENT_NEXT_SLICE_PLAN_VERSION);
    assert.equal(plan.sourceStateVersion,state.version);
    assert.equal(plan.startDistanceM,state.bunchPositionM);
    assert.equal(plan.endDistanceM,state.plannedNextBoundaryM);
    assert.equal(plan.selectiveDecisions.length,3);
    assert.equal(plan.selectiveDecisions.filter(row=>
      row.decision==='working').length,plan.chase?1:0);
    assert.equal(plan.rotation.turnIndex,1);
    assert.equal(plan.energyAtDecision.length,state.riders.length);
    for(const row of plan.energyAtDecision)
      assert.equal(row.energy,state.riders.find(source=>
        source.riderId===row.riderId).energyAtEvent);
    assert.equal(plan.travelStatus,'planned_unpaid');
    assert.equal(plan.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentNextSlicePlanFromTour(tour,
      JSON.parse(JSON.stringify(plan))),true);
    const forged=structuredClone(plan);
    forged.leadingGapSeconds+=1;
    assert.throws(()=>validateFinaleConcurrentNextSlicePlanFromTour(tour,
      forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('next boundary charges the exact shared travel or stops at contact',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const state=recordFinaleConcurrentBunchArrivalFromTour(tour);
    const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
    const event=recordFinaleConcurrentNextBoundaryFromTour(tour);
    assert.equal(event.version,FINALE_CONCURRENT_NEXT_BOUNDARY_VERSION);
    assert.equal(event.sourcePlanVersion,plan.version);
    assert.equal(event.riders.length,state.riders.length);
    assert.equal(new Set(event.riders.map(row=>row.riderId)).size,48);
    assert.ok(event.elapsedSinceLaunchSeconds>
      state.elapsedSinceLaunchSeconds);
    assert.ok(event.riders.every(row=>row.energyAtEvent>=0&&
      row.positionM<=event.plannedNextBoundaryM+1e-8));
    for(const row of event.riders){
      const prior=state.riders.find(source=>source.riderId===row.riderId);
      assert.equal(row.energyAtDecision,prior.energyAtEvent);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    if(plan.chase){
      const chaser=event.riders.find(row=>row.riderId===
        plan.chase.riderId);
      assert.equal(chaser.role,'chase');
      assert.ok(Math.abs(chaser.energySpent-
        plan.chase.workCostPerKm*chaser.distanceM/1000)<1e-8);
    }
    for(const work of plan.rotation.selected?.work??[]){
      const worker=event.riders.find(row=>row.riderId===work.riderId);
      assert.equal(worker.role,'front_rotation');
      assert.ok(Math.abs(worker.energySpent-
        work.energySpent*worker.distanceM/
          (plan.endDistanceM-plan.startDistanceM))<1e-8);
    }
    if(event.event==='first_attacker_at_next_boundary')
      assert.ok(Math.abs(event.firstPositionM-
        event.plannedNextBoundaryM)<1e-8);
    assert.equal(event.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentNextBoundaryFromTour(tour,
      JSON.parse(JSON.stringify(event))),true);
    const forged=structuredClone(event);
    forged.riders[0].energySpent+=1;
    assert.throws(()=>validateFinaleConcurrentNextBoundaryFromTour(tour,
      forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('exact contact identifies road bands without granting draft or travel',()=>{
  const rows=(first,second,bunch)=>[
    {riderId:'a',positionM:first,energyAtEvent:40},
    {riderId:'b',positionM:second,energyAtEvent:35},
    {riderId:'c',positionM:bunch,energyAtEvent:30},
    {riderId:'d',positionM:bunch,energyAtEvent:25}];
  const input={firstRiderId:'a',secondRiderId:'b'};
  assert.deepEqual(concurrentContactRoadBands({...input,
    event:'attackers_contact_uncontinued',riders:rows(12,12,5)}),[
    {kind:'front',positionM:12,riderIds:['a','b']},
    {kind:'bunch',positionM:5,riderIds:['c','d']}]);
  assert.deepEqual(concurrentContactRoadBands({...input,
    event:'second_attacker_bunch_contact_uncontinued',
    riders:rows(12,5,5)}),[
    {kind:'front',positionM:12,riderIds:['a']},
    {kind:'bunch',positionM:5,riderIds:['b','c','d']}]);
  assert.deepEqual(concurrentContactRoadBands({...input,
    event:'multiple_contacts_uncontinued',riders:rows(5,5,5)}),[
    {kind:'bunch',positionM:5,riderIds:['a','b','c','d']}]);
  assert.throws(()=>concurrentContactRoadBands({...input,
    event:'attackers_contact_uncontinued',riders:rows(12,11,5)}),
  /disagree/);
  assert.throws(()=>concurrentContactRoadBands({...input,
    event:'first_attacker_at_next_boundary',riders:rows(12,11,5)}),
  /paid exact-intersection/);
});

test('rear-catch continuation chooses the next exact event',()=>{
  const positions={frontPositionM:20,bunchPositionM:10,
    nextBoundaryM:30,frontSpeedMps:10};
  assert.deepEqual(rearCatchFollowupEvent({...positions,
    bunchSpeedMps:25}),
  {kind:'front_bunch_contact_uncontinued',seconds:2/3});
  assert.deepEqual(rearCatchFollowupEvent({...positions,
    bunchSpeedMps:11}),
  {kind:'front_at_next_boundary',seconds:1});
  assert.throws(()=>rearCatchFollowupEvent({...positions,
    bunchPositionM:20,bunchSpeedMps:11}),/ordered positive travel/);
});

test('measured rear contact can carry its already-paid field work',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender,70,75);
    const original=structuredClone(tour.provisionalResults);
    const contact=recordFinaleConcurrentNextBoundaryFromTour(tour);
    assert.equal(contact.event,
      'second_attacker_bunch_contact_uncontinued');
    const continued=recordFinaleConcurrentRearCatchFollowupFromTour(tour);
    assert.ok(continued.elapsedSinceLaunchSeconds>
      contact.elapsedSinceLaunchSeconds);
    assert.equal(continued.riders.length,contact.riders.length);
    assert.equal(new Set(continued.riders.map(row=>row.riderId)).size,
      continued.riders.length);
    assert.ok(continued.roadBands.some(row=>
      row.riderIds.includes(continued.caughtRiderId)));
    for(const row of continued.riders){
      const prior=contact.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtContact,prior.energyAtEvent);
      assert.ok(row.energyAtEvent>=0);
      assert.ok(Math.abs(row.energyAtContact-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    assert.equal(continued.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentRearCatchFollowupFromTour(tour,
      JSON.parse(JSON.stringify(continued))),true);
    const forged=structuredClone(continued);
    forged.riders[0].energySpent+=1;
    assert.throws(()=>validateFinaleConcurrentRearCatchFollowupFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('double-catch continuation refuses a still separated front rider',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender,70,75);
    assert.equal(recordFinaleConcurrentRearCatchFollowupFromTour(tour).event,
      'front_at_next_boundary');
    assert.throws(()=>recordFinaleConcurrentDoubleCatchMergeFromTour(tour),
      /needs both attacks caught/);
  }
});

test('rear-bunch continuation stops at the earlier paid boundary',()=>{
  const positions={frontPositionM:500,bunchPositionM:480,
    bunchNextBoundaryM:500,frontNextBoundaryM:600};
  assert.deepEqual(rearBunchArrivalEvent({...positions,
    frontSpeedMps:10,bunchSpeedMps:20}),
  {kind:'bunch_at_second_slice_boundary',seconds:1});
  assert.deepEqual(rearBunchArrivalEvent({...positions,
    frontSpeedMps:20,bunchSpeedMps:2}),
  {kind:'front_at_next_boundary',seconds:5});
  assert.throws(()=>rearBunchArrivalEvent({...positions,
    bunchPositionM:500,frontSpeedMps:10,bunchSpeedMps:20}),
  /ordered positive travel/);
});

test('separated front and rear-caught bunch pay one clock to next event',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender,70,75);
    const original=structuredClone(tour.provisionalResults);
    const previous=recordFinaleConcurrentRearCatchFollowupFromTour(tour);
    assert.equal(previous.event,'front_at_next_boundary');
    const event=recordFinaleConcurrentRearBunchArrivalFromTour(tour);
    assert.equal(event.version,
      FINALE_CONCURRENT_REAR_BUNCH_ARRIVAL_VERSION);
    assert.ok(event.elapsedSinceLaunchSeconds>
      previous.elapsedSinceLaunchSeconds);
    assert.equal(event.riders.length,previous.riders.length);
    assert.equal(new Set(event.riders.map(row=>row.riderId)).size,
      event.riders.length);
    assert.ok(event.riders.every(row=>row.energyAtEvent>=0));
    for(const row of event.riders){
      const prior=previous.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtPreviousEvent,prior.energyAtEvent);
      assert.ok(Math.abs(row.energyAtPreviousEvent-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    assert.ok(event.frontPositionM>event.bunchPositionM);
    assert.equal(event.roadBands.length,2);
    assert.equal(event.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentRearBunchArrivalFromTour(tour,
      JSON.parse(JSON.stringify(event))),true);
    const forged=structuredClone(event);
    forged.riders[0].distanceM+=1;
    assert.throws(()=>validateFinaleConcurrentRearBunchArrivalFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('two-split follow-up chooses the earliest boundary or rear contact',()=>{
  const positions={firstPositionM:500,secondPositionM:480,
    bunchPositionM:470,firstNextBoundaryM:600,
    secondNextBoundaryM:500,bunchNextBoundaryM:500};
  assert.deepEqual(twoSplitFollowupEvent({...positions,
    firstSpeedMps:20,secondSpeedMps:10,bunchSpeedMps:2}),
  {kind:'second_at_second_slice_boundary',seconds:2});
  assert.deepEqual(twoSplitFollowupEvent({...positions,
    firstSpeedMps:20,secondSpeedMps:1,bunchSpeedMps:1}),
  {kind:'first_at_next_boundary',seconds:5});
  assert.deepEqual(twoSplitFollowupEvent({...positions,
    firstSpeedMps:10,secondSpeedMps:10,bunchSpeedMps:30}),
  {kind:'second_attacker_bunch_contact_uncontinued',seconds:0.5});
  assert.throws(()=>twoSplitFollowupEvent({...positions,
    secondPositionM:470,firstSpeedMps:10,
    secondSpeedMps:10,bunchSpeedMps:30}),
  /ordered positive travel/);
});

test('two surviving attackers and the bunch continue on one paid clock',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const previous=recordFinaleConcurrentNextBoundaryFromTour(tour);
    assert.equal(previous.event,'first_attacker_at_next_boundary');
    const event=recordFinaleConcurrentTwoSplitFollowupFromTour(tour);
    assert.equal(event.version,
      FINALE_CONCURRENT_TWO_SPLIT_FOLLOWUP_VERSION);
    assert.ok(event.elapsedSinceLaunchSeconds>
      previous.elapsedSinceLaunchSeconds);
    assert.equal(event.riders.length,previous.riders.length);
    assert.equal(new Set(event.riders.map(row=>row.riderId)).size,
      event.riders.length);
    for(const row of event.riders){
      const prior=previous.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtPreviousEvent,prior.energyAtEvent);
      assert.ok(row.energyAtEvent>=0);
      assert.ok(Math.abs(row.energyAtPreviousEvent-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    assert.equal(event.roadBands.length,3);
    assert.equal(event.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentTwoSplitFollowupFromTour(tour,
      JSON.parse(JSON.stringify(event))),true);
    const forged=structuredClone(event);
    forged.riders[0].energySpent+=1;
    assert.throws(()=>validateFinaleConcurrentTwoSplitFollowupFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('bunch-500 solver stops before a new boundary or exact attacker contact',()=>{
  const positions={firstPositionM:520,secondPositionM:500,
    bunchPositionM:480,firstNextBoundaryM:600,
    secondNextBoundaryM:600,bunchNextBoundaryM:500};
  assert.deepEqual(concurrentBunch500Event({...positions,
    firstSpeedMps:20,secondSpeedMps:10,bunchSpeedMps:10}),
  {kind:'bunch_at_500_boundary',seconds:2});
  assert.deepEqual(concurrentBunch500Event({...positions,
    firstSpeedMps:20,secondSpeedMps:1,bunchSpeedMps:1}),
  {kind:'first_at_next_boundary',seconds:4});
  assert.deepEqual(concurrentBunch500Event({...positions,
    firstSpeedMps:10,secondSpeedMps:30,bunchSpeedMps:10}),
  {kind:'attackers_contact_uncontinued',seconds:1});
  assert.throws(()=>concurrentBunch500Event({...positions,
    bunchPositionM:500,firstSpeedMps:10,
    secondSpeedMps:30,bunchSpeedMps:10}),
  /ordered positive travel/);
});

test('two split attackers remain paid as their bunch approaches 500 m',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const previous=recordFinaleConcurrentTwoSplitFollowupFromTour(tour);
    assert.equal(previous.event,'second_at_second_slice_boundary');
    const event=recordFinaleConcurrentBunch500ArrivalFromTour(tour);
    assert.equal(event.version,
      FINALE_CONCURRENT_BUNCH_500_ARRIVAL_VERSION);
    assert.ok(event.elapsedSinceLaunchSeconds>
      previous.elapsedSinceLaunchSeconds);
    assert.equal(event.riders.length,previous.riders.length);
    assert.equal(new Set(event.riders.map(row=>row.riderId)).size,
      event.riders.length);
    for(const row of event.riders){
      const prior=previous.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtPreviousEvent,prior.energyAtEvent);
      assert.ok(row.energyAtEvent>=0);
      assert.ok(Math.abs(row.energyAtPreviousEvent-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    assert.equal(event.roadBands.length,3);
    assert.equal(event.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentBunch500ArrivalFromTour(tour,
      JSON.parse(JSON.stringify(event))),true);
    const forged=structuredClone(event);
    forged.riders[0].energySpent+=1;
    assert.throws(()=>validateFinaleConcurrentBunch500ArrivalFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('supported selective branches share a replayable paid 500 m handoff',()=>{
  for(const gender of ['M','F']){
    for(const [tour,branch,bands] of [
      [multiSource(gender),'two_split',3],
      [multiSource(gender,70,75),'solo_ahead',2]]){
      const original=structuredClone(tour.provisionalResults);
      const state=recordFinaleConcurrentSelective500StateFromTour(tour);
      assert.equal(state.version,
        FINALE_CONCURRENT_SELECTIVE_500_STATE_VERSION);
      assert.equal(state.branch,branch);
      assert.equal(state.roadBands.length,bands);
      assert.equal(state.roadBands.at(-1).positionM,state.boundaryM);
      assert.equal(state.riders.length,48);
      assert.equal(new Set(state.riders.map(row=>row.riderId)).size,48);
      assert.ok(state.riders.every(row=>
        row.energyAtBoundary>=0&&row.positionM>=state.boundaryM));
      assert.equal(state.pointsStatus,'withheld');
      assert.equal(validateFinaleConcurrentSelective500StateFromTour(tour,
        JSON.parse(JSON.stringify(state))),true);
      const forged=structuredClone(state);
      forged.riders[0].energyAtBoundary+=1;
      assert.throws(()=>validateFinaleConcurrentSelective500StateFromTour(
        tour,forged),/does not replay/);
      assert.deepEqual(tour.provisionalResults,original);
    }
  }
});

test('surviving attackers get only an unpaid next 100 m bunch plan',()=>{
  for(const gender of ['M','F']){
    for(const [tour,branch] of [
      [multiSource(gender),'two_split'],
      [multiSource(gender,70,75),'solo_ahead']]){
      const original=structuredClone(tour.provisionalResults);
      const state=recordFinaleConcurrentSelective500StateFromTour(tour);
      const plan=recordFinaleConcurrentSelective500PlanFromTour(tour);
      assert.equal(plan.version,
        FINALE_CONCURRENT_SELECTIVE_500_PLAN_VERSION);
      assert.equal(plan.branch,branch);
      assert.equal(plan.startDistanceM,state.boundaryM);
      assert.equal(plan.endDistanceM-plan.startDistanceM,100);
      assert.ok(plan.rearGapSeconds>0);
      assert.ok(plan.leadingGapSeconds>=plan.rearGapSeconds);
      assert.equal(plan.selectiveDecisions.length,3);
      assert.equal(plan.selectiveDecisions.filter(row=>
        row.decision==='working').length,plan.chase?1:0);
      assert.equal(plan.rotation.turnIndex,2);
      assert.equal(plan.energyAtDecision.length,state.riders.length);
      assert.equal(plan.travelStatus,'planned_unpaid');
      assert.equal(plan.pointsStatus,'withheld');
      assert.equal(validateFinaleConcurrentSelective500PlanFromTour(tour,
        JSON.parse(JSON.stringify(plan))),true);
      const forged=structuredClone(plan);
      forged.rearGapSeconds+=1;
      assert.throws(()=>validateFinaleConcurrentSelective500PlanFromTour(
        tour,forged),/does not replay/);
      assert.deepEqual(tour.provisionalResults,original);
    }
  }
});

test('solo 500 m event stops at exact contact or the next boundary',()=>{
  const positions={frontPositionM:520,bunchPositionM:500,
    nextBoundaryM:600};
  assert.deepEqual(solo500NextEvent({...positions,
    frontSpeedMps:20,bunchSpeedMps:10}),
  {kind:'front_at_400_boundary',seconds:4});
  assert.deepEqual(solo500NextEvent({...positions,
    frontSpeedMps:10,bunchSpeedMps:20}),
  {kind:'front_bunch_contact_uncontinued',seconds:2});
  assert.throws(()=>solo500NextEvent({...positions,
    bunchPositionM:520,frontSpeedMps:10,bunchSpeedMps:20}),
  /ordered positive travel/);
});

test('solo and bunch pay one shared 100 m clock from the 500 m handoff',()=>{
  for(const gender of ['M','F']){
    const tour=multiSource(gender,70,75);
    const original=structuredClone(tour.provisionalResults);
    const state=recordFinaleConcurrentSelective500StateFromTour(tour);
    const event=recordFinaleConcurrentSolo500StepFromTour(tour);
    assert.equal(state.branch,'solo_ahead');
    assert.equal(event.version,FINALE_CONCURRENT_SOLO_500_STEP_VERSION);
    assert.ok(event.elapsedSinceLaunchSeconds>
      state.elapsedSinceLaunchSeconds);
    assert.equal(event.riders.length,state.riders.length);
    assert.equal(new Set(event.riders.map(row=>row.riderId)).size,
      event.riders.length);
    for(const row of event.riders){
      const prior=state.riders.find(source=>
        source.riderId===row.riderId);
      assert.equal(row.energyAtDecision,prior.energyAtBoundary);
      assert.ok(row.energyAtEvent>=0);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAtEvent)<1e-8);
    }
    assert.ok([1,2].includes(event.roadBands.length));
    assert.equal(event.pointsStatus,'withheld');
    if(event.event==='front_bunch_contact_uncontinued'){
      const merge=recordFinaleConcurrentSolo500CatchMergeFromTour(tour);
      assert.equal(merge.version,
        FINALE_CONCURRENT_SOLO_500_CATCH_MERGE_VERSION);
      assert.equal(merge.roadBands.length,1);
      assert.equal(merge.riders.length,event.riders.length);
      assert.equal(merge.chaseDecision,'stop_no_front_target');
      assert.equal(validateFinaleConcurrentSolo500CatchMergeFromTour(
        tour,JSON.parse(JSON.stringify(merge))),true);
    }else assert.throws(()=>
      recordFinaleConcurrentSolo500CatchMergeFromTour(tour),
    /exact catch inside the slice/);
    assert.equal(validateFinaleConcurrentSolo500StepFromTour(tour,
      JSON.parse(JSON.stringify(event))),true);
    const forged=structuredClone(event);
    forged.riders[0].energySpent+=1;
    assert.throws(()=>validateFinaleConcurrentSolo500StepFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});
