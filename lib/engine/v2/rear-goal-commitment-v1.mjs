// Explicit pre-race rear intentions. Break work and chase orders never become
// rear work by inference; a rider's current group decision remains dynamic.
import {isDeepStrictEqual} from 'node:util';
import {orderMarkers} from './orders.mjs';
import {advanceRearGroupTurnKilometreV1} from
  './rear-group-turn-kilometre-v1.mjs';

export const REAR_GOAL_COMMITMENT_VERSION='v2-rear-goal-commitment-1';
const GOALS=new Set(['finish_safely','rejoin_bunch','save_for_stage']);
const WORK=new Set(['cooperate','drive','sit_on']);
const allowedKeys=(value,keys)=>value&&typeof value==='object'&&
  !Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));
function validPlan(plan,riderId,stageNumber,stageCount){
  return plan?.riderId===riderId&&
    plan.currentStageNumber===stageNumber&&
    Number.isInteger(plan.targetStageNumber)&&
    plan.targetStageNumber>stageNumber&&
    plan.targetStageNumber<=stageCount&&
    plan.currentGoal==='finish_safely'&&
    plan.futureGoal==='target_stage'&&
    Number.isFinite(plan.reserveEnergy)&&
    plan.reserveEnergy>=0&&plan.reserveEnergy<=100;
}
function intentValid(intent,riderId,stageNumber,stageCount){
  if(!allowedKeys(intent,['goal','rearWork','committedStagePlan'])||
    !GOALS.has(intent.goal)||!WORK.has(intent.rearWork)||
    (intent.goal==='save_for_stage')!==
      (intent.committedStagePlan!==undefined))return false;
  return intent.committedStagePlan===undefined||
    validPlan(intent.committedStagePlan,riderId,stageNumber,stageCount);
}

export function commitRearGoalsV1({riderIds,strategies,distanceKm,
  keypoints=[],stageNumber,stageCount}){
  if(!Array.isArray(riderIds)||!riderIds.length||
    riderIds.some(id=>typeof id!=='string'||!id)||
    new Set(riderIds).size!==riderIds.length||
    !Array.isArray(strategies)||strategies.length!==riderIds.length||
    new Set(strategies.map(row=>row?.riderId)).size!==riderIds.length||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber)
    throw new Error('Rear intent needs a complete pre-race rider roster.');
  const markers=new Set(orderMarkers({distanceKm,keypoints}));
  if(!markers.size)
    throw new Error('Rear intent needs a valid race route.');
  for(const strategy of strategies){
    if(!allowedKeys(strategy,['riderId','baseline','phases'])||
      !riderIds.includes(strategy.riderId)||
      !intentValid(strategy.baseline,strategy.riderId,
        stageNumber,stageCount)||
      !Array.isArray(strategy.phases))
      throw new Error('Rear rider needs an explicit sporting intention.');
    let lastKm=0;
    for(const phase of strategy.phases){
      if(!allowedKeys(phase,['atKm','goal','rearWork',
        'committedStagePlan'])||
        !Number.isInteger(phase.atKm)||!markers.has(phase.atKm)||
        phase.atKm<=lastKm||
        !intentValid({goal:phase.goal,rearWork:phase.rearWork,
          ...(phase.committedStagePlan===undefined?{}:
            {committedStagePlan:phase.committedStagePlan})},
        strategy.riderId,stageNumber,stageCount))
        throw new Error('Rear intention may change only at a route marker.');
      lastKm=phase.atKm;
    }
  }
  return {version:REAR_GOAL_COMMITMENT_VERSION,
    committedAtKm:0,riderIds:[...riderIds],
    distanceKm,keypoints:structuredClone(keypoints),
    stageNumber,stageCount,strategies:structuredClone(strategies)};
}

export function rearGoalsAtKmV1({commitment,riderIds,km}){
  if(!commitment||!isDeepStrictEqual(commitment,
    commitRearGoalsV1(commitment))||
    !Array.isArray(riderIds)||riderIds.length<2||
    new Set(riderIds).size!==riderIds.length||
    riderIds.some(id=>!commitment.riderIds.includes(id))||
    !Number.isInteger(km)||km<1||km>commitment.distanceKm)
    throw new Error('Rear group needs replayed committed intentions.');
  const byId=new Map(commitment.strategies.map(row=>[row.riderId,row]));
  return riderIds.map(riderId=>{
    const strategy=byId.get(riderId);
    let intent=strategy.baseline;
    for(const phase of strategy.phases){
      if(phase.atKm>=km)break;
      intent=phase;
    }
    return {riderId,goal:intent.goal,rearWork:intent.rearWork,
      ...(intent.committedStagePlan===undefined?{}:
        {committedStagePlan:structuredClone(intent.committedStagePlan)})};
  });
}

export function advanceCommittedRearTurnsV1({commitment,
  priorInput,priorStep,segment,bunchTurnPlan,teams,roadGroups=[]}){
  const riderIds=priorStep?.rearGroup?.riderIds;
  const rearGoals=rearGoalsAtKmV1({commitment,riderIds,km:segment?.km});
  const input={priorInput,priorStep,segment,bunchTurnPlan,teams,
    roadGroups,rearGoals,stageNumber:commitment.stageNumber,
    stageCount:commitment.stageCount};
  const turn=advanceRearGroupTurnKilometreV1(input);
  return {version:REAR_GOAL_COMMITMENT_VERSION,
    commitment:structuredClone(commitment),rearGoals,turn};
}

export function validateCommittedRearTurnsV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceCommittedRearTurnsV1(input)))
    throw new Error('Rear turns differ from committed sporting intentions.');
  return true;
}
