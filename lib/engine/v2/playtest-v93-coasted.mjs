import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {recordFinaleCoastDroppedLastKmClock,
  validateFinaleCoastDroppedLastKmClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine,
  validateFinaleDepletedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {projectV93ProvisionalCoastedPointPreview} from
  './playtest-point-preview.mjs';

export const V93_COASTED_PLAYTEST_VERSION='v93-coasted-playtest-1';

// A bounded full-race preview: the selected route and all manager tactics
// generate one locked road, followed by a coasted kilometre, nominated
// individual crossings and a read-only policy illustration.
export function createV93CoastedPlaytest(settings,{plans=null,
  pointContext=null}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  validateRecordedTour(recording);
  const clock=recordFinaleCoastDroppedLastKmClock(recording);
  validateFinaleCoastDroppedLastKmClock(recording,clock);
  const individualLine=recordFinaleCoastedIndividualLine(recording,clock,
    {plans});
  const appliedPlans=individualLine.sprintPlan.decisions.map(row=>({
    teamId:row.teamId,finisherId:row.finisherId,
    leadOutRiderId:row.leadOutRiderId}));
  validateFinaleDepletedIndividualLine(recording,clock,
    {plans:appliedPlans},individualLine);
  let pointPreview=null;
  if(pointContext)try{
    pointPreview=projectV93ProvisionalCoastedPointPreview(recording,clock,
      individualLine,pointContext);
  }catch(error){
    if(error.message!=='Preview points need an unambiguous multiband order.')
      throw error;
    pointPreview={status:'unavailable',
      reason:'Tied conditional crossings have no unique point placing.',
      pointsStatus:'withheld',canCommitAwards:false};
  }
  return {version:V93_COASTED_PLAYTEST_VERSION,
    settings:prepared.settings,recording,clock,individualLine,
    appliedPlans,pointPreview,
    roadStatus:individualLine.roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV93CoastedPlaytest(settings,input,recorded){
  if(!isDeepStrictEqual(recorded,
    createV93CoastedPlaytest(settings,input)))
    throw new Error('The v93 coasted playtest does not replay.');
  return true;
}
