// Complete detached riders' first kilometre only when no unpriced solo
// meeting intervenes. The bunch has already paid its source kilometre.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalFirstKmV1} from
  './v94-physical-first-km-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FIRST_KM_COMPLETION_VERSION=
  'v94-physical-first-km-completion-1';
export const V94_PAID_SOLO_COLOCATION_VERSION=
  'v94-paid-solo-colocation-1';

export function firstV94SoloContactWithinBoundaryV1(solos,frontClockSeconds){
  let first=null;
  for(let i=0;i<solos.length;i++)for(let j=i+1;j<solos.length;j++){
    const a=solos[i],b=solos[j];
    const startGap=a.atDistanceM-b.atDistanceM;
    const velocityGap=(a.speedKph-b.speedKph)/3.6;
    if(Math.abs(startGap)<=1e-9)continue;
    const meetSeconds=-startGap/velocityGap;
    if(Number.isFinite(meetSeconds)&&meetSeconds>1e-9&&
      meetSeconds<=Math.min(a.remainingSeconds,b.remainingSeconds)+1e-9){
      const event={riderIds:[a.riderId,b.riderId].sort(),
        atDistanceM:a.atDistanceM+a.speedKph*meetSeconds/3.6,
        clockSeconds:frontClockSeconds+meetSeconds};
      if(!first||event.clockSeconds<first.clockSeconds)
        first=event;
    }
  }
  return first;
}

export function completeV94PhysicalFirstKmV1(recording){
  const first=replayV94PhysicalFirstKmV1(recording);
  const segment=recording.route.kilometres[0];
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{rider,team}])));
  const ledger=new Map(recording.frames[0].energyLedger.map(row=>
    [row.riderId,row]));
  const base=segmentBaseSeconds(segment);
  const solos=first.atFrontClock.filter(row=>!row.attached).map(row=>{
    const {rider,team}=byRider.get(row.riderId);
    const effort=orderAt(team.orders,0).effort;
    const effect=riderKilometreEffect(rider,segment,{phase:'solo',
      energy:row.reserveBeforeRecovery,exposed:segment.exposed});
    const ability=effect.ability+
      (TUNING.effortPressure[effort]-1)*20;
    const secondsPerKm=base+(50-ability)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
    if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
      throw new Error('Detached first-km rider needs paid solo speed.');
    const speedKph=3600/secondsPerKm;
    const remainingSeconds=row.remainingDistanceM*3.6/speedKph;
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.reserveBeforeRecovery,effort,
      role:'solo',distanceM:row.remainingDistanceM});
    return {...row,rider,effort,ability,speedKph,
      remainingSeconds,finishClockSeconds:first.frontClockSeconds+
        remainingSeconds,remainingEnergySpent:price.energyDemand,
      reserveBeforeRecovery:price.energyAfter};
  });
  const contact=firstV94SoloContactWithinBoundaryV1(solos,
    first.frontClockSeconds);
  if(contact){
    const error=new Error('Detached first-km solos need paid contact.');
    error.sourceKm=1;
    error.sourceEvidence=contact;
    throw error;
  }
  const soloById=new Map(solos.map(row=>[row.riderId,row]));
  const finishes=first.atFrontClock.map(row=>{
    const source=ledger.get(row.riderId);
    if(row.attached)return {riderId:row.riderId,
      sourceKm:1,physicalGroup:'peloton',endDistanceM:1000,
      clockSeconds:first.frontClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:source.recoveryAward,
      capAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter};
    const solo=soloById.get(row.riderId);
    const {rider}=byRider.get(row.riderId);
    const recovery=recoveryForKilometre({rider,segment,
      effort:solo.effort,group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Detached first-km rider cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,throughKm:1}).cap;
    const capAdjustment=Math.max(0,solo.reserveBeforeRecovery-cap);
    const energyAfter=+Math.min(cap,solo.reserveBeforeRecovery).toFixed(3);
    return {riderId:row.riderId,sourceKm:1,
      physicalGroup:`solo-${row.riderId}`,endDistanceM:1000,
      clockSeconds:solo.finishClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock+
        solo.remainingEnergySpent,
      recoveryAward:0,capAdjustment,energyAfter};
  });
  const orderedSolos=finishes.filter(row=>
    row.physicalGroup!=='peloton').sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const coincidentSoloSets=[];
  for(const finish of orderedSolos){
    const last=coincidentSoloSets.at(-1);
    if(last&&Math.abs(last.clockSeconds-finish.clockSeconds)<1e-8)
      last.riderIds.push(finish.riderId);
    else coincidentSoloSets.push({clockSeconds:finish.clockSeconds,
      atDistanceM:1000,riderIds:[finish.riderId]});
  }
  const unresolvedCoincidence=coincidentSoloSets.filter(row=>
    row.riderIds.length>1);
  const firstById=new Map(first.atFrontClock.map(row=>
    [row.riderId,row]));
  const soloByIdAtClock=new Map(solos.map(row=>
    [row.riderId,row]));
  const paidCoLocationObservations=unresolvedCoincidence.map(set=>{
    const rows=set.riderIds.map(riderId=>({
      first:firstById.get(riderId),solo:soloByIdAtClock.get(riderId)}));
    const atDistanceM=rows[0].first.atDistanceM;
    const calculatedSoloContinuationSpeedKph=rows[0].solo.speedKph;
    if(rows.some(row=>!row.first||!row.solo||
      Math.abs(row.first.atDistanceM-atDistanceM)>1e-8||
      Math.abs(row.solo.speedKph-
        calculatedSoloContinuationSpeedKph)>1e-8))
      throw new Error('Coincident solo finish lacks paid co-location.');
    return {version:V94_PAID_SOLO_COLOCATION_VERSION,
      sourceKm:1,clockSeconds:first.frontClockSeconds,
      atDistanceM,riderIds:[...set.riderIds],
      calculatedSoloContinuationSpeedKph,
      riderPaidThroughClock:set.riderIds.map((riderId,index)=>({
        riderId,paidFromReserve:rows[index].first
          .physicalPaidThroughClock})),
      formsRearGroup:false,contactDecisionRequired:true};
  });
  return {version:V94_PHYSICAL_FIRST_KM_COMPLETION_VERSION,
    sourceKm:1,frontClockSeconds:first.frontClockSeconds,
    first,soloCompletions:solos.map(row=>({
      riderId:row.riderId,effort:row.effort,
      startDistanceM:row.atDistanceM,endDistanceM:1000,
      startClockSeconds:first.frontClockSeconds,
      finishClockSeconds:row.finishClockSeconds,
      soloAbility:row.ability,soloSpeedKph:row.speedKph,
      energyBefore:first.atFrontClock.find(item=>
        item.riderId===row.riderId).reserveBeforeRecovery,
      paidRemainingEnergy:row.remainingEnergySpent,
      reserveBeforeRecovery:row.reserveBeforeRecovery})),
    finishes,completeRiderKilometres:finishes.length,
    coincidentSoloSets:unresolvedCoincidence,
    paidCoLocationObservations,
    continuationNeedsContactDecision:unresolvedCoincidence.length>0,
    physicalRearGroups:[],officialResults:false};
}

export function validateV94PhysicalFirstKmCompletionV1(recording,completion){
  if(!isDeepStrictEqual(completion,
    completeV94PhysicalFirstKmV1(recording)))
    throw new Error('First-km completion differs from paid source.');
  return true;
}
