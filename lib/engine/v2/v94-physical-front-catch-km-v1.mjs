// Settle one measured solo/front meeting with a paid shelter choice.
// Source break membership remains a claim after physical contact.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalUnattachedSourceNextKmV1} from
  './v94-physical-unattached-source-next-km-v1.mjs';
import {replayV94PhysicalSixthKmV1} from
  './v94-physical-sixth-km-v1.mjs';
import {firstV94SecondPiecewiseContactV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_DRAFT_SHELTER,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_CATCH_KM_VERSION=
  'v94-physical-front-catch-km-4';
export const V94_PHYSICAL_FRONT_CATCH_DECISION_VERSION=
  'v94-physical-front-catch-decision-2';
const EPS=1e-7;
const roadSegment=road=>({
  startClockSeconds:road.startClockSeconds,
  endClockSeconds:road.finishClockSeconds,
  startDistanceM:road.startDistanceM,
  endDistanceM:road.endDistanceM});

export function replayV94PhysicalFrontCatchKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const sourceBreakRiderIds=km===6?
    prior?.freshAttackSoloRiderIds:
    prior?.sourceBreakRiderIds;
  if(!Number.isInteger(km)||km<6||
    !prior.fullFieldKilometre||
    !sourceBreakRiderIds?.length||
    prior.sourceCheckpointCalibrationFailed!==true)
    throw new Error('Front catch needs a paid prior field.');
  let evidence=null,physicalRoads=null;
  try{
    (km===6?replayV94PhysicalSixthKmV1:
      replayV94PhysicalUnattachedSourceNextKmV1)(
      recording,prior);
  }catch(error){
    if(km!==6&&prior.front.availableFrontPlanVersion&&
      ['Named leader left the physical front.',
        'Physical front lacks continuous paid reserve.'].includes(
        error.message)){
      try{replayV94PhysicalUnattachedSourceNextKmV1(
        recording,prior,{useAvailableFront:true});
        throw new Error('Front catch needs measured contact.');}
      catch(availableError){error=availableError;}
    }
    if(error.message!==
      'Physical rear/front contact needs paid resolution.')
      throw error;
    evidence=error.sourceEvidence;
    physicalRoads=error.physicalRoads;
  }
  const {roads,frontSegments,front,boundary}=physicalRoads??{};
  const caught=roads?.find(row=>
    row.roadId===evidence?.roadId);
  const riderId=caught?.riderDecisions[0]?.riderId;
  const segment=recording.route.kilometres[km-1];
  const startM=(km-1)*1000;
  const contactM=evidence?.atDistanceM-startM;
  const soloBehindAtBoundary=caught?.startClockSeconds>
    front?.road?.[0]?.startClockSeconds+EPS;
  const soloAheadAtBoundary=caught?.startClockSeconds<
    front?.road?.[0]?.startClockSeconds-EPS;
  const crossingDirectionValid=soloBehindAtBoundary?
    caught.finishClockSeconds<front.frontClockSeconds-EPS:
    soloAheadAtBoundary&&
      caught.finishClockSeconds>front.frontClockSeconds+EPS;
  if(segment?.km!==km||!Array.isArray(roads)||
    !Array.isArray(frontSegments)||front?.sourceKm!==km||
    boundary?.sourceKm!==km||
    caught?.kind!=='solo'||
    caught.riderDecisions.length!==1||
    !sourceBreakRiderIds.includes(riderId)||
    !Number.isFinite(contactM)||contactM<=0||contactM>=1000||
    front.atFrontClock.some(row=>!row.attached)||
    !crossingDirectionValid)
    throw new Error('Front catch needs one measured paid solo pass.');
  const otherRoads=roads.filter(row=>
    row.roadId!==caught.roadId);
  const caughtPrefix={...roadSegment(caught),
    endClockSeconds:evidence.clockSeconds,
    endDistanceM:evidence.atDistanceM};
  for(let i=0;i<otherRoads.length;i++){
    const road=otherRoads[i];
    if(firstV94SecondPiecewiseContactV1(
      frontSegments,[roadSegment(road)],{
        sharedOrigin:road.kind==='fresh_attack_solo'})||
      firstV94SecondPiecewiseContactV1(
        [caughtPrefix],[roadSegment(road)]))
      throw new Error('Front catch has another road meeting.');
    for(let j=i+1;j<otherRoads.length;j++)
      if(firstV94SecondPiecewiseContactV1(
        [roadSegment(road)],[roadSegment(otherRoads[j])],{
          sharedOrigin:Math.abs(road.startClockSeconds-
            otherRoads[j].startClockSeconds)<EPS}))
        throw new Error('Front catch has another rear meeting.');
  }
  const source=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const {rider,team}=source.get(riderId)??{};
  const stake=recording.committedInputs.rivalIntent?.find(row=>
    row.teamId===team?.id);
  const order=team?orderAt(team.orders,km-1):null;
  const priorFinish=prior.finishes.find(row=>
    row.riderId===riderId);
  if(!rider||!stake?.sportingGoal||
    !stake.sportingCaptainId||!order||
    priorFinish?.physicalGroup!==caught.previousGroupIds[0]||
    priorFinish.energyAfter!==
      caught.riderDecisions[0].energyBefore)
    throw new Error('Front catch lacks rider decision source.');
  const prefix=priceRearEnergyDemandV1({rider,segment,
    energyBefore:priorFinish.energyAfter,
    effort:order.effort,role:'solo',distanceM:contactM});
  let reserve=prefix.energyAfter;
  const shelterTurns=[];
  for(const turn of front.road){
    const fromM=Math.max(contactM,turn.startM);
    const distanceM=turn.endM-fromM;
    if(distanceM<=0)continue;
    const holdAbility=riderKilometreEffect(rider,segment,{
      phase:'cruise',energy:reserve,
      exposed:segment.exposed}).ability+
      (TUNING.effortPressure[order.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    if(holdAbility+EPS<turn.leaderAbility)
      throw new Error('Caught rider cannot hold paid front shelter.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:reserve,effort:order.effort,
      role:'sheltered',distanceM});
    const endHoldAbility=riderKilometreEffect(rider,segment,{
      phase:'cruise',energy:price.energyAfter,
      exposed:segment.exposed}).ability+
      (TUNING.effortPressure[order.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    if(endHoldAbility+EPS<turn.leaderAbility)
      throw new Error('Caught rider loses shelter during paid turn.');
    shelterTurns.push({leaderRiderId:turn.leaderRiderId,
      leaderAbility:turn.leaderAbility,
      startM:fromM,endM:turn.endM,
      energyBefore:reserve,
      paidFromReserve:price.energyDemand,
      energyAfter:price.energyAfter});
    reserve=price.energyAfter;
  }
  if(Math.abs(shelterTurns.reduce((sum,row)=>
    sum+row.endM-row.startM,0)-(1000-contactM))>EPS)
    throw new Error('Caught rider lacks paid remaining metres.');
  const recovery=recoveryForKilometre({rider,segment,
    effort:order.effort,group:'dropped',
    working:false,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Front catch cannot claim recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:recording.route.kilometres,
    throughKm:km}).cap;
  const paidFromReserve=priorFinish.energyAfter-reserve;
  const capAdjustment=Math.max(0,reserve-cap);
  const caughtFinish={riderId,sourceKm:km,
    physicalGroup:'peloton',endDistanceM:km*1000,
    clockSeconds:front.frontClockSeconds,
    energyBefore:priorFinish.energyAfter,
    paidFromReserve,recoveryAward:0,capAdjustment,
    energyAfter:+Math.min(cap,reserve).toFixed(3)};
  const caughtDecision={
    version:V94_PHYSICAL_FRONT_CATCH_DECISION_VERSION,
    sourceKm:km,riderId,teamId:team.id,
    managerEffort:order.effort,
    managerBreakWork:order.breakWork,
    sportingGoal:stake.sportingGoal,
    sportingCaptainId:stake.sportingCaptainId,
    previousPhysicalGroup:priorFinish.physicalGroup,
    contactDistanceM:evidence.atDistanceM,
    contactClockSeconds:evidence.clockSeconds,
    soloEnergyToContact:prefix.energyDemand,
    shelterTurns,
    choice:'accept_paid_front_shelter_after_contact'};
  const ledger=new Map(recording.frames[km-1].energyLedger.map(row=>
    [row.riderId,row]));
  const frontFinishes=front.atFrontClock.map(row=>{
    if(front.physicallyCaughtSourceBreakRiderIds?.includes(
      row.riderId)){
      const {rider:attached,team:attachedTeam}=source.get(
        row.riderId)??{};
      const previous=prior.finishes.find(finish=>
        finish.riderId===row.riderId);
      if(!attached||!previous||
        previous.physicalGroup!=='peloton')
        throw new Error('Front catch lacks prior caught rider.');
      const effort=orderAt(attachedTeam.orders,km-1).effort;
      const quietKm=prior.physicalCaughtQuietKmByRider
        ?.[row.riderId]??prior
        .physicalFormerCaughtQuietKmByRider
        ?.[row.riderId]??0;
      const rest=recoveryForKilometre({rider:attached,segment,
        effort,group:'peloton',working:false,quietKm});
      const attachedCap=replayRearEnergyCapV1({rider:attached,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery+rest.recovery-attachedCap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:'peloton',endDistanceM:km*1000,
        clockSeconds:front.frontClockSeconds,
        energyBefore:previous.energyAfter,
        paidFromReserve:row.physicalPaidThroughClock,
        recoveryAward:rest.recovery,capAdjustment,
        energyAfter:+Math.min(attachedCap,
          row.reserveBeforeRecovery+rest.recovery).toFixed(3),
        physicalQuietKm:rest.quietKm};
    }
    const energy=ledger.get(row.riderId);
    if(!energy)throw new Error('Front catch lacks front ledger.');
    if(front.physicalFrontEnergySettlementPending){
      const {rider:attached,team:attachedTeam}=source.get(
        row.riderId)??{};
      const previous=prior.finishes.find(finish=>
        finish.riderId===row.riderId);
      if(!attached||!previous||
        previous.physicalGroup!=='peloton')
        throw new Error('Front catch lacks paid front rider.');
      const effort=orderAt(attachedTeam.orders,km-1).effort;
      const rest=recoveryForKilometre({rider:attached,
        segment,effort,group:'peloton',
        working:front.road.some(turn=>
          turn.leaderRiderId===row.riderId),quietKm:0});
      const cap=replayRearEnergyCapV1({rider:attached,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery+rest.recovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:'peloton',endDistanceM:km*1000,
        clockSeconds:front.frontClockSeconds,
        energyBefore:previous.energyAfter,
        paidFromReserve:row.physicalPaidThroughClock,
        recoveryAward:rest.recovery,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery+rest.recovery).toFixed(3)};
    }
    return {riderId:row.riderId,sourceKm:km,
      physicalGroup:'peloton',endDistanceM:km*1000,
      clockSeconds:front.frontClockSeconds,
      energyBefore:energy.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:energy.recoveryAward,
      capAdjustment:energy.capAdjustment,
      energyAfter:energy.energyAfter};
  });
  const rearFinishes=otherRoads.flatMap(road=>
    road.riderDecisions.map(row=>{
      const otherRider=source.get(row.riderId)?.rider;
      if(!otherRider||!['rear_group','solo'].includes(
        road.kind))
        throw new Error('Front catch lacks other rear work.');
      const rest=recoveryForKilometre({rider:otherRider,
        segment,effort:row.effort,group:'dropped',
        working:row.role==='leader',quietKm:0});
      if(rest.recovery!==0)
        throw new Error('Front catch has unpaid rear recovery.');
      const riderCap=replayRearEnergyCapV1({rider:otherRider,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:road.roadId,endDistanceM:km*1000,
        clockSeconds:road.finishClockSeconds,
        energyBefore:row.energyBefore,
        paidFromReserve:row.paidFromReserve,
        recoveryAward:0,
        capAdjustment:Math.max(0,
          row.reserveBeforeRecovery-riderCap),
        energyAfter:+Math.min(riderCap,
          row.reserveBeforeRecovery).toFixed(3)};
    }));
  const finishes=[...frontFinishes,caughtFinish,
    ...rearFinishes];
  if(finishes.length!==prior.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==
      finishes.length||
    finishes.some(row=>row.endDistanceM!==km*1000||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>.001+EPS))
  {
    const error=new Error('Front catch lacks paid full field.');
    error.sourceEvidence={sourceKm:km,
      priorCount:prior.finishes.length,finishCount:finishes.length,
      uniqueCount:new Set(finishes.map(row=>row.riderId)).size,
      balanceFailures:finishes.filter(row=>
        Math.abs(row.energyBefore-row.paidFromReserve+
          row.recoveryAward-row.capAdjustment-
          row.energyAfter)>.001+EPS).map(row=>({riderId:row.riderId,
            energyBefore:row.energyBefore,
            paidFromReserve:row.paidFromReserve,
            recoveryAward:row.recoveryAward,
            capAdjustment:row.capAdjustment,
            energyAfter:row.energyAfter})).slice(0,5)};
    throw error;
  }
  const alreadyCaught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  const formerCaught=new Set(
    prior.physicallyCaughtFormerBreakRiderIds??[]);
  if(alreadyCaught.has(riderId)||formerCaught.has(riderId)||
    [...alreadyCaught,...formerCaught].some(id=>
      !frontFinishes.some(row=>row.riderId===id)))
    throw new Error('Front catch lacks caught lineage.');
  return {version:V94_PHYSICAL_FRONT_CATCH_KM_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    boundary,front,roads:otherRoads,
    physicalRearGroups:otherRoads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes:[],
    caughtFinish,caughtDecision,
    paidFrontContact:{...evidence,
      contactKind:soloBehindAtBoundary?
        'solo_joins_peloton_from_behind':
        'solo_caught_by_peloton',
      frontShelterPaid:true},
    sourceBreakRiderIds:[...sourceBreakRiderIds],
    physicallyCaughtSourceBreakRiderIds:[...alreadyCaught,
      riderId],
    physicalCaughtQuietKmByRider:Object.fromEntries([
      ...[...alreadyCaught].map(id=>[id,
        frontFinishes.find(row=>row.riderId===id)
          .physicalQuietKm]),
      [riderId,0]]),
    ...(formerCaught.size?{
      formerSourceBreakRiderIds:
        [...prior.formerSourceBreakRiderIds],
      physicallyCaughtFormerBreakRiderIds:
        [...formerCaught],
      physicalFormerCaughtQuietKmByRider:
        Object.fromEntries([...formerCaught].map(id=>[
          id,frontFinishes.find(row=>row.riderId===id)
            .physicalQuietKm]))}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    finishes,fullFieldKilometre:true,
    officialResults:false};
}

export function validateV94PhysicalFrontCatchKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFrontCatchKmV1(
      recording,prior)))
    throw new Error('Front catch differs from paid source.');
  return true;
}
