import {isDeepStrictEqual} from 'node:util';
import {divisionMultiplier} from '../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../calendar/points.mjs';
import {recordFinaleGroupResultBounds} from
  '../engine/v2/finale-group-result-bounds.mjs';

export const V2_CONDITIONAL_GROUP_POINT_BOUNDS_VERSION=
  'v2-conditional-group-point-bounds-1';
export const V2_CONDITIONAL_CHASE_GROUP_POINT_BOUNDS_VERSION=
  'v2-conditional-group-point-bounds-2';
export const V2_CONDITIONAL_ROTATING_CHASE_POINT_BOUNDS_VERSION=
  'v2-conditional-group-point-bounds-3';

// This is a policy-consistent range over still possible places. It creates
// no award rows and never turns a group-band result into a classification.
export function projectV2ConditionalGroupPointBounds(tour,clock,{
  tier,divisionIndex,divisionCount,chasePullRiderId=null,
  chaseRotationRiderIds=null}={}){
  if(!Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Group point bounds need a valid race tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  const bounds=recordFinaleGroupResultBounds(tour,clock,
    {chasePullRiderId,chaseRotationRiderIds});
  const riders=bounds.riders.map(row=>{
    const possiblePoints=[];
    for(let placing=row.firstPossiblePlace;
      placing<=row.lastPossiblePlace;placing++)
      possiblePoints.push(pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing,multiplier}));
    return {...row,minPossiblePoints:Math.min(...possiblePoints),
      maxPossiblePoints:Math.max(...possiblePoints)};
  });
  return {version:chaseRotationRiderIds?
    V2_CONDITIONAL_ROTATING_CHASE_POINT_BOUNDS_VERSION:
    chasePullRiderId===null?
    V2_CONDITIONAL_GROUP_POINT_BOUNDS_VERSION:
    V2_CONDITIONAL_CHASE_GROUP_POINT_BOUNDS_VERSION,
    sourceBoundsVersion:bounds.version,
    sourceClockVersion:clock.version,
    sourceMotorVersion:tour.tuningVersion,
    tier,divisionIndex,divisionCount,multiplier,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    outcome:bounds.outcome,riders,
    resultStatus:'band_bounds_only',pointsStatus:'withheld',
    canCommitAwards:false,awardRows:[]};
}

export function validateV2ConditionalGroupPointBounds(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    projectV2ConditionalGroupPointBounds(tour,clock,input)))
    throw new Error('The conditional group point bounds do not replay.');
  return true;
}
