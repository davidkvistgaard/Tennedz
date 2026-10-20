import {isDeepStrictEqual} from 'node:util';
import {recordFinalePaidOneClockContactRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {isPassivePartialContactEligible,
  isChasedPartialContactEligible,
  isChasedPartialAfterLeadOutEligible,
  isPassivePartialAfterLeadOutEligible,
  isChasedPartialActiveLeadOutEligible,
  isPassivePartialActiveRivalLeadOutEligible,
  recordFinalePassivePartialContactFromTour,
  recordFinaleChasedPartialContactFromTour,
  recordFinaleChasedPartialAfterLeadOutFromTour,
  recordFinalePassivePartialAfterLeadOutFromTour,
  recordFinaleChasedPartialActiveLeadOutFromTour,
  recordFinalePassivePartialActiveRivalLeadOutFromTour} from
  './finale-partial-contact-runner.mjs';
import {createV91EarlyBunchTrial,createV91VerifiedEarlyBunchTrial,
  createV91VerifiedEarlyBunchTrialFromLockedRace,
  V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION,
  V91_VERIFIED_INACTIVE_ASSEMBLY_BUNCH_TRIAL_VERSION,
  createV91FinaleTrialWithUnifiedRoad} from
  './playtest-finale-trial.mjs';
import {prepareV91Playtest} from './playtest.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  FINALE_LAST_KM_ALL_INTENTS_VERSION} from
  './finale-last-km-named-intents.mjs';
import {simulateFinaleCooperativeGroupCommonClock} from
  './finale-group-common-clock.mjs';
import {selectiveFinaleChaseDecision} from './finale-multi-run.mjs';
import {recordFinaleGroupResultBounds} from
  './finale-group-result-bounds.mjs';
import {recordFinaleSeparatedLastKmClock,
  recordFinaleDepletedLastKmClock,
  recordFinaleNoFrontDroppedLastKmClock} from
  './finale-separated-last-km.mjs';
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
export const V91_TWO_TEAM_CHASE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-6';
export const V91_SEPARATED_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-7';
export const V91_DEPLETED_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-8';
export const V91_NO_FRONT_DROPPED_RACE_FINAL_VERSION=
  'v91-conditional-race-final-9';
export const V91_VERIFIED_ASSEMBLY_RACE_FINAL_VERSION=
  'v91-conditional-race-final-10';
export const V91_VERIFIED_INACTIVE_ASSEMBLY_RACE_FINAL_VERSION=
  'v91-conditional-race-final-11';
export const V91_UNAVAILABLE_CHASE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-12';
export const V91_UNAVAILABLE_SELECTIVE_CHASE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-13';
export const V91_RECORDED_SELECTIVE_CHASE_GROUP_RACE_FINAL_VERSION=
  'v91-conditional-race-final-14';
const EPSILON=1e-8;

function cooperativeGroupFinal(plans,lockedRace){
  if(!lockedRace?.recording)
    throw new Error('A group fallback needs the locked kilometre race.');
  const {settings:prepared,recording}=lockedRace;
  const refuse=message=>{
    throw new Error(message,{cause:{playtestSource:lockedRace}});
  };
  const snapshot=finaleSnapshotFromTour(recording,{
    remainingKm:1,includeAttackLoad:true});
  const intents=recordFinaleLastKmNamedIntentsFromTour(recording,{
    version:FINALE_LAST_KM_ALL_INTENTS_VERSION});
  if(snapshot.roadGroups.length===0&&
    snapshot.droppedRiderIds.length>0){
    if(plans!==null)
      refuse('Finisher and lead-out plans are not paid for dropped road bands.');
    const paidFinale=recordFinaleNoFrontDroppedLastKmClock(recording);
    return {version:V91_NO_FRONT_DROPPED_RACE_FINAL_VERSION,
      settings:prepared,recording,attackIntent:null,finalePlans:null,
      finalePlanStatus:'unapplied_dropped_bands',
      sourceTrialVersion:null,roadDecision:intents,preContactFinale:null,
      paidFinale,roadStatus:'recorded_dropped_bands',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false};
  }
  if(snapshot.roadGroups.length>=1&&
    snapshot.droppedRiderIds.length>0){
    if(plans!==null)
      refuse('Finisher and lead-out plans are not paid for depleted road bands.');
    const paidFinale=recordFinaleDepletedLastKmClock(recording);
    return {version:V91_DEPLETED_GROUP_RACE_FINAL_VERSION,
      settings:prepared,recording,attackIntent:null,finalePlans:null,
      finalePlanStatus:'unapplied_depleted_bands',
      sourceTrialVersion:null,roadDecision:intents,preContactFinale:null,
      paidFinale,roadStatus:'recorded_depleted_bands',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false};
  }
  if(snapshot.roadGroups.length>=2&&
    snapshot.droppedRiderIds.length===0){
    if(plans!==null)
      refuse('Finisher and lead-out plans are not paid for road groups.');
    const paidFinale=recordFinaleSeparatedLastKmClock(recording);
    return {version:V91_SEPARATED_GROUP_RACE_FINAL_VERSION,
      settings:prepared,recording,attackIntent:null,finalePlans:null,
      finalePlanStatus:'unapplied_group_bands',
      sourceTrialVersion:null,roadDecision:intents,preContactFinale:null,
      paidFinale,roadStatus:'paid_separated_bands',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false};
  }
  const source=recording.frames[snapshot.sourceKm-1];
  const frontTeamIds=new Set(snapshot.roadGroups[0]?.teamIds??[]);
  const ownBreakChaseOrders=recording.committedInputs.teams.filter(team=>
    orderAt(team.orders,recording.route.distanceKm-1).chase!=='ignore');
  const externalChaseOrders=ownBreakChaseOrders.filter(team=>
    !frontTeamIds.has(team.id));
  const sourceRiders=new Map(snapshot.riders.map(row=>
    [row.riderId,row]));
  const unavailableChaseTeamIds=externalChaseOrders.filter(team=>
    team.orders.helperIds.every(id=>{
      const rider=sourceRiders.get(id);
      return rider?.roadGroupId!=='peloton'||
        rider.energy<TUNING.chase.minHelperEnergy;
    })).map(team=>team.id);
  const unavailableOrderedChase=externalChaseOrders.length>0&&
    unavailableChaseTeamIds.length===externalChaseOrders.length;
  // A team protecting its active leader in the front group cannot chase that
  // leader. A team behind it cannot begin a chase without an eligible helper.
  // Any other selective order still needs a short-step chase decision.
  const frontRiderIds=new Set(snapshot.roadGroups[0]?.riderIds??[]);
  const protectedFrontSelectiveTeamIds=new Set(
    recording.committedInputs.teams.filter(team=>
      team.orders.forwardResponse==='protect_forward'&&
      source.activeLeaders.some(row=>row.teamId===team.id&&
        frontRiderIds.has(row.riderId))).map(team=>team.id));
  const unavailableSelectiveChaseTeamIds=
    intents.unresolvedSelectiveChaseTeamIds.filter(id=>
      unavailableChaseTeamIds.includes(id));
  const payableSelectiveChaseTeamIds=
    intents.unresolvedSelectiveChaseTeamIds.filter(id=>
      !protectedFrontSelectiveTeamIds.has(id)&&
      !unavailableChaseTeamIds.includes(id));
  const noChase=ownBreakChaseOrders.every(team=>
    frontTeamIds.has(team.id))||unavailableOrderedChase;
  const passiveChase=noChase&&source.chasers.length===0&&
    ['activeBreakResponseTeamIds','activeGcResponseTeamIds',
      'engagedChaseTeamIds'].every(key=>source[key].length===0);
  const chaseIds=new Set(source.chasers);
  const chaseTeams=source.chasers.map(id=>
    recording.committedInputs.teams.find(team=>team.id===id));
  const paidChase=[1,2].includes(source.chasers.length)&&
    chaseIds.size===source.chasers.length&&
    chaseTeams.every(team=>team&&!frontTeamIds.has(team.id)&&
      orderAt(team.orders,recording.route.distanceKm-1).chase==='all')&&
    ownBreakChaseOrders.every(team=>
      frontTeamIds.has(team.id)||chaseIds.has(team.id))&&
    source.engagedChaseTeamIds.length===source.chasers.length&&
    new Set(source.engagedChaseTeamIds).size===chaseIds.size&&
    source.engagedChaseTeamIds.every(id=>chaseIds.has(id))&&
    source.chaseReasons.length===source.chasers.length&&
    new Set(source.chaseReasons.map(row=>row.teamId)).size===chaseIds.size&&
    source.chaseReasons.every(row=>chaseIds.has(row.teamId)&&
      row.reason==='ordered_all')&&
    source.heldChaseTeamIds.length===0&&
    ['activeBreakResponseTeamIds','activeGcResponseTeamIds']
      .every(key=>source[key].length===0);
  const selectiveChaseTeam=source.chasers.length===1?
    recording.committedInputs.teams.find(team=>
      team.id===source.chasers[0]):null;
  const recordedSelectiveChase=Boolean(selectiveChaseTeam&&
    !frontTeamIds.has(selectiveChaseTeam.id)&&
    externalChaseOrders.length===1&&
    externalChaseOrders[0].id===selectiveChaseTeam.id&&
    orderAt(selectiveChaseTeam.orders,
      recording.route.distanceKm-1).chase==='selective'&&
    source.engagedChaseTeamIds.length===1&&
    source.engagedChaseTeamIds[0]===selectiveChaseTeam.id&&
    source.chaseReasons.length===1&&
    source.chaseReasons[0].teamId===selectiveChaseTeam.id&&
    source.chaseReasons[0].reason==='gap_over_limit'&&
    source.heldChaseTeamIds.length===0&&
    ['activeBreakResponseTeamIds','activeGcResponseTeamIds']
      .every(key=>source[key].length===0));
  const unresolvedSelectiveChaseTeamIds=payableSelectiveChaseTeamIds
    .filter(id=>!recordedSelectiveChase||id!==selectiveChaseTeam.id);
  if(snapshot.roadGroups.length!==1||snapshot.droppedRiderIds.length||
    !passiveChase&&!paidChase&&!recordedSelectiveChase||
    intents.named.some(row=>row.canEnterRoadContest)||
    intents.unnamed.some(row=>row.canEnterRoadContest)||
    intents.otherPendingActions.length||
    unresolvedSelectiveChaseTeamIds.length)
    refuse('The cooperative group has an unresolved last-kilometre road action.');
  if(plans!==null)
    refuse('Finisher and lead-out plans are not paid for a road group.');
  const pelotonIds=new Set(snapshot.peloton.riderIds);
  const sourceEnergy=new Map(snapshot.riders.map(row=>[
    row.riderId,row.energy]));
  const chasePullRiderIds=paidChase||recordedSelectiveChase?chaseTeams.map(team=>
    team.orders.helperIds.filter(id=>pelotonIds.has(id)&&
      sourceEnergy.get(id)>=TUNING.chase.minHelperEnergy)
      .map(id=>({id,energy:sourceEnergy.get(id),
        speedKph:finaleWorkerStep({
          rider:team.riders.find(rider=>rider.id===id),
          segment:recording.route.kilometres[snapshot.sourceKm-1],
          order:orderAt(team.orders,snapshot.sourceKm-1),
          energy:sourceEnergy.get(id),role:'chase',
          paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION}).speedKph}))
      .sort((a,b)=>b.speedKph-a.speedKph||b.energy-a.energy||
        a.id.localeCompare(b.id))[0]?.id??null):[];
  if(chasePullRiderIds.includes(null))
    throw new Error('The recorded chase has no payable nominated helper.');
  const chasePullRiderId=chasePullRiderIds[0]??null;
  const chaseRotationRiderIds=chasePullRiderIds.length===2?
    finaleDistanceGrid(recording.route,{remainingKm:1}).map((_,index)=>
      chasePullRiderIds[index%2]):null;
  let paidFinale;
  try{
    paidFinale=simulateFinaleCooperativeGroupCommonClock({
      route:recording.route,snapshot,teams:recording.committedInputs.teams,
      frontPullRiderId:null,chasePullRiderId,
      passiveChase:!paidChase&&!recordedSelectiveChase,
      ...(paidChase||recordedSelectiveChase?{bunchPaceFloor:true}:{}),
      ...(chaseRotationRiderIds?{chaseRotationRiderIds}:{}),
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
      cooperativeFront:true});
  }catch(error){
    if(unavailableOrderedChase&&error.message.startsWith(
      'A finale group rider cannot spend energy they do not have:'))
      refuse('The cooperative group has unpaid last-kilometre rider travel.');
    throw error;
  }
  const selectiveChaseDecisions=recordedSelectiveChase?
    paidFinale.line.approachFrames.map((frame,index)=>{
      const priorGap=index===0?snapshot.roadGroups[0].gapSeconds:
        paidFinale.line.approachFrames[index-1].roadGroups[0].gapSeconds;
      const decision=selectiveFinaleChaseDecision({
        team:selectiveChaseTeam,awareBefore:true,
        rearGapSeconds:priorGap,leadingGapSeconds:priorGap,
        remainingKm:(recording.route.distanceKm*1000-
          frame.startDistanceM)/1000});
      return {startDistanceM:frame.startDistanceM,
        gapSeconds:priorGap,decision:decision.decision};
    }):null;
  if(selectiveChaseDecisions?.some(row=>row.decision!=='engaged')||
    recordedSelectiveChase&&paidFinale.line.outcome!=='survived')
    refuse('The selective chase needs a recorded last-kilometre change.');
  const expected=new Set(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  const finalEnergy=paidFinale.line.finalRiderEnergy;
  if(finalEnergy.length!==expected.size||
    new Set(finalEnergy.map(row=>row.riderId)).size!==expected.size||
    finalEnergy.some(row=>!expected.has(row.riderId)||
      !Number.isFinite(row.energy)||row.energy<0))
    throw new Error('The cooperative group lost its locked field.');
  const roadPlaceBounds=recordFinaleGroupResultBounds(recording,paidFinale,
    {chasePullRiderId,chaseRotationRiderIds});
  return {version:chaseRotationRiderIds?
    V91_TWO_TEAM_CHASE_GROUP_RACE_FINAL_VERSION:
    paidChase?
    V91_ONE_TEAM_CHASE_GROUP_RACE_FINAL_VERSION:
    recordedSelectiveChase?
    V91_RECORDED_SELECTIVE_CHASE_GROUP_RACE_FINAL_VERSION:
    unavailableSelectiveChaseTeamIds.length?
    V91_UNAVAILABLE_SELECTIVE_CHASE_GROUP_RACE_FINAL_VERSION:
    unavailableOrderedChase?
    V91_UNAVAILABLE_CHASE_GROUP_RACE_FINAL_VERSION:
    ownBreakChaseOrders.length?
    V91_OWN_BREAK_GROUP_RACE_FINAL_VERSION:
    V91_COOPERATIVE_GROUP_RACE_FINAL_VERSION,
    settings:prepared,recording,attackIntent:null,finalePlans:null,
    finalePlanStatus:'unapplied_group_band',
    sourceTrialVersion:null,roadDecision:intents,preContactFinale:null,
    ...(unavailableOrderedChase?{chaseAvailability:{
      sourceDistanceM:snapshot.startDistanceM,
      orderedExternalTeamIds:externalChaseOrders.map(team=>team.id),
      unavailableTeamIds:unavailableChaseTeamIds,
      ...(unavailableSelectiveChaseTeamIds.length?{
        unavailableSelectiveTeamIds:unavailableSelectiveChaseTeamIds}:{}),
      reason:'no_external_helper_above_minimum_energy'}}:{}),
    ...(recordedSelectiveChase?{selectiveChaseDecision:{
      teamId:selectiveChaseTeam.id,sourceReason:'gap_over_limit',
      chasePullRiderId,decisions:selectiveChaseDecisions}}:{}),
    paidFinale,roadPlaceBounds,roadStatus:'paid_group_bands',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// The offline individual-band experiment reuses the exact kilometre source
// already carried by a refused group plan. This keeps the older conditional
// race-final versions and their replay shapes unchanged.
export function createV91GroupFallbackFromLockedRace(lockedRace){
  return cooperativeGroupFinal(null,lockedRace);
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
function createConditionalRaceFinal(settings,request={},verifiedAssembly=true,
  lockedRace=null){
  if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).some(key=>
      !['attackTeamId','attackRiderId','plans'].includes(key)))
    throw new Error('Choose supported conditional race orders.');
  const {attackTeamId=null,attackRiderId=null,plans=null}=request;
  if((attackTeamId===null)!==(attackRiderId===null))
    throw new Error('Choose both a team and rider for a named attack.');
  const namedAttack=attackTeamId!==null;
  if(lockedRace&&(!verifiedAssembly||namedAttack||
    !isDeepStrictEqual(prepareV91Playtest(settings).settings,
      lockedRace.settings)))
    throw new Error('The locked bunch race differs from its request.');
  let trial;
  try{
    trial=namedAttack?
      createV91FinaleTrialWithUnifiedRoad(settings,{
        attackTeamId,attackRiderId,plans}):
      lockedRace?createV91VerifiedEarlyBunchTrialFromLockedRace(
        lockedRace,{plans}):
      (verifiedAssembly?createV91VerifiedEarlyBunchTrial:
        createV91EarlyBunchTrial)(settings,{plans});
  }catch(error){
    if(namedAttack||![
      'The inactive-intents bunch has an unresolved road action.',
      'An early bunch plan needs one inactive-attack bunch.'
    ].includes(error.message))throw error;
    return cooperativeGroupFinal(plans,error.cause?.playtestSource);
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
  const passiveRivalLeadOutContact=!canMerge&&!partialContinuation&&
    !chasedContinuation&&!postLeadOutContinuation&&
    !passivePostLeadOut&&!activeLeadOutContact&&oneClock&&
    isPassivePartialActiveRivalLeadOutEligible(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock)?
    recordFinalePassivePartialActiveRivalLeadOutFromTour(trial.recording,{
      attackTeamId,plans:trial.finalePlans},oneClock):null;
  const paidFinale=contactContinuation??partialContinuation??
    chasedContinuation??postLeadOutContinuation??passivePostLeadOut??
    activeLeadOutContact??passiveRivalLeadOutContact??
    trial.paidFinale;
  assertPaidConditionalLine(trial.recording,paidFinale);
  const roadStatus=paidFinale?.finishers?
    'paid_conditional_line':oneClock?.outcome==='contact_uncontinued'?
      wholeBunchAtContact(oneClock)?
        'unsupported_post_contact_lead_out':
        'unsupported_partial_contact':'unsupported_road_outcome';
  return {version:namedAttack?
    V91_CONDITIONAL_RACE_FINAL_VERSION:
    verifiedAssembly?
      trial.version===V91_VERIFIED_INACTIVE_ASSEMBLY_BUNCH_TRIAL_VERSION?
        V91_VERIFIED_INACTIVE_ASSEMBLY_RACE_FINAL_VERSION:
        V91_VERIFIED_ASSEMBLY_RACE_FINAL_VERSION:
      trial.version===V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION?
        V91_INACTIVE_INTENTS_RACE_FINAL_VERSION:
        V91_CONDITIONAL_RACE_FINAL_VERSION,
    settings:trial.settings,recording:trial.recording,
    attackIntent:trial.attackIntent??null,
    finalePlans:trial.finalePlans,
    sourceTrialVersion:trial.version,
    roadDecision:trial.decision??null,
    preContactFinale:contactContinuation||partialContinuation||
    chasedContinuation||postLeadOutContinuation||passivePostLeadOut||
    activeLeadOutContact||passiveRivalLeadOutContact?
      oneClock:null,
    paidFinale,roadStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function createV91ConditionalRaceFinal(settings,request={}){
  return createConditionalRaceFinal(settings,request,true);
}

export function createV91ConditionalRaceFinalFromLockedRace(settings,request,
  lockedRace){
  if(!lockedRace?.recording)
    throw new Error('A locked bunch race is required.');
  return createConditionalRaceFinal(settings,request,true,lockedRace);
}

// Older complete-bunch recordings keep their original labels and replay.
export function createV91LegacyConditionalRaceFinal(settings,request={}){
  return createConditionalRaceFinal(settings,request,false);
}

export function validateV91ConditionalRaceFinal(settings,request,recorded){
  const legacy=[V91_CONDITIONAL_RACE_FINAL_VERSION,
    V91_INACTIVE_INTENTS_RACE_FINAL_VERSION].includes(recorded?.version)&&
    !request?.attackTeamId;
  if(!isDeepStrictEqual(recorded,
    createConditionalRaceFinal(settings,request,!legacy)))
    throw new Error('The conditional race final does not replay.');
  return true;
}
