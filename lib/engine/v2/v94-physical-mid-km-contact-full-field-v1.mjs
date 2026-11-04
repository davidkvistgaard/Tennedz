// Settle one observed mid-km rear contact into a complete paid field
// only when no other rear, front, or front-drop path intersects it.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalContactingNextKmV1} from
  './v94-physical-contacting-next-km-v1.mjs';
import {replayV94PhysicalMidKmContactFragmentV1} from
  './v94-physical-mid-km-contact-fragment-v1.mjs';
import {inspectV94PhysicalMidKmContactRoadsV1} from
  './v94-physical-mid-km-contact-road-audit-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';

export const V94_PHYSICAL_MID_KM_CONTACT_FULL_FIELD_VERSION=
  'v94-physical-mid-km-contact-full-field-1';
const EPS=1e-7;

export function replayV94PhysicalMidKmContactFullFieldV1(
  recording,prior){
  const fragment=replayV94PhysicalMidKmContactFragmentV1(
    recording,prior);
  const audit=inspectV94PhysicalMidKmContactRoadsV1(
    recording,prior);
  const km=fragment.sourceKm;
  if(audit.sourceKm!==km||audit.firstOtherContact||
    audit.frontDropsUnchecked||audit.frontDropCount!==0)
    throw new Error('Contact field has unresolved road contact.');
  let physicalRoads=null;
  try{
    replayV94PhysicalContactingNextKmV1(recording,prior);
  }catch(error){
    if(error.message!==
      'Physical rear roads need paid contact resolution.')
      throw error;
    physicalRoads=error.physicalRoads;
  }
  const {roads,front,boundary}=physicalRoads??{};
  if(!Array.isArray(roads)||front?.sourceKm!==km||
    boundary?.sourceKm!==km||
    !fragment.previousRoadIds.every(id=>
      roads.some(row=>row.roadId===id)))
    throw new Error('Contact field lacks measured paid roads.');
  const segment=recording.route.kilometres[km-1];
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const ledger=new Map(recording.frames[km-1].energyLedger.map(row=>
    [row.riderId,row]));
  const replaced=new Set(fragment.previousRoadIds);
  const otherRoads=roads.filter(row=>!replaced.has(row.roadId));
  if(otherRoads.some(row=>
    !['rear_group','solo'].includes(row.kind)))
    throw new Error('Contact field needs priced rear road kinds.');
  const otherRearFinishes=otherRoads.flatMap(road=>
    road.riderDecisions.map(row=>{
      const rider=byRider.get(row.riderId);
      if(!rider)throw new Error('Contact field lacks rear rider.');
      const recovery=recoveryForKilometre({rider,segment,
        effort:row.effort,group:'dropped',
        working:row.role==='leader',quietKm:0});
      if(recovery.recovery!==0)
        throw new Error('Contact field cannot claim rear recovery.');
      const cap=replayRearEnergyCapV1({rider,
        kilometres:recording.route.kilometres,
        throughKm:km}).cap;
      const capAdjustment=Math.max(0,
        row.reserveBeforeRecovery-cap);
      return {riderId:row.riderId,sourceKm:km,
        physicalGroup:road.roadId,endDistanceM:km*1000,
        clockSeconds:road.finishClockSeconds,
        energyBefore:row.energyBefore,
        paidFromReserve:row.paidFromReserve,
        recoveryAward:0,capAdjustment,
        energyAfter:+Math.min(cap,
          row.reserveBeforeRecovery).toFixed(3)};
    }));
  const contactGroup={roadId:fragment.road.roadId,
    kind:'rear_group',sourceKm:km,
    previousGroupIds:[...fragment.previousRoadIds],
    sourceBoundaryClockSeconds:fragment.contactClockSeconds,
    startClockSeconds:fragment.contactClockSeconds,
    finishClockSeconds:fragment.road.finishClockSeconds,
    startDistanceM:fragment.atDistanceM,
    endDistanceM:km*1000,
    speedMps:fragment.road.speedMps,
    leaderRiderId:fragment.road.leaderRiderId,
    riderDecisions:fragment.riderWork.map(row=>({
      riderId:row.riderId,role:row.roleAfterContact,
      effort:row.teamOrderEffort,
      energyBefore:row.energyBeforeKm,
      paidFromReserve:row.paidFromReserve,
      reserveBeforeRecovery:row.energyBeforeKm-
        row.paidFromReserve,
      sourceContactFragmentVersion:fragment.version}))};
  const contactFinishes=fragment.riderWork.map(row=>({
    riderId:row.riderId,sourceKm:km,
    physicalGroup:contactGroup.roadId,
    endDistanceM:km*1000,
    clockSeconds:row.finishClockSeconds,
    energyBefore:row.energyBeforeKm,
    paidFromReserve:row.paidFromReserve,
    recoveryAward:row.recoveryAward,
    capAdjustment:row.capAdjustment,
    energyAfter:row.energyAfter}));
  const frontFinishes=front.atFrontClock.map(row=>{
    if(!row.attached)
      throw new Error('Contact field has an unresolved front drop.');
    const source=ledger.get(row.riderId);
    if(!source)
      throw new Error('Contact field lacks front ledger.');
    return {riderId:row.riderId,sourceKm:km,
      physicalGroup:'peloton',endDistanceM:km*1000,
      clockSeconds:front.frontClockSeconds,
      energyBefore:source.energyBefore,
      paidFromReserve:row.physicalPaidThroughClock,
      recoveryAward:source.recoveryAward,
      capAdjustment:source.capAdjustment,
      energyAfter:source.energyAfter};
  });
  const rearFinishes=[...otherRearFinishes,...contactFinishes];
  const finishes=[...frontFinishes,...rearFinishes];
  if(finishes.length!==prior.finishes.length||
    new Set(finishes.map(row=>row.riderId)).size!==
      finishes.length||
    finishes.some(row=>row.endDistanceM!==km*1000||
      Math.abs(row.energyBefore-row.paidFromReserve+
        row.recoveryAward-row.capAdjustment-
        row.energyAfter)>.001+EPS))
    throw new Error('Contact field lacks paid rider coverage.');
  const completeRoads=[...otherRoads,contactGroup];
  return {version:V94_PHYSICAL_MID_KM_CONTACT_FULL_FIELD_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    boundary,front,roads:completeRoads,
    newFrontDrops:[],
    physicalRearGroups:completeRoads.filter(row=>
      row.kind==='rear_group'),
    rearFinishes,droppedFrontFinishes:[],
    coincidentNewFrontDropSets:[],
    continuationNeedsContactDecision:false,
    contactFragmentVersion:fragment.version,
    contactRoadAuditVersion:audit.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    finishes,fullFieldKilometre:true,
    officialResults:false};
}

export function validateV94PhysicalMidKmContactFullFieldV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalMidKmContactFullFieldV1(
      recording,prior)))
    throw new Error('Contact field differs from paid source.');
  return true;
}
