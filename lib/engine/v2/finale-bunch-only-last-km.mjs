import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_BUNCH_ONLY_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';

export const FINALE_BUNCH_ONLY_LAST_KM_CLOCK_VERSION=
  'v2-finale-bunch-only-last-km-clock-1';

export function recordFinaleBunchOnlyLastKmClock(tour){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('The bunch-only clock needs a v93 source.');
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  if(source.roadGroups.length||source.droppedRiderIds.length)
    throw new Error('The bunch-only clock needs one complete field.');
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_BUNCH_ONLY_LAST_KM_VERSION});
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const lineDistanceM=tour.route.distanceKm*1000;
  if(trace.sourceKm!==source.sourceKm||
    trace.frames[0]?.startDistanceM!==source.startDistanceM||
    trace.frames.at(-1)?.endDistanceM!==lineDistanceM||
    trace.finalRiderEnergy.length!==roster.length||
    new Set(trace.finalRiderEnergy.map(row=>row.riderId)).size!==
      roster.length||
    trace.finalRiderEnergy.some(row=>!roster.includes(row.riderId)||
      !Number.isFinite(row.energy)||row.energy<0))
    throw new Error('The bunch-only clock lost its locked field.');
  let elapsed=0;
  const passageFrames=trace.frames.map(frame=>{
    if(frame.roadGroups.length||
      frame.pelotonRiderIds.length!==roster.length||
      !Number.isFinite(frame.bunchElapsedSeconds)||
      frame.bunchElapsedSeconds<=0)
      throw new Error('The bunch-only road changed its field.');
    elapsed+=frame.bunchElapsedSeconds;
    return {distanceM:frame.endDistanceM,
      bunchPassageSecondsFromBunchMarker:elapsed,
      groups:[],droppedPassages:[]};
  });
  return {version:FINALE_BUNCH_ONLY_LAST_KM_CLOCK_VERSION,
    traceVersion:trace.version,sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM,trace,passageFrames,
    line:{outcome:'bunch_only',bands:[{id:'peloton',kind:'peloton',
      riderIds:[...roster],passageSecondsFromBunchMarker:elapsed,
      firstPossiblePlace:1,lastPossiblePlace:roster.length}],
    finalRiderEnergy:trace.finalRiderEnergy},
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleBunchOnlyLastKmClock(tour,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleBunchOnlyLastKmClock(tour)))
    throw new Error('The bunch-only clock does not replay.');
  return true;
}
