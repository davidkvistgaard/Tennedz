import {isDeepStrictEqual} from 'node:util';
import {recordFinalePaidOneClockContactRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {isPassivePartialContactEligible,
  isChasedPartialContactEligible,
  isChasedPartialAfterLeadOutEligible,
  isPassivePartialAfterLeadOutEligible,
  isChasedPartialActiveLeadOutEligible,
  recordFinalePassivePartialContactFromTour,
  recordFinaleChasedPartialContactFromTour,
  recordFinaleChasedPartialAfterLeadOutFromTour,
  recordFinalePassivePartialAfterLeadOutFromTour,
  recordFinaleChasedPartialActiveLeadOutFromTour} from
  './finale-partial-contact-runner.mjs';
import {createV91EarlyBunchTrial,
  V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION,
  createV91FinaleTrialWithUnifiedRoad} from
  './playtest-finale-trial.mjs';

export const V91_CONDITIONAL_RACE_FINAL_VERSION=
  'v91-conditional-race-final-1';
export const V91_INACTIVE_INTENTS_RACE_FINAL_VERSION=
  'v91-conditional-race-final-2';
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

function assertPaidConditionalLine(tour,finale){
  if(!finale?.finishers)return;
  const expected=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const last=finale.frames?.at(-1);
  const atLine=new Map(last?.riders?.map(row=>[row.riderId,row])??[]);
  if(!expected.size||!Array.isArray(finale.finishers)||
    finale.finishers.length!==expected.size||
    atLine.size!==expected.size||
    last.riders.length!==expected.size||
    finale.lineDistanceM!==tour.route.distanceKm*1000||
    finale.pointsStatus!=='withheld'||finale.canCommitAwards!==false)
    throw new Error('The conditional line lost its locked field.');
  const seen=new Set();
  for(const finisher of finale.finishers){
    const row=atLine.get(finisher.riderId);
    if(seen.has(finisher.riderId)||
      expected.get(finisher.riderId)!==finisher.teamId||!row||
      !Number.isFinite(finisher.elapsedSecondsFromLastKmStart)||
      finisher.elapsedSecondsFromLastKmStart<=0||
      !Number.isFinite(finisher.energyAtLine)||
      finisher.energyAtLine<0||
      Math.abs(row.positionM-finale.lineDistanceM)>EPSILON||
      Math.abs(row.elapsedToLineSeconds-
        finisher.elapsedSecondsFromLastKmStart)>EPSILON||
      Math.abs(row.energyAfter-finisher.energyAtLine)>EPSILON)
      throw new Error('The conditional line differs from paid rider travel.');
    seen.add(finisher.riderId);
  }
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
  const partialContinuation=!canMerge&&oneClock&&
    isPassivePartialContactEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinalePassivePartialContactFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const chasedContinuation=!canMerge&&!partialContinuation&&oneClock&&
    isChasedPartialContactEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinaleChasedPartialContactFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const postLeadOutContinuation=!canMerge&&!partialContinuation&&
    !chasedContinuation&&oneClock&&
    isChasedPartialAfterLeadOutEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinaleChasedPartialAfterLeadOutFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const passivePostLeadOut=!canMerge&&!partialContinuation&&
    !chasedContinuation&&!postLeadOutContinuation&&oneClock&&
    isPassivePartialAfterLeadOutEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinalePassivePartialAfterLeadOutFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const activeLeadOutContact=!canMerge&&!partialContinuation&&
    !chasedContinuation&&!postLeadOutContinuation&&
    !passivePostLeadOut&&oneClock&&
    isChasedPartialActiveLeadOutEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinaleChasedPartialActiveLeadOutFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const paidFinale=contactContinuation??partialContinuation??
    chasedContinuation??postLeadOutContinuation??passivePostLeadOut??
    activeLeadOutContact??
    trial.paidFinale;
  assertPaidConditionalLine(trial.recording,paidFinale);
  const roadStatus=paidFinale?.finishers?
    'paid_conditional_line':oneClock?.outcome==='contact_uncontinued'?
      wholeBunchAtContact(oneClock)?
        'unsupported_post_contact_lead_out':
        'unsupported_partial_contact':'unsupported_road_outcome';
  return {version:trial.version===
    V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION?
    V91_INACTIVE_INTENTS_RACE_FINAL_VERSION:
    V91_CONDITIONAL_RACE_FINAL_VERSION,
    settings:trial.settings,recording:trial.recording,
    attackIntent:trial.attackIntent??null,
    finalePlans:trial.finalePlans,
    sourceTrialVersion:trial.version,
    roadDecision:trial.decision??null,
    preContactFinale:contactContinuation||partialContinuation||
    chasedContinuation||postLeadOutContinuation||passivePostLeadOut||
    activeLeadOutContact?
      oneClock:null,
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
