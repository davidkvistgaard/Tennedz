// Join paid solo meeting and paid group road to the earlier 24-rider
// recording. Subsequent rear-group turns are a separate source.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerChaseRaceV1} from
  './physical-manager-chase-race-replay-v1.mjs';
import {finishPhysicalPostcatchContactKmV1} from
  './physical-postcatch-contact-road-v1.mjs';

export const PHYSICAL_MANAGER_POSTCATCH_CONTACT_VERSION=
  'v2-physical-manager-postcatch-contact-1';

export function replayPhysicalManagerPostcatchContactV1({
  input,leaderRiderId}){
  let source;
  try{
    replayPhysicalManagerChaseRaceV1(input);
  }catch(error){
    if(!error.paidPostcatchContact)throw error;
    source=error.paidPostcatchContact;
  }
  if(!source)
    throw new Error('Post-catch contact needs source meeting.');
  const {contactInput,contact,priorKilometres}=source;
  const groupRoad=finishPhysicalPostcatchContactKmV1({
    contactInput,contact,leaderRiderId});
  const {loss,priorBunchClock}=contactInput;
  const km=loss.sourceKm;
  const riderIds=input.start.riderIds;
  const bunchClock=priorBunchClock+loss.elapsedSeconds;
  const bunchDecisions=new Map(loss.riderDecisions.map(row=>
    [row.riderId,row]));
  const states=loss.physicalGroup.riderIds.map(riderId=>{
    const row=loss.riders.find(item=>
      item.riderId===riderId);
    return {riderId,sourceKm:km,
      physicalGroupId:'peloton',atDistanceM:km*1000,
      elapsedSeconds:bunchClock,
      energyAfter:row.energyAfter,
      decisions:[bunchDecisions.get(riderId)]};
  });
  for(const row of groupRoad.riders)
    states.push({riderId:row.riderId,sourceKm:km,
      physicalGroupId:groupRoad.physicalGroup.id,
      atDistanceM:km*1000,
      elapsedSeconds:groupRoad.elapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[{riderId:row.riderId,
        ...row.decision}]});
  if(priorKilometres.length!==km-1||
    states.length!==riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      riderIds.length||states.some(row=>
      !row.decisions[0]||row.energyAfter<0)||
    priorKilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==riderIds.length))
    throw new Error('Post-catch contact lacks rider road.');
  const contactKilometre={sourceKm:km,
    riderStates:states.sort((a,b)=>
      riderIds.indexOf(a.riderId)-
      riderIds.indexOf(b.riderId))};
  return {version:PHYSICAL_MANAGER_POSTCATCH_CONTACT_VERSION,
    sourceKm:km,riderIds:[...riderIds],
    kilometres:[...priorKilometres,contactKilometre],
    source:{contactInput,contact,groupRoad},
    laterRoadUnsettled:true,movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalManagerPostcatchContactV1(
input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerPostcatchContactV1(input)))
    throw new Error('Post-catch rider road differs from source.');
  return true;
}
