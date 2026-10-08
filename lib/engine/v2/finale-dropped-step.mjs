import {isDeepStrictEqual} from 'node:util';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {finalePassiveFrontSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_DROPPED_STEP_VERSION='v2-finale-dropped-step-1';

// Move already dropped riders over one recorded short slice. A solo rider gets
// no bunch draft or free recovery. Contact and exhaustion need separate road
// rules, so neither is silently converted into a finish position here.
export function advanceFinaleDroppedStep({slice,segment,bunchElapsedSeconds,
  droppedRiders,ridersById}){
  energyCostForFinaleSlice(slice,0);
  if(!segment||segment.km!==slice.sourceKm||
    !Number.isFinite(bunchElapsedSeconds)||bunchElapsedSeconds<=0||
    !Array.isArray(droppedRiders)||!droppedRiders.length||
    !(ridersById instanceof Map)||
    new Set(droppedRiders.map(row=>row?.riderId)).size!==
      droppedRiders.length||
    droppedRiders.some(row=>typeof row?.riderId!=='string'||
      !ridersById.has(row.riderId)||
      !Number.isFinite(row.deficitSeconds)||row.deficitSeconds<0||
      !Number.isFinite(row.energy)||row.energy<0||row.energy>100))
    throw new Error('A dropped finale step needs complete source riders and bunch travel.');
  const riders=droppedRiders.map(row=>{
    const rider=ridersById.get(row.riderId);
    const effect=riderKilometreEffect(rider,segment,{phase:'cruise',
      energy:row.energy,exposed:segment.exposed});
    const costPerKm=TUNING.effortCost.conserve*
      effect.energyCostMultiplier;
    const energySpent=energyCostForFinaleSlice(slice,costPerKm);
    if(energySpent>row.energy+1e-9)
      throw new Error(`A dropped finale rider cannot pay for travel: ${
        row.riderId} at ${slice.startDistanceM} m.`);
    const speedKph=finalePassiveFrontSpeed({riderIds:[row.riderId],
      ridersById,energies:new Map([[row.riderId,row.energy]]),segment});
    const elapsedSeconds=slice.lengthM*3.6/speedKph;
    const deficitSeconds=row.deficitSeconds+elapsedSeconds-
      bunchElapsedSeconds;
    if(deficitSeconds<=0)
      throw new Error(`A dropped finale rider needs recorded bunch contact: ${
        row.riderId} at ${slice.startDistanceM} m.`);
    return {riderId:row.riderId,
      deficitSecondsBefore:row.deficitSeconds,
      deficitSecondsAfter:deficitSeconds,
      energyBefore:row.energy,
      energyAfter:Math.max(0,row.energy-energySpent),
      energySpent,elapsedSeconds,speedKph};
  });
  return {version:FINALE_DROPPED_STEP_VERSION,
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
