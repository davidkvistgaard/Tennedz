// Read-only energy reconciliation for an opt-in road projected from V94.
// A replayed turn plan does not make the separate energy model the V94 road.
import {isDeepStrictEqual} from 'node:util';
import {runRearRecordedBunchOriginV1} from
  './rear-recorded-bunch-origin-v1.mjs';

export const REAR_RECORDED_BUNCH_ORIGIN_V2_VERSION=
  'v2-rear-recorded-bunch-origin-2';
const TOLERANCE=.001;

export function auditRearRecordedBunchOriginV2(input){
  const projected=runRearRecordedBunchOriginV1(input);
  const {recording,riderId}=input;
  const mismatches=[];
  let previousEnergy=projected.road.initialEnergy;
  for(const step of projected.road.steps){
    const frame=recording.frames[step.sourceKm-1];
    const ledger=frame.energyLedger.filter(row=>
      row.riderId===riderId);
    if(ledger.length!==1)
      throw new Error('Recorded origin needs one rider energy source.');
    const actual=ledger[0];
    const projectedPaid=step.slices.reduce((sum,slice)=>
      sum+slice.energySpent,0);
    const fields=[['energyBefore',previousEnergy,
      actual.energyBefore],
    ['paidFromReserve',projectedPaid,
      actual.paidFromReserve],
    ['recoveryAward',step.recoveryAward,
      actual.recoveryAward],
    ['energyAfter',step.energyAfter,
      actual.energyAfter]];
    for(const [field,projectedValue,recordedValue] of fields)
      if(!Number.isFinite(projectedValue)||
        !Number.isFinite(recordedValue)||
        Math.abs(projectedValue-recordedValue)>TOLERANCE)
        mismatches.push({km:step.sourceKm,field,
          projectedValue,recordedValue});
    previousEnergy=step.energyAfter;
  }
  return {version:REAR_RECORDED_BUNCH_ORIGIN_V2_VERSION,
    raceSeed:recording.raceSeed,riderId,throughKm:input.throughKm,
    sourceEnergyReconciled:mismatches.length===0,
    physicalClockReconciled:false,
    mismatches,projected,officialResults:false};
}

export function requireRearRecordedBunchOriginEnergyV2(input){
  const audit=auditRearRecordedBunchOriginV2(input);
  if(!audit.sourceEnergyReconciled)
    throw new Error('Recorded bunch origin energy differs from paid V94 source.');
  return audit;
}

export function validateRearRecordedBunchOriginV2(input,audit){
  if(!isDeepStrictEqual(audit,
    auditRearRecordedBunchOriginV2(input)))
    throw new Error('Recorded bunch energy audit differs from source.');
  return true;
}
