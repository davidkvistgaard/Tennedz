import {isDeepStrictEqual} from 'node:util';
import {recordFinaleRotationSoloRunFromTour} from
  './finale-rotation-solo-slice.mjs';
import {recordFinaleRotationSoloLateCatchSprintFromTour,
  recordFinaleRotationSoloSecondCatchSprintFromTour,
  recordFinaleRotationSoloFirstCatchSprintFromTour} from
  './finale-rotation-solo-late-catch-sprint.mjs';

export const FINALE_ROTATION_SOLO_FINISH_BOUNDS_VERSION=
  'v2-finale-rotation-solo-finish-bounds-1';
export const FINALE_ROTATION_SOLO_LATE_CATCH_BOUNDS_VERSION=
  'v2-finale-rotation-solo-late-catch-bounds-2';
export const FINALE_ROTATION_SOLO_SECOND_CATCH_BOUNDS_VERSION=
  'v2-finale-rotation-solo-second-catch-bounds-1';
export const FINALE_ROTATION_SOLO_FIRST_CATCH_BOUNDS_VERSION=
  'v2-finale-rotation-solo-first-catch-bounds-1';

function teamByRider(tour){
  return new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
}

function verifyLineRiders(tour,ids,energy){
  const byId=teamByRider(tour);
  const lineEnergy=new Map(energy.map(row=>[row.riderId,row]));
  if(ids.length!==byId.size||new Set(ids).size!==ids.length||
    lineEnergy.size!==ids.length||
    ids.some(id=>!byId.has(id)||!lineEnergy.has(id)))
    throw new Error('Solo finish bounds need every locked rider once.');
  return {byId,lineEnergy};
}

// One separate rider with a measured positive line gap is known to be ahead
// of all 31 bunch riders. No order within that bunch or point award follows.
export function probeFinaleRotationSoloFinishBoundsFromTour(tour,input){
  const run=recordFinaleRotationSoloRunFromTour(tour,input);
  const front=run.roadGroups[0];
  const bunch=run.pelotonRiderIds;
  const ids=[...front.riderIds,...bunch];
  const {byId,lineEnergy}=verifyLineRiders(tour,ids,
    run.lineRiderEnergy);
  if(run.roadGroups.length!==1||front.riderIds.length!==1||
    !Number.isFinite(front.gapSeconds)||front.gapSeconds<=0||
    bunch.length===0||front.riderIds.includes(bunch[0]))
    throw new Error('Solo finish bounds need one separated line rider.');
  return {version:FINALE_ROTATION_SOLO_FINISH_BOUNDS_VERSION,
    sourceRunVersion:run.version,lineDistanceM:run.endDistanceM,
    elapsedBunchSecondsFromLastKmStart:run.bunchElapsedSecondsAtLine,
    roadBands:[{roadGroupId:front.id,
      riderIds:[...front.riderIds],
      gapAheadOfBunchSeconds:front.gapSeconds,
      firstPossiblePlace:1,lastPossiblePlace:1},
    {roadGroupId:null,riderIds:[...bunch],
      gapAheadOfBunchSeconds:0,
      firstPossiblePlace:2,lastPossiblePlace:ids.length}],
    knownFirstPlaceRiderId:front.riderIds[0],
    riders:ids.map(riderId=>({riderId,
      teamId:byId.get(riderId),
      roadGroupId:riderId===front.riderIds[0]?front.id:null,
      energyAfter:lineEnergy.get(riderId).energy,
      firstPossiblePlace:riderId===front.riderIds[0]?1:2,
      lastPossiblePlace:riderId===front.riderIds[0]?1:ids.length})),
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

// After a paid late catch, all 32 riders reach one road band. Attempted
// sprint movement is recorded but cannot determine a position or award.
export function probeFinaleRotationSoloLateCatchBoundsFromTour(tour,input){
  const run=recordFinaleRotationSoloLateCatchSprintFromTour(tour,input);
  return mergedSoloBounds(tour,run,
    FINALE_ROTATION_SOLO_LATE_CATCH_BOUNDS_VERSION);
}

export function probeFinaleRotationSoloSecondCatchBoundsFromTour(tour,input){
  const run=recordFinaleRotationSoloSecondCatchSprintFromTour(tour,input);
  return mergedSoloBounds(tour,run,
    FINALE_ROTATION_SOLO_SECOND_CATCH_BOUNDS_VERSION);
}

export function probeFinaleRotationSoloFirstCatchBoundsFromTour(tour,input){
  const run=recordFinaleRotationSoloFirstCatchSprintFromTour(tour,input);
  return mergedSoloBounds(tour,run,
    FINALE_ROTATION_SOLO_FIRST_CATCH_BOUNDS_VERSION);
}

function mergedSoloBounds(tour,run,version){
  const ids=run.pelotonRiderIds;
  const {byId,lineEnergy}=verifyLineRiders(tour,ids,
    run.lineRiderEnergy);
  if(run.roadGroups.length!==0)
    throw new Error('Late-catch bounds need one merged line bunch.');
  return {version,
    sourceRunVersion:run.version,lineDistanceM:run.endDistanceM,
    elapsedBunchSecondsFromLastKmStart:run.bunchElapsedSecondsAtLine,
    roadBands:[{roadGroupId:null,riderIds:[...ids],
      gapAheadOfBunchSeconds:0,
      firstPossiblePlace:1,lastPossiblePlace:ids.length}],
    knownFirstPlaceRiderId:null,
    riders:ids.map(riderId=>({riderId,teamId:byId.get(riderId),
      roadGroupId:null,
      energyAfter:lineEnergy.get(riderId).energyAfter,
      movementGainSeconds:lineEnergy.get(riderId).gainSeconds,
      firstPossiblePlace:1,lastPossiblePlace:ids.length})),
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleRotationSoloSecondCatchBoundsFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationSoloSecondCatchBoundsFromTour(tour,input)))
    throw new Error('The solo second-catch bounds do not replay.');
  return true;
}

export function validateFinaleRotationSoloFirstCatchBoundsFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationSoloFirstCatchBoundsFromTour(tour,input)))
    throw new Error('The solo first-catch bounds do not replay.');
  return true;
}

export function validateFinaleRotationSoloFinishBoundsFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationSoloFinishBoundsFromTour(tour,input)))
    throw new Error('The solo finish bounds do not replay.');
  return true;
}

export function validateFinaleRotationSoloLateCatchBoundsFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationSoloLateCatchBoundsFromTour(tour,input)))
    throw new Error('The solo late-catch bounds do not replay.');
  return true;
}
