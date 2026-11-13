import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  './finale-multi-run.mjs';
import {auditDissolvedFrontPaidContact} from
  './finale-dissolved-front-paid-contact.mjs';

export const FINALE_MIXED_STRADDLING_HANDOFF_AUDIT_VERSION=
  'v2-finale-mixed-straddling-500m-handoff-audit-1';
const EPSILON=1e-7;

// Read-only whole-race evidence. Group-marker overlaps on either side of
// 500 m are paid, but neither those markers nor this energy handoff place
// riders into occupied sprint wheels or authorize an individual finish.
export function recordFinaleMixedStraddlingHandoffAudit(tour){
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
  const audit=auditDissolvedFrontPaidContact(trace);
  const finishM=tour.route.distanceKm*1000;
  const handoffM=finishM-500;
  const leading=source.roadGroups[0];
  const second=source.roadGroups[1];
  const exits=trace.frames.flatMap(frame=>frame.frontExhaustionDrops);
  const leavers=exits.filter(row=>row.fromRoadGroupId===leading?.id);
  const handoff=trace.frames.find(frame=>frame.endDistanceM===handoffM);
  const before=audit.encounters.filter(row=>
    row.distanceM<handoffM-EPSILON);
  const after=audit.encounters.filter(row=>
    row.distanceM>handoffM+EPSILON);
  const roster=new Set(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  let priorEnergy=new Map(source.riders.map(row=>
    [row.riderId,row.energy]));
  for(const frame of trace.frames){
    const nextEnergy=new Map();
    for(const row of frame.riders){
      const before=row.energyBefore??row.energy+row.energySpent;
      const after=row.energyAfter??row.energy;
      if(!priorEnergy.has(row.riderId)||
        ![before,row.energySpent,after].every(Number.isFinite)||
        Math.abs(priorEnergy.get(row.riderId)-before)>EPSILON||
        Math.abs(before-row.energySpent-after)>EPSILON||
        row.energySpent<-EPSILON||after<-EPSILON||
        nextEnergy.has(row.riderId))
        throw new Error('The straddling handoff loses paid rider energy.');
      nextEnergy.set(row.riderId,after);
    }
    if(nextEnergy.size!==roster.size)
      throw new Error('The straddling handoff loses a rider.');
    priorEnergy=nextEnergy;
  }
  const handoffRiders=handoff?.riders??[];
  const handoffEnergy=new Map(handoffRiders.map(row=>
    [row.riderId,row.energyAfter??row.energy]));
  if(source.roadGroups.length!==3||!source.droppedRiderIds.length||
    !second||!leading||!handoff||!leavers.length||
    !exits.some(row=>row.fromRoadGroupId===second.id)||
    trace.frames.some(frame=>frame.exhaustionDrops.length||
      frame.frontGroupDissolutions?.length)||
    audit.encounters.length!==leavers.length||
    new Set(audit.encounters.map(row=>row.riderId)).size!==leavers.length||
    audit.encounters.some(row=>row.activeBandId!==second.id||
      !leavers.some(exit=>exit.riderId===row.riderId)||
      row.distanceM>=finishM-EPSILON||
      row.split.solo.energyAtContact<-EPSILON)||
    !before.length||!after.length||
    audit.encounters.length!==before.length+after.length||
    source.riders.length!==roster.size||
    handoffRiders.length!==roster.size||
    handoffEnergy.size!==roster.size||
    [...roster].some(id=>!handoffEnergy.has(id)||
      !Number.isFinite(handoffEnergy.get(id))||
      handoffEnergy.get(id)<-EPSILON))
    throw new Error('The straddling handoff lacks paid separate riders.');
  return {version:FINALE_MIXED_STRADDLING_HANDOFF_AUDIT_VERSION,
    sourceTraceVersion:trace.version,
    sourceContactAuditVersion:audit.version,
    handoffDistanceM:handoffM,
    paidRiderCount:roster.size,
    handoffRiderEnergy:[...handoffEnergy].map(([riderId,energy])=>({
      riderId,energy})),
    beforeHandoff:before.map(row=>({riderId:row.riderId,
      distanceM:row.distanceM,
      energyAtMarker:row.split.solo.energyAtContact})),
    afterHandoff:after.map(row=>({riderId:row.riderId,
      distanceM:row.distanceM,
      energyAtMarker:row.split.solo.energyAtContact})),
    status:'paid_marker_handoff_occupied_wheels_unresolved',
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleMixedStraddlingHandoffAudit(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedStraddlingHandoffAudit(tour)))
    throw new Error('The straddling handoff audit does not replay.');
  return true;
}
