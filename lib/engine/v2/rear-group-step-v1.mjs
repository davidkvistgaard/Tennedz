// Isolated next-slice group clock for riders who already met on a paid road.
// One willing rider leads; every member pays their own explicit energy cost.
import {isDeepStrictEqual} from 'node:util';
import {advanceFinaleGap,energyCostForFinaleSlice} from './finale-step.mjs';

export const REAR_GROUP_STEP_VERSION='v2-rear-group-step-1';

export function advanceRearGroupStepV1({slice,group,bunchSpeedKph,riderPlans}){
  if(!group||!/^rear-[1-9]\d*$/.test(group.id??'')||
    !Array.isArray(group.riderIds)||group.riderIds.length<2||
    new Set(group.riderIds).size!==group.riderIds.length||
    group.atDistanceM!==slice?.startDistanceM||
    !Number.isFinite(group.behindBunchSeconds)||
    group.behindBunchSeconds<=0||
    !Number.isInteger(group.turnCount)||group.turnCount<0||
    !group.energyByRider||typeof group.energyByRider!=='object'||
    Object.keys(group.energyByRider).length!==group.riderIds.length||
    !Number.isFinite(bunchSpeedKph)||bunchSpeedKph<=0||
    !Array.isArray(riderPlans)||riderPlans.length!==group.riderIds.length||
    new Set(riderPlans.map(row=>row?.riderId)).size!==group.riderIds.length||
    riderPlans.some(row=>!group.riderIds.includes(row?.riderId)||
      !['pull','sit_in'].includes(row.choice)||
      typeof row.reason!=='string'||!row.reason||
      !Number.isFinite(row.speedKph)||row.speedKph<=0||
      !Number.isFinite(row.leadCostPerKm)||
      !Number.isFinite(row.shelteredCostPerKm)||
      row.shelteredCostPerKm<0||
      row.leadCostPerKm<=row.shelteredCostPerKm||
      !Number.isFinite(group.energyByRider[row.riderId])||
      group.energyByRider[row.riderId]<0||
      group.energyByRider[row.riderId]>100))
    throw new Error('A rear-group step needs complete rider decisions and energy.');
  const byRider=new Map(riderPlans.map(row=>[row.riderId,row]));
  const pullers=group.riderIds.filter(id=>byRider.get(id).choice==='pull');
  if(!pullers.length)throw new Error('Rear group has no willing leader.');
  const leaderRiderId=pullers[group.turnCount%pullers.length];
  const leader=byRider.get(leaderRiderId);
  const movement=advanceFinaleGap({slice,gapSeconds:group.behindBunchSeconds,
    frontSpeedKph:bunchSpeedKph,chaseSpeedKph:leader.speedKph});
  const endDistanceM=movement.catchDistanceM??slice.endDistanceM;
  const fraction=(endDistanceM-slice.startDistanceM)/slice.lengthM;
  const riders=group.riderIds.map(riderId=>{
    const plan=byRider.get(riderId),leading=riderId===leaderRiderId;
    const energySpent=energyCostForFinaleSlice(slice,
      leading?plan.leadCostPerKm:plan.shelteredCostPerKm)*fraction;
    const before=group.energyByRider[riderId];
    if(energySpent>before+1e-9)
      throw new Error('Rear-group rider cannot pay for the selected turn.');
    return {riderId,choice:plan.choice,reason:plan.reason,
      role:leading?'leader':'sheltered',energySpent,
      energy:Math.max(0,before-energySpent)};
  });
  const nextGroup=movement.caught?null:{id:group.id,
    riderIds:[...group.riderIds],atDistanceM:endDistanceM,
    behindBunchSeconds:movement.gapSeconds,turnCount:group.turnCount+1,
    energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energy]))};
  return {version:REAR_GROUP_STEP_VERSION,groupId:group.id,
    startDistanceM:slice.startDistanceM,endDistanceM,leaderRiderId,
    bunchElapsedSeconds:movement.frontSeconds*fraction,
    groupElapsedSeconds:movement.chaseSeconds*fraction,
    riders,rearGroup:nextGroup,
    event:movement.caught?{kind:'rejoin_bunch',atDistanceM:endDistanceM,
      riderIds:[...group.riderIds]}:null};
}

export function validateRearGroupStepV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupStepV1(input)))
    throw new Error('Rear-group step differs from its source decisions.');
  return true;
}
