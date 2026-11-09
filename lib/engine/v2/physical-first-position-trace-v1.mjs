// Replay a committed race into the opt-in positional contract. A paid
// group-clock road cannot silently become a different rider's front wheel.
import {isDeepStrictEqual} from 'node:util';
import {recordPhysicalFirstRaceV1} from
  './physical-first-race-record-v1.mjs';
import {createPhysicalFirstPositionStartV1} from
  './physical-first-position-start-v1.mjs';
import {advancePhysicalFirstPositionRoadV1} from
  './physical-first-position-road-v1.mjs';

export const PHYSICAL_FIRST_POSITION_TRACE_VERSION=
  'physical-first-position-trace-1';

export function recordPhysicalFirstPositionTraceV1(input,grid,
  {recording}={}){
  const race=recordPhysicalFirstRaceV1(input,{recording});
  const start=createPhysicalFirstPositionStartV1({input,grid});
  const states=[start],checkpointCrossings=[];
  let unsupported=null;
  for(const step of race.recording.steps){
    try{
      const next=advancePhysicalFirstPositionRoadV1(
        states.at(-1),step);
      states.push(next);
      checkpointCrossings.push(...next.checkpointCrossings);
    }catch(error){
      if(error.message!==
        'Position road needs one unchanged paid leader and road.')
        throw error;
      const prior=states.at(-1);
      const movement=[];
      if(step.attackSteps?.length)
        movement.push('attack_launch');
      if(step.peloton?.startDropEvents?.length)
        movement.push('start_drop');
      if(step.otherSteps?.length)
        movement.push('rear_road');
      if(step.boundaryContactEvents?.length||
        step.withinKmContactEvents?.length)
        movement.push('contact');
      if(step.peloton?.road?.leaderRiderId!==
        prior.positions[0].riderId)
        movement.push('leader_change');
      if(step.peloton?.road?.riderIds?.length!==
        prior.positions.length)
        movement.push('membership_change');
      if(!movement.length)
        movement.push('road_motion_disagreement');
      unsupported={sourceKm:step.sourceKm,
        reason:error.message,
        movement,
        currentFrontRiderId:prior.positions[0].riderId,
        paidLeaderRiderId:step.peloton?.road?.leaderRiderId??null};
      break;
    }
  }
  const completedThroughKm=states.at(-1).sourceKm;
  const finishKm=input.kilometres.length;
  const finishCrossings=checkpointCrossings.filter(row=>
    row.km===finishKm);
  const riderCount=start.positions.length;
  return {version:PHYSICAL_FIRST_POSITION_TRACE_VERSION,
    raceSeed:start.raceSeed,inputHash:start.inputHash,
    raceCommitmentHash:race.commitmentHash,
    raceValidatedKm:race.replay.validatedKm,
    plannedKm:finishKm,riderCount,
    completedThroughKm,validatedPositionRiderKm:
      completedThroughKm*riderCount,
    unsupported,states,checkpointCrossings,
    finishCrossings,finishCrossingCoverage:
      `${finishCrossings.length}/${riderCount}`,
    legacyGroupClockPositionsUsed:false,
    officialResults:false};
}

export function replayPhysicalFirstPositionTraceV1(input,grid,
  recorded,{recording}={}){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionTraceV1(input,grid,
      {recording})))
    throw new Error('Position trace differs from committed paid race.');
  return recorded;
}
