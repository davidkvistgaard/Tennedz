import {isDeepStrictEqual} from 'node:util';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';

export const FINALE_GROUP_STEP_VERSION='v2-finale-group-step-1';
export const FINALE_PASSIVE_GROUP_STEP_VERSION='v2-finale-group-step-2';
export const FINALE_PASSIVE_FRONT_STEP_VERSION='v2-finale-group-step-3';

// One counterfactual distance slice with a single road group and the bunch.
// A named puller sets each group's pace. Every member pays their own finite
// energy cost; a catch stops the slice at its actual distance and merges the
// groups. A later candidate must supply player-linked plans for all slices.
export function advanceFinaleGroupStep({slice,frontGroup,pelotonRiderIds,
  frontPull,chasePull,riderPlans,passiveChase=false,passiveFront=false}){
  const frontIds=frontGroup?.riderIds;
  const allIds=[...(frontIds??[]),...(pelotonRiderIds??[])];
  if(typeof frontGroup?.id!=='string'||!frontGroup.id||
    !Number.isFinite(frontGroup.gapSeconds)||frontGroup.gapSeconds<=0||
    !Array.isArray(frontIds)||frontIds.length===0||
    !Array.isArray(pelotonRiderIds)||pelotonRiderIds.length===0||
    new Set(allIds).size!==allIds.length||
    (passiveFront?frontPull?.riderId!==null:
      !frontIds.includes(frontPull?.riderId))||
    (passiveChase?chasePull?.riderId!==null:
      !pelotonRiderIds.includes(chasePull?.riderId))||
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
      throw new Error(`A finale group rider cannot spend energy they do not have: ${
        plan.riderId} at ${slice.startDistanceM} m (${plan.energy} < ${spent}).`);
    return {riderId:plan.riderId,energy:Math.max(0,plan.energy-spent),
      energySpent:spent,role:plan.riderId===frontPull.riderId||
        plan.riderId===chasePull.riderId?'pull':'sheltered'};
  });
  return {version:passiveFront?FINALE_PASSIVE_FRONT_STEP_VERSION:
    passiveChase?FINALE_PASSIVE_GROUP_STEP_VERSION:
    FINALE_GROUP_STEP_VERSION,
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

export const FINALE_MERGED_STEP_VERSION='v2-finale-merged-step-1';
export const FINALE_PASSIVE_MERGED_STEP_VERSION='v2-finale-merged-step-2';

// Continue a caught group from the exact catch distance. This gives no rider
// a passing position; the nominated worker sets a common travel pace.
export function advanceFinaleMergedStep({slice,startDistanceM,riderIds,
  pullRiderId,speedKph,riderPlans,passiveChase=false}){
  energyCostForFinaleSlice(slice,0);
  if(!Number.isFinite(startDistanceM)||
    startDistanceM<slice?.startDistanceM||startDistanceM>=slice?.endDistanceM||
    !Number.isFinite(speedKph)||speedKph<=0||
    !Array.isArray(riderIds)||riderIds.length<2||
    new Set(riderIds).size!==riderIds.length||
    (passiveChase?pullRiderId!==null:!riderIds.includes(pullRiderId))||
    !Array.isArray(riderPlans)||riderPlans.length!==riderIds.length||
    new Set(riderPlans.map(plan=>plan?.riderId)).size!==riderIds.length||
    riderPlans.some(plan=>!riderIds.includes(plan?.riderId)||
      !Number.isFinite(plan.energy)||plan.energy<0||plan.energy>100||
      !Number.isFinite(plan.workCostPerKm)||plan.workCostPerKm<0))
    throw new Error('A merged finale step needs a valid distance and full rider plans.');
  const riddenM=slice.endDistanceM-startDistanceM;
  const riders=riderPlans.map(plan=>{
    const spent=plan.workCostPerKm*riddenM/1000;
    if(spent>plan.energy+1e-9)
      throw new Error(`A merged finale rider cannot spend energy they do not have: ${
        plan.riderId} at ${startDistanceM} m (${plan.energy} < ${spent}).`);
    return {riderId:plan.riderId,energy:Math.max(0,plan.energy-spent),
      energySpent:spent,role:plan.riderId===pullRiderId?'pull':'sheltered'};
  });
  return {version:passiveChase?FINALE_PASSIVE_MERGED_STEP_VERSION:
    FINALE_MERGED_STEP_VERSION,startDistanceM,
    endDistanceM:slice.endDistanceM,travelSeconds:riddenM*3.6/speedKph,
    pullRiderId,riderIds:[...riderIds],riders,event:'merged_travel'};
}
