// Complete road only while staggered detached riders remain separate.
// A measured crossing refuses until a paid contact transition exists.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {runPhysicalStaggeredDetachedSoloV1} from
  './physical-staggered-detached-solo-v1.mjs';

export const PHYSICAL_STAGGERED_RACE_REPLAY_VERSION=
  'v2-physical-staggered-race-replay-1';

export function replayPhysicalStaggeredRaceV1({startInput,start,
  throughKm}){
  const bunch=runPhysicalStaggeredBunchLossV1({startInput,start,
    throughKm});
  if(bunch.losses.length!==2||
    bunch.losses[0].sourceKm===bunch.losses[1].sourceKm)
    throw new Error('Staggered race needs exactly two later losses.');
  const solos=bunch.losses.map(loss=>
    runPhysicalStaggeredDetachedSoloV1({startInput,start,
      staggered:bunch,riderId:loss.riderId,throughKm}));
  const riderIds=start.riderIds;
  const kilometres=[];
  let bunchElapsedSeconds=0;
  let priorSoloOrder=null;
  for(let km=1;km<=throughKm;km++){
    const step=bunch.road[km-1];
    bunchElapsedSeconds+=step.elapsedSeconds;
    const decisions=new Map(step.riderDecisions.map(row=>
      [row.riderId,row]));
    const states=step.physicalGroup.riderIds.map(riderId=>{
      const row=step.riders.find(item=>item.riderId===riderId);
      return {riderId,sourceKm:km,physicalGroupId:'peloton',
        atDistanceM:km*1000,elapsedSeconds:bunchElapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(riderId)]};
    });
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
    if(states.length!==riderIds.length||
      new Set(states.map(row=>row.riderId)).size!==riderIds.length||
      states.some(row=>!Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Staggered race lacks sourced rider road.');
    if(km>=solos[1].lossKm){
      const first=states.find(row=>row.riderId===solos[0].riderId);
      const second=states.find(row=>row.riderId===solos[1].riderId);
      const order=Math.sign(first.elapsedSeconds-
        second.elapsedSeconds);
      if(order<=0||priorSoloOrder!==null&&order!==priorSoloOrder)
        throw new Error('Staggered solos need paid contact road.');
      priorSoloOrder=order;
    }
    kilometres.push({sourceKm:km,riderStates:states.sort((a,b)=>
      riderIds.indexOf(a.riderId)-riderIds.indexOf(b.riderId))});
  }
  const last=kilometres.at(-1);
  return {version:PHYSICAL_STAGGERED_RACE_REPLAY_VERSION,
    throughKm,riderIds:[...riderIds],kilometres,
    sources:{bunch,solos},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalStaggeredRaceV1(input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalStaggeredRaceV1(input)))
    throw new Error('Staggered race differs from paid source.');
  return true;
}
