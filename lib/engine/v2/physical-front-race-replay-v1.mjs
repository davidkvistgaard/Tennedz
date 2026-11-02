// Complete narrow witness for a named solo that stays ahead on paid
// road. If the bunch catches it, the separate contact source is required.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalFrontSoloV1} from
  './physical-front-solo-run-v1.mjs';
import {runPhysicalBunchAfterNamedAttackV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_FRONT_RACE_REPLAY_VERSION=
  'v2-physical-front-race-replay-1';

export function replayPhysicalFrontRaceV1({startInput,start,
  attackKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=attackKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Front race replay needs later paid road.');
  const front=runPhysicalFrontSoloV1({startInput,start,
    attackKm,throughKm});
  const bunch=runPhysicalBunchAfterNamedAttackV1({startInput,start,
    attackKm,throughKm});
  const riderId=front.riderId;
  const attack=front.attack;
  const allRiderIds=start.riderIds;
  const kilometres=[];
  let bunchSeconds=0;
  for(let km=1;km<=throughKm;km++){
    const bunchStep=km<attackKm?
      attack.priorRoad[km-1]:km===attackKm?
        attack.step:bunch.road.find(row=>row.sourceKm===km);
    if(!bunchStep)
      throw new Error('Front race lacks paid bunch road.');
    bunchSeconds+=bunchStep.elapsedSeconds;
    const decisions=new Map(bunchStep.riderDecisions.map(row=>
      [row.riderId,row]));
    const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
      const row=bunchStep.riders.find(item=>item.riderId===id);
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',atDistanceM:km*1000,
        elapsedSeconds:bunchSeconds,energyAfter:row.energyAfter,
        decisions:[decisions.get(id)]};
    });
    if(km===attackKm){
      const row=attack.step.riders.find(item=>
        item.riderId===riderId);
      riderStates.push({riderId,sourceKm:km,
        physicalGroupId:attack.frontSolo.id,
        atDistanceM:km*1000,
        elapsedSeconds:attack.frontSolo.elapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(riderId)]});
    }else if(km>attackKm){
      const step=front.steps.find(row=>row.sourceKm===km);
      riderStates.push({riderId,sourceKm:km,
        physicalGroupId:step.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:step.elapsedSeconds,
        energyAfter:step.energyAfter,
        decisions:[step.decision]});
    }
    if(riderStates.length!==allRiderIds.length||
      new Set(riderStates.map(row=>row.riderId)).size!==
        allRiderIds.length||riderStates.some(row=>
        !Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Front race lacks rider kilometre.');
    kilometres.push({sourceKm:km,
      riderStates:riderStates.sort((a,b)=>
        allRiderIds.indexOf(a.riderId)-
        allRiderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_FRONT_RACE_REPLAY_VERSION,
    throughKm,attackKm,riderIds:[...allRiderIds],
    kilometres,sources:{front,bunch},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalFrontRaceV1(input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRaceV1(input)))
    throw new Error('Front race differs from paid source.');
  return true;
}
