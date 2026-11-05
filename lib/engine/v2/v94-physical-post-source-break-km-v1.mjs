// Continue paid roads when a source break claim ends. The prior
// riders stay on their physical rear roads until paid contact occurs.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_POST_SOURCE_BREAK_KM_VERSION=
  'v94-physical-post-source-break-km-2';
export const V94_PHYSICAL_POST_SOURCE_BREAK_BOUNDARY_VERSION=
  'v94-physical-post-source-break-boundary-1';
export const V94_PHYSICAL_POST_SOURCE_BREAK_FRONT_VERSION=
  'v94-physical-post-source-break-front-1';
export const V94_PHYSICAL_POST_SOURCE_BREAK_FRONT_DECISION_VERSION=
  'v94-physical-post-source-break-front-decision-1';
export const V94_PHYSICAL_POST_SOURCE_BREAK_REAR_DECISION_VERSION=
  'v94-physical-post-source-break-rear-decision-1';

export function replayV94PhysicalPostSourceBreakKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  if(!Number.isInteger(km)||km<8||
    recording.route.kilometres[km-1]?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !Array.isArray(frame?.breakawayRiderIds)||
    frame.breakawayRiderIds.length||
    frame.attackers.length||
    frame.joinedBreakawayRiderIds.length||
    frame.roadGroups.length||
    !Array.isArray(frame.pelotonRestTeamIds))
    throw new Error('Post-break km needs ended source claim.');
  const formerBreakIds=prior.formerSourceBreakRiderIds??
    prior.sourceBreakRiderIds;
  const caught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  if(!formerBreakIds.length||
    [...caught].some(id=>!formerBreakIds.includes(id)||
      !prior.finishes.some(row=>row.riderId===id&&
        row.physicalGroup==='peloton'))||
    formerBreakIds.some(id=>!caught.has(id)&&
      !prior.finishes.some(row=>
      row.riderId===id&&row.physicalGroup!=='peloton')))
    throw new Error('Post-break riders need paid rear roads.');
  const boundary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,
      version:V94_PHYSICAL_POST_SOURCE_BREAK_BOUNDARY_VERSION});
  const frontInput={km,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_POST_SOURCE_BREAK_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_POST_SOURCE_BREAK_FRONT_DECISION_VERSION,
    priorField:null,allowNamedChaseTurns:true,
    sourceClaimedCaughtRiderIds:[...caught]};
  let front,orderedEffortRefusal=null;
  try{
    front=replayV94PhysicalFrontKmFromPriorV1(
      recording,frontInput);
  }catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km||
      !frame.pelotonRestTeamIds.length)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    front=replayV94PhysicalFrontKmFromPriorV1(recording,{
      ...frontInput,recordedRestMode:true});
  }
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_POST_SOURCE_BREAK_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_POST_SOURCE_BREAK_REAR_DECISION_VERSION});
  return {...settled,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    formerSourceBreakRiderIds:[...formerBreakIds],
    sourceBreakRiderIds:[],
    ...(caught.size?{
      physicallyCaughtSourceBreakRiderIds:[...caught],
      physicalCaughtQuietKmByRider:
        settled.physicalCaughtQuietKmByRider}:{}),
    sourceBreakMembershipEnded:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...frame.pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalPostSourceBreakKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalPostSourceBreakKmV1(
      recording,prior)))
    throw new Error('Post-break km differs from paid source.');
  return true;
}
