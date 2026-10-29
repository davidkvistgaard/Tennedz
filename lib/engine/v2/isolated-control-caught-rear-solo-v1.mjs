// A front rider who passed through a source-paid control bunch continues
// alone against that same named controller in the next kilometre.
import {isDeepStrictEqual} from 'node:util';
import {advanceControlCaughtFrontSlideV1} from
  './isolated-control-caught-front-slide-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const ISOLATED_CONTROL_CAUGHT_REAR_SOLO_VERSION=
  'v2-isolated-control-caught-rear-solo-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Caught rear solo has invalid pace.');
  return 3600/seconds;
};

export function advanceControlCaughtRearSoloV1({slideInput,
  slide,segment,soloDecision}){
  if(!isDeepStrictEqual(slide,
    advanceControlCaughtFrontSlideV1(slideInput))||
    slide.status!=='solo_behind'||
    !Number.isInteger(segment?.km)||
    segment.km!==slide.sourceKm+1||
    slide.endDistanceM!==(segment.km-1)*1000)
    throw new Error('Rear solo needs replayed paid control slide.');
  if(!isDeepStrictEqual(soloDecision,{
    riderId:slide.riderId,
    action:'finish_safely',effort:'conserve'}))
    throw new Error('Rear solo needs an explicit finish decision.');
  const teams=slideInput.paidInput.committedChoiceInput.teams;
  const byId=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,{rider:row,team}])));
  const rider=byId.get(slide.riderId);
  const worker=byId.get(slide.bunchLeaderRiderId);
  const order=orderAt(worker.team.orders,segment.km-1);
  if(order.frontWork!=='rotate'||
    order.frontWorkRiderId!==worker.rider.id||
    order.attack!=='none'||order.chase!=='ignore')
    throw new Error('Rear solo needs the same named paid controller.');
  const riderEnergy=slide.energyByRider[rider.rider.id];
  const workerEnergy=slide.energyByRider[worker.rider.id];
  const riderEffect=riderKilometreEffect(rider.rider,segment,{
    phase:'solo',energy:riderEnergy,
    exposed:segment.exposed});
  const workerEffect=riderKilometreEffect(worker.rider,segment,{
    phase:'cruise',energy:workerEnergy,
    exposed:segment.exposed});
  const adjustment=order.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[order.effort];
  const base=segmentBaseSeconds(segment);
  const soloSpeedKph=speed(base,riderEffect.ability+
    (TUNING.effortPressure.conserve-1)*20);
  const bunchSpeedKph=speed(base,workerEffect.ability+
    adjustment+TUNING.breakaway.bunchDraftAdvantage);
  const startM=(segment.km-1)*1000;
  const movement=advanceFinaleGap({slice:{
    startDistanceM:startM,endDistanceM:startM+1000,
    lengthM:1000},gapSeconds:slide.behindBunchSeconds,
  frontSpeedKph:bunchSpeedKph,
  chaseSpeedKph:soloSpeedKph});
  const endDistanceM=movement.catchDistanceM??startM+1000;
  const share=(endDistanceM-startM)/1000;
  const workerExtra=order.effort==='hard'?
    TUNING.groups.hardPaceWorkerExtraCostPerKm:
    order.effort==='steady'?
      TUNING.groups.steadyPaceWorkerExtraCostPerKm:
      MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;
  const riderCost=share*TUNING.effortCost.conserve*
    riderEffect.energyCostMultiplier;
  const workerCost=share*(TUNING.effortCost[order.effort]+
    workerExtra)*workerEffect.energyCostMultiplier;
  if(riderCost>riderEnergy+1e-9||
    workerCost>workerEnergy+1e-9)
    throw new Error('Rear solo or controller cannot pay road.');
  const energyByRider={...slide.energyByRider,
    [rider.rider.id]:Math.max(0,riderEnergy-riderCost),
    [worker.rider.id]:Math.max(0,workerEnergy-workerCost)};
  const status=movement.caught?'bunch_contact':
    movement.gapSeconds>TUNING.groups.droppedAtSeconds?
      'solo_behind':'wheel_gap_unresolved';
  return {version:ISOLATED_CONTROL_CAUGHT_REAR_SOLO_VERSION,
    sourceKm:segment.km,riderId:rider.rider.id,
    bunchLeaderRiderId:worker.rider.id,soloDecision,
    startDistanceM:startM,endDistanceM,
    bunchSpeedKph,soloSpeedKph,
    behindBunchSeconds:movement.gapSeconds,status,
    riders:[{riderId:rider.rider.id,role:'solo',
      energyBefore:riderEnergy,energySpent:riderCost,
      energy:energyByRider[rider.rider.id]},
    {riderId:worker.rider.id,role:'bunch_leader',
      energyBefore:workerEnergy,energySpent:workerCost,
      energy:energyByRider[worker.rider.id]}],
    energyByRider,
    event:movement.caught?{kind:'rejoin_bunch',
      atDistanceM:endDistanceM,riderId:rider.rider.id}:null,
    officialResults:false};
}

export function validateControlCaughtRearSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceControlCaughtRearSoloV1(input)))
    throw new Error('Caught rear solo differs from paid source.');
  return true;
}
