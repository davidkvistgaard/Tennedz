// After a source-paid controller catches one front rider, the rider may
// choose to finish alone if they cannot hold that named bunch front.
import {isDeepStrictEqual} from 'node:util';
import {advanceIsolatedPaidControlRoadV1} from
  './isolated-paid-control-road-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const ISOLATED_CONTROL_CAUGHT_FRONT_SLIDE_VERSION=
  'v2-isolated-control-caught-front-slide-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Control catch has invalid road pace.');
  return 3600/seconds;
};

export function advanceControlCaughtFrontSlideV1({paidInput,
  paidRoad,slideDecision}){
  if(!isDeepStrictEqual(paidRoad,
    advanceIsolatedPaidControlRoadV1(paidInput))||
    !paidRoad.contact||
    paidRoad.contact.frontRiderIds.length!==1||
    paidRoad.contact.atDistanceM>=paidInput.segment.km*1000)
    throw new Error('Control slide needs a replayed paid catch.');
  const frontId=paidRoad.contact.frontRiderIds[0];
  if(!isDeepStrictEqual(slideDecision,{
    riderId:frontId,action:'finish_safely',effort:'conserve'}))
    throw new Error('Caught front needs an explicit solo decision.');
  const teams=paidInput.committedChoiceInput.teams;
  const byId=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,{rider:row,team}])));
  const front=byId.get(frontId);
  const workerId=paidRoad.bunchLeaderRiderId;
  const worker=byId.get(workerId);
  const segment=paidInput.segment;
  const startM=paidRoad.contact.atDistanceM;
  const endM=segment.km*1000;
  const share=(endM-startM)/1000;
  const frontEnergy=paidRoad.energyByRider[frontId];
  const workerEnergy=paidRoad.energyByRider[workerId];
  const hold=riderKilometreEffect(front.rider,segment,{
    phase:'cruise',energy:frontEnergy,
    exposed:segment.exposed});
  const workerEffect=riderKilometreEffect(worker.rider,segment,{
    phase:'cruise',energy:workerEnergy,
    exposed:segment.exposed});
  const order=orderAt(worker.team.orders,segment.km-1);
  const adjustment=order.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[order.effort];
  const holdAbility=hold.ability+
    (TUNING.effortPressure.hard-1)*20;
  const workerAbility=workerEffect.ability+adjustment;
  if(holdAbility+1e-9>=workerAbility)
    throw new Error('Caught front can hold the paid bunch wheel.');
  const solo=riderKilometreEffect(front.rider,segment,{
    phase:'solo',energy:frontEnergy,
    exposed:segment.exposed});
  const base=segmentBaseSeconds(segment);
  const soloSpeedKph=speed(base,solo.ability+
    (TUNING.effortPressure.conserve-1)*20);
  const bunchSpeedKph=speed(base,workerAbility+
    TUNING.breakaway.bunchDraftAdvantage);
  const workerExtra=order.effort==='hard'?
    TUNING.groups.hardPaceWorkerExtraCostPerKm:
    order.effort==='steady'?
      TUNING.groups.steadyPaceWorkerExtraCostPerKm:
      MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;
  const frontCost=share*TUNING.effortCost.conserve*
    solo.energyCostMultiplier;
  const workerCost=share*(TUNING.effortCost[order.effort]+
    workerExtra)*workerEffect.energyCostMultiplier;
  if(frontCost>frontEnergy+1e-9||
    workerCost>workerEnergy+1e-9)
    throw new Error('Caught front cannot pay postcontact road.');
  const behindBunchSeconds=(endM-startM)*3.6/
    soloSpeedKph-(endM-startM)*3.6/bunchSpeedKph;
  if(behindBunchSeconds<=0)
    throw new Error('Caught front did not fall behind controller.');
  const status=behindBunchSeconds>
    TUNING.groups.droppedAtSeconds?
      'solo_behind':'wheel_gap_unresolved';
  const energyByRider={...paidRoad.energyByRider,
    [frontId]:Math.max(0,frontEnergy-frontCost),
    [workerId]:Math.max(0,workerEnergy-workerCost)};
  return {version:ISOLATED_CONTROL_CAUGHT_FRONT_SLIDE_VERSION,
    sourceKm:segment.km,riderId:frontId,slideDecision,
    catchDistanceM:startM,endDistanceM:endM,
    bunchLeaderRiderId:workerId,
    soloSpeedKph,bunchSpeedKph,behindBunchSeconds,
    riders:[{riderId:frontId,role:'solo',
      energyBefore:frontEnergy,energySpent:frontCost,
      energy:energyByRider[frontId]},
    {riderId:workerId,role:'bunch_leader',
      energyBefore:workerEnergy,energySpent:workerCost,
      energy:energyByRider[workerId]}],
    energyByRider,status,
    event:status==='solo_behind'?{
      kind:'front_passes_through_bunch',
      atDistanceM:startM,riderId:frontId}:null,
    officialResults:false};
}

export function validateControlCaughtFrontSlideV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceControlCaughtFrontSlideV1(input)))
    throw new Error('Control catch slide differs from paid source.');
  return true;
}
