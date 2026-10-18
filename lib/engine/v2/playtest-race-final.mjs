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
import {createV91Playtest} from './playtest.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  FINALE_LAST_KM_ALL_INTENTS_VERSION} from
  './finale-last-km-named-intents.mjs';
import {simulateFinaleCooperativeGroupCommonClock} from
  './finale-group-common-clock.mjs';
import {recordFinaleGroupResultBounds} from
  './finale-group-result-bounds.mjs';
import {finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const V91_CONDITIONAL_RACE_FINAL_VERSION=
  'v91-conditional-race-final-1';
export const V91_INACTIVE_INTENTS_RACE_FINAL_VERSION=
  'v91-conditional-race-final-2';
export const V91_COOPERATIVE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-3';
export const V91_OWN_BREAK_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-4';
export const V91_ONE_TEAM_CHASE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-5';
const EPSILON=1e-8;

function cooperativeGroupFinal(settings,plans){
  const {settings:prepared,recording}=createV91Playtest(settings);
  const snapshot=finaleSnapshotFromTour(recording,{
    remainingKm:1,includeAttackLoad:true});
  const intents=recordFinaleLastKmNamedIntentsFromTour(recording,{
    version:FINALE_LAST_KM_ALL_INTENTS_VERSION});
  const source=recording.frames[snapshot.sourceKm-1];
  const frontTeamIds=new Set(snapshot.roadGroups[0]?.teamIds??[]);
  const ownBreakChaseOrders=recording.committedInputs.teams.filter(team=>
    orderAt(team.orders,recording.route.distanceKm-1).chase!=='ignore');
  const noChase=ownBreakChaseOrders.every(team=>
    frontTeamIds.has(team.id))&&source.chasers.length===0&&
    ['activeBreakResponseTeamIds','activeGcResponseTeamIds',
      'engagedChaseTeamIds'].every(key=>source[key].length===0);
  const chaseTeamId=source.chasers.length===1?
    source.chasers[0]:null;
  const chaseTeam=recording.committedInputs.teams.find(team=>
    team.id===chaseTeamId);
  const onePaidChase=chaseTeam!==undefined&&chaseTeamId!==null&&
    !frontTeamIds.has(chaseTeamId)&&
    orderAt(chaseTeam.orders,recording.route.distanceKm-1).chase==='all'&&
    ownBreakChaseOrders.every(team=>
      frontTeamIds.has(team.id)||team.id===chaseTeamId)&&
    source.engagedChaseTeamIds.length===1&&
    source.engagedChaseTeamIds[0]===chaseTeamId&&
    source.chaseReasons.length===1&&
    source.chaseReasons[0].teamId===chaseTeamId&&
    source.chaseReasons[0].reason==='ordered_all'&&
    source.heldChaseTeamIds.length===0&&
    ['activeBreakResponseTeamIds','activeGcResponseTeamIds']
      .every(key=>source[key].length===0);
  if(snapshot.roadGroups.length!==1||snapshot.droppedRiderIds.length||
    !noChase&&!onePaidChase||
    intents.named.some(row=>row.canEnterRoadContest)||
    intents.unnamed.some(row=>row.canEnterRoadContest)||
    intents.otherPendingActions.length||
    intents.unresolvedSelectiveChaseTeamIds.length)
    throw new Error('The cooperative group has an unresolved last-kilometre road action.');
  if(plans!==null)
    throw new Error('Finisher and lead-out plans are not paid for a road group.');
  const pelotonIds=new Set(snapshot.peloton.riderIds);
  const sourceEnergy=new Map(snapshot.riders.map(row=>[
    row.riderId,row.energy]));
  const chasePullRiderId=onePaidChase?
    chaseTeam.orders.helperIds.filter(id=>pelotonIds.has(id)&&
      sourceEnergy.get(id)>=TUNING.chase.minHelperEnergy)
      .map(id=>({id,energy:sourceEnergy.get(id),
        speedKph:finaleWorkerStep({
          rider:chaseTeam.riders.find(rider=>rider.id===id),
          segment:recording.route.kilometres[snapshot.sourceKm-1],
          order:orderAt(chaseTeam.orders,snapshot.sourceKm-1),
          energy:sourceEnergy.get(id),role:'chase',
          paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION}).speedKph}))
      .sort((a,b)=>b.speedKph-a.speedKph||b.energy-a.energy||
        a.id.localeCompare(b.id))[0]?.id??null:null;
  if(onePaidChase&&chasePullRiderId===null)
    throw new Error('The recorded chase has no payable nominated helper.');
  const paidFinale=simulateFinaleCooperativeGroupCommonClock({
    route:recording.route,snapshot,teams:recording.committedInputs.teams,
    frontPullRiderId:null,chasePullRiderId,
    passiveChase:!onePaidChase,
    ...(onePaidChase?{bunchPaceFloor:true}:{}),
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
    cooperativeFront:true});
  const expected=new Set(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  const finalEnergy=paidFinale.line.finalRiderEnergy;
  if(finalEnergy.length!==expected.size||
    new Set(finalEnergy.map(row=>row.riderId)).size!==expected.size||
    finalEnergy.some(row=>!expected.has(row.riderId)||
      !Number.isFinite(row.energy)||row.energy<0))
    throw new Error('The cooperative group lost its locked field.');
  const roadPlaceBounds=recordFinaleGroupResultBounds(recording,paidFinale,
    {chasePullRiderId});
  return {version:onePaidChase?
    V91_ONE_TEAM_CHASE_GROUP_RACE_FINAL_VERSION:
    ownBreakChaseOrders.length?
    V91_OWN_BREAK_GROUP_RACE_FINAL_VERSION:
    V91_COOPERATIVE_GROUP_RACE_FINAL_VERSION,
    settings:prepared,recording,attackIntent:null,finalePlans:null,
    finalePlanStatus:'unapplied_group_band',
    sourceTrialVersion:null,roadDecision:intents,preContactFinale:null,
    paidFinale,roadPlaceBounds,roadStatus:'paid_group_bands',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

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
  let trial;
  try{
    trial=namedAttack?
      createV91FinaleTrialWithUnifiedRoad(settings,{
        attackTeamId,attackRiderId,plans}):
      createV91EarlyBunchTrial(settings,{plans});
  }catch(error){
    if(namedAttack||![
      'The inactive-intents bunch has an unresolved road action.',
      'An early bunch plan needs one inactive-attack bunch.'
    ].includes(error.message))throw error;
    return cooperativeGroupFinal(settings,plans);
  }
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
