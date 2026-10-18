import {isDeepStrictEqual} from 'node:util';
import {recordFinalePaidOneClockContactRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {createV91EarlyBunchTrial,
  createV91FinaleTrialWithUnifiedRoad} from
  './playtest-finale-trial.mjs';

export const V91_CONDITIONAL_RACE_FINAL_VERSION=
  'v91-conditional-race-final-1';
const EPSILON=1e-8;

function wholeBunchAtContact(road){
  const frame=road?.frames.at(-1);
  const contact=road?.contact;
  return road?.outcome==='contact_uncontinued'&&contact&&frame&&
    contact.riderIds.length===frame.riders.length-1&&
    frame.pelotonRiderIds.length===frame.riders.length-1&&
    frame.riders.every(row=>row.elapsedToLineSeconds===null&&
      Math.abs(row.positionM-contact.distanceM)<=EPSILON);
}

// One read-only entry for the currently payable race-to-line branches. This
// joins existing versioned recordings; it does not change their movement or
// promote their conditional crossing order to a classified result.
export function createV91ConditionalRaceFinal(settings,request={}){
  if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).some(key=>
      !['attackTeamId','attackRiderId','plans'].includes(key)))
    throw new Error('Choose supported conditional race orders.');
  const {attackTeamId=null,attackRiderId=null,plans=null}=request;
  if((attackTeamId===null)!==(attackRiderId===null))
    throw new Error('Choose both a team and rider for a named attack.');
  const namedAttack=attackTeamId!==null;
  const trial=namedAttack?
    createV91FinaleTrialWithUnifiedRoad(settings,{
      attackTeamId,attackRiderId,plans}):
    createV91EarlyBunchTrial(settings,{plans});
  const oneClock=trial.decision?.branch==='solo'?
    trial.paidFinale:null;
  const canMerge=wholeBunchAtContact(oneClock)&&
    trial.finalePlans.every(row=>row.leadOutRiderId===null);
  const contactContinuation=canMerge?
    recordFinalePaidOneClockContactRunnerFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const paidFinale=contactContinuation??trial.paidFinale;
  const roadStatus=paidFinale?.finishers?
    'paid_conditional_line':oneClock?.outcome==='contact_uncontinued'?
      wholeBunchAtContact(oneClock)?
        'unsupported_post_contact_lead_out':
        'unsupported_partial_contact':'unsupported_road_outcome';
  return {version:V91_CONDITIONAL_RACE_FINAL_VERSION,
    settings:trial.settings,recording:trial.recording,
    attackIntent:trial.attackIntent??null,
    finalePlans:trial.finalePlans,
    sourceTrialVersion:trial.version,
    roadDecision:trial.decision??null,
    preContactFinale:contactContinuation?oneClock:null,
    paidFinale,roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91ConditionalRaceFinal(settings,request,recorded){
  if(!isDeepStrictEqual(recorded,
    createV91ConditionalRaceFinal(settings,request)))
    throw new Error('The conditional race final does not replay.');
  return true;
}
