// A conditional km-7 full field from paid km-6 arrivals. Source break
// membership stays a claim; only paid boundary contacts may join roads.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_SEVENTH_KM_VERSION=
  'v94-physical-seventh-km-2';
export const V94_PHYSICAL_SEVENTH_BOUNDARY_VERSION=
  'v94-physical-seventh-boundary-choice-1';
export const V94_PHYSICAL_SEVENTH_FRONT_VERSION=
  'v94-physical-seventh-front-km-1';
export const V94_PHYSICAL_SEVENTH_FRONT_DECISION_VERSION=
  'v94-physical-seventh-front-decision-1';
export const V94_PHYSICAL_SEVENTH_REAR_DECISION_VERSION=
  'v94-physical-seventh-rear-decision-1';

export function replayV94PhysicalSeventhKmV1(recording,prior){
  if(prior?.sourceKm!==6||!prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error('Seventh physical km needs paid sixth field.');
  const sourceBreakIds=new Set(prior.sourceBreakRiderIds);
  const caught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  if(sourceBreakIds.size!==prior.sourceBreakRiderIds.length||
    [...caught].some(id=>!sourceBreakIds.has(id)||
      !prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup==='peloton'))||
    prior.sourceBreakRiderIds.some(id=>
      !caught.has(id)&&!prior.finishes.some(row=>
        row.riderId===id&&
        row.physicalGroup.startsWith('solo-'))))
    throw new Error(
      'Seventh source break riders need individual paid roads.');
  const boundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km:7,prior,version:V94_PHYSICAL_SEVENTH_BOUNDARY_VERSION});
  if(boundary.choices.some(choice=>
    choice.riderIds.some(id=>sourceBreakIds.has(id))))
    throw new Error(
      'Seventh forward contact needs a paid break-work choice.');
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km:7,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_SEVENTH_FRONT_VERSION,
    decisionVersion:V94_PHYSICAL_SEVENTH_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds.filter(
      id=>!caught.has(id)),
    sourceClaimedCaughtRiderIds:[...caught]});
  const seventh=replayV94PhysicalRearKmFromPriorV1(recording,{
    km:7,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_SEVENTH_KM_VERSION,
    decisionVersion:V94_PHYSICAL_SEVENTH_REAR_DECISION_VERSION});
  return {...seventh,priorSourceKm:6,priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds],
    ...(caught.size?{
      physicallyCaughtSourceBreakRiderIds:[...caught],
      physicalCaughtQuietKmByRider:
        seventh.physicalCaughtQuietKmByRider}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}

export function validateV94PhysicalSeventhKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalSeventhKmV1(recording,prior)))
    throw new Error('Seventh physical km differs from paid source.');
  return true;
}
