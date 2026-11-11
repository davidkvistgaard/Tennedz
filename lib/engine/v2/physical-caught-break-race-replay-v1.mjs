// Complete narrow witness for a named break caught by a paid bunch,
// sliding behind, and finishing on separately paid solo road.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalFrontSoloV1} from
  './physical-front-solo-run-v1.mjs';
import {catchPhysicalFrontSoloV1} from
  './physical-front-bunch-catch-v1.mjs';
import {slideCaughtBreakRiderV1} from
  './physical-caught-break-slide-v1.mjs';
import {runPhysicalBunchAfterCaughtSlideV1} from
  './physical-bunch-after-caught-slide-v1.mjs';
import {runPhysicalSlidBreakSoloV1} from
  './physical-slid-break-solo-run-v1.mjs';

export const PHYSICAL_CAUGHT_BREAK_RACE_REPLAY_VERSION=
  'v2-physical-caught-break-race-replay-1';

export function replayPhysicalCaughtBreakRaceV1({startInput,start,
  attackKm,catchKm,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=catchKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Caught break race needs later paid road.');
  const front=runPhysicalFrontSoloV1({startInput,start,
    attackKm,throughKm:catchKm-1});
  const contact=catchPhysicalFrontSoloV1({startInput,start,
    attackKm,catchKm});
  const slide=slideCaughtBreakRiderV1({startInput,start,
    attackKm,catchKm,catchRecord:contact});
  const laterInput={startInput,start,attackKm,catchKm,
    catchRecord:contact,slideRecord:slide,throughKm};
  const bunch=runPhysicalBunchAfterCaughtSlideV1(laterInput);
  const solo=runPhysicalSlidBreakSoloV1(laterInput);
  const riderId=front.riderId;
  const attack=front.attack;
  const allRiderIds=start.riderIds;
  const kilometres=[];
  let bunchSeconds=0;
  for(let km=1;km<=throughKm;km++){
    const bunchStep=km<attackKm?
      attack.priorRoad[km-1]:km===attackKm?
        attack.step:km<=catchKm?
          contact.paidBunch.road.find(row=>row.sourceKm===km):
          bunch.road.find(row=>row.sourceKm===km);
    if(!bunchStep)
      throw new Error('Caught break race lacks paid bunch road.');
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
    }else if(km>attackKm&&km<catchKm){
      const step=front.steps.find(row=>row.sourceKm===km);
      riderStates.push({riderId,sourceKm:km,
        physicalGroupId:step.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:step.elapsedSeconds,
        energyAfter:step.energyAfter,
        decisions:[step.decision]});
    }else if(km===catchKm){
      riderStates.push({riderId,sourceKm:km,
        physicalGroupId:slide.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:slide.elapsedSeconds,
        energyAfter:slide.energyAfter,
        decisions:[contact.frontDecision,slide.decision]});
    }else if(km>catchKm){
      const step=solo.steps.find(row=>row.sourceKm===km);
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
      throw new Error('Caught break race lacks rider kilometre.');
    kilometres.push({sourceKm:km,
      riderStates:riderStates.sort((a,b)=>
        allRiderIds.indexOf(a.riderId)-
        allRiderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_CAUGHT_BREAK_RACE_REPLAY_VERSION,
    throughKm,attackKm,catchKm,riderIds:[...allRiderIds],
    kilometres,sources:{front,contact,slide,bunch,solo},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalCaughtBreakRaceV1(input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalCaughtBreakRaceV1(input)))
    throw new Error('Caught break race differs from paid source.');
  return true;
}
