// Shared deterministic road-gap calculation for simulation and recorded replay.
// Callers supply committed riders/orders and the energy state before the km.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function median(values){
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}
function lowerQuartile(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor((sorted.length-1)/4)];
}

export function passiveBreakGapDelta(teams,ahead,rearGroup,dropped,segment,km,activePulls,
  paidPaceAbility=null,explicitFront=false,bunchEasePoints=0,
  secondsPerAbilityPoint=TUNING.breakaway.driftSecondsPerAbilityPoint,
  maxPassiveDeltaSecondsPerKm=TUNING.breakaway.maxPassiveGainSecondsPerKm){
  if(!ahead.size)return {delta:0,unpaidDelta:0,pullRiderIds:[]};
  const breakAbilities=[],pullAbilities=[],pullRiderIds=[],bunchAbilities=[];
  for(const team of teams)for(const rider of team.riders){
    const isAhead=ahead.has(rider.id);
    if(!isAhead&&dropped.has(rider.id))continue;
    const ability=riderKilometreEffect(rider,segment,{phase:isAhead?'solo':'cruise',
      energy:Number(team.energy?.[rider.id]??100),exposed:segment.exposed}).ability;
    if(isAhead){
      if(rearGroup.has(rider.id))breakAbilities.push(ability);
      if(activePulls?activePulls.has(rider.id):
        orderAt(team.orders,km-1).breakWork!=='sit_on'){
        if(rearGroup.has(rider.id))pullAbilities.push(ability+
          (orderAt(team.orders,km-1).breakWork==='drive'?
            TUNING.breakaway.driveAbilityBonusPoints:0));
        pullRiderIds.push(rider.id);
      }
    }else bunchAbilities.push(ability);
  }
  if(!breakAbilities.length||!bunchAbilities.length)
    return {delta:0,unpaidDelta:0,pullRiderIds};
  const tune=TUNING.breakaway;
  const cooperation=Math.min(Math.max(0,pullAbilities.length-1),tune.maxCooperatingRiders)*
    tune.cooperationPerExtraRider;
  const breakPace=pullAbilities.length?
    pullAbilities.reduce((sum,ability)=>sum+ability,0)/pullAbilities.length+cooperation:
    breakAbilities.reduce((sum,ability)=>sum+ability,0)/breakAbilities.length-tune.noWorkPenaltyPoints;
  const baselineBunchAbility=explicitFront?lowerQuartile(bunchAbilities):median(bunchAbilities);
  const bunchPace=Math.max(baselineBunchAbility-bunchEasePoints,
    paidPaceAbility??0)+tune.bunchDraftAdvantage;
  const unpaidDelta=+clamp((breakPace-baselineBunchAbility-tune.bunchDraftAdvantage)*
    secondsPerAbilityPoint,-maxPassiveDeltaSecondsPerKm,
    maxPassiveDeltaSecondsPerKm).toFixed(2);
  return {delta:+clamp((breakPace-bunchPace)*secondsPerAbilityPoint,
    -maxPassiveDeltaSecondsPerKm,maxPassiveDeltaSecondsPerKm).toFixed(2),
  pullRiderIds,unpaidDelta};
}
