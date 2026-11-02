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

export function contactPhysicalSimultaneousLossV1({
  startInput,start,lossKm}){
  const loss=runPhysicalBunchToPaceLossV1({
    startInput,start,lossKm});
  const riderIds=loss.step.splits.map(row=>row.riderId);
  if(riderIds.length<2||
    new Set(riderIds).size!==riderIds.length)
    throw new Error('Simultaneous rear contact needs two paid losses.');
  const completions=riderIds.map(riderId=>
    completePhysicalPaceLossKmV1({
      startInput,start,lossKm,loss,riderId}));
  const clock=completions[0].elapsedSeconds;
  if(completions.some(row=>
    row.endDistanceM!==lossKm*1000||
    Math.abs(row.elapsedSeconds-clock)>1e-7||
    row.energyAfter<0)||
    clock<=loss.elapsedSeconds)
    throw new Error('Simultaneous solos have no recorded meeting.');
  return {version:PHYSICAL_SIMULTANEOUS_LOSS_CONTACT_VERSION,
    sourceKm:lossKm,
    contact:{kind:'paid_solo_arrival',
      atDistanceM:lossKm*1000,
      clockSeconds:clock,riderIds:[...riderIds],
      behindBunchSeconds:clock-loss.elapsedSeconds},
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
