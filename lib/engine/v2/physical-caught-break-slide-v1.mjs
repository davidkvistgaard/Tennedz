// A caught break rider may pass through the bunch and fall behind.
// This branch requires measured inability to hold the paid bunch pace;
// contact never grants an inferred sheltered wheel.
import {isDeepStrictEqual} from 'node:util';
import {catchPhysicalFrontSoloV1} from
  './physical-front-bunch-catch-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_CAUGHT_BREAK_SLIDE_VERSION=
  'v2-physical-caught-break-slide-1';

export function slideCaughtBreakRiderV1({startInput,start,
  attackKm,catchKm,catchRecord}){
  if(!isDeepStrictEqual(catchRecord,
    catchPhysicalFrontSoloV1({startInput,start,
      attackKm,catchKm})))
    throw new Error('Caught break slide needs replayed paid catch.');
  const riderId=catchRecord.contact.riderId;
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const segment=startInput.routeKilometres[catchKm-1];
  const order=orderAt(team.orders,catchKm-1);
  const bunchStep=catchRecord.paidBunch.road.at(-1);
  const leader=bunchStep.riders.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',
    energy:catchRecord.frontPartial.energyAtContact,
    exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(holdAbility+1e-9>=leader.holdAbility)
    throw new Error('Caught rider can hold; slide needs physical loss.');
  const effort='conserve';
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',
    energy:catchRecord.frontPartial.energyAtContact,
    exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-soloAbility)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Caught rider needs physical safe-finish pace.');
  const remainingM=catchKm*1000-
    catchRecord.contact.atDistanceM;
  const remainingSeconds=secondsPerKm*remainingM/1000;
  const elapsedSeconds=catchRecord.contact.clockSeconds+
    remainingSeconds;
  const bunchElapsedSeconds=catchRecord.paidBunch.elapsedSeconds;
  const gapSecondsToBunch=elapsedSeconds-bunchElapsedSeconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Caught rider did not fall behind paid bunch.');
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:catchRecord.frontPartial.energyAtContact,
    effort,role:'solo',distanceM:remainingM});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'dropped',working:false,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Caught rider cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,throughKm:catchKm}).cap;
  const energyAfter=+Math.min(cap,paid.energyAfter).toFixed(3);
  return {version:PHYSICAL_CAUGHT_BREAK_SLIDE_VERSION,
    sourceKm:catchKm,riderId,
    contactAtDistanceM:catchRecord.contact.atDistanceM,
    endDistanceM:catchKm*1000,
    decision:{sourceGoal:catchRecord.frontDecision.goal,
      goal:'finish_safely',
      teamOrderEffort:order.effort,effort,
      choice:'slide_through',
      reason:'cannot_hold_paid_bunch_pace'},
    holdAbility,bunchLeaderAbility:leader.holdAbility,
    physicalGroup:{id:'solo-'+riderId,
      riderIds:[riderId],atDistanceM:catchKm*1000},
    elapsedSeconds,bunchElapsedSeconds,
    gapSecondsToBunch,
    energyBefore:catchRecord.frontPartial.energyAtContact,
    energySpent:paid.energyDemand,
    totalKmEnergySpent:catchRecord.frontPartial.energySpent+
      paid.energyDemand,
    recoveryAward:0,cap,energyAfter,
    officialResults:false};
}

export function validateCaughtBreakSlideV1(input,recording){
  if(!isDeepStrictEqual(recording,
    slideCaughtBreakRiderV1(input)))
    throw new Error('Caught break slide differs from physical source.');
  return true;
}
