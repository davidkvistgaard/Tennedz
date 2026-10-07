import {isDeepStrictEqual} from 'node:util';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';

export const FINALE_GROUP_STEP_VERSION='v2-finale-group-step-1';

// One counterfactual distance slice with a single road group and the bunch.
// A named puller sets each group's pace. Every member pays their own finite
// energy cost; a catch stops the slice at its actual distance and merges the
// groups. A later candidate must supply player-linked plans for all slices.
export function advanceFinaleGroupStep({slice,frontGroup,pelotonRiderIds,
  frontPull,chasePull,riderPlans}){
  const frontIds=frontGroup?.riderIds;
  const allIds=[...(frontIds??[]),...(pelotonRiderIds??[])];
  if(typeof frontGroup?.id!=='string'||!frontGroup.id||
    !Number.isFinite(frontGroup.gapSeconds)||frontGroup.gapSeconds<=0||
    !Array.isArray(frontIds)||frontIds.length===0||
    !Array.isArray(pelotonRiderIds)||pelotonRiderIds.length===0||
    new Set(allIds).size!==allIds.length||
    !frontIds.includes(frontPull?.riderId)||
    !pelotonRiderIds.includes(chasePull?.riderId)||
    !Number.isFinite(frontPull.speedKph)||frontPull.speedKph<=0||
    !Number.isFinite(chasePull.speedKph)||chasePull.speedKph<=0||
    !Array.isArray(riderPlans)||riderPlans.length!==allIds.length||
    new Set(riderPlans.map(plan=>plan?.riderId)).size!==allIds.length||
    riderPlans.some(plan=>!allIds.includes(plan?.riderId)||
      !Number.isFinite(plan.energy)||plan.energy<0||plan.energy>100||
      !Number.isFinite(plan.workCostPerKm)||plan.workCostPerKm<0))
    throw new Error('A finale group step needs complete distinct riders and pull plans.');
  const movement=advanceFinaleGap({slice,gapSeconds:frontGroup.gapSeconds,
    frontSpeedKph:frontPull.speedKph,chaseSpeedKph:chasePull.speedKph});
  const endDistanceM=movement.catchDistanceM??slice.endDistanceM;
  const riddenFraction=(endDistanceM-slice.startDistanceM)/slice.lengthM;
  const riders=riderPlans.map(plan=>{
    const spent=energyCostForFinaleSlice(slice,plan.workCostPerKm)*riddenFraction;
    if(spent>plan.energy+1e-9)
      throw new Error('A finale group rider cannot spend energy they do not have.');
    return {riderId:plan.riderId,energy:Math.max(0,plan.energy-spent),
      energySpent:spent,role:plan.riderId===frontPull.riderId||
        plan.riderId===chasePull.riderId?'pull':'sheltered'};
  });
  return {version:FINALE_GROUP_STEP_VERSION,
    startDistanceM:slice.startDistanceM,endDistanceM,
    frontGroupId:frontGroup.id,frontPullRiderId:frontPull.riderId,
    chasePullRiderId:chasePull.riderId,
    frontElapsedSeconds:movement.frontSeconds*riddenFraction,
    pelotonElapsedSeconds:movement.chaseSeconds*riddenFraction,
    roadGroups:movement.caught?[]:[{id:frontGroup.id,
      gapSeconds:movement.gapSeconds,riderIds:[...frontIds]}],
    pelotonRiderIds:movement.caught?[...pelotonRiderIds,...frontIds]:
      [...pelotonRiderIds],riders,
    event:movement.caught?{kind:'catch',caughtGroupId:frontGroup.id,
      atDistanceM:endDistanceM}:null};
}

export function validateFinaleGroupStep(input,recording){
  if(!isDeepStrictEqual(recording,advanceFinaleGroupStep(input)))
    throw new Error('Finale group step differs from its source plans.');
  return true;
}
