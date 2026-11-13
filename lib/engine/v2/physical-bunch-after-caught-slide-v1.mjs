// Continue the surviving paid bunch after a front solo is caught and
// physically slides behind. Neither contact nor the old attack order
// puts the former attacker back on a bunch wheel.
import {isDeepStrictEqual} from 'node:util';
import {catchPhysicalFrontSoloV1} from
  './physical-front-bunch-catch-v1.mjs';
import {slideCaughtBreakRiderV1} from
  './physical-caught-break-slide-v1.mjs';
import {advancePhysicalBunchAfterCaughtSlideKmV1} from
  './physical-start-bunch-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_BUNCH_AFTER_CAUGHT_SLIDE_VERSION=
  'v2-physical-bunch-after-caught-slide-1';

export function runPhysicalBunchAfterCaughtSlideV1({startInput,
  start,attackKm,catchKm,catchRecord,slideRecord,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=catchKm||
    throughKm>startInput?.routeKilometres?.length||
    !isDeepStrictEqual(catchRecord,
      catchPhysicalFrontSoloV1({startInput,start,
        attackKm,catchKm}))||
    !isDeepStrictEqual(slideRecord,
      slideCaughtBreakRiderV1({startInput,start,
        attackKm,catchKm,catchRecord})))
    throw new Error('Post-slide bunch needs replayed paid contact.');
  const caughtRiderId=slideRecord.riderId;
  const catchStep=catchRecord.paidBunch.road.at(-1);
  let prior={riderIds:catchStep.physicalGroup.riderIds,
    energyByRider:catchStep.energyByRider,
    quietKmByRider:catchStep.quietKmByRider};
  const road=[];
  for(let km=catchKm+1;km<=throughKm;km++){
    const activeChaseTeams=startInput.teams.filter(team=>{
      const order=orderAt(team.orders,km-1);
      return order.chase!=='ignore'&&
        order.frontWork==='rotate';
    });
    if(activeChaseTeams.length>1)
      throw new Error('Post-catch road has ambiguous chase order.');
    let current;
    try{current=advancePhysicalBunchAfterCaughtSlideKmV1({
      startInput,prior,
      segment:startInput.routeKilometres[km-1],
      caughtRiderId,
      resolvedChaseTeamId:activeChaseTeams[0]?.id??null});}
    catch(error){error.sourceKm=km;throw error;}
    road.push(current);
    prior={riderIds:current.physicalGroup.riderIds,
      energyByRider:current.energyByRider,
      quietKmByRider:current.quietKmByRider};
  }
  return {version:PHYSICAL_BUNCH_AFTER_CAUGHT_SLIDE_VERSION,
    sourceKm:throughKm,caughtRiderId,
    catchRecord,slideRecord,road,
    physicalGroup:road.at(-1).physicalGroup,
    energyByRider:prior.energyByRider,
    elapsedSeconds:catchRecord.paidBunch.elapsedSeconds+
      road.reduce((sum,row)=>sum+row.elapsedSeconds,0),
    officialResults:false};
}

export function validatePhysicalBunchAfterCaughtSlideV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalBunchAfterCaughtSlideV1(input)))
    throw new Error('Post-slide bunch differs from paid source.');
  return true;
}
