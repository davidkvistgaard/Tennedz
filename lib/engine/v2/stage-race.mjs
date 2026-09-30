// Explicit accounting handoff for an isolated simulated stage. The caller
// supplies official classified times; provisional lab results are never
// silently promoted into the general classification.
import {validateRecordedTour} from './recording.mjs';
import {startGeneralClassification,recordGeneralClassificationStage} from
  './classification.mjs';

export function classifyTacticalStage({recording,stageId,classifiedTimes}){
  validateRecordedTour(recording);
  const previous=recording.committedInputs.classification??
    startGeneralClassification({raceCategory:recording.raceCategory,
      riders:recording.committedInputs.teams.flatMap(team=>team.riders.map(rider=>({
        riderId:rider.id,teamId:team.id,gender:rider.gender,
      })))});
  return recordGeneralClassificationStage(previous,{stageId,classifiedTimes});
}
