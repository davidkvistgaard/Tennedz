// Continue an isolated paid solo return through later whole-bunch road.
// Any later split needs its own source and is refused here.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalOrderedSoloBunchJoinKmV1} from
  './physical-ordered-solo-bunch-join-v1.mjs';
import {advancePhysicalBunchAfterOrderedSoloJoinKmV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_ORDERED_SOLO_BUNCH_RACE_VERSION=
  'v2-physical-ordered-solo-bunch-race-1';

export function replayPhysicalOrderedSoloBunchRaceV1({
  contactInput,throughKm}){
  const joined=finishPhysicalOrderedSoloBunchJoinKmV1(
    contactInput);
  const {startInput,start,riderId}=contactInput;
  if(!Number.isInteger(throughKm)||
    throughKm<=joined.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Ordered return race needs later source road.');
  const kilometres=[{sourceKm:joined.sourceKm,
    riderStates:joined.riderStates}];
  const steps=[];
  let prior=joined.nextBunchState;
  let clock=joined.bunchEndClock;
  for(let km=joined.sourceKm+1;km<=throughKm;km++){
    const step=advancePhysicalBunchAfterOrderedSoloJoinKmV1({
      startInput,prior,
      segment:startInput.routeKilometres[km-1],
      riderId,contactKm:joined.sourceKm});
    if(step.splits.length||
      step.physicalGroup.riderIds.length!==
        start.riderIds.length||
      !isDeepStrictEqual(
        new Set(step.physicalGroup.riderIds),
        new Set(start.riderIds)))
      throw new Error(
        'Ordered return race needs paid later split source.');
    clock+=step.elapsedSeconds;
    const decisions=new Map(step.riderDecisions.map(row=>
      [row.riderId,row]));
    const states=start.riderIds.map(id=>{
      const row=step.riders.find(item=>
        item.riderId===id);
      if(!row||!decisions.has(id)||
        Math.abs(row.energyBefore-
          prior.energyByRider[id])>1e-6||
        row.energyAfter<0)
        throw new Error(
          'Ordered return race lacks paid rider state.');
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:clock,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(id)]};
    });
    kilometres.push({sourceKm:km,
      riderStates:states});
    steps.push(step);
    prior={riderIds:step.physicalGroup.riderIds,
      energyByRider:step.energyByRider,
      quietKmByRider:step.quietKmByRider};
  }
  return {version:PHYSICAL_ORDERED_SOLO_BUNCH_RACE_VERSION,
    riderId,contactKm:joined.sourceKm,
    throughKm,sources:{joined,steps},kilometres,
    observedFinishSecondsByRider:Object.fromEntries(
      kilometres.at(-1).riderStates.map(row=>
        [row.riderId,row.elapsedSeconds])),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalOrderedSoloBunchRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedSoloBunchRaceV1(input)))
    throw new Error(
      'Ordered return race differs from paid source.');
  return true;
}
