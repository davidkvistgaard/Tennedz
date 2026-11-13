// Two physically detached riders meet only after both have paid the
// road to the same place at the same time. No rear wheel is inferred.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalDetachedSoloV1} from
  './physical-detached-solo-run-v1.mjs';
import {runPhysicalBunchAfterPaceLossV1} from
  './physical-start-bunch-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';

export const PHYSICAL_REAR_SOLO_CONTACT_VERSION=
  'v2-physical-rear-solo-contact-1';

export function contactPhysicalRearSolosV1({startInput,start,
  lossKm,contactKm,riderIds}){
  if(!Array.isArray(riderIds)||riderIds.length!==2||
    riderIds[0]===riderIds[1]||
    !Number.isInteger(contactKm)||contactKm<=lossKm)
    throw new Error('Rear contact needs two later detached riders.');
  const solos=riderIds.map(riderId=>runPhysicalDetachedSoloV1({
    startInput,start,lossKm,throughKm:contactKm,riderId}));
  const initialGap=solos[1].completion.elapsedSeconds-
    solos[0].completion.elapsedSeconds;
  if(initialGap===0)
    throw new Error('Rear riders have already met at split kilometre.');
  for(let index=0;index<contactKm-lossKm-1;index++){
    const gap=solos[1].steps[index].elapsedSeconds-
      solos[0].steps[index].elapsedSeconds;
    if(gap===0||Math.sign(gap)!==Math.sign(initialGap))
      throw new Error('Rear riders met before requested contact.');
  }
  const prior=solos.map(solo=>solo.steps.length===1?
    solo.completion:solo.steps.at(-2));
  const current=solos.map(solo=>solo.steps.at(-1));
  const order=prior[0].elapsedSeconds<prior[1].elapsedSeconds?
    [0,1]:[1,0];
  const [aheadIndex,behindIndex]=order;
  const ahead=prior[aheadIndex],behind=prior[behindIndex];
  const aheadStep=current[aheadIndex];
  const behindStep=current[behindIndex];
  const startGapSeconds=behind.elapsedSeconds-ahead.elapsedSeconds;
  const paceGainSecondsPerKm=aheadStep.seconds-
    behindStep.seconds;
  const fraction=startGapSeconds/paceGainSecondsPerKm;
  if(!Number.isFinite(fraction)||startGapSeconds<=0||
    paceGainSecondsPerKm<=0||fraction<=0||fraction>=1)
    throw new Error('Rear riders have no paid contact in this kilometre.');
  const bunch=runPhysicalBunchAfterPaceLossV1({
    startInput,start,lossKm,throughKm:contactKm});
  const bunchPriorSeconds=bunch.elapsedSeconds-
    bunch.road.at(-1).elapsedSeconds;
  const contactClockSeconds=ahead.elapsedSeconds+
    aheadStep.seconds*fraction;
  const bunchAtContactSeconds=bunchPriorSeconds+
    bunch.road.at(-1).elapsedSeconds*fraction;
  if(contactClockSeconds<=bunchAtContactSeconds)
    throw new Error('Rear contact requires both riders behind bunch.');
  const segment=startInput.routeKilometres[contactKm-1];
  const distanceM=1000*fraction;
  const contactAtDistanceM=(contactKm-1)*1000+distanceM;
  const riders=riderIds.map((riderId,index)=>{
    const rider=startInput.teams.flatMap(team=>team.riders)
      .find(row=>row.id===riderId);
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:prior[index].energyAfter,
      effort:current[index].decision.effort,
      role:'solo',distanceM});
    return {riderId,decision:current[index].decision,
      startClockSeconds:prior[index].elapsedSeconds,
      secondsPerKm:current[index].seconds,
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      energyAfter:paid.energyAfter,
      atDistanceM:contactAtDistanceM};
  });
  const simultaneousSeconds=behind.elapsedSeconds+
    behindStep.seconds*fraction;
  if(Math.abs(simultaneousSeconds-contactClockSeconds)>1e-7)
    throw new Error('Rear riders did not reach paid contact together.');
  return {version:PHYSICAL_REAR_SOLO_CONTACT_VERSION,
    sourceKm:contactKm,lossKm,
    aheadRiderId:riderIds[aheadIndex],
    catchingRiderId:riderIds[behindIndex],
    contactAtDistanceM,contactClockSeconds,
    behindBunchSeconds:contactClockSeconds-
      bunchAtContactSeconds,
    physicalGroup:{id:`rear-contact-${[...riderIds].sort().join('-')}`,
      riderIds:[...riderIds],atDistanceM:contactAtDistanceM},
    riders,remainingKmUnsettled:true,
    officialResults:false};
}

export function validatePhysicalRearSoloContactV1(input,recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalRearSolosV1(input)))
    throw new Error('Rear contact differs from paid physical source.');
  return true;
}
