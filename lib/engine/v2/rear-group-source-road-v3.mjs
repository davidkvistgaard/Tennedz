// Opt-in terrain-priced two-rider rear road after replayed physical contact.
// The V2 hold gate chooses the road; this version charges its actual distance.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupFromPaidSourceV2,
  advanceRearGroupSourceRoadV2} from
  './rear-group-source-road-v2.mjs';
import {advanceRearGroupStepV1} from './rear-group-step-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {TUNING} from './tuning.mjs';

export const REAR_GROUP_SOURCE_ROAD_V3_VERSION=
  'v2-rear-group-source-road-3';

function terrainRoad(input,sourceV2){
  const oldRoad=sourceV2.sourceRoad.road;
  const group=input.group;
  const distanceM=oldRoad.endDistanceM-oldRoad.startDistanceM;
  if(distanceM<=0)
    throw new Error('Terrain-priced rear road needs paid travel.');
  const riders=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const decisions=new Map(sourceV2.sourceRoad.memberDecisions.map(row=>
    [row.riderId,row]));
  const prices=group.riderIds.map(riderId=>priceRearEnergyDemandV1({
    rider:riders.get(riderId),segment:input.segment,
    energyBefore:group.energyByRider[riderId],
    effort:decisions.get(riderId).effort,
    role:riderId===oldRoad.leaderRiderId?'leader':'sheltered',
    distanceM}));
  const priceByRider=new Map(prices.map(row=>[row.riderId,row]));
  const riderPlans=sourceV2.sourceRoad.riderPlans.map(plan=>{
    const price=priceByRider.get(plan.riderId);
    const effortCost=TUNING.effortCost[decisions.get(plan.riderId).effort];
    const multiplier=plan.shelteredCostPerKm/
      (effortCost*.8);
    const leadCostPerKm=(effortCost*price.terrainLoad+
      TUNING.breakaway.extraCostPerKm)*multiplier;
    const shelteredCostPerKm=effortCost*price.terrainLoad*
      multiplier*.8;
    const charged=price.role==='leader'?leadCostPerKm:
      shelteredCostPerKm;
    if(Math.abs(charged*distanceM/1000-price.energyDemand)>1e-9)
      throw new Error('Rear terrain price differs from role demand.');
    return {...plan,leadCostPerKm,shelteredCostPerKm};
  });
  const road=advanceRearGroupStepV1({
    slice:{startDistanceM:oldRoad.startDistanceM,
      endDistanceM:oldRoad.startDistanceM+1000,lengthM:1000},
    group,bunchSpeedKph:sourceV2.sourceRoad.bunchSpeedKph,
    riderPlans});
  if(road.leaderRiderId!==oldRoad.leaderRiderId||
    road.endDistanceM!==oldRoad.endDistanceM||
    !isDeepStrictEqual(road.event,oldRoad.event))
    throw new Error('Terrain price changed the paid rear road clock.');
  return {version:REAR_GROUP_SOURCE_ROAD_V3_VERSION,
    sourceV2,prices,road,officialResults:false};
}

export function advanceRearGroupSourceRoadV3(input){
  const sourceV2=advanceRearGroupSourceRoadV2(input);
  return terrainRoad({...input,
    group:input.priorChoice.group.continuation.rearGroup},sourceV2);
}

// The caller must replay the paid contact or preceding V3 step that supplied
// this group. A V3 run performs that source check before each call.
export function advanceRearGroupFromPaidSourceV3(input){
  return terrainRoad(input,advanceRearGroupFromPaidSourceV2(input));
}

export function validateRearGroupSourceRoadV3(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupSourceRoadV3(input)))
    throw new Error('Terrain-priced rear road differs from paid source.');
  return true;
}
