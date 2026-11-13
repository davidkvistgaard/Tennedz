// Whole-road replay for one named attack, perceived chase commitment,
// paid rotating leaders and a front solo that remains ahead to finish.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalPerceivedChaseV1} from
  './physical-perceived-chase-run-v1.mjs';

export const PHYSICAL_PERCEIVED_CHASE_RACE_VERSION=
  'v2-physical-perceived-chase-race-replay-1';

export function replayPhysicalPerceivedChaseRaceV1(input){
  const chase=runPhysicalPerceivedChaseV1(input);
  const {startInput,start,attackKm,choiceKm,throughKm}=input;
  const front=chase.source.threat.physicalSource.front;
  const bunch=chase.source.threat.physicalSource.bunch;
  const attack=front.attack;
  const frontRiderId=chase.frontRiderId;
  const riderIds=start.riderIds;
  const kilometres=[];
  let bunchElapsedSeconds=0;
  for(let km=1;km<=throughKm;km++){
    if(km>=choiceKm){
      const step=chase.steps.find(row=>row.sourceKm===km);
      kilometres.push({sourceKm:km,
        riderStates:step.riderStates});
      continue;
    }
    const bunchStep=km<attackKm?attack.priorRoad[km-1]:
      km===attackKm?attack.step:
        bunch.road.find(row=>row.sourceKm===km);
    if(!bunchStep)
      throw new Error('Chase race lacks earlier paid bunch road.');
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const decisions=new Map(bunchStep.riderDecisions.map(row=>
      [row.riderId,row]));
    const states=bunchStep.physicalGroup.riderIds.map(riderId=>{
      const row=bunchStep.riders.find(item=>
        item.riderId===riderId);
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',atDistanceM:km*1000,
        elapsedSeconds:bunchElapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(riderId)]};
    });
    if(km===attackKm){
      const row=attack.step.riders.find(item=>
        item.riderId===frontRiderId);
      states.push({riderId:frontRiderId,
        sourceKm:km,physicalGroupId:attack.frontSolo.id,
        atDistanceM:km*1000,
        elapsedSeconds:attack.frontSolo.elapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(frontRiderId)]});
    }else if(km>attackKm){
      const step=front.steps.find(row=>row.sourceKm===km);
      states.push({riderId:frontRiderId,
        sourceKm:km,physicalGroupId:step.physicalGroup.id,
        atDistanceM:km*1000,
        elapsedSeconds:step.elapsedSeconds,
        energyAfter:step.energyAfter,
        decisions:[step.decision]});
    }
    if(states.length!==riderIds.length||
      new Set(states.map(row=>row.riderId)).size!==
        riderIds.length||states.some(row=>
        !Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Chase race lacks sourced rider kilometre.');
    kilometres.push({sourceKm:km,
      riderStates:states.sort((a,b)=>
        riderIds.indexOf(a.riderId)-
        riderIds.indexOf(b.riderId))});
  }
  if(Math.abs(bunchElapsedSeconds-bunch.elapsedSeconds)>1e-7)
    throw new Error('Chase race prior clock differs from source.');
  if(kilometres.length!==throughKm||
    kilometres.some(row=>row.riderStates.length!==
      riderIds.length))
    throw new Error('Chase race lacks full-field road.');
  const last=kilometres.at(-1);
  return {version:PHYSICAL_PERCEIVED_CHASE_RACE_VERSION,
    attackKm,choiceKm,throughKm,
    riderIds:[...riderIds],kilometres,
    sources:{chase},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalPerceivedChaseRaceV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalPerceivedChaseRaceV1(input)))
    throw new Error('Chase race differs from paid source.');
  return true;
}
