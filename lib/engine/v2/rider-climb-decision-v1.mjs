// Isolated decision witness. It does not move a rider or create a rear group.
import {isDeepStrictEqual} from 'node:util';

export const RIDER_CLIMB_DECISION_VERSION='v2-rider-climb-decision-1';

export function decideRiderClimbV1({riderId,stageNumber,stageCount,
  terrain,energy,projectedHoldCost,teamOrder='follow_plan',
  committedStagePlan=null}){
  if(typeof riderId!=='string'||!riderId||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber||stageCount>30||
    terrain!=='climb'||!Number.isFinite(energy)||energy<0||energy>100||
    !Number.isFinite(projectedHoldCost)||projectedHoldCost<0||
    !['follow_plan','hold_position'].includes(teamOrder)||
    committedStagePlan!==null&&(!committedStagePlan||
      committedStagePlan.riderId!==riderId||
      committedStagePlan.currentStageNumber!==stageNumber||
      !Number.isInteger(committedStagePlan.targetStageNumber)||
      committedStagePlan.targetStageNumber<=stageNumber||
      committedStagePlan.targetStageNumber>stageCount||
      committedStagePlan.currentGoal!=='finish_safely'||
      committedStagePlan.futureGoal!=='target_stage'||
      !Number.isFinite(committedStagePlan.reserveEnergy)||
      committedStagePlan.reserveEnergy<0||
      committedStagePlan.reserveEnergy>100))
    throw new Error('Invalid climb decision source.');
  let choice='hold',reason='can_hold_current_group';
  if(projectedHoldCost>energy){
    choice='cannot_hold';reason='insufficient_energy_for_climb';
  }else if(teamOrder==='follow_plan'&&committedStagePlan&&
    energy-projectedHoldCost<committedStagePlan.reserveEnergy){
    choice='release';reason='committed_future_stage_reserve';
  }
  return {version:RIDER_CLIMB_DECISION_VERSION,riderId,stageNumber,
    choice,reason,energyBefore:energy,projectedHoldCost,
    teamOrder,stagePlanTarget:committedStagePlan?.targetStageNumber??null};
}

export function validateRiderClimbDecisionV1(input,recording){
  if(!isDeepStrictEqual(recording,decideRiderClimbV1(input)))
    throw new Error('Climb decision differs from committed source.');
  return true;
}
