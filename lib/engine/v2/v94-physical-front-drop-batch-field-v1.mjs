// Complete a recorded-rest kilometre only after every measured drop
// contact has paid group work and no remaining road crossing.
import {inspectV94PhysicalFrontDropFirstBatchNextV1} from
  './v94-physical-front-drop-first-batch-next-v1.mjs';
import {planV94PhysicalFrontDropContactBatchesV1} from
  './v94-physical-front-drop-contact-batches-v1.mjs';
import {V94_PHYSICAL_FRONT_DROP_LATER_BATCH_FRAGMENT_VERSION} from
  './v94-physical-front-drop-first-batch-fragment-v1.mjs';

export const V94_PHYSICAL_FRONT_DROP_BATCH_FIELD_VERSION=
  'v94-physical-front-drop-batch-field-1';
export const V94_PHYSICAL_FRONT_DROP_PARTIAL_FIELD_VERSION=
  'v94-physical-front-drop-partial-field-1';
const EPS=.002;

export function completeV94PhysicalFrontDropBatchFieldV1(
  recording,prior,physicalRoads,provisional,fragment){
  const km=prior?.sourceKm+1;
  const probe=inspectV94PhysicalFrontDropFirstBatchNextV1(
    physicalRoads,fragment);
  const joined=new Set(fragment.riderWork.map(row=>row.riderId));
  const partial=(fragment.firstFragmentVersion??
    fragment.version)===
      V94_PHYSICAL_FRONT_DROP_LATER_BATCH_FRAGMENT_VERSION;
  const passThrough=fragment.passThroughContacts??[];
  const passed=new Set(passThrough.map(row=>row.passedRiderId));
  if(partial){
    const plan=planV94PhysicalFrontDropContactBatchesV1(
      recording,prior,physicalRoads);
    const expected=plan.batches.slice(0,
      plan.firstPayableBatchIndex-1).flatMap(batch=>
      batch.dropQuotes.map(row=>({riderId:row.riderId,
        clockSeconds:batch.clockSeconds,
        atDistanceM:batch.atDistanceM})));
    if(passed.size!==passThrough.length||
      expected.length!==passThrough.length||
      expected.some(row=>!passThrough.some(receipt=>
        receipt.passedRiderId===row.riderId&&
        Math.abs(receipt.clockSeconds-
          row.clockSeconds)<EPS&&
        Math.abs(receipt.atDistanceM-
          row.atDistanceM)<EPS&&
        receipt.formsRearGroup===false)))
      throw new Error(
        'Partial front-drop field lacks paid pass-through.');
  }
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
    probe.remainingFrontDropCount!==passed.size||
    drops.length!==joined.size-1+passed.size||
    !drops.every(row=>joined.has(row.riderId)||
      passed.has(row.riderId))||
    [...passed].some(id=>joined.has(id))||
    !joined.has(fragment.road.leaderRiderId)||
    passing?.kind!=='solo'||
    passing.riderDecisions.length!==1||
    passing.riderDecisions[0].riderId!==
      fragment.road.leaderRiderId||
    pendingFrontDropContacts.length!==drops.length||
    new Set(pendingFrontDropContacts.map(row=>
      row.riderId)).size!==drops.length||
    !pendingFrontDropContacts.every(row=>
      (joined.has(row.riderId)||passed.has(row.riderId))&&
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
      version:row.version,
      choice:row.roleAfterContact==='leader'?
        'lead_paid_contact_group':'take_paid_contact_shelter',
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId??null,
      teamOrderEffort:row.teamOrderEffort,
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
    version:partial?
      V94_PHYSICAL_FRONT_DROP_PARTIAL_FIELD_VERSION:
      V94_PHYSICAL_FRONT_DROP_BATCH_FIELD_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactFragmentVersion:fragment.version,
    contactProbeVersion:probe.version,
    paidContactHistory:contactRoad.contactHistory,
    ...(partial?{passThroughContacts:passThrough}:{}),
    roads,newFrontDrops:[],
    physicalRearGroups:roads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes:partial?
      base.droppedFrontFinishes.filter(row=>
        passed.has(row.riderId)):[],
    coincidentNewFrontDropSets:[],
    continuationNeedsContactDecision:false,
    finishes,fullFieldKilometre:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}
