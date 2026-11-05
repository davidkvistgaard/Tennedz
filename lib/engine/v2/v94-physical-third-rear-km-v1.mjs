// Continue a paid kilometre only while every rear and detached road stays
// free of an unpriced contact. No official position is inferred.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalThirdBoundaryChoicesV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalThirdFrontKmV1} from
  './v94-physical-third-front-km-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {priceRearEnergyDemandV1,
  quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {priceRearDepletedTravelV1} from
  './rear-depleted-travel-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {orderAt} from './orders.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_DRAFT_SHELTER,MOTOR_RACE_DYNAMICS,TUNING} from
  './tuning.mjs';

export const V94_PHYSICAL_THIRD_REAR_KM_VERSION=
  'v94-physical-third-rear-km-1';
export const V94_PHYSICAL_THIRD_REAR_DECISION_VERSION=
  'v94-physical-third-rear-decision-1';
export const V94_PHYSICAL_REAR_PASS_THROUGH_VERSION=
  'v94-physical-rear-pass-through-1';
const EPS=1e-7;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(seconds)||seconds<=0)
    throw new Error('Physical rear needs positive paid speed.');
  return 1000/seconds;
};
const segmentOf=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});
const roadContactEvidence=road=>({
  roadId:road.roadId,kind:road.kind,
  leaderRiderId:road.leaderRiderId,
  riderIds:road.riderDecisions.map(row=>row.riderId),
  riderWork:road.riderDecisions.map(row=>({
    riderId:row.riderId,role:row.role,
    effort:row.effort,energyBefore:row.energyBefore})),
  previousGroupIds:road.previousGroupIds,
  startClockSeconds:road.startClockSeconds,
  finishClockSeconds:road.finishClockSeconds,
  speedMps:road.speedMps});
const contactError=(message,evidence,physicalRoads=null)=>{
  const error=new Error(message);
  error.sourceEvidence=evidence;
  if(physicalRoads)Object.defineProperty(error,'physicalRoads',{
    value:physicalRoads});
  throw error;
};

