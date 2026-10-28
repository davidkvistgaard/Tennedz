// Isolated, paid solo-road step behind the bunch. Speeds and energy costs must
// eventually come from committed rider decisions and the route. No inferred
// proximity or free group shelter is awarded from kilometre snapshots.
import {isDeepStrictEqual} from 'node:util';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';

export const REAR_SOLO_CONTACT_VERSION='v2-rear-solo-contact-1';

export function advanceRearSoloContactV1({slice,bunchSpeedKph,front,rear}){
  if(!front||!rear||typeof front.riderId!=='string'||
    typeof rear.riderId!=='string'||front.riderId===rear.riderId||
    !Number.isFinite(front.behindBunchSeconds)||
    !Number.isFinite(rear.behindBunchSeconds)||
    front.behindBunchSeconds<=0||
    rear.behindBunchSeconds<=front.behindBunchSeconds||
    !Number.isFinite(bunchSpeedKph)||bunchSpeedKph<=0||
    [front,rear].some(row=>!Number.isFinite(row.speedKph)||
      row.speedKph<=0||!Number.isFinite(row.energy)||row.energy<0||
      row.energy>100||!Number.isFinite(row.workCostPerKm)||
      row.workCostPerKm<0))
    throw new Error('Rear contact needs two ordered, distinct solo riders.');
  const movement=advanceFinaleGap({slice,
    gapSeconds:rear.behindBunchSeconds-front.behindBunchSeconds,
    frontSpeedKph:front.speedKph,chaseSpeedKph:rear.speedKph});
  const frontToBunch=advanceFinaleGap({slice,
    gapSeconds:front.behindBunchSeconds,frontSpeedKph:bunchSpeedKph,
    chaseSpeedKph:front.speedKph});
  const endDistanceM=movement.catchDistanceM??slice.endDistanceM;
  if(frontToBunch.catchDistanceM!==null&&
    frontToBunch.catchDistanceM<=endDistanceM+1e-9)
    throw new Error('Front solo rider reaches the bunch before rear contact.');
  const riddenM=endDistanceM-slice.startDistanceM;
  const bunchSeconds=riddenM*3.6/bunchSpeedKph;
  const riders=[front,rear].map(row=>{
    const spent=energyCostForFinaleSlice(slice,row.workCostPerKm)*
      riddenM/slice.lengthM;
    if(spent>row.energy+1e-9)
      throw new Error('A rear solo rider cannot pay for the contact step.');
    return {riderId:row.riderId,energy:Math.max(0,row.energy-spent),
      energySpent:spent,
      behindBunchSeconds:row.behindBunchSeconds+
        riddenM*3.6/row.speedKph-bunchSeconds};
  });
  if(movement.caught&&
    Math.abs(riders[0].behindBunchSeconds-riders[1].behindBunchSeconds)>1e-8)
    throw new Error('Rear riders did not meet at the paid contact point.');
  return {version:REAR_SOLO_CONTACT_VERSION,startDistanceM:slice.startDistanceM,
    endDistanceM,bunchElapsedSeconds:bunchSeconds,riders,
    event:movement.caught?{kind:'rear_contact',atDistanceM:endDistanceM,
      riderIds:[front.riderId,rear.riderId]}:null};
}

export function validateRearSoloContactV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSoloContactV1(input)))
    throw new Error('Rear solo contact differs from its paid source.');
  return true;
}
