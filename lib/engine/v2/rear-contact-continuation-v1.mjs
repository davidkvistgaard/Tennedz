// Isolated continuation from a paid solo contact. It cannot start from two
// similar checkpoint deficits: the contact step is recalculated from its
// explicit solo speeds and energy before a rear group may receive shelter.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearSoloContactV1} from './rear-solo-contact-v1.mjs';

export const REAR_CONTACT_CONTINUATION_VERSION='v2-rear-contact-continuation-1';

export function continueRearContactV1({soloInput,groupId,leaderRiderId,
  groupSpeedKph,leadCostPerKm,shelteredCostPerKm}){
  const contact=advanceRearSoloContactV1(soloInput);
  if(!contact.event||!/^rear-[1-9]\d*$/.test(groupId??'')||
    !contact.event.riderIds.includes(leaderRiderId)||
    !Number.isFinite(groupSpeedKph)||groupSpeedKph<=0||
    !Number.isFinite(leadCostPerKm)||
    !Number.isFinite(shelteredCostPerKm)||
    shelteredCostPerKm<0||leadCostPerKm<=shelteredCostPerKm)
    throw new Error('A rear group needs paid contact and one valid leader.');
  const startDistanceM=contact.endDistanceM;
  const remainingM=soloInput.slice.endDistanceM-startDistanceM;
  const startBehind=contact.riders[0].behindBunchSeconds;
  const groupSecondsPerM=3.6/groupSpeedKph;
  const bunchSecondsPerM=3.6/soloInput.bunchSpeedKph;
  const gainPerM=bunchSecondsPerM-groupSecondsPerM;
  const catchM=gainPerM>0?startBehind/gainPerM:Infinity;
  const riddenM=Math.max(0,Math.min(remainingM,catchM));
  const endDistanceM=startDistanceM+riddenM;
  const caughtBunch=catchM<=remainingM+1e-9;
  const riders=contact.riders.map(row=>{
    const leading=row.riderId===leaderRiderId;
    const energySpent=riddenM/1000*(leading?leadCostPerKm:shelteredCostPerKm);
    if(energySpent>row.energy+1e-9)
      throw new Error('A rear-group rider cannot pay for a shared step.');
    return {riderId:row.riderId,role:leading?'leader':'sheltered',
      energy:Math.max(0,row.energy-energySpent),energySpent};
  });
  const behindBunchSeconds=caughtBunch?0:
    startBehind+riddenM*(groupSecondsPerM-bunchSecondsPerM);
  return {version:REAR_CONTACT_CONTINUATION_VERSION,contact,
    groupId,leaderRiderId,startDistanceM,endDistanceM,
    groupElapsedSeconds:riddenM*groupSecondsPerM,
    bunchElapsedSeconds:riddenM*bunchSecondsPerM,
    riders,behindBunchSeconds,
    rearGroup:caughtBunch?null:{id:groupId,
      riderIds:[...contact.event.riderIds],atDistanceM:endDistanceM,
      behindBunchSeconds,turnCount:1,
      energyByRider:Object.fromEntries(riders.map(row=>
        [row.riderId,row.energy]))},
    event:caughtBunch?{kind:'rejoin_bunch',atDistanceM:endDistanceM,
      riderIds:[...contact.event.riderIds]}:null};
}

export function validateRearContactContinuationV1(input,recording){
  if(!isDeepStrictEqual(recording,continueRearContactV1(input)))
    throw new Error('Rear-group continuation differs from its source.');
  return true;
}
