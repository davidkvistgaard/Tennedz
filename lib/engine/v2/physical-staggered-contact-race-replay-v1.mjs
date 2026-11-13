// Whole-race witness with two different paid loss kilometres, their
// measured later contact and a single-leader rear group to finish.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {runPhysicalStaggeredDetachedSoloV1} from
  './physical-staggered-detached-solo-v1.mjs';
import {contactPhysicalStaggeredSolosV1} from
  './physical-staggered-solo-contact-v1.mjs';
import {finishPhysicalStaggeredContactKmV1} from
  './physical-staggered-contact-road-v1.mjs';
import {runPhysicalStaggeredRearGroupV1} from
  './physical-staggered-rear-group-v1.mjs';

export const PHYSICAL_STAGGERED_CONTACT_RACE_VERSION=
  'v2-physical-staggered-contact-race-replay-1';

export function replayPhysicalStaggeredContactRaceV1({startInput,
  start,riderIds,contactKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=contactKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Staggered contact race needs later paid road.');
  const staggered=runPhysicalStaggeredBunchLossV1({startInput,
    start,throughKm});
  if(staggered.losses.length!==2||
    !isDeepStrictEqual([...riderIds].sort(),
      [...staggered.detachedRiderIds].sort()))
    throw new Error('Staggered contact race needs exact two losses.');
  const solos=riderIds.map(riderId=>
    runPhysicalStaggeredDetachedSoloV1({startInput,start,
      staggered,riderId,throughKm:contactKm}));
  const contact=contactPhysicalStaggeredSolosV1({startInput,
    start,staggered,riderIds,contactKm});
  const contactRoad=finishPhysicalStaggeredContactKmV1({
    startInput,start,staggered,riderIds,contactKm,contact});
  const rear=runPhysicalStaggeredRearGroupV1({startInput,
    start,staggered,riderIds,contactKm,contact,contactRoad,
    throughKm});
  const allRiderIds=start.riderIds;
  const kilometres=[];
  let bunchElapsedSeconds=0;
  for(let km=1;km<=throughKm;km++){
    const bunchStep=staggered.road[km-1];
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const decisions=new Map(bunchStep.riderDecisions.map(row=>
      [row.riderId,row]));
    const states=bunchStep.physicalGroup.riderIds.map(riderId=>{
      const row=bunchStep.riders.find(item=>item.riderId===riderId);
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',atDistanceM:km*1000,
        elapsedSeconds:bunchElapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(riderId)]};
    });
    if(km<contactKm){
      for(const solo of solos){
        if(km<solo.lossKm)continue;
        const source=km===solo.lossKm?solo.completion:
          solo.steps.find(row=>row.sourceKm===km);
        states.push({riderId:solo.riderId,sourceKm:km,
          physicalGroupId:source.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:source.elapsedSeconds,
          energyAfter:source.energyAfter,
          decisions:[source.decision]});
      }
    }else if(km===contactKm){
      for(const row of contactRoad.riders){
        const before=contact.riders.find(item=>
          item.riderId===row.riderId);
        states.push({riderId:row.riderId,sourceKm:km,
          physicalGroupId:contactRoad.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:contactRoad.elapsedSeconds,
          energyAfter:row.energyAfter,
          decisions:[before.decision,row.decision]});
      }
    }else{
      const step=rear.steps.find(row=>row.sourceKm===km);
      for(const row of step.riders)
        states.push({riderId:row.riderId,sourceKm:km,
          physicalGroupId:step.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:step.elapsedSeconds,
          energyAfter:row.energyAfter,
          decisions:[row.decision]});
    }
    if(states.length!==allRiderIds.length||
      new Set(states.map(row=>row.riderId)).size!==
        allRiderIds.length||states.some(row=>
        !Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Staggered contact race lacks rider road.');
    kilometres.push({sourceKm:km,
      riderStates:states.sort((a,b)=>
        allRiderIds.indexOf(a.riderId)-
        allRiderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_STAGGERED_CONTACT_RACE_VERSION,
    throughKm,riderIds:[...allRiderIds],kilometres,
    sources:{staggered,solos,contact,contactRoad,rear},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalStaggeredContactRaceV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalStaggeredContactRaceV1(input)))
    throw new Error('Staggered contact race differs from source.');
  return true;
}