export function replayV94PhysicalRearKmFromPriorV1(recording,{
  km,priorTrace,boundary,front,version,decisionVersion,
  allowDepletedSolo=false,
  allowUnaffordableShelterPassThrough=false,
  provisionalFrontDropContacts=false}){
  const segment=recording.route.kilometres[km-1];
  if(!Number.isInteger(km)||km<3||segment?.km!==km||
    !priorTrace?.fullFieldKilometre||
    priorTrace.sourceKm!==km-1||
    boundary?.sourceKm!==km||front?.sourceKm!==km||
    typeof version!=='string'||!version||
    typeof decisionVersion!=='string'||!decisionVersion)
    throw new Error('Physical rear needs a paid prior boundary.');
  const fromDistanceM=(km-1)*1000;
  const toDistanceM=km*1000;
  const base=segmentBaseSeconds(segment);
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakes=new Map(recording.committedInputs.rivalIntent?.map(row=>
    [row.teamId,row])??[]);
  const prior=new Map(priorTrace.finishes.map(row=>
    [row.riderId,row]));
  const ledger=new Map(recording.frames[km-1].energyLedger.map(row=>
    [row.riderId,row]));
  const freshAttackSolos=front.freshAttackSolos??null;
  if(freshAttackSolos&&(
    freshAttackSolos.sourceKm!==km||
    freshAttackSolos.roads.length!==
      front.excludedFreshAttackRiderIds?.length||
    freshAttackSolos.roads.some(row=>
      !front.excludedFreshAttackRiderIds.includes(row.riderId)||
      prior.get(row.riderId)?.physicalGroup!=='peloton')))
    throw new Error('Fresh solo road lacks paid field source.');
  const priceRoad=(decision,role)=>{
    const rider=byRider.get(decision.riderId)?.rider;
    const energyBefore=prior.get(decision.riderId)?.energyAfter;
    if(!rider||!Number.isFinite(energyBefore))
      throw new Error('Physical rear needs paid prior reserve.');
    const input={rider,segment,energyBefore,
      effort:decision.managerEffort,role,distanceM:1000};
    const quote=quoteRearEnergyDemandV1(input);
    const depleted=quote.energyDemand>quote.energyBefore+1e-9;
    if(depleted&&!(allowDepletedSolo&&role==='solo')){
      const error=new Error(
        'Rear rider cannot pay terrain-priced work.');
      error.sourceEvidence={sourceKm:km,riderId:rider.id,
        physicalGroup:prior.get(rider.id).physicalGroup,
        role,effort:decision.managerEffort,
        energyBefore:quote.energyBefore,
        energyDemand:quote.energyDemand};
      throw error;
    }
    const price=depleted?
      priceRearDepletedTravelV1({...input,
        baseSpeedMps:speed(base,
          decision.perceivedSoloAbility)}):
      priceRearEnergyDemandV1(input);
    const paidFromReserve=depleted?
      price.paidFromReserve:price.energyDemand;
    return {version:decisionVersion,
      sourceKm:km,riderId:decision.riderId,role,
      effort:decision.managerEffort,
      managerChase:decision.managerChase,
      managerFrontWork:decision.managerFrontWork,
      ...(km>=6?{
        managerBreakWork:orderAt(
          byRider.get(decision.riderId).team.orders,
          km-1).breakWork??null}:{}),
      sportingGoal:decision.sportingGoal,
      sportingCaptainId:decision.sportingCaptainId,
      perceivedSoloAbility:decision.perceivedSoloAbility,
      perceivedShelterHoldAbility:
        decision.perceivedShelterHoldAbility,
      energyBefore:price.energyBefore,
      paidFromReserve,
      reserveBeforeRecovery:price.energyAfter,
      ...(depleted?{
        energyDemand:price.energyDemand,
        unmetEnergyDemand:price.unmetEnergyDemand,
        sustainableFraction:price.sustainableFraction,
        depletedTravelVersion:price.version}:{}),
      sourceBoundaryVersion:boundary.version,
      choice:role==='leader'?'pay_rear_lead':
        role==='sheltered'?'hold_paid_rear_shelter':
          'continue_paid_solo'};
  };
  const roads=[];
  const addRoad=(roadId,kind,clockSeconds,leader,decisions,
    previousGroupIds)=>{
    const speedMps=speed(base,leader.perceivedSoloAbility)*
      (kind==='solo'?
        leader.sustainableFraction??1:1);
    roads.push({roadId,kind,sourceKm:km,
      sourceBoundaryClockSeconds:clockSeconds,
      previousGroupIds,startClockSeconds:clockSeconds,
      finishClockSeconds:clockSeconds+1000/speedMps,
      startDistanceM:fromDistanceM,endDistanceM:toDistanceM,
      speedMps,leaderRiderId:leader.riderId,
      riderDecisions:decisions});
  };
  for(const [index,choice] of boundary.choices.entries()){
    const leader=choice.riderDecisions.find(row=>
      row.riderId===choice.pendingLeaderRiderId);
    const groupIds=new Set(leader?[
      leader.riderId,...choice.pendingShelterRiderIds]:[]);
    if(leader){
      const decisions=[leader.riderId,
        ...choice.pendingShelterRiderIds].map(riderId=>{
        const source=choice.riderDecisions.find(row=>
          row.riderId===riderId);
        const role=riderId===leader.riderId?'leader':'sheltered';
        const decision=priceRoad(source,role);
        if(role==='sheltered'){
          const rider=byRider.get(riderId).rider;
          const ability=riderKilometreEffect(rider,segment,{
            phase:'cruise',energy:decision.reserveBeforeRecovery,
            exposed:segment.exposed}).ability+
            (TUNING.effortPressure[decision.effort]-1)*20+
            MOTOR_DRAFT_SHELTER[segment.terrain];
          if(ability+EPS<leader.perceivedSoloAbility)
            throw new Error(
              'Physical rear shelter fails before paid boundary.');
        }
        return decision;
      });
      addRoad(`paid-contact-km${km}-${index+1}`,'rear_group',
        choice.clockSeconds,leader,decisions,
        choice.previousGroupIds);
    }
    for(const decision of choice.riderDecisions){
      if(groupIds.has(decision.riderId))continue;
      const paid=priceRoad(decision,'solo');
      addRoad(`solo-${decision.riderId}`,'solo',
        choice.clockSeconds,paid,[paid],
        choice.previousGroupIds);
    }
  }
  for(const riderId of boundary.unpairedSoloRiderIds){
    const {rider,team}=byRider.get(riderId);
    const finish=prior.get(riderId);
    const order=orderAt(team.orders,km-1);
    const stake=stakes.get(team.id);
    if(!stake?.sportingGoal||!stake.sportingCaptainId)
      throw new Error('Physical solo needs committed stake.');
    const solo=riderKilometreEffect(rider,segment,{phase:'solo',
      energy:finish.energyAfter,exposed:segment.exposed});
    const decision={riderId,managerEffort:order.effort,
      managerChase:order.chase,
      managerFrontWork:order.frontWork??null,
      ...(km>=6?{
        managerBreakWork:order.breakWork??null}:{}),
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      perceivedSoloAbility:solo.ability+
        (TUNING.effortPressure[order.effort]-1)*20,
      perceivedShelterHoldAbility:null};
    const paid=priceRoad(decision,'solo');
    addRoad(`solo-${riderId}`,'solo',finish.clockSeconds,
      paid,[paid],
      [finish.physicalGroup]);
  }
  if(freshAttackSolos)for(const solo of freshAttackSolos.roads){
    const launch=freshAttackSolos.launch.decisions.find(row=>
      row.riderId===solo.riderId);
    const source=ledger.get(solo.riderId);
    if(!launch||!source||
      source.energyBefore!==solo.energyBefore||
      source.paidFromReserve!==solo.sourcePaidFromReserve)
      throw new Error('Fresh solo lacks paid ledger continuity.');
    roads.push({roadId:solo.physicalGroup,
      kind:'fresh_attack_solo',sourceKm:km,
      sourceBoundaryClockSeconds:solo.startClockSeconds,
      previousGroupIds:['peloton'],
      startClockSeconds:solo.startClockSeconds,
      finishClockSeconds:solo.finishClockSeconds,
      startDistanceM:solo.startDistanceM,
      endDistanceM:solo.endDistanceM,
      speedMps:solo.soloSpeedMps,
      leaderRiderId:solo.riderId,
      riderDecisions:[{version:solo.version,
        sourceKm:km,riderId:solo.riderId,
        role:'solo',effort:launch.managerEffort,
        managerAttack:launch.managerAttack,
        managerBreakWork:launch.managerBreakWork,
        sportingGoal:launch.sportingGoal,
        sportingCaptainId:launch.sportingCaptainId,
        perceivedAttackAbility:launch.perceivedAttackAbility,
        energyBefore:solo.energyBefore,
        paidFromReserve:solo.sourcePaidFromReserve,
        reserveBeforeRecovery:solo.energyBefore-
          solo.sourcePaidFromReserve,
        choice:solo.choice}]});
  }
  const frontSegments=front.road.map(turn=>({
    startClockSeconds:turn.startClockSeconds,
    endClockSeconds:turn.endClockSeconds,
    startDistanceM:fromDistanceM+turn.startM,
    endDistanceM:fromDistanceM+turn.endM}));
  const passThroughContacts=[];
  for(let i=0;i<roads.length;i++){
    const meeting=firstV94SecondPiecewiseContactV1(
      frontSegments,[segmentOf(roads[i])],{
        sharedOrigin:roads[i].kind==='fresh_attack_solo'});
    if(meeting){
      const frontTurn=front.road.find(turn=>
        meeting.clockSeconds>=turn.startClockSeconds-EPS&&
        meeting.clockSeconds<=turn.endClockSeconds+EPS);
      contactError(
        'Physical rear/front contact needs paid resolution.',
        {...meeting,roadId:roads[i].roadId,
          roadEvidence:roadContactEvidence(roads[i]),
          frontEvidence:{
            priorFrontClockSeconds:front.road[0].startClockSeconds,
            frontClockSeconds:front.frontClockSeconds,
            leaderRiderId:frontTurn?.leaderRiderId??null,
            workKind:frontTurn?.workKind??(
              frontTurn?'front':null),
            turnStartM:frontTurn?.startM??null,
            turnEndM:frontTurn?.endM??null}},
        {roads,frontSegments,front,boundary});
    }
    for(let j=i+1;j<roads.length;j++){
      const a=roads[i],b=roads[j];
      const sharedOrigin=Math.abs(a.startClockSeconds-
        b.startClockSeconds)<EPS;
      const contact=firstV94SecondPiecewiseContactV1(
        [segmentOf(a)],[segmentOf(b)],{sharedOrigin});
      if(contact&&allowUnaffordableShelterPassThrough){
        const group=a.kind==='rear_group'?a:
          b.kind==='rear_group'?b:null;
        const solo=a.kind==='solo'?a:
          b.kind==='solo'?b:null;
        const travelledM=contact.atDistanceM-fromDistanceM;
        if(group&&solo&&
          group.startClockSeconds>solo.startClockSeconds+EPS&&
          group.speedMps>solo.speedMps+EPS&&
          Math.abs(group.startDistanceM-
            solo.startDistanceM)<EPS&&
          travelledM>EPS&&travelledM<1000-EPS){
          const work=solo.riderDecisions[0];
          const rider=byRider.get(work.riderId).rider;
          const prefix=quoteRearEnergyDemandV1({rider,segment,
            energyBefore:work.energyBefore,
            effort:work.effort,role:'solo',
            distanceM:travelledM});
          const energyAtContact=Math.max(0,
            work.energyBefore-prefix.energyDemand);
          const shelter=quoteRearEnergyDemandV1({rider,
            segment,energyBefore:energyAtContact,
            effort:work.effort,role:'sheltered',
            distanceM:1000-travelledM});
          if(shelter.energyDemand>energyAtContact+EPS){
            passThroughContacts.push({
              version:V94_PHYSICAL_REAR_PASS_THROUGH_VERSION,
              sourceKm:km,
              clockSeconds:contact.clockSeconds,
              atDistanceM:contact.atDistanceM,
              overtakingRoadId:group.roadId,
              passedRoadId:solo.roadId,
              passedRiderId:work.riderId,
              energyAtContact,
              remainingShelterEnergyDemand:
                shelter.energyDemand,
              choice:'continue_separate_paid_roads',
              formsRearGroup:false});
            continue;
          }
        }
      }
      if(contact)contactError(
        'Physical rear roads need paid contact resolution.',
        {...contact,roadIds:[a.roadId,b.roadId],
          roadEvidence:[roadContactEvidence(a),
            roadContactEvidence(b)]},
        {roads,frontSegments,front,boundary});
    }
  }
  const newFrontDrops=front.atFrontClock.filter(row=>
    !row.attached).map(row=>{
    const {rider,team}=byRider.get(row.riderId);
    const effort=orderAt(team.orders,km-1).effort;
    const solo=riderKilometreEffect(rider,segment,{phase:'solo',
      energy:row.reserveBeforeRecovery,exposed:segment.exposed});
    const ability=solo.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const speedMps=speed(base,ability);
    const remainingDistanceM=toDistanceM-row.atDistanceM;
    if(remainingDistanceM<=0||remainingDistanceM>1000)
      throw new Error('Physical front drop needs remaining road.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.reserveBeforeRecovery,effort,
      role:'solo',distanceM:remainingDistanceM});
    const paidSegments=front.road.flatMap(turn=>{
      const slice=turn.riderSlices.find(item=>
        item.riderId===row.riderId);
      return slice?.attachedAfter?[]:[{
        startClockSeconds:turn.startClockSeconds,
        endClockSeconds:turn.endClockSeconds,
        startDistanceM:slice.startDistanceM,
        endDistanceM:slice.endDistanceM}];
    });
    const origin=paidSegments[0];
    const priorDecision=front.road.at(-1).riderSlices.find(item=>
      item.riderId===row.riderId)?.decision;
    if(!origin||!priorDecision)
      throw new Error('Physical front drop lacks paid source.');
    const finishClockSeconds=front.frontClockSeconds+
      remainingDistanceM/speedMps;
    const segments=[...paidSegments,{
      startClockSeconds:front.frontClockSeconds,
      endClockSeconds:finishClockSeconds,
      startDistanceM:row.atDistanceM,endDistanceM:toDistanceM}];
    const recovery=recoveryForKilometre({rider,segment,
      effort,group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Physical front drop cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,throughKm:km}).cap;
    const capAdjustment=Math.max(0,price.energyAfter-cap);
    return {riderId:row.riderId,origin,segments,
      completionDecision:{
        version:decisionVersion,
        riderId:row.riderId,sourceKm:km,
        teamOrderEffort:effort,
        sportingGoal:priorDecision.sportingGoal,
        sportingCaptainId:priorDecision.sportingCaptainId,
        perceivedSoloAbility:ability,
        energyBefore:row.reserveBeforeRecovery,
        paidRemainingEnergy:price.energyDemand,
        choice:'complete_detached_solo'},
      finish:{riderId:row.riderId,sourceKm:km,
        physicalGroup:`solo-${row.riderId}`,
        endDistanceM:toDistanceM,
        clockSeconds:finishClockSeconds,
        energyBefore:front.physicalFrontEnergySettlementPending?
          prior.get(row.riderId).energyAfter:
          ledger.get(row.riderId).energyBefore,
        paidFromReserve:row.physicalPaidThroughClock+
          price.energyDemand,
        recoveryAward:0,capAdjustment,
        energyAfter:+Math.min(cap,price.energyAfter).toFixed(3)}};
  });
  const pendingFrontDropContacts=[];
  for(let i=0;i<newFrontDrops.length;i++){
    const a=newFrontDrops[i];
    for(const road of roads){
      const meeting=firstV94SecondPiecewiseContactV1(
        a.segments,[segmentOf(road)]);
      if(meeting&&provisionalFrontDropContacts){
        pendingFrontDropContacts.push({
          ...meeting,riderId:a.riderId,
          roadId:road.roadId});
        continue;
      }
      if(meeting)contactError(
        'Physical front drop/rear contact needs paid resolution.',
        {...meeting,riderId:a.riderId,roadId:road.roadId,
          roadEvidence:roadContactEvidence(road),
          dropOrigin:a.origin,
          dropSegments:a.segments},
        {roads,frontSegments,front,boundary,newFrontDrops});
    }
    for(let j=i+1;j<newFrontDrops.length;j++){
      const b=newFrontDrops[j];
      const sharedOrigin=Math.abs(a.origin.startClockSeconds-
        b.origin.startClockSeconds)<=EPS&&
        Math.abs(a.origin.startDistanceM-
          b.origin.startDistanceM)<=EPS;
      const meeting=firstV94SecondPiecewiseContactV1(
        a.segments,b.segments,{sharedOrigin});
      if(meeting)contactError(
        'Physical front drops need paid contact resolution.',
        {...meeting,riderIds:[a.riderId,b.riderId]});
    }
  }
  const rearFinishes=roads.flatMap(road=>road.riderDecisions.map(row=>{
    const rider=byRider.get(row.riderId).rider;
    if(road.kind==='fresh_attack_solo'){
      const source=ledger.get(row.riderId);
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,throughKm:km}).cap;
      if(source.recoveryAward!==0||source.energyAfter>cap+EPS)
        throw new Error('Fresh solo lacks paid cap settlement.');
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:road.roadId,endDistanceM:toDistanceM,
        clockSeconds:road.finishClockSeconds,
        energyBefore:source.energyBefore,
        paidFromReserve:source.paidFromReserve,
        recoveryAward:0,capAdjustment:source.capAdjustment,
        energyAfter:source.energyAfter};
    }
    const recovery=recoveryForKilometre({rider,segment,
      effort:row.effort,group:'dropped',
      working:row.role==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Physical rear cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,throughKm:km}).cap;
    const capAdjustment=Math.max(0,row.reserveBeforeRecovery-cap);
    return {riderId:row.riderId,sourceKm:km,
      physicalGroup:road.roadId,endDistanceM:toDistanceM,
      clockSeconds:road.finishClockSeconds,
      energyBefore:row.energyBefore,
      paidFromReserve:row.paidFromReserve,
      recoveryAward:0,capAdjustment,
      energyAfter:+Math.min(cap,
        row.reserveBeforeRecovery).toFixed(3)};
  }));
  const frontFinishes=front.atFrontClock.filter(row=>
    row.attached).map(row=>{
    if(front.physicallyCaughtSourceBreakRiderIds?.includes(
      row.riderId)){
      const {rider,team}=byRider.get(row.riderId)??{};
      const previous=prior.get(row.riderId);
      if(!rider||!previous||
        previous.physicalGroup!=='peloton')
        throw new Error('Caught front rider lacks paid prior field.');
      const effort=orderAt(team.orders,km-1).effort;
      const quietKm=priorTrace.physicalCaughtQuietKmByRider
        ?.[row.riderId]??priorTrace
        .physicalFormerCaughtQuietKmByRider?.[row.riderId]??0;
      const rest=recoveryForKilometre({rider,segment,
        effort,group:'peloton',working:false,quietKm});
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery+rest.recovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:'peloton',endDistanceM:toDistanceM,
        clockSeconds:front.frontClockSeconds,
        energyBefore:previous.energyAfter,
        paidFromReserve:row.physicalPaidThroughClock,
        recoveryAward:rest.recovery,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery+rest.recovery).toFixed(3),
        physicalQuietKm:rest.quietKm};
    }
    const source=ledger.get(row.riderId);
    if(!source)
      throw new Error('Physical front finish lacks source.');
    if(front.physicalFrontEnergySettlementPending){
      const {rider,team}=byRider.get(row.riderId);
      const previous=prior.get(row.riderId);
      const effort=orderAt(team.orders,km-1).effort;
      const rest=recoveryForKilometre({rider,segment,effort,
        group:'peloton',working:front.road.some(turn=>
          turn.leaderRiderId===row.riderId),quietKm:0});
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery+rest.recovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:'peloton',endDistanceM:toDistanceM,
        clockSeconds:front.frontClockSeconds,
        energyBefore:previous.energyAfter,
        paidFromReserve:row.physicalPaidThroughClock,
        recoveryAward:rest.recovery,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery+rest.recovery).toFixed(3)};
    }
    return {riderId:row.riderId,sourceKm:km,
      physicalGroup:'peloton',endDistanceM:toDistanceM,
      clockSeconds:front.frontClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:source.recoveryAward,
      capAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter};
  });
  const droppedFrontFinishes=newFrontDrops.map(row=>row.finish);
  const orderedDrops=[...droppedFrontFinishes].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const coincidentNewFrontDropSets=[];
  for(const finish of orderedDrops){
    const last=coincidentNewFrontDropSets.at(-1);
    if(last&&Math.abs(last.clockSeconds-finish.clockSeconds)<EPS)
      last.riderIds.push(finish.riderId);
    else coincidentNewFrontDropSets.push({sourceKm:km,
      atDistanceM:toDistanceM,clockSeconds:finish.clockSeconds,
      riderIds:[finish.riderId],formsRearGroup:false});
  }
  const unresolvedNewDropSets=coincidentNewFrontDropSets.filter(row=>
    row.riderIds.length>1);
  const finishes=[...frontFinishes,...droppedFrontFinishes,
    ...rearFinishes];
  if(finishes.length!==priorTrace.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==finishes.length||
    finishes.some(row=>row.endDistanceM!==toDistanceM||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-row.energyAfter)>.001))
    throw new Error('Physical full field lacks paid finish coverage.');
  return {version,sourceKm:km,boundary,front,
    roads,newFrontDrops,
    ...(provisionalFrontDropContacts?{
      provisionalFrontDropContacts:true,
      pendingFrontDropContacts}:{}),
    ...(passThroughContacts.length?{passThroughContacts}:{}),
    ...(front.physicallyCaughtSourceBreakRiderIds?.length?{
      physicallyCaughtSourceBreakRiderIds:
        [...front.physicallyCaughtSourceBreakRiderIds],
      physicalCaughtQuietKmByRider:Object.fromEntries(
        frontFinishes.filter(row=>
          front.physicallyCaughtSourceBreakRiderIds.includes(
            row.riderId)).map(row=>[
          row.riderId,row.physicalQuietKm]))}:{}),
    ...(freshAttackSolos?{
      freshAttackSoloRiderIds:freshAttackSolos.roads.map(row=>
        row.riderId),
      sourceCheckpointCalibrationFailed:true}:{}),
    physicalRearGroups:roads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes,
    coincidentNewFrontDropSets:unresolvedNewDropSets,
    continuationNeedsContactDecision:
      unresolvedNewDropSets.length>0||
        pendingFrontDropContacts.length>0,
    finishes,officialResults:false,
    fullFieldKilometre:!provisionalFrontDropContacts};
}

export function replayV94PhysicalThirdRearKmV1(recording){
  const boundary=decideV94PhysicalThirdBoundaryChoicesV1(recording);
  const front=replayV94PhysicalThirdFrontKmV1(recording);
  return replayV94PhysicalRearKmFromPriorV1(recording,{
    km:3,priorTrace:boundary.second,boundary,front,
    version:V94_PHYSICAL_THIRD_REAR_KM_VERSION,
    decisionVersion:V94_PHYSICAL_THIRD_REAR_DECISION_VERSION});
}

export function validateV94PhysicalThirdRearKmV1(recording,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalThirdRearKmV1(recording)))
    throw new Error('Third-km rear road differs from paid source.');
  return true;
}
