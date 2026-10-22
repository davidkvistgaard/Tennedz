import {isDeepStrictEqual} from 'node:util';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {finalePassiveFrontSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING,MOTOR_EXHAUSTION_COAST} from './tuning.mjs';

export const FINALE_DROPPED_STEP_VERSION='v2-finale-dropped-step-1';
export const FINALE_DEPLETED_DROPPED_STEP_VERSION=
  'v2-finale-depleted-dropped-step-2';
export const FINALE_COAST_DROPPED_STEP_VERSION=
  'v2-finale-coast-dropped-step-3';
export const FINALE_FRONT_DROP_CONTACT_STEP_VERSION=
  'v2-finale-front-drop-contact-step-4';

// Move already dropped riders over one recorded short slice. A solo rider gets
// no bunch draft or free recovery. Contact and exhaustion need separate road
// rules, so neither is silently converted into a finish position here.
export function advanceFinaleDroppedStep({slice,segment,bunchElapsedSeconds,
  droppedRiders,ridersById,version=FINALE_DROPPED_STEP_VERSION}){
  if(![FINALE_DROPPED_STEP_VERSION,
    FINALE_DEPLETED_DROPPED_STEP_VERSION,
    FINALE_COAST_DROPPED_STEP_VERSION,
    FINALE_FRONT_DROP_CONTACT_STEP_VERSION].includes(version))
    throw new Error('Unknown dropped finale step version.');
  energyCostForFinaleSlice(slice,0);
  if(!segment||segment.km!==slice.sourceKm||
    !Number.isFinite(bunchElapsedSeconds)||bunchElapsedSeconds<=0||
    !Array.isArray(droppedRiders)||!droppedRiders.length||
    !(ridersById instanceof Map)||
    new Set(droppedRiders.map(row=>row?.riderId)).size!==
      droppedRiders.length||
    droppedRiders.some(row=>typeof row?.riderId!=='string'||
      !ridersById.has(row.riderId)||
      !Number.isFinite(row.deficitSeconds)||
      version!==FINALE_FRONT_DROP_CONTACT_STEP_VERSION&&
        row.deficitSeconds<0||
      !Number.isFinite(row.energy)||row.energy<0||row.energy>100))
    throw new Error('A dropped finale step needs complete source riders and bunch travel.');
  const riders=droppedRiders.map(row=>{
    const rider=ridersById.get(row.riderId);
    const effect=riderKilometreEffect(rider,segment,{phase:'cruise',
      energy:row.energy,exposed:segment.exposed});
    const costPerKm=TUNING.effortCost.conserve*
      effect.energyCostMultiplier;
    const energyDemand=energyCostForFinaleSlice(slice,costPerKm);
    if(version===FINALE_DROPPED_STEP_VERSION&&
      energyDemand>row.energy+1e-9)
      throw new Error(`A dropped finale rider cannot pay for travel: ${
        row.riderId} at ${slice.startDistanceM} m.`);
    // The kilometre motor saturates reserve at zero while an exhausted rider
    // continues at their reduced ability. Keep that demand visible in v2.
    const energySpent=version===FINALE_DROPPED_STEP_VERSION?
      energyDemand:Math.min(row.energy,energyDemand);
    const curtailedEnergyDemand=energyDemand-energySpent;
    const coasted=[FINALE_COAST_DROPPED_STEP_VERSION,
      FINALE_FRONT_DROP_CONTACT_STEP_VERSION].includes(version);
    const sustainableFraction=coasted&&
      energyDemand>0?1-MOTOR_EXHAUSTION_COAST.maxSpeedLoss*
        curtailedEnergyDemand/energyDemand:1;
    const speedKph=finalePassiveFrontSpeed({riderIds:[row.riderId],
      ridersById,energies:new Map([[row.riderId,row.energy]]),segment})*
      sustainableFraction;
    const elapsedSeconds=slice.lengthM*3.6/speedKph;
    const deficitSeconds=row.deficitSeconds+elapsedSeconds-
      bunchElapsedSeconds;
    if(deficitSeconds<=0&&
      version!==FINALE_FRONT_DROP_CONTACT_STEP_VERSION)
      throw new Error(`A dropped finale rider needs recorded bunch contact: ${
        row.riderId} at ${slice.startDistanceM} m.`);
    const crossedBunch=row.deficitSeconds<0&&deficitSeconds>=0;
    const contactDistanceM=crossedBunch?
      slice.startDistanceM+slice.lengthM*(-row.deficitSeconds)/
        (deficitSeconds-row.deficitSeconds):null;
    return {riderId:row.riderId,
      deficitSecondsBefore:row.deficitSeconds,
      deficitSecondsAfter:deficitSeconds,
      energyBefore:row.energy,
      energyAfter:Math.max(0,row.energy-energySpent),
      energySpent,
      ...(version===FINALE_DEPLETED_DROPPED_STEP_VERSION?{
        energyDemand,unmetEnergyDemand:curtailedEnergyDemand}:{}),
      ...(coasted?{
        energyDemand,curtailedEnergyDemand,sustainableFraction}:{}),
      ...(version===FINALE_FRONT_DROP_CONTACT_STEP_VERSION?{
        contactDistanceM,contactStatus:crossedBunch?
          'bunch_passed_unassisted':'no_contact_in_slice'}:{}),
      elapsedSeconds,speedKph};
  });
  return {version,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    bunchElapsedSeconds,riders,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleDroppedStep(input,recording){
  if(!isDeepStrictEqual(recording,advanceFinaleDroppedStep(input)))
    throw new Error('Dropped finale travel differs from its source.');
  return true;
}
