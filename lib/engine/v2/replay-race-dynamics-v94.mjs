// Internal deterministic source replay for the opt-in race-dynamics recording.
// This runs the same model again; it is not an independent physics oracle.
import {isDeepStrictEqual} from 'node:util';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from './tuning.mjs';

export function replayRaceDynamicsRecording(recording){
  if(recording?.tuningVersion!==MOTOR_RACE_DYNAMICS_VERSION)
    throw new Error('Race-dynamics replay requires v94.');
  validateRecordedTour(recording);
  const source=recording.committedInputs;
  if(source.stageSourceVersion!==1||!source.stageSource||
    !Object.hasOwn(source,'weatherSource'))
    throw new Error('Race-dynamics replay lacks locked stage source.');
  const replay=simulateTacticalTour({stage:source.stageSource,
    weather:source.weatherSource,teams:source.teams,
    classification:source.classification,seed:recording.raceSeed,
    raceContext:source.raceContext,rivalIntent:source.rivalIntent??null,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION});
  if(!isDeepStrictEqual(replay.route,recording.route))
    throw new Error('Race-dynamics replay route differs from source.');
  for(let index=0;index<replay.frames.length;index++)
    if(!isDeepStrictEqual(replay.frames[index],recording.frames[index]))
      throw new Error(`Race-dynamics replay differs at km ${index+1}.`);
  if(replay.frames.length!==recording.frames.length||
    !isDeepStrictEqual(replay.provisionalResults,recording.provisionalResults))
    throw new Error('Race-dynamics replay finish differs from source.');
  return replay;
}
