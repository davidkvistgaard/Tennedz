// Follow an actual source-break membership withdrawal without moving the
// departing rider to the bunch or altering any paid physical road.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_PARTIAL_SOURCE_WITHDRAWAL_VERSION=
  'v94-physical-partial-source-withdrawal-1';
export const V94_PHYSICAL_PARTIAL_SOURCE_BOUNDARY_VERSION=
  'v94-physical-partial-source-boundary-1';
export const V94_PHYSICAL_PARTIAL_SOURCE_FRONT_VERSION=
  'v94-physical-partial-source-front-1';
export const V94_PHYSICAL_PARTIAL_SOURCE_FRONT_DECISION_VERSION=
  'v94-physical-partial-source-front-decision-1';
export const V94_PHYSICAL_PARTIAL_SOURCE_REAR_DECISION_VERSION=
  'v94-physical-partial-source-rear-decision-1';

export function replayV94PhysicalPartialSourceWithdrawalKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  const active=frame?.breakawayRiderIds;
  const previous=new Set(prior?.sourceBreakRiderIds??[]);
  if(!Number.isInteger(km)||km<8||
    recording.route.kilometres[km-1]?.km!==km||
    !prior?.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    previous.size!==prior.sourceBreakRiderIds.length||
    !Array.isArray(active)||!active.length||
    new Set(active).size!==active.length||
    active.length>=previous.size||
    active.some(id=>!previous.has(id))||
    frame.attackers.length||
    frame.joinedBreakawayRiderIds.length||
    !Array.isArray(frame.roadGroups)||
    new Set(frame.roadGroups.flatMap(group=>
      group.riderIds)).size!==active.length||
    frame.roadGroups.some(group=>group.riderIds.some(id=>
      !active.includes(id))))
    throw new Error('Partial withdrawal needs exact source membership.');
  const withdrawn=prior.sourceBreakRiderIds.filter(id=>
    !active.includes(id));
  const caught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  if(withdrawn.some(id=>caught.has(id)||
    !prior.finishes.some(row=>row.riderId===id&&
      row.physicalGroup!=='peloton'))||
    [...caught].some(id=>!active.includes(id)))
    throw new Error('Withdrawn rider lacks a detached paid road.');
  const ordinary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,
      version:V94_PHYSICAL_PARTIAL_SOURCE_BOUNDARY_VERSION});
  const activePrior={...prior,sourceBreakRiderIds:[...active],
    physicallyCaughtSourceBreakRiderIds:[...caught]};
  const boundary=ordinary.choices.some(choice=>
    choice.riderIds.some(id=>active.includes(id)))?
    decideV94PhysicalForwardBoundaryChoicesV1(
      recording,activePrior,{
        allowPaidMixedContact:
          prior.mixedPaidContactFromPrior===true||
          !!prior.contactFragmentVersion}):ordinary;
  const frontInput={km,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_PARTIAL_SOURCE_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_PARTIAL_SOURCE_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:active.filter(id=>
      !caught.has(id)),
    sourceClaimedCaughtRiderIds:[...caught],
    allowNamedChaseTurns:true};
  let front,orderedEffortRefusal=null;
  try{front=replayV94PhysicalFrontKmFromPriorV1(
    recording,frontInput);}
  catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km||
      !frame.pelotonRestTeamIds?.length)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    front=replayV94PhysicalFrontKmFromPriorV1(
      recording,{...frontInput,recordedRestMode:true});
  }
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_PARTIAL_SOURCE_WITHDRAWAL_VERSION,
    decisionVersion:
      V94_PHYSICAL_PARTIAL_SOURCE_REAR_DECISION_VERSION});
  const former=[...new Set([
    ...(prior.formerSourceBreakRiderIds??[]),...withdrawn])];
  return {...settled,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...active],
    formerSourceBreakRiderIds:former,
    sourceMembershipWithdrawnRiderIds:[...withdrawn],
    ...(boundary.choices.some(row=>row.mixedPaidContact)?{
      mixedPaidContactFromPrior:true}:{}),
    ...(caught.size?{
      physicallyCaughtSourceBreakRiderIds:[...caught],
      physicalCaughtQuietKmByRider:
        settled.physicalCaughtQuietKmByRider}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:
        [...frame.pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalPartialSourceWithdrawalKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalPartialSourceWithdrawalKmV1(
      recording,prior)))
    throw new Error('Partial withdrawal differs from paid source.');
  return true;
}
