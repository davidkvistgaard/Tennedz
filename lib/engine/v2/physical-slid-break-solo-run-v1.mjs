// A caught break rider who could not hold the bunch pays each later solo
// kilometre. The current-stage safe-finish choice follows a measured
// pace loss, never an uncommitted future-stage saving plan.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalBunchAfterCaughtSlideV1} from
  './physical-bunch-after-caught-slide-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_SLID_BREAK_SOLO_RUN_VERSION=
  'v2-physical-slid-break-solo-run-1';

export function runPhysicalSlidBreakSoloV1({startInput,start,
  attackKm,catchKm,catchRecord,slideRecord,throughKm}){
  const bunch=runPhysicalBunchAfterCaughtSlideV1({startInput,start,
    attackKm,catchKm,catchRecord,slideRecord,throughKm});
  const riderId=slideRecord.riderId;
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===riderId));
  const rider=team.riders.find(row=>row.id===riderId);
  let energy=slideRecord.energyAfter;
  let elapsedSeconds=slideRecord.elapsedSeconds;
  let bunchElapsedSeconds=catchRecord.paidBunch.elapsedSeconds;
  const steps=[];
  for(const bunchStep of bunch.road){
    const km=bunchStep.sourceKm;
    const segment=startInput.routeKilometres[km-1];
    const order=orderAt(team.orders,km-1);
    const effort='conserve';
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const seconds=segmentBaseSeconds(segment)+
      (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(seconds)||seconds<=0)
      throw new Error('Slid break solo needs physical paid pace.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort,role:'solo',distanceM:1000});
    const recovery=recoveryForKilometre({rider,segment,
      effort,group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Slid break solo cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:startInput.routeKilometres,throughKm:km}).cap;
    const energyAfter=+Math.min(cap,price.energyAfter).toFixed(3);
    elapsedSeconds+=seconds;
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const gapSecondsToBunch=elapsedSeconds-bunchElapsedSeconds;
    if(gapSecondsToBunch<=0)
      throw new Error('Slid break solo needs paid contact to rejoin.');
    steps.push({sourceKm:km,riderId,
      decision:{goal:'finish_safely',effort,
        teamOrderEffort:order.effort,choice:'ride_solo',
        reason:'cannot_hold_paid_bunch_pace'},
      physicalGroup:{id:`solo-${riderId}`,
        riderIds:[riderId],atDistanceM:km*1000},
      seconds,elapsedSeconds,bunchElapsedSeconds,
      gapSecondsToBunch,
      energyBefore:energy,energySpent:price.energyDemand,
      recoveryAward:0,cap,energyAfter,
      officialResults:false});
    energy=energyAfter;
  }
  return {version:PHYSICAL_SLID_BREAK_SOLO_RUN_VERSION,
    sourceKm:throughKm,riderId,slideRecord,steps,
    elapsedSeconds,energyAfter:energy,
    gapSecondsToBunch:steps.at(-1).gapSecondsToBunch,
    physicalGroup:steps.at(-1).physicalGroup,
    observedFinishSeconds:throughKm===
      startInput.routeKilometres.length?elapsedSeconds:null,
    officialResults:false};
}

export function validatePhysicalSlidBreakSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalSlidBreakSoloV1(input)))
    throw new Error('Slid break solo differs from paid source.');
  return true;
}
