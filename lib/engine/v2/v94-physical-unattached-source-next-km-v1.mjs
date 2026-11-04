// Advance a paid field while source break membership remains separate
// individual roads. Refuse any contact or source charge that cannot be
// reconciled with the physical replay.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_UNATTACHED_SOURCE_NEXT_KM_VERSION=
  'v94-physical-unattached-source-next-km-1';
export const V94_PHYSICAL_UNATTACHED_SOURCE_BOUNDARY_VERSION=
  'v94-physical-unattached-source-boundary-1';
export const V94_PHYSICAL_UNATTACHED_SOURCE_FRONT_VERSION=
  'v94-physical-unattached-source-front-1';
export const V94_PHYSICAL_UNATTACHED_SOURCE_FRONT_DECISION_VERSION=
  'v94-physical-unattached-source-front-decision-1';
export const V94_PHYSICAL_UNATTACHED_SOURCE_REAR_DECISION_VERSION=
  'v94-physical-unattached-source-rear-decision-1';

export function replayV94PhysicalUnattachedSourceNextKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||km<8||
    recording.route.kilometres[km-1]?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error(
      'Unattached source continuation needs paid prior field.');
  const sourceBreakIds=new Set(prior.sourceBreakRiderIds);
  const caught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  if(sourceBreakIds.size!==prior.sourceBreakRiderIds.length||
    [...caught].some(id=>!sourceBreakIds.has(id)||
      !prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup==='peloton'))||
    prior.sourceBreakRiderIds.some(id=>
      !caught.has(id)&&!prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup!=='peloton')))
    throw new Error(
      'Unattached source break needs detached paid roads.');
  const ordinaryBoundary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,
      version:V94_PHYSICAL_UNATTACHED_SOURCE_BOUNDARY_VERSION});
  const forwardContact=ordinaryBoundary.choices.some(choice=>
    choice.riderIds.some(id=>sourceBreakIds.has(id)));
  const boundary=forwardContact?
    decideV94PhysicalForwardBoundaryChoicesV1(recording,prior):
    ordinaryBoundary;
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_UNATTACHED_SOURCE_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_UNATTACHED_SOURCE_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds.filter(id=>
      !caught.has(id)),
    sourceClaimedCaughtRiderIds:[...caught],
    allowNamedChaseTurns:true});
  const next=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_UNATTACHED_SOURCE_NEXT_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_UNATTACHED_SOURCE_REAR_DECISION_VERSION});
  return {...next,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds],
    ...(caught.size?{
      physicallyCaughtSourceBreakRiderIds:[...caught]}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}

export function validateV94PhysicalUnattachedSourceNextKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalUnattachedSourceNextKmV1(
      recording,prior)))
    throw new Error(
      'Unattached source continuation differs from paid source.');
  return true;
}
