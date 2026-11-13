// A detached rider's goals and effort limits are fixed before the race.
// A future-stage motive is valid only with an explicit stage plan.
import {isDeepStrictEqual} from 'node:util';
import {orderMarkers} from './orders.mjs';

export const REAR_SOLO_COMMITMENT_VERSION=
  'v2-rear-solo-commitment-1';
const GOALS=new Set(['finish_safely','rejoin_bunch','save_for_stage']);
const EFFORTS=new Set(['conserve','steady','hard']);
const keys=(value,allowed)=>value&&typeof value==='object'&&
  !Array.isArray(value)&&Object.keys(value).every(key=>
    allowed.includes(key));
const stagePlanValid=(plan,riderId,stageNumber,stageCount)=>
  plan?.riderId===riderId&&
  plan.currentStageNumber===stageNumber&&
  Number.isInteger(plan.targetStageNumber)&&
  plan.targetStageNumber>stageNumber&&
  plan.targetStageNumber<=stageCount&&
  plan.currentGoal==='finish_safely'&&
  plan.futureGoal==='target_stage'&&
  Number.isFinite(plan.reserveEnergy)&&
  plan.reserveEnergy>=0&&plan.reserveEnergy<=100;
function validIntent(intent,riderId,stageNumber,stageCount){
  return keys(intent,['goal','effort','committedStagePlan'])&&
    GOALS.has(intent.goal)&&EFFORTS.has(intent.effort)&&
    (intent.goal==='save_for_stage')===
      (intent.committedStagePlan!==undefined)&&
    (intent.goal!=='save_for_stage'||
      intent.effort==='conserve'&&stagePlanValid(
        intent.committedStagePlan,riderId,stageNumber,stageCount));
}

export function commitRearSoloPlanV1({riderId,distanceKm,
  keypoints=[],stageNumber,stageCount,baseline,phases=[]}){
  const markers=new Set(orderMarkers({distanceKm,keypoints}));
  if(typeof riderId!=='string'||!riderId||!markers.size||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber||
    !validIntent(baseline,riderId,stageNumber,stageCount)||
    !Array.isArray(phases))
    throw new Error('Rear solo needs a pre-race goal and effort plan.');
  let previous=0;
  for(const phase of phases){
    if(!keys(phase,['atKm','goal','effort','committedStagePlan'])||
      !markers.has(phase.atKm)||phase.atKm<=previous||
      !validIntent({goal:phase.goal,effort:phase.effort,
        ...(phase.committedStagePlan===undefined?{}:
          {committedStagePlan:phase.committedStagePlan})},
      riderId,stageNumber,stageCount))
      throw new Error('Rear solo plan may change only at a route marker.');
    previous=phase.atKm;
  }
  return {version:REAR_SOLO_COMMITMENT_VERSION,
    committedAtKm:0,riderId,distanceKm,
    keypoints:structuredClone(keypoints),stageNumber,stageCount,
    baseline:structuredClone(baseline),phases:structuredClone(phases)};
}

export function rearSoloPlanAtKmV1({commitment,km}){
  if(!commitment||!isDeepStrictEqual(commitment,
    commitRearSoloPlanV1(commitment))||
    !Number.isInteger(km)||km<1||km>commitment.distanceKm)
    throw new Error('Rear solo needs a replayed pre-race plan.');
  let intent=commitment.baseline;
  for(const phase of commitment.phases){
    if(phase.atKm>=km)break;
    intent=phase;
  }
  return {riderId:commitment.riderId,
    action:intent.goal,effort:intent.effort,
    ...(intent.committedStagePlan===undefined?{}:
      {committedStagePlan:structuredClone(intent.committedStagePlan)})};
}
