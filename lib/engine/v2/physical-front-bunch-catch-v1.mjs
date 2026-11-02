// The paid bunch catches a front solo at a derived metre and clock.
// Contact alone does not grant the caught rider a sheltered wheel.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalFrontSoloV1} from
  './physical-front-solo-run-v1.mjs';
import {runPhysicalBunchAfterNamedAttackV1} from
  './physical-start-bunch-v1.mjs';
import {teamChaseStakeAtKmV1} from './team-chase-stake-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_FRONT_BUNCH_CATCH_VERSION=
  'v2-physical-front-bunch-catch-1';

export function catchPhysicalFrontSoloV1({startInput,start,
  attackKm,catchKm}){
  if(!Number.isInteger(catchKm)||catchKm<=attackKm||
    catchKm>startInput?.routeKilometres?.length)
    throw new Error('Front catch needs later sourced road.');
  const front=runPhysicalFrontSoloV1({startInput,start,
    attackKm,throughKm:catchKm-1});
  const bunch=runPhysicalBunchAfterNamedAttackV1({startInput,start,
    attackKm,throughKm:catchKm});
  const bunchStep=bunch.road.at(-1);
  const riderId=front.riderId;
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  const segment=startInput.routeKilometres[catchKm-1];
  const stake=teamChaseStakeAtKmV1({
    commitment:startInput.commitment,teamId:team.id,km:catchKm});
  if(!['break_stage','summit_attack'].includes(stake.goal))
    throw new Error('Front catch needs continuing source stake.');
  const order=orderAt(team.orders,catchKm-1);
  const effort=front.energyAfter<TUNING.exhaustion.thresholdEnergy?
    'conserve':order.effort;
  const effect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:front.energyAfter,
    exposed:segment.exposed});
  const ability=effect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const frontSeconds=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const bunchSeconds=bunchStep.elapsedSeconds;
  const gapAtStartSeconds=bunch.elapsedSeconds-bunchSeconds-
    front.elapsedSeconds;
  const paceGainSecondsPerKm=frontSeconds-bunchSeconds;
  const fraction=gapAtStartSeconds/paceGainSecondsPerKm;
  if(!Number.isFinite(frontSeconds)||frontSeconds<=0||
    !Number.isFinite(fraction)||gapAtStartSeconds<=0||
    paceGainSecondsPerKm<=0||fraction<=0||fraction>=1)
    throw new Error('Front solo has no paid bunch catch here.');
  const paidDistanceM=1000*fraction;
  const contactAtDistanceM=(catchKm-1)*1000+paidDistanceM;
  const contactClockSeconds=front.elapsedSeconds+
    frontSeconds*fraction;
  if(Math.abs(contactClockSeconds-(
    bunch.elapsedSeconds-bunchSeconds+
    bunchSeconds*fraction))>1e-7)
    throw new Error('Front and bunch did not meet at same clock.');
  const frontPaid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:front.energyAfter,effort,role:'solo',
    distanceM:paidDistanceM});
  const bunchPartial=bunchStep.riders.map(row=>({
    riderId:row.riderId,role:row.role,
    energyBefore:row.energyBefore,
    energySpent:row.energySpent*fraction,
    energyAtContact:row.energyBefore-
      row.energySpent*fraction}));
  return {version:PHYSICAL_FRONT_BUNCH_CATCH_VERSION,
    sourceKm:catchKm,attackKm,
    contact:{kind:'bunch_catches_front_solo',
      riderId,atDistanceM:contactAtDistanceM,
      clockSeconds:contactClockSeconds},
    frontDecision:{goal:stake.goal,
      teamOrderEffort:order.effort,effort,
      choice:'drive_until_caught'},
    frontPartial:{riderId,
      physicalGroup:{id:front.physicalGroup.id,
        riderIds:[riderId],atDistanceM:contactAtDistanceM},
      secondsPerKm:frontSeconds,
      energyBefore:front.energyAfter,
      energySpent:frontPaid.energyDemand,
      energyAtContact:frontPaid.energyAfter},
    bunchPartial:{physicalGroup:{id:'peloton',
      riderIds:[...bunchStep.physicalGroup.riderIds],
      atDistanceM:contactAtDistanceM},
    leaderRiderId:bunchStep.leaderRiderId,
    secondsPerKm:bunchSeconds,
    riders:bunchPartial},
    priorFront:front,paidBunch:bunch,
    remainingKmUnsettled:true,officialResults:false};
}

export function validatePhysicalFrontBunchCatchV1(input,recording){
  if(!isDeepStrictEqual(recording,
    catchPhysicalFrontSoloV1(input)))
    throw new Error('Front catch differs from paid physical source.');
  return true;
}
