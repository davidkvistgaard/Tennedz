// Complete narrow witness for one physically detached bunch rider.
// A later manager attack by that rider is explicitly blocked, while
// their own solo road remains separately paid through observed finish.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {runPhysicalDetachedSoloV1} from
  './physical-detached-solo-run-v1.mjs';

export const PHYSICAL_SINGLE_LOSS_RACE_REPLAY_VERSION=
  'v2-physical-single-loss-race-replay-1';

export function replayPhysicalSingleLossRaceV1({startInput,start,
  lossKm,riderId,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=lossKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Single-loss race needs later paid road.');
  const bunch=runPhysicalBunchAfterPaceLossV1({startInput,start,
    lossKm,throughKm});
  if(bunch.loss.step.splits.length!==1||
    bunch.loss.step.splits[0].riderId!==riderId)
    throw new Error('Single-loss race needs exactly one physical drop.');
  const completion=completePhysicalPaceLossKmV1({startInput,start,
    lossKm,loss:bunch.loss,riderId});
  const solo=runPhysicalDetachedSoloV1({startInput,start,
    lossKm,throughKm,riderId});
  const allRiderIds=start.riderIds;
  const kilometres=[];
  let bunchSeconds=0;
  for(let km=1;km<=throughKm;km++){
    const bunchStep=km<lossKm?
      bunch.loss.priorRoad[km-1]:km===lossKm?
        bunch.loss.step:bunch.road.find(row=>row.sourceKm===km);
    if(!bunchStep)
      throw new Error('Single-loss race lacks paid bunch road.');
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
    if(km===lossKm){
      riderStates.push({riderId,sourceKm:km,
        physicalGroupId:completion.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:completion.elapsedSeconds,
        energyAfter:completion.energyAfter,
        decisions:[completion.decision]});
    }else if(km>lossKm){
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
      throw new Error('Single-loss race lacks rider kilometre.');
    kilometres.push({sourceKm:km,
      riderStates:riderStates.sort((a,b)=>
        allRiderIds.indexOf(a.riderId)-
        allRiderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_SINGLE_LOSS_RACE_REPLAY_VERSION,
    throughKm,lossKm,riderId,riderIds:[...allRiderIds],
    kilometres,sources:{bunch,completion,solo},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalSingleLossRaceV1(input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalSingleLossRaceV1(input)))
    throw new Error('Single-loss race differs from paid source.');
  return true;
}
