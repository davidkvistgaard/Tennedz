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
