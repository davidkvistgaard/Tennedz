// Complete a recorded-rest kilometre only after every measured drop
// contact has paid group work and no remaining road crossing.
import {inspectV94PhysicalFrontDropFirstBatchNextV1} from
  './v94-physical-front-drop-first-batch-next-v1.mjs';

export const V94_PHYSICAL_FRONT_DROP_BATCH_FIELD_VERSION=
  'v94-physical-front-drop-batch-field-1';
const EPS=.002;

export function completeV94PhysicalFrontDropBatchFieldV1(
  recording,prior,physicalRoads,provisional,fragment){
  const km=prior?.sourceKm+1;
  const probe=inspectV94PhysicalFrontDropFirstBatchNextV1(
    physicalRoads,fragment);
  const joined=new Set(fragment.riderWork.map(row=>row.riderId));
  const drops=physicalRoads.newFrontDrops;
  const passing=physicalRoads.roads.find(row=>
    row.riderDecisions.some(decision=>
      decision.riderId===fragment.road.leaderRiderId));
  const {provisionalFrontDropContacts:pendingFlag,
    pendingFrontDropContacts,...base}=provisional??{};
  if(recording.route.kilometres[km-1]?.km!==km||
    base.sourceKm!==km||base.fullFieldKilometre!==false||
    pendingFlag!==true||
    !Array.isArray(pendingFrontDropContacts)||
    !Array.isArray(base.finishes)||
    !Array.isArray(base.roads)||
    probe.contactCount!==0||
    probe.remainingFrontDropCount!==0||
    drops.length!==joined.size-1||
    !drops.every(row=>joined.has(row.riderId))||
    !joined.has(fragment.road.leaderRiderId)||
    passing?.kind!=='solo'||
    passing.riderDecisions.length!==1||
    passing.riderDecisions[0].riderId!==
      fragment.road.leaderRiderId||
    pendingFrontDropContacts.length!==drops.length||
    new Set(pendingFrontDropContacts.map(row=>
      row.riderId)).size!==drops.length||
    !pendingFrontDropContacts.every(row=>
      joined.has(row.riderId)&&
      row.roadId===passing.roadId))
    throw new Error('Front-drop field has unresolved paid roads.');
  const contactRoad={...fragment.road,
    kind:'rear_group',sourceKm:km,
    previousGroupIds:[passing.roadId,
      ...drops.map(row=>`solo-${row.riderId}`)],
    sourceContactFragmentVersion:fragment.version,
    contactHistory:[{
      clockSeconds:fragment.road.startClockSeconds,
      atDistanceM:fragment.road.startDistanceM,
      joinedRiderIds:fragment.riderWork.filter(row=>
        row.version!==
          'v94-physical-front-drop-batch-extension-1'&&
        row.riderId!==fragment.road.leaderRiderId)
        .map(row=>row.riderId)},
    ...(fragment.contactHistory??[])],
    riderDecisions:fragment.riderWork.map(row=>({
      riderId:row.riderId,
      role:row.roleAfterContact,
      effort:row.effectiveEffort,
      energyBefore:row.energyBeforeKm,
      paidFromReserve:row.paidFromReserve,
      reserveBeforeRecovery:row.energyBeforeKm-
        row.paidFromReserve,
      sourceContactFragmentVersion:row.version}))};
  const contactFinishes=fragment.riderWork.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:contactRoad.roadId,
    endDistanceM:km*1000,
    clockSeconds:row.finishClockSeconds,
    energyBefore:row.energyBeforeKm,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:row.recoveryAward,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter}));
  const otherFinishes=base.finishes.filter(row=>
    !joined.has(row.riderId));
  const finishes=[...otherFinishes,...contactFinishes];
  if(finishes.length!==prior.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==
      finishes.length||
    finishes.some(row=>row.endDistanceM!==km*1000||
      !Number.isFinite(row.clockSeconds)||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>EPS))
    throw new Error('Front-drop field lacks paid rider finish.');
  const roads=[...base.roads.filter(row=>
    row.roadId!==passing.roadId),contactRoad];
  const rearFinishes=[...base.rearFinishes.filter(row=>
    !joined.has(row.riderId)),...contactFinishes];
  return {...base,
    version:V94_PHYSICAL_FRONT_DROP_BATCH_FIELD_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactFragmentVersion:fragment.version,
    contactProbeVersion:probe.version,
    paidContactHistory:contactRoad.contactHistory,
    roads,newFrontDrops:[],
    physicalRearGroups:roads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes:[],
    coincidentNewFrontDropSets:[],
    continuationNeedsContactDecision:false,
    finishes,fullFieldKilometre:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}
