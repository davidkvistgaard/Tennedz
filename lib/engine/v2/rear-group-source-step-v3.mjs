// Opt-in hold check after a source-replayed three-rider rear-group turn.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupSourceStepV2} from
  './rear-group-source-step-v2.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_SOURCE_STEP_V3_VERSION=
  'v2-rear-group-source-step-3';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Three-rider hold speed is invalid.');
  return 3600/seconds;
};

export function advanceRearGroupSourceStepV3(input){
  const sourceStep=advanceRearGroupSourceStepV2(input);
  const riders=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const base=segmentBaseSeconds(input.segment);
  const holdChecks=sourceStep.memberDecisions.filter(row=>
    row.riderId!==sourceStep.leaderRiderId).map(decision=>{
    const rider=riders.get(decision.riderId);
    const effect=riderKilometreEffect(rider,input.segment,{
      phase:'cruise',energy:input.group.energyByRider[rider.id],
      exposed:input.segment.exposed});
    const holdSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[decision.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage);
    return {riderId:rider.id,effort:decision.effort,
      holdSpeedKph,leaderSpeedKph:sourceStep.leaderSpeedKph,
      canHold:holdSpeedKph+1e-9>=sourceStep.leaderSpeedKph};
  });
  if(holdChecks.some(row=>!row.canHold))
    throw new Error('Three-rider follower cannot hold paid leader; split road needed.');
  return {version:REAR_GROUP_SOURCE_STEP_V3_VERSION,
    sourceStep,holdChecks,officialResults:false};
}

export function validateRearGroupSourceStepV3(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearGroupSourceStepV3(input)))
    throw new Error('Three-rider hold differs from paid source.');
  return true;
}
