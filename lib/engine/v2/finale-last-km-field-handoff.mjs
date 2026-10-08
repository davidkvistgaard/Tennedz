import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';

export const FINALE_LAST_KM_FIELD_HANDOFF_VERSION=
  'v2-finale-last-km-field-handoff-1';

// Preserve every rider's validated road, energy, attack load and accumulated
// deficit at the v91 last-kilometre boundary. This does not move any rider.
export function recordFinaleLastKmFieldHandoffFromTour(tour){
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm:1,includeAttackLoad:true});
  if(snapshot.sourceTuningVersion!==MOTOR_ATTACK_TRACE_VERSION)
    throw new Error('The full-field handoff needs a v91 source.');
  const frame=tour.frames[snapshot.sourceKm-1];
  const byId=new Map(frame.riderGroups.map(row=>[row.id,row]));
  const loadById=new Map(snapshot.riderAttackLoads.map(row=>
    [row.riderId,row.load]));
  const riders=snapshot.riders.map(row=>({
    ...row,deficitSeconds:byId.get(row.riderId)?.deficitSeconds,
    attackLoad:loadById.get(row.riderId)}));
  const riderIds=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(riders.length!==riderIds.length||
    byId.size!==riderIds.length||loadById.size!==riderIds.length||
    new Set(riders.map(row=>row.riderId)).size!==riderIds.length||
    riders.some(row=>!riderIds.includes(row.riderId)||
      !Number.isFinite(row.energy)||row.energy<0||
      !Number.isFinite(row.deficitSeconds)||row.deficitSeconds<0||
      !Number.isFinite(row.attackLoad)||row.attackLoad<0||
      row.status==='breakaway'&&row.deficitSeconds!==0))
    throw new Error('The full-field handoff lost a rider or source state.');
  const roadGroups=snapshot.roadGroups.map(group=>({
    ...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds]}));
  const pelotonRiderIds=[...snapshot.peloton.riderIds];
  const droppedRiderIds=[...snapshot.droppedRiderIds];
  if(!isDeepStrictEqual([...roadGroups.flatMap(group=>group.riderIds),
    ...pelotonRiderIds,...droppedRiderIds].sort(),[...riderIds].sort()))
    throw new Error('The full-field handoff has incomplete road membership.');
  return {version:FINALE_LAST_KM_FIELD_HANDOFF_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    sourceKm:snapshot.sourceKm,
    startDistanceM:snapshot.startDistanceM,
    remainingM:snapshot.remainingM,
    roadGroups,pelotonRiderIds,droppedRiderIds,riders,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleLastKmFieldHandoffFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleLastKmFieldHandoffFromTour(tour)))
    throw new Error('The full-field finale handoff does not replay.');
  return true;
}
