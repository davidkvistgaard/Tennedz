import {isDeepStrictEqual} from 'node:util';
import {recordFinaleRotationCatchSprintRunFromTour} from
  './finale-sprint-run.mjs';

export const FINALE_ROTATION_CATCH_FINISH_BOUNDS_VERSION=
  'v2-finale-rotation-catch-finish-bounds-2';

// The short-step trace proves every rider reaches the line in the same road
// band. It has no within-bunch position or passing evidence. A movement gain
// cannot narrow an individual placing or be used for an official award.
export function probeFinaleRotationCatchFinishBoundsFromTour(tour,input){
  const run=recordFinaleRotationCatchSprintRunFromTour(tour,input);
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const ids=run.frames.at(-1).pelotonRiderIds;
  const lineEnergy=new Map(run.lineRiderEnergy.map(row=>
    [row.riderId,row]));
  if(ids.length!==ridersById.size||new Set(ids).size!==ids.length||
    ids.some(id=>!ridersById.has(id)||!lineEnergy.has(id))||
    lineEnergy.size!==ids.length)
    throw new Error('The finish bounds need one complete line bunch.');
  return {version:FINALE_ROTATION_CATCH_FINISH_BOUNDS_VERSION,
    sourceRunVersion:run.version,lineDistanceM:run.endDistanceM,
    elapsedSecondsFromLastKmStart:run.bunchElapsedSecondsAtLine,
    roadBands:[{roadGroupId:null,riderIds:[...ids],
      firstPossiblePlace:1,lastPossiblePlace:ids.length}],
    riders:ids.map(riderId=>({riderId,teamId:ridersById.get(riderId),
      roadGroupId:null,energyAfter:lineEnergy.get(riderId).energyAfter,
      movementGainSeconds:lineEnergy.get(riderId).gainSeconds,
      firstPossiblePlace:1,lastPossiblePlace:ids.length}))};
}

export function validateFinaleRotationCatchFinishBoundsFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    probeFinaleRotationCatchFinishBoundsFromTour(tour,input)))
    throw new Error('The rotating-catch finish bounds do not replay.');
  return true;
}
