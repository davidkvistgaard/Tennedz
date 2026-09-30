// Explicit accounting handoff for an isolated simulated stage. The caller
// supplies official classified times; provisional lab results are never
// silently promoted into the general classification.
import {validateRecordedTour} from './recording.mjs';
import {startGeneralClassification,recordGeneralClassificationStage} from
  './classification.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function classifyTacticalStage({recording,stageId,classifiedTimes}){
  validateRecordedTour(recording);
  const previous=recording.committedInputs.classification??
    startGeneralClassification({raceCategory:recording.raceCategory,
      riders:recording.committedInputs.teams.flatMap(team=>team.riders.map(rider=>({
        riderId:rider.id,teamId:team.id,gender:rider.gender,
      })))});
  return recordGeneralClassificationStage(previous,{stageId,classifiedTimes});
}

// Experimental condition carry, separate from official stage timing. The
// returned riders need new stage-specific orders before another simulation.
export function carryStageFatigue({recording,restDays=0}){
  if(!Number.isInteger(restDays)||restDays<0||restDays>10)
    throw new Error('Rest days must be an integer from zero to ten.');
  validateRecordedTour(recording);
  if(recording.tuningVersion!==TUNING_VERSION)
    throw new Error('Cannot carry fatigue across different tuning versions.');
  const finalEnergy=new Map(recording.frames.at(-1).riderGroups.map(rider=>[
    rider.id,rider.energy,
  ]));
  const tune=TUNING.stageRace;
  return {version:1,tuningVersion:TUNING_VERSION,raceCategory:recording.raceCategory,
    teams:recording.committedInputs.teams.map(team=>({
    id:team.id,riders:team.riders.map(rider=>{
      const cap=100-rider.fatigue*tune.initialEnergyFatigueFactor;
      const ending=finalEnergy.get(rider.id);
      if(!Number.isFinite(ending)||ending>cap+.001)
        throw new Error('Final energy exceeds the rider’s stage capacity.');
      const spent=Math.max(0,cap-ending);
      return {...rider,fatigue:+clamp(rider.fatigue+
        spent*tune.fatiguePerSpentEnergy-tune.overnightRecovery-
        restDays*tune.restDayRecovery,0,100).toFixed(2)};
    }),
    }))};
}

// Keep the two independently supplied next-stage inputs tied to one recording.
// The caller still supplies official classified times and new stage orders.
export function createStageHandoff({recording,stageId,classifiedTimes,restDays=0}){
  const classification=classifyTacticalStage({recording,stageId,classifiedTimes});
  const condition=carryStageFatigue({recording,restDays});
  return {classification,condition};
}
