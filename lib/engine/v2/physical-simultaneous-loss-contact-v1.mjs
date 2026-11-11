// Riders who separately pay a bunch loss may meet only when their
// completed solo clocks and route metre coincide. This records that
// contact; a later source must pay any shared road.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchToPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';

export const PHYSICAL_SIMULTANEOUS_LOSS_CONTACT_VERSION=
  'v2-physical-simultaneous-loss-contact-1';
export const PHYSICAL_SIMULTANEOUS_LOSS_PARTITION_VERSION=
  'v2-physical-simultaneous-loss-partition-1';

export function partitionPhysicalSimultaneousLossV1({
  startInput,start,lossKm}){
  const loss=runPhysicalBunchToPaceLossV1({
    startInput,start,lossKm});
  const riderIds=loss.step.splits.map(row=>row.riderId);
  if(riderIds.length<2||
    new Set(riderIds).size!==riderIds.length)
    throw new Error('Simultaneous partition needs two paid losses.');
  const completions=riderIds.map(riderId=>
    completePhysicalPaceLossKmV1({
      startInput,start,lossKm,loss,riderId}));
  if(completions.some(row=>
    row.endDistanceM!==lossKm*1000||
    row.elapsedSeconds<=loss.elapsedSeconds||
    row.energyAfter<0))
    throw new Error('Simultaneous partition lacks paid solo arrival.');
  const arrivals=[];
  for(const row of completions){
    let arrival=arrivals.find(item=>
      Math.abs(item.clockSeconds-row.elapsedSeconds)<=1e-7);
    if(!arrival){
      arrival={atDistanceM:row.endDistanceM,
        clockSeconds:row.elapsedSeconds,riderIds:[]};
      arrivals.push(arrival);
    }
    arrival.riderIds.push(row.riderId);
  }
  if(arrivals.flatMap(row=>row.riderIds).length!==
    riderIds.length)
    throw new Error('Simultaneous partition lost a paid rider.');
  return {version:PHYSICAL_SIMULTANEOUS_LOSS_PARTITION_VERSION,
    sourceKm:lossKm,loss,completions,arrivals,
    contacts:arrivals.filter(row=>row.riderIds.length>=2)
      .map(row=>({kind:'paid_solo_arrival',...row,
        behindBunchSeconds:row.clockSeconds-
          loss.elapsedSeconds})),
    separateSoloRiderIds:arrivals.filter(row=>
      row.riderIds.length===1).map(row=>row.riderIds[0]),
    sharedRoadUnsettled:true,movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalSimultaneousLossPartitionV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    partitionPhysicalSimultaneousLossV1(input)))
    throw new Error('Simultaneous partition differs from source.');
  return true;
}

export function contactPhysicalSimultaneousLossV1({
  startInput,start,lossKm}){
  const partition=partitionPhysicalSimultaneousLossV1({
    startInput,start,lossKm});
  const {loss,completions}=partition;
  const riderIds=loss.step.splits.map(row=>row.riderId);
  if(partition.contacts.length!==1||
    partition.contacts[0].riderIds.length!==
      riderIds.length)
    throw new Error('Simultaneous solos have no recorded meeting.');
  const shared=partition.contacts[0];
  return {version:PHYSICAL_SIMULTANEOUS_LOSS_CONTACT_VERSION,
    sourceKm:lossKm,
    contact:shared,
    energyByRider:Object.fromEntries(completions.map(
      row=>[row.riderId,row.energyAfter])),
    loss,completions,
    sharedRoadUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalSimultaneousLossContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalSimultaneousLossV1(input)))
    throw new Error('Simultaneous rear contact differs from source.');
  return true;
}
