// Join a paid return contact to the earlier full-field recording.
// Later bunch kilometres still require a separate source.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerChaseRaceV1} from
  './physical-manager-chase-race-replay-v1.mjs';
import {contactPhysicalManagerReturnV1} from
  './physical-manager-return-contact-v1.mjs';

export const PHYSICAL_MANAGER_RETURN_KM_VERSION=
  'v2-physical-manager-return-km-1';

export function replayPhysicalManagerReturnKmV1(input){
  let source;
  try{
    replayPhysicalManagerChaseRaceV1(input);
  }catch(error){
    if(!error.paidReturnContact)throw error;
    source=error.paidReturnContact;
  }
  if(!source)
    throw new Error('Return kilometre needs paid contact.');
  const {bunchStep,priorKilometres}=source;
  const contact=contactPhysicalManagerReturnV1(source);
  const km=contact.sourceKm;
  const riderIds=input.start.riderIds;
  const decisions=new Map(bunchStep.riderDecisions.map(
    row=>[row.riderId,row]));
  const states=bunchStep.physicalGroup.riderIds.map(
    riderId=>{
      const row=bunchStep.riders.find(item=>
        item.riderId===riderId);
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:contact.bunchEndClockSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(riderId)]};
    });
  states.push({riderId:contact.riderId,
    sourceKm:km,physicalGroupId:'peloton',
    atDistanceM:km*1000,
    elapsedSeconds:contact.bunchEndClockSeconds,
    energyAfter:contact.energyAfter,
    decisions:[contact.decision]});
  if(priorKilometres.length!==km-1||
    states.length!==riderIds.length||
    new Set(states.map(row=>row.riderId)).size!==
      riderIds.length||
    states.some(row=>!row.decisions[0]||
      row.energyAfter<0)||
    priorKilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==riderIds.length))
    throw new Error('Return kilometre lacks rider road.');
  const returnKilometre={sourceKm:km,
    riderStates:states.sort((a,b)=>
      riderIds.indexOf(a.riderId)-
      riderIds.indexOf(b.riderId))};
  return {version:PHYSICAL_MANAGER_RETURN_KM_VERSION,
    sourceKm:km,riderIds:[...riderIds],
    kilometres:[...priorKilometres,returnKilometre],
    source:{bunchStep,contact},
    laterRoadUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerReturnKmV1(input,
recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerReturnKmV1(input)))
    throw new Error('Return kilometre differs from paid source.');
  return true;
}
