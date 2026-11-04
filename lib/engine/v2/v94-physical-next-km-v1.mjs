// A source-checked continuation from one complete physical boundary.
// The caller keeps earlier traces for a full replay of the run.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {inspectV94PhysicalSixthSourceBoundaryV1} from
  './v94-physical-sixth-source-boundary-v1.mjs';

export const V94_PHYSICAL_NEXT_KM_VERSION=
  'v94-physical-next-km-1';
export const V94_PHYSICAL_NEXT_BOUNDARY_VERSION=
  'v94-physical-next-boundary-choice-1';
export const V94_PHYSICAL_NEXT_FRONT_VERSION=
  'v94-physical-next-front-km-1';
export const V94_PHYSICAL_NEXT_FRONT_DECISION_VERSION=
  'v94-physical-next-front-decision-1';
export const V94_PHYSICAL_NEXT_REAR_DECISION_VERSION=
  'v94-physical-next-rear-decision-1';

export function replayV94PhysicalNextKmV1(recording,prior){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||km<4||
    !prior.fullFieldKilometre||
    !Number.isFinite(prior.front?.frontClockSeconds))
    throw new Error('Next physical km needs a complete paid prior km.');
  const frame=recording.frames[km-1];
  if(km===6&&prior.sourceCheckpointCalibrationFailed){
    const boundary=inspectV94PhysicalSixthSourceBoundaryV1(
      recording,prior);
    const unattachable=boundary.sourceRoads.filter(row=>
      row.sourcePlanCannotAttach);
    if(unattachable.length){
      const error=new Error(
        'Source road group lacks paid physical km5 contact.');
      error.sourceKm=km;
      error.sourceEvidence={
        priorPhysicalVersion:prior.version,
        sourceRoads:unattachable};
      throw error;
    }
  }
  if(frame?.attackers.length||
    frame?.joinedBreakawayRiderIds.length||
    frame?.breakawayRiderIds.length||
    frame?.roadGroups.length){
    const error=new Error(
      'Physical forward road needs a paid launch and contact contract.');
    error.sourceKm=km;
    error.sourceEvidence={
      attackerRiderIds:[...frame.attackers],
      priorAttackerGroups:frame.attackers.map(riderId=>({
        riderId,physicalGroup:prior.finishes.find(row=>
          row.riderId===riderId)?.physicalGroup??null})),
      sourceBreakRoadIds:frame.roadGroups.map(row=>row.id),
      paidRoadGroupTurnPlans:frame.roadGroupTurnPlans?.length??0};
    throw error;
  }
  const boundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km,prior,version:V94_PHYSICAL_NEXT_BOUNDARY_VERSION});
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_NEXT_FRONT_VERSION,
    decisionVersion:V94_PHYSICAL_NEXT_FRONT_DECISION_VERSION,
    priorField:null});
  const next=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_NEXT_KM_VERSION,
    decisionVersion:V94_PHYSICAL_NEXT_REAR_DECISION_VERSION});
  return {...next,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version};
}

export function validateV94PhysicalNextKmV1(recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalNextKmV1(recording,prior)))
    throw new Error('Next physical km differs from paid source.');
  return true;
}
