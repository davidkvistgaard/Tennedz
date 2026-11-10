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
const EPS=1e-6;

export function advancePhysicalFirstPositionSoloKmV1({
  priorSolo,priorPeloton,nextPeloton,segment,input}){
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
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:priorSolo.energy,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||
    secondsPerKm<=0)
    throw new Error('Solo kilometre lacks payable speed.');
  const speedMps=1000/secondsPerKm;
  const finishDistanceM=input.kilometres.length*1000;
  if(priorSolo.distanceM>=finishDistanceM-EPS)
    throw new Error('Solo rider already passed the finish.');
  const fullTravelM=speedMps*elapsedSeconds;
  const remainingM=finishDistanceM-
    priorSolo.distanceM;
  const travelM=Math.min(fullTravelM,remainingM);
  const finished=travelM>=remainingM-EPS;
  const rideSeconds=travelM/speedMps;
  if(travelM<=EPS||travelM>=2000)
    throw new Error('Solo kilometre exceeds payable distance.');
  const first=priceRearEnergyDemandV1({
    rider,segment,energyBefore:priorSolo.energy,
    effort:order.effort,role:'solo',
    distanceM:Math.min(1000,travelM)});
  const extra=travelM>1000?
    priceRearEnergyDemandV1({
      rider,segment,energyBefore:first.energyAfter,
      effort:order.effort,role:'solo',
      distanceM:travelM-1000}):null;
  const endDistanceM=priorSolo.distanceM+travelM;
  if(!finished&&
    endDistanceM<=nextPeloton.frontDistanceM+EPS)
    throw new Error('Solo kilometre needs paid bunch contact.');
  const energyAfter=+(extra?.energyAfter??
    first.energyAfter).toFixed(3);
  const position={...priorSolo,
    distanceM:endDistanceM,
    paidDistanceM:priorSolo.paidDistanceM+
      travelM,energy:energyAfter,
    clockSeconds:priorPeloton.clockSeconds+
      rideSeconds,
    ...(finished?{finishedAtClockSeconds:
      priorPeloton.clockSeconds+rideSeconds}:{}),
    quietKm:0};
  const checkpointCrossings=[];
  for(let markerKm=1;markerKm<=
    input.kilometres.length;markerKm++){
    const lineDistanceM=markerKm*1000;
    if(priorSolo.distanceM+EPS>=lineDistanceM||
      endDistanceM+EPS<lineDistanceM)continue;
    checkpointCrossings.push({riderId:rider.id,
      km:markerKm,sourceKm:km,lineDistanceM,
      clockSeconds:priorPeloton.clockSeconds+
        (lineDistanceM-priorSolo.distanceM)/
          speedMps});
  }
  return {version:PHYSICAL_FIRST_POSITION_SOLO_KM_VERSION,
    sourceKm:km,riderId:rider.id,
    roadId:soloRoadId,
    startClockSeconds:priorPeloton.clockSeconds,
    endClockSeconds:priorPeloton.clockSeconds+
      rideSeconds,
    startDistanceM:priorSolo.distanceM,
    endDistanceM,speedMps,
    decision:{riderId:rider.id,role:'solo',
      energyBefore:priorSolo.energy,
      paidDistanceM:travelM,
      paidFromReserve:first.energyDemand+
        (extra?.energyDemand??0),
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

export function replayPhysicalFirstPositionSoloKmV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    advancePhysicalFirstPositionSoloKmV1(input)))
    throw new Error('Solo kilometre differs from paid movement.');
  return recorded;
}
