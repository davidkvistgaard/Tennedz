// A narrow complete-road witness: one physical bunch loss, two detached
// riders meet on paid road, then both groups reach a common kilometre.
// Every rider has a source-derived clock, energy and decision each km.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1} from
  './physical-pace-loss-completion-v1.mjs';
import {runPhysicalDetachedSoloV1} from
  './physical-detached-solo-run-v1.mjs';
import {contactPhysicalRearSolosV1} from
  './physical-rear-solo-contact-v1.mjs';
import {finishPhysicalRearContactKmV1} from
  './physical-rear-contact-road-v1.mjs';
import {runPhysicalRearGroupV1} from
  './physical-rear-group-run-v1.mjs';

export const PHYSICAL_REAR_RACE_REPLAY_VERSION=
  'v2-physical-rear-race-replay-1';

export function replayPhysicalRearRaceV1({startInput,start,
  lossKm,contactKm,riderIds,throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<=contactKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Physical race replay needs later road.');
  const bunch=runPhysicalBunchAfterPaceLossV1({startInput,start,
    lossKm,throughKm});
  if(bunch.loss.step.splits.length!==2||
    !isDeepStrictEqual([...bunch.loss.step.splits.map(row=>
      row.riderId)].sort(),[...riderIds].sort()))
    throw new Error('Physical race witness needs exact two-rider loss.');
  const completions=riderIds.map(riderId=>
    completePhysicalPaceLossKmV1({startInput,start,lossKm,
      loss:bunch.loss,riderId}));
  const solos=riderIds.map(riderId=>runPhysicalDetachedSoloV1({
    startInput,start,lossKm,throughKm:contactKm,riderId}));
  const contact=contactPhysicalRearSolosV1({
    startInput,start,lossKm,contactKm,riderIds});
  const contactRoad=finishPhysicalRearContactKmV1({
    startInput,start,lossKm,contactKm,riderIds,contact});
  const rear=runPhysicalRearGroupV1({startInput,start,lossKm,
    contactKm,riderIds,contact,contactRoad,throughKm});
  const allRiderIds=start.riderIds;
  const kilometres=[];
  let priorBunchSeconds=0;
  for(let km=1;km<=throughKm;km++){
    const bunchStep=km<lossKm?bunch.loss.priorRoad[km-1]:
      km===lossKm?bunch.loss.step:
        bunch.road.find(row=>row.sourceKm===km);
    priorBunchSeconds+=bunchStep.elapsedSeconds;
    const decisionById=new Map(bunchStep.riderDecisions.map(row=>
      [row.riderId,row]));
    const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
      const row=bunchStep.riders.find(item=>item.riderId===id);
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:priorBunchSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisionById.get(id)]};
    });
    if(km===lossKm){
      for(const completed of completions)
        riderStates.push({riderId:completed.riderId,
          sourceKm:km,
          physicalGroupId:completed.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:completed.elapsedSeconds,
          energyAfter:completed.energyAfter,
          decisions:[decisionById.get(completed.riderId)]});
    }else if(km>lossKm&&km<contactKm){
      for(const solo of solos){
        const step=solo.steps.find(row=>row.sourceKm===km);
        riderStates.push({riderId:solo.riderId,
          sourceKm:km,
          physicalGroupId:step.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:step.elapsedSeconds,
          energyAfter:step.energyAfter,
          decisions:[step.decision]});
      }
    }else if(km===contactKm){
      for(const row of contactRoad.riders){
        const before=contact.riders.find(item=>
          item.riderId===row.riderId);
        riderStates.push({riderId:row.riderId,
          sourceKm:km,
          physicalGroupId:contactRoad.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:contactRoad.elapsedSeconds,
          energyAfter:row.energyAfter,
          decisions:[before.decision,row.decision]});
      }
    }else if(km>contactKm){
      const rearStep=rear.steps.find(row=>row.sourceKm===km);
      for(const row of rearStep.riders)
        riderStates.push({riderId:row.riderId,
          sourceKm:km,
          physicalGroupId:rearStep.physicalGroup.id,
          atDistanceM:km*1000,
          elapsedSeconds:rearStep.elapsedSeconds,
          energyAfter:row.energyAfter,
          decisions:[row.decision]});
    }
    if(riderStates.length!==allRiderIds.length||
      new Set(riderStates.map(row=>row.riderId)).size!==
        allRiderIds.length||riderStates.some(row=>
        !Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Physical race lacks a sourced rider kilometre.');
    kilometres.push({sourceKm:km,
      riderStates:riderStates.sort((a,b)=>
        allRiderIds.indexOf(a.riderId)-
        allRiderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_REAR_RACE_REPLAY_VERSION,
    throughKm,riderIds:[...allRiderIds],
    kilometres,
    sources:{bunch,completions,solos,contact,contactRoad,rear},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalRearRaceV1(input,recording){
  if(!isDeepStrictEqual(recording,replayPhysicalRearRaceV1(input)))
    throw new Error('Physical race differs from paid source.');
  return true;
}
