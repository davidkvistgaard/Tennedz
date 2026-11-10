// Pay one solo rider on the same race clock as the measured peloton.
// Contact with the bunch is a separate, still missing movement contract.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_POSITION_SOLO_KM_VERSION=
  'physical-first-position-solo-km-1';
export const PHYSICAL_FIRST_POSITION_SOLO_KM_V2_VERSION=
  'physical-first-position-solo-km-2';
const EPS=1e-6;

function advanceSoloKm({priorSolo,priorPeloton,
  nextPeloton,segment,input},riderLocalTerrain){
  const km=priorPeloton?.sourceKm+1;
  const team=input?.teams?.find(row=>
    row.id===priorSolo?.teamId);
  const rider=team?.riders.find(row=>
    row.id===priorSolo?.riderId);
  const soloRoadId=`solo:${priorSolo?.riderId}`;
  if(segment?.km!==km||
    !isDeepStrictEqual(input?.kilometres?.[km-1],segment)||
    !rider||priorSolo.roadId!==soloRoadId||
    !Number.isFinite(priorSolo.distanceM)||
    !Number.isFinite(priorSolo.energy)||
    priorSolo.energy<0||
    priorSolo.finishedAtClockSeconds!==undefined||
    priorSolo.clockSeconds!==priorPeloton.clockSeconds||
    nextPeloton?.sourceKm!==km||
    nextPeloton.clockSeconds<=
      priorPeloton.clockSeconds||
    nextPeloton.inputHash!==priorPeloton.inputHash||
    priorSolo.distanceM<=
      priorPeloton.frontDistanceM+EPS||
    !priorPeloton.separateRoadRiderIds?.includes(
      priorSolo.riderId)||
    !nextPeloton.separateRoadRiderIds?.includes(
      priorSolo.riderId))
    throw new Error('Solo kilometre needs recorded paid separation.');
  const elapsedSeconds=nextPeloton.clockSeconds-
    priorPeloton.clockSeconds;
  const order=orderAt(team.orders,km-1);
  const speedFor=localSegment=>{
    const effect=riderKilometreEffect(rider,
      localSegment,{
        phase:'solo',energy:priorSolo.energy,
        exposed:localSegment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[order.effort]-1)*20;
    const secondsPerKm=segmentBaseSeconds(
      localSegment)+(50-ability)*
        MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(secondsPerKm)||
      secondsPerKm<=0)
      throw new Error('Solo kilometre lacks payable speed.');
    return 1000/secondsPerKm;
  };
  const speedMps=speedFor(segment);
  const finishDistanceM=input.kilometres.length*1000;
  if(priorSolo.distanceM>=finishDistanceM-EPS)
    throw new Error('Solo rider already passed the finish.');
  let endDistanceM=priorSolo.distanceM;
  let travelM=0;
  let rideSeconds=0;
  let paidFromReserve=0;
  let energyAfterDemand=priorSolo.energy;
  const speedLegs=[];
  const checkpointCrossings=[];
  if(riderLocalTerrain){
    while(rideSeconds<elapsedSeconds-EPS&&
      endDistanceM<finishDistanceM-EPS){
      const localIndex=Math.min(
        input.kilometres.length-1,
        Math.floor((endDistanceM+EPS)/1000));
      const localSegment=input.kilometres[
        localIndex];
      const speed=speedFor(localSegment);
      const lineDistanceM=Math.min(
        finishDistanceM,(localIndex+1)*1000);
      const distanceM=Math.min(
        speed*(elapsedSeconds-rideSeconds),
        lineDistanceM-endDistanceM);
      if(distanceM<=EPS)
        throw new Error('Solo kilometre lost its route position.');
      const spentSeconds=distanceM/speed;
      endDistanceM+=distanceM;
      travelM+=distanceM;
      rideSeconds+=spentSeconds;
      const priced=priceRearEnergyDemandV1({
        rider,segment:localSegment,
        energyBefore:energyAfterDemand,
        effort:order.effort,role:'solo',
        distanceM});
      speedLegs.push({
        sourceKm:localSegment.km,
        distanceM,speedMps:speed,
        energyBefore:energyAfterDemand,
        paidFromReserve:priced.energyDemand,
        energyAfter:priced.energyAfter});
      energyAfterDemand=priced.energyAfter;
      paidFromReserve+=priced.energyDemand;
      if(endDistanceM>=lineDistanceM-EPS)
        checkpointCrossings.push({
          riderId:rider.id,
          km:localIndex+1,sourceKm:km,
          lineDistanceM,
          clockSeconds:priorPeloton.clockSeconds+
            rideSeconds});
    }
  }else{
    const fullTravelM=speedMps*elapsedSeconds;
    const remainingM=finishDistanceM-
      priorSolo.distanceM;
    travelM=Math.min(fullTravelM,
      remainingM);
    rideSeconds=travelM/speedMps;
    endDistanceM+=travelM;
    const first=priceRearEnergyDemandV1({
      rider,segment,energyBefore:priorSolo.energy,
      effort:order.effort,role:'solo',
      distanceM:Math.min(1000,travelM)});
    const extra=travelM>1000?
      priceRearEnergyDemandV1({
        rider,segment,
        energyBefore:first.energyAfter,
        effort:order.effort,role:'solo',
        distanceM:travelM-1000}):null;
    energyAfterDemand=extra?.energyAfter??
      first.energyAfter;
    paidFromReserve=first.energyDemand+
      (extra?.energyDemand??0);
    for(let markerKm=1;markerKm<=
      input.kilometres.length;markerKm++){
      const lineDistanceM=markerKm*1000;
      if(priorSolo.distanceM+EPS>=lineDistanceM||
        endDistanceM+EPS<lineDistanceM)continue;
      checkpointCrossings.push({
        riderId:rider.id,km:markerKm,
        sourceKm:km,lineDistanceM,
        clockSeconds:priorPeloton.clockSeconds+
          (lineDistanceM-priorSolo.distanceM)/
            speedMps});
    }
  }
  const finished=endDistanceM>=finishDistanceM-EPS;
  if(travelM<=EPS||travelM>=2000)
    throw new Error('Solo kilometre exceeds payable distance.');
  if(!finished&&
    endDistanceM<=nextPeloton.frontDistanceM+EPS)
    throw new Error('Solo kilometre needs paid bunch contact.');
  const energyAfter=+energyAfterDemand.toFixed(3);
  const position={...priorSolo,
    distanceM:endDistanceM,
    paidDistanceM:priorSolo.paidDistanceM+
      travelM,energy:energyAfter,
    clockSeconds:priorPeloton.clockSeconds+
      rideSeconds,
    ...(finished?{finishedAtClockSeconds:
      priorPeloton.clockSeconds+rideSeconds}:{}),
    quietKm:0};
  return {version:riderLocalTerrain?
    PHYSICAL_FIRST_POSITION_SOLO_KM_V2_VERSION:
    PHYSICAL_FIRST_POSITION_SOLO_KM_VERSION,
    sourceKm:km,riderId:rider.id,
    roadId:soloRoadId,
    startClockSeconds:priorPeloton.clockSeconds,
    endClockSeconds:priorPeloton.clockSeconds+
      rideSeconds,
    startDistanceM:priorSolo.distanceM,
    endDistanceM,
    ...(riderLocalTerrain?{speedLegs}:
      {speedMps}),
    decision:{riderId:rider.id,role:'solo',
      energyBefore:priorSolo.energy,
      paidDistanceM:travelM,
      paidFromReserve,
      energyAfter},
    checkpointCrossings,position,
    finished,
    finishCrossing:finished?
      checkpointCrossings.find(row=>row.km===
        input.kilometres.length):null,
    gapAheadOfPelotonM:endDistanceM-
      nextPeloton.frontDistanceM,
    sourceGroupClockUsedForMovement:false,
    officialResults:false};
}

export function advancePhysicalFirstPositionSoloKmV1(input){
  return advanceSoloKm(input,false);
}

export function advancePhysicalFirstPositionSoloKmV2(input){
  return advanceSoloKm(input,true);
}

export function replayPhysicalFirstPositionSoloKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSoloKmV1(input)))
    throw new Error('Solo kilometre differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionSoloKmV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSoloKmV2(input)))
    throw new Error('Solo kilometre v2 differs from paid movement.');
  return recorded;
}
