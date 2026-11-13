// Two riders lost on different kilometres meet only when their
// separately paid clocks reach the same road metre simultaneously.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {runPhysicalStaggeredDetachedSoloV1} from
  './physical-staggered-detached-solo-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';

export const PHYSICAL_STAGGERED_SOLO_CONTACT_VERSION=
  'v2-physical-staggered-solo-contact-1';

export function contactPhysicalStaggeredSolosV1({startInput,
  start,staggered,riderIds,contactKm}){
  if(!isDeepStrictEqual(staggered,
    runPhysicalStaggeredBunchLossV1({startInput,start,
      throughKm:staggered?.throughKm}))||
    !Array.isArray(riderIds)||riderIds.length!==2||
    new Set(riderIds).size!==2||
    !isDeepStrictEqual([...riderIds].sort(),
      [...staggered.detachedRiderIds].sort())||
    !Number.isInteger(contactKm)||
    contactKm<=Math.max(...staggered.losses.map(row=>
      row.sourceKm))||contactKm>staggered.throughKm)
    throw new Error('Staggered contact needs two later paid solos.');
  const solos=riderIds.map(riderId=>
    runPhysicalStaggeredDetachedSoloV1({startInput,start,
      staggered,riderId,throughKm:contactKm}));
  const prior=solos.map(solo=>solo.steps.at(-2)??
    solo.completion);
  const current=solos.map(solo=>solo.steps.at(-1));
  const priorGap=prior[1].elapsedSeconds-
    prior[0].elapsedSeconds;
  if(priorGap===0)
    throw new Error('Staggered riders already met before contact.');
  for(let km=Math.max(...solos.map(solo=>solo.lossKm));
    km<contactKm;km++){
    const times=solos.map(solo=>km===solo.lossKm?
      solo.completion.elapsedSeconds:
      solo.steps.find(row=>row.sourceKm===km).elapsedSeconds);
    if(times[1]===times[0]||
      Math.sign(times[1]-times[0])!==Math.sign(priorGap))
      throw new Error('Staggered riders met before requested contact.');
  }
  const aheadIndex=prior[0].elapsedSeconds<
    prior[1].elapsedSeconds?0:1;
  const behindIndex=1-aheadIndex;
  const startGapSeconds=prior[behindIndex].elapsedSeconds-
    prior[aheadIndex].elapsedSeconds;
  const paceGainSecondsPerKm=current[aheadIndex].seconds-
    current[behindIndex].seconds;
  const fraction=startGapSeconds/paceGainSecondsPerKm;
  if(!Number.isFinite(fraction)||startGapSeconds<=0||
    paceGainSecondsPerKm<=0||fraction<=0||fraction>=1)
    throw new Error('Staggered riders have no paid contact here.');
  const clockSeconds=prior[aheadIndex].elapsedSeconds+
    current[aheadIndex].seconds*fraction;
  const behindClockSeconds=prior[behindIndex].elapsedSeconds+
    current[behindIndex].seconds*fraction;
  if(Math.abs(clockSeconds-behindClockSeconds)>1e-7)
    throw new Error('Staggered contact clocks differ.');
  const bunchPriorSeconds=staggered.road.slice(0,
    contactKm-1).reduce((sum,row)=>sum+row.elapsedSeconds,0);
  const bunchAtContactSeconds=bunchPriorSeconds+
    staggered.road[contactKm-1].elapsedSeconds*fraction;
  if(clockSeconds<=bunchAtContactSeconds)
    throw new Error('Staggered contact requires both behind bunch.');
  const segment=startInput.routeKilometres[contactKm-1];
  const contactAtDistanceM=(contactKm-1+fraction)*1000;
  const riders=riderIds.map((riderId,index)=>{
    const rider=startInput.teams.flatMap(team=>team.riders)
      .find(row=>row.id===riderId);
    const paid=priceRearEnergyDemandV1({rider,segment,
      energyBefore:prior[index].energyAfter,
      effort:current[index].decision.effort,
      role:'solo',distanceM:fraction*1000});
    return {riderId,decision:current[index].decision,
      startClockSeconds:prior[index].elapsedSeconds,
      secondsPerKm:current[index].seconds,
      energyBefore:paid.energyBefore,
      energySpent:paid.energyDemand,
      energyAfter:paid.energyAfter,
      atDistanceM:contactAtDistanceM};
  });
  return {version:PHYSICAL_STAGGERED_SOLO_CONTACT_VERSION,
    sourceKm:contactKm,
    lossKilometres:solos.map(solo=>solo.lossKm),
    aheadRiderId:riderIds[aheadIndex],
    catchingRiderId:riderIds[behindIndex],
    contactAtDistanceM,contactClockSeconds:clockSeconds,
    behindBunchSeconds:clockSeconds-bunchAtContactSeconds,
    physicalGroup:{id:`rear-contact-${[...riderIds].sort().join('-')}`,
      riderIds:[...riderIds],atDistanceM:contactAtDistanceM},
    riders,remainingKmUnsettled:true,officialResults:false};
}

export function validatePhysicalStaggeredSoloContactV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    contactPhysicalStaggeredSolosV1(input)))
    throw new Error('Staggered contact differs from paid source.');
  return true;
}
