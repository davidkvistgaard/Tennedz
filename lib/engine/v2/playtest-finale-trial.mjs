import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';
import {orderAt} from './orders.mjs';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {recordLeadOutConditionalLineFromTour} from
  './finale-lead-out-longitudinal.mjs';
import {recordFinalePaidBunchRunnerFromTour,
  recordFinalePositionedBunchRunnerFromTour,
  recordFinaleIndependentBunchRunnerFromTour,
  recordFinaleAssembledBunchRunnerFromTour,
  recordFinaleEarlyBunchRunnerFromTour,
  recordFinaleInactiveIntentsBunchRunnerFromTour,
  recordFinalePaidPostContactRunnerFromTour,
  recordFinalePaidOneClockContactRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {proveFinaleSoloFirstFromTour} from
  './finale-solo-first-proof.mjs';
import {recordFinaleOneClockSoloFromTour,
  recordFinaleOneClockSoloWithLeadOutFromTour} from
  './finale-one-clock-solo.mjs';
import {decideFinaleRotationSoloOutcomeFromTour} from
  './finale-rotation-solo-slice.mjs';
import {probeFinaleRotationSoloFinishBoundsFromTour,
  probeFinaleRotationSoloFirstCatchBoundsFromTour,
  probeFinaleRotationSoloSecondCatchBoundsFromTour,
  probeFinaleRotationSoloLateCatchBoundsFromTour,
  probeFinaleRotationSoloPenultimateCatchBoundsFromTour,
  probeFinaleRotationSoloFinalContactBoundsFromTour} from
  './finale-rotation-solo-finish-bounds.mjs';

export const V91_FINALE_TRIAL_VERSION='v91-finale-trial-1';
export const V91_FINALE_TRIAL_SOLO_VERSION='v91-finale-trial-2';
export const V91_FINALE_TRIAL_COVERAGE_VERSION='v91-finale-trial-3';

// Read-only motor trial. Playtest preparation validates settings and creates
// the fictional roster; this opt-in branch adds one named last-km attack to
// that same roster. The saved v79/v2 event path is never called.
export function prepareV91FinaleTrial(settings,{attackTeamId,
  attackRiderId,plans,leadOutTiming='late'}={}){
  const base=prepareV91Playtest(settings);
  const {distanceKm,seed}=base.settings;
  const roster=[...base.teams].sort((a,b)=>
    String(a.id).localeCompare(String(b.id)));
  const attackTeam=roster.find(team=>team.id===attackTeamId);
  if(!attackTeam||!attackTeam.riders.some(row=>
    row.id===attackRiderId)||
    roster.some(team=>team.orders.baseline.attack!=='none'||
      !['ignore','all'].includes(team.orders.baseline.chase))||
    leadOutTiming!=='late')
    throw new Error('Choose supported controlled-finale settings.');
  const namedPlans=plans??roster.map(team=>({teamId:team.id,
    finisherId:team.orders.captainId,leadOutRiderId:null}));
  const planByTeam=new Map(Array.isArray(namedPlans)?
    namedPlans.map(row=>[row?.teamId,row]):[]);
  if(!Array.isArray(namedPlans)||namedPlans.length!==roster.length||
    planByTeam.size!==roster.length||roster.some(team=>{
      const plan=planByTeam.get(team.id);
      return !plan||Object.keys(plan).length!==3||
        !team.riders.some(rider=>
        rider.id===plan.finisherId)||
        plan.leadOutRiderId!==null&&
          (plan.leadOutRiderId===plan.finisherId||
            plan.leadOutRiderId===team.orders.captainId||
            plan.leadOutRiderId===team.orders.roadCaptainId||
            !team.riders.some(rider=>rider.id===plan.leadOutRiderId));
    }))
    throw new Error('Choose one valid finale plan per manager.');
  const stage={...base.stage,keypoints:[
    ...(base.stage.keypoints??[]),
    {km:distanceKm-1,kind:'SPRINT'}]};
  const teams=roster.map(team=>({...team,orders:{...team.orders,
    phases:team.id===attackTeamId?[{atKm:distanceKm-1,
      attack:'selective',attackRiderId}]:[]}}));
  const attackIntent={teamId:attackTeamId,riderId:attackRiderId,
    atKm:distanceKm-1};
  const finalePlans=namedPlans.map(row=>({teamId:row.teamId,
    finisherId:row.finisherId,leadOutRiderId:row.leadOutRiderId}));
  return {settings:base.settings,stage,weather:base.weather,teams,seed,
    attackIntent,finalePlans,leadOutTiming};
}

export function createV91FinaleTrial(settings,request={}){
  const prepared=prepareV91FinaleTrial(settings,request);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,
    teams,seed,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  return resolveV91FinaleTrial(prepared,recording);
}

function resolveV91FinaleTrial(prepared,recording){
  const {teams,attackIntent,finalePlans,leadOutTiming}=prepared;
  const {teamId:attackTeamId,riderId:attackRiderId}=attackIntent;
  const source=finaleSnapshotFromTour(recording,{remainingKm:1,
    includeAttackLoad:true});
  const lockedCount=teams.reduce((count,team)=>
    count+team.riders.length,0);
  if(source.roadGroups.length||source.droppedRiderIds.length||
    source.peloton.riderIds.length!==lockedCount)
    throw new Error('The controlled finale trial needs one complete source bunch.');
  const decision=decideLastKmRotationOutcomeFromTour(recording,{
    teamId:attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    return {version:V91_FINALE_TRIAL_VERSION,settings:prepared.settings,
      sourceMotorVersion:recording.tuningVersion,recording,
      attackIntent,finalePlans,leadOutTiming,
      decision,finaleStatus:'unsupported_road_outcome',finale:null,
      sourceResultStatus:'kilometre_provisional_not_finale',
      classifiedResults:null,pointsStatus:'withheld',
      canCommitAwards:false};
  const finale=recordLeadOutConditionalLineFromTour(recording,{
    attackTeamId,attackRiderId,plans:finalePlans,leadOutTiming});
  return {version:V91_FINALE_TRIAL_VERSION,settings:prepared.settings,
    sourceMotorVersion:recording.tuningVersion,recording,
    attackIntent,finalePlans,leadOutTiming,
    decision,finaleStatus:'provisional_conditional',finale,
    sourceResultStatus:'kilometre_provisional_not_finale',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrial(settings,request,recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrial(settings,request)))
    throw new Error('The controlled finale trial does not replay.');
  return true;
}

// Version 2 resolves the *road* of a solo source through an already recorded
// no-lead-out continuation. A requested lead-out might change contact, so it
// remains unsupported until that work is paid in the separated road trace.
export function createV91FinaleTrialWithSoloBounds(settings,request){
  return withSoloBounds(createV91FinaleTrial(settings,request));
}

function withSoloBounds(first){
  const prefix={...first,version:V91_FINALE_TRIAL_SOLO_VERSION,
    sourceTrialVersion:first.version,soloContinuation:null};
  if(first.decision.branch!=='solo'||first.finalePlans.some(row=>
    row.leadOutRiderId!==null))return prefix;
  const input={attackTeamId:first.attackIntent.teamId,
    plans:first.finalePlans};
  const outcome=decideFinaleRotationSoloOutcomeFromTour(
    first.recording,input);
  const boundsByBranch={
    surviving_solo:probeFinaleRotationSoloFinishBoundsFromTour,
    first_catch:probeFinaleRotationSoloFirstCatchBoundsFromTour,
    second_catch:probeFinaleRotationSoloSecondCatchBoundsFromTour,
    late_catch:probeFinaleRotationSoloLateCatchBoundsFromTour,
    penultimate_catch:probeFinaleRotationSoloPenultimateCatchBoundsFromTour,
    final_contact:probeFinaleRotationSoloFinalContactBoundsFromTour};
  const recordBounds=boundsByBranch[outcome.branch];
  if(!recordBounds)
    throw new Error('The solo continuation has no recorded line bounds.');
  const bounds=recordBounds(first.recording,input);
  if(bounds.riders.length!==first.recording.committedInputs.teams
    .reduce((count,team)=>count+team.riders.length,0)||
    bounds.resultStatus!=='unclassified'||
    bounds.pointsStatus!=='withheld')
    throw new Error('The solo continuation lost its line roster.');
  return {...prefix,finaleStatus:outcome.branch==='surviving_solo'?
    'provisional_solo_bounds':'provisional_post_contact_bounds',
  soloContinuation:{outcome,bounds}};
}

export function validateV91FinaleTrialWithSoloBounds(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithSoloBounds(settings,request)))
    throw new Error('The solo-aware finale trial does not replay.');
  return true;
}

// The paid road state is useful even when a valid finisher nomination has not
// been executed. Keep that distinction explicit before a viewer can consume
// this trial as though every planned sprint affected the line.
export function createV91FinaleTrialWithOrderCoverage(settings,request){
  return withOrderCoverage(createV91FinaleTrialWithSoloBounds(settings,request));
}

function withOrderCoverage(prior){
  const branch=prior.soloContinuation?.outcome?.branch;
  const unpaid=prior.decision.branch==='solo'&&
    (!prior.soloContinuation||
      ['surviving_solo','final_contact'].includes(branch));
  const status=unpaid?'recorded_unapplied':
    prior.decision.branch==='solo'?'paid_unranked_sprint':
      'paid_conditional_line';
  const teamIds=prior.finalePlans.map(plan=>plan.teamId);
  return {...prior,version:V91_FINALE_TRIAL_COVERAGE_VERSION,
    sourceSoloTrialVersion:prior.version,
    finaleStatus:unpaid&&prior.soloContinuation?
      'unsupported_unpaid_finisher':prior.finaleStatus,
    orderCoverage:{status,
      appliedFinisherTeamIds:unpaid?[]:teamIds,
      unappliedFinisherTeamIds:unpaid?teamIds:[]}};
}

export function validateV91FinaleTrialWithOrderCoverage(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithOrderCoverage(settings,request)))
    throw new Error('The order-aware finale trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_PHYSICAL_VERSION='v91-finale-trial-4';

// Opt-in complete-bunch continuation from the same locked tour. The earlier
// trial versions remain replayable; no conditional crossing becomes an award.
export function createV91FinaleTrialWithPhysicalRunner(settings,request){
  const prior=createV91FinaleTrialWithOrderCoverage(settings,request);
  const completeBunch=['caught','contained'].includes(prior.decision.branch);
  const physicalRunner=completeBunch?
    recordFinalePaidBunchRunnerFromTour(prior.recording,{
      attackTeamId:prior.attackIntent.teamId,plans:prior.finalePlans}):null;
  if(physicalRunner&&physicalRunner.finishers.length!==
    prior.recording.committedInputs.teams.reduce((sum,team)=>
      sum+team.riders.length,0))
    throw new Error('The physical runner lost a locked rider.');
  return {version:V91_FINALE_TRIAL_PHYSICAL_VERSION,
    sourceCoverageTrialVersion:prior.version,
    settings:prior.settings,sourceMotorVersion:prior.sourceMotorVersion,
    recording:prior.recording,attackIntent:prior.attackIntent,
    finalePlans:prior.finalePlans,leadOutTiming:prior.leadOutTiming,
    decision:prior.decision,soloContinuation:prior.soloContinuation,
    orderCoverage:prior.orderCoverage,physicalRunner,
    physicalRunnerStatus:physicalRunner?'paid_conditional_line':
      'unsupported_separated_road',
    sourceResultStatus:prior.sourceResultStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithPhysicalRunner(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithPhysicalRunner(settings,request)))
    throw new Error('The physical finale trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_CONTACT_VERSION='v91-finale-trial-5';

// Four measured solo catches can resume the paid individual bunch finish.
// A lead-out ordered before contact remains unapplied: it could change when
// contact happens and cannot be appended after the road has been recorded.
export function createV91FinaleTrialWithContactRunner(settings,request){
  const prior=createV91FinaleTrialWithPhysicalRunner(settings,request);
  const branch=prior.soloContinuation?.outcome?.branch;
  const eligible=['first_catch','second_catch','late_catch',
    'penultimate_catch'].includes(branch)&&
    prior.finalePlans.every(row=>row.leadOutRiderId===null);
  const postContactRunner=eligible?
    recordFinalePaidPostContactRunnerFromTour(prior.recording,{
      attackTeamId:prior.attackIntent.teamId,plans:prior.finalePlans}):null;
  if(postContactRunner&&postContactRunner.finishers.length!==
    prior.recording.committedInputs.teams.reduce((sum,team)=>
      sum+team.riders.length,0))
    throw new Error('The post-contact trial lost a locked rider.');
  return {...prior,version:V91_FINALE_TRIAL_CONTACT_VERSION,
    sourcePhysicalTrialVersion:prior.version,postContactRunner,
    postContactRunnerStatus:postContactRunner?
      'paid_conditional_line':prior.physicalRunner?
        'not_applicable_complete_bunch':prior.decision.branch==='solo'&&
        prior.finalePlans.some(row=>row.leadOutRiderId!==null)?
        'unsupported_pre_contact_lead_out':
        'unsupported_road_outcome',classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateV91FinaleTrialWithContactRunner(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithContactRunner(settings,request)))
    throw new Error('The contact-aware finale trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_SPRINT_CONTACT_GUARD_VERSION=
  'v91-finale-trial-6';

// Once the bunch reaches 300 m, a nominated finisher may already be
// accelerating. The solo contact recorded without that sprint cannot then
// be used as a paid handoff. Keep the earlier trial replayable, but refuse
// its late conditional continuation in the current player-facing candidate.
export function createV91FinaleTrialWithSprintContactGuard(settings,request){
  const prior=createV91FinaleTrialWithContactRunner(settings,request);
  const branch=prior.soloContinuation?.outcome?.branch;
  const unresolved=['late_catch','penultimate_catch'].includes(branch);
  return {...prior,version:V91_FINALE_TRIAL_SPRINT_CONTACT_GUARD_VERSION,
    sourceContactTrialVersion:prior.version,
    postContactRunner:unresolved?null:prior.postContactRunner,
    postContactRunnerStatus:unresolved?
      'unsupported_pre_contact_sprint':prior.postContactRunnerStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithSprintContactGuard(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithSprintContactGuard(settings,request)))
    throw new Error('The sprint-contact guarded trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_SOLO_FIRST_PROOF_VERSION=
  'v91-finale-trial-7';

// A paid solo line can prove first place only when even an optimistic,
// energy-unlimited bunch sprint cannot reach it. This is a model bound, not
// a complete classification or a point settlement.
export function createV91FinaleTrialWithSoloFirstProof(settings,request){
  const prior=createV91FinaleTrialWithSprintContactGuard(settings,request);
  const eligible=prior.soloContinuation?.outcome?.branch===
    'surviving_solo'&&prior.finalePlans.every(row=>
      row.leadOutRiderId===null);
  const soloFirstProof=eligible?proveFinaleSoloFirstFromTour(
    prior.recording,{attackTeamId:prior.attackIntent.teamId}):null;
  return {...prior,version:V91_FINALE_TRIAL_SOLO_FIRST_PROOF_VERSION,
    sourceSprintContactTrialVersion:prior.version,soloFirstProof,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithSoloFirstProof(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithSoloFirstProof(settings,request)))
    throw new Error('The solo first-place trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_ONE_CLOCK_SOLO_VERSION=
  'v91-finale-trial-8';

// A separate, opt-in road clock for a solo source. Manager finishers can
// change contact during the sprint. Contact stops at its measured instant;
// a separated line is still conditional because the source bunch has no
// recorded passing lanes or wheel order. Earlier trial records stay intact.
export function createV91FinaleTrialWithOneClockSolo(settings,request){
  const prior=createV91FinaleTrial(settings,request);
  const eligible=prior.decision.branch==='solo'&&
    prior.finalePlans.every(row=>row.leadOutRiderId===null);
  const oneClockSolo=eligible?recordFinaleOneClockSoloFromTour(
    prior.recording,{attackTeamId:prior.attackIntent.teamId,
      plans:prior.finalePlans}):null;
  return {version:V91_FINALE_TRIAL_ONE_CLOCK_SOLO_VERSION,
    sourceTrialVersion:prior.version,settings:prior.settings,
    sourceMotorVersion:prior.sourceMotorVersion,
    recording:prior.recording,attackIntent:prior.attackIntent,
    finalePlans:prior.finalePlans,decision:prior.decision,
    oneClockSolo,oneClockSoloStatus:oneClockSolo?.outcome??
      (prior.decision.branch==='solo'?
        'unsupported_pre_contact_lead_out':'not_applicable_bunch'),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithOneClockSolo(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithOneClockSolo(settings,request)))
    throw new Error('The one-clock solo trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_ONE_CLOCK_CATCH_VERSION=
  'v91-finale-trial-9';

// Only a simultaneous catch of the entire source bunch can enter the
// existing paid bunch runner. A single sprinter's contact remains a distinct
// road state and cannot be converted to a full-bunch result.
export function createV91FinaleTrialWithOneClockCatch(settings,request){
  const prior=createV91FinaleTrialWithOneClockSolo(settings,request);
  const road=prior.oneClockSolo;
  const frame=road?.frames.at(-1);
  const wholeBunch=road?.outcome==='contact_uncontinued'&&
    frame.contact.riderIds.length===frame.riders.length-1&&
    frame.pelotonRiderIds.length===frame.riders.length-1&&
    frame.riders.every(row=>row.elapsedToLineSeconds===null&&
      Math.abs(row.positionM-road.contact.distanceM)<=1e-8);
  const contactContinuation=wholeBunch?
    recordFinalePaidOneClockContactRunnerFromTour(prior.recording,{
      attackTeamId:prior.attackIntent.teamId,plans:prior.finalePlans},
    road):null;
  return {...prior,version:V91_FINALE_TRIAL_ONE_CLOCK_CATCH_VERSION,
    sourceOneClockTrialVersion:prior.version,contactContinuation,
    contactContinuationStatus:contactContinuation?
      'paid_conditional_line':road?.outcome==='contact_uncontinued'?
        'unsupported_partial_contact':road?.outcome==='separated_line'?
          'not_applicable_separated_line':prior.oneClockSoloStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithOneClockCatch(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithOneClockCatch(settings,request)))
    throw new Error('The one-clock catch trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_ONE_CLOCK_LEAD_OUT_VERSION=
  'v91-finale-trial-10';

// A named helper now works on the same paid road as the solo and finisher.
// Partial contacts still stop exactly where measured; they cannot be
// converted into a shared bunch or a classification by this version.
export function createV91FinaleTrialWithOneClockLeadOut(settings,request){
  const prior=createV91FinaleTrial(settings,request);
  const eligible=prior.decision.branch==='solo';
  const oneClockSolo=eligible?recordFinaleOneClockSoloWithLeadOutFromTour(
    prior.recording,{attackTeamId:prior.attackIntent.teamId,
      plans:prior.finalePlans}):null;
  return {version:V91_FINALE_TRIAL_ONE_CLOCK_LEAD_OUT_VERSION,
    sourceTrialVersion:prior.version,settings:prior.settings,
    sourceMotorVersion:prior.sourceMotorVersion,
    recording:prior.recording,attackIntent:prior.attackIntent,
    finalePlans:prior.finalePlans,decision:prior.decision,
    oneClockSolo,oneClockSoloStatus:oneClockSolo?.outcome??
      'not_applicable_bunch',classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateV91FinaleTrialWithOneClockLeadOut(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithOneClockLeadOut(settings,request)))
    throw new Error('The one-clock lead-out trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_UNIFIED_ROAD_VERSION=
  'v91-finale-trial-11';

// Select the existing paid finale from the recorded 500 m road. This is one
// opt-in entry point for both a surviving solo and a complete caught or
// contained bunch. Each branch retains its own versioned physics and replay;
// neither conditional line is promoted to a classification or point award.
export function createV91FinaleTrialWithUnifiedRoad(settings,request){
  const prior=createV91FinaleTrial(settings,request);
  const branch=prior.decision.branch;
  const input={attackTeamId:prior.attackIntent.teamId,
    plans:prior.finalePlans};
  const paidFinale=branch==='solo'?
    recordFinaleOneClockSoloWithLeadOutFromTour(prior.recording,input):
    ['caught','contained'].includes(branch)?
      recordFinalePaidBunchRunnerFromTour(prior.recording,input):null;
  return {version:V91_FINALE_TRIAL_UNIFIED_ROAD_VERSION,
    sourceTrialVersion:prior.version,settings:prior.settings,
    sourceMotorVersion:prior.sourceMotorVersion,
    recording:prior.recording,attackIntent:prior.attackIntent,
    finalePlans:prior.finalePlans,decision:prior.decision,
    paidFinale,paidFinaleStatus:paidFinale?.outcome??
      (paidFinale?'paid_conditional_line':'unsupported_road_outcome'),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithUnifiedRoad(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithUnifiedRoad(settings,request)))
    throw new Error('The unified-road finale trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_POSITIONED_BUNCH_VERSION=
  'v91-finale-trial-12';

// A separate laboratory road order for the complete-bunch branch. The solo
// branch keeps its prior one-clock trace. The inferred wheel slots and
// unblocked passing remain experimental, so neither path settles a result.
export function createV91FinaleTrialWithPositionedBunch(settings,request){
  const prior=createV91FinaleTrialWithUnifiedRoad(settings,request);
  const branch=prior.decision.branch;
  const positionedBunch=['caught','contained'].includes(branch)?
    recordFinalePositionedBunchRunnerFromTour(prior.recording,{
      attackTeamId:prior.attackIntent.teamId,
      plans:prior.finalePlans}):null;
  return {version:V91_FINALE_TRIAL_POSITIONED_BUNCH_VERSION,
    sourceTrialVersion:prior.version,settings:prior.settings,
    sourceMotorVersion:prior.sourceMotorVersion,
    recording:prior.recording,attackIntent:prior.attackIntent,
    finalePlans:prior.finalePlans,decision:prior.decision,
    paidFinale:positionedBunch??prior.paidFinale,
    paidFinaleStatus:positionedBunch?.resultStatus??
      prior.paidFinaleStatus,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91FinaleTrialWithPositionedBunch(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithPositionedBunch(settings,request)))
    throw new Error('The positioned-bunch trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_INDEPENDENT_BUNCH_VERSION=
  'v91-finale-trial-13';

// The source placement no longer changes with a helper nomination. The
// complete-bunch path accepts only an adjacent paid lead-out, while the solo
// path retains its earlier one-clock, non-awarding recording.
export function createV91FinaleTrialWithIndependentBunch(settings,request){
  const prior=createV91FinaleTrialWithPositionedBunch(settings,request);
  const independentBunch=['caught','contained'].includes(
    prior.decision.branch)?recordFinaleIndependentBunchRunnerFromTour(
      prior.recording,{attackTeamId:prior.attackIntent.teamId,
        plans:prior.finalePlans}):null;
  return {...prior,version:V91_FINALE_TRIAL_INDEPENDENT_BUNCH_VERSION,
    sourceTrialVersion:prior.version,
    paidFinale:independentBunch??prior.paidFinale,
    paidFinaleStatus:independentBunch?.resultStatus??
      prior.paidFinaleStatus};
}

export function validateV91FinaleTrialWithIndependentBunch(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithIndependentBunch(settings,request)))
    throw new Error('The independent-bunch trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_ASSEMBLED_BUNCH_VERSION=
  'v91-finale-trial-14';

// A rear helper can pay to reach the finisher on the same locked road. A
// lead-out activates only after the measured approach reaches a source wheel.
// The provisional lane model cannot yet classify or award this race.
export function createV91FinaleTrialWithAssembledBunch(settings,request){
  const prior=createV91FinaleTrialWithUnifiedRoad(settings,request);
  const assembledBunch=['caught','contained'].includes(
    prior.decision.branch)?recordFinaleAssembledBunchRunnerFromTour(
      prior.recording,{attackTeamId:prior.attackIntent.teamId,
        plans:prior.finalePlans}):null;
  return {...prior,version:V91_FINALE_TRIAL_ASSEMBLED_BUNCH_VERSION,
    sourceTrialVersion:prior.version,
    paidFinale:assembledBunch??prior.paidFinale,
    paidFinaleStatus:assembledBunch?.resultStatus??
      prior.paidFinaleStatus};
}

export function validateV91FinaleTrialWithAssembledBunch(settings,request,
  recorded){
  if(!isDeepStrictEqual(recorded,
    createV91FinaleTrialWithAssembledBunch(settings,request)))
    throw new Error('The assembled-bunch trial does not replay.');
  return true;
}

export const V91_EARLY_BUNCH_TRIAL_VERSION='v91-early-bunch-trial-1';
export const V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION=
  'v91-inactive-intents-bunch-trial-2';

// An independent complete-bunch, no-attack race from the recorded 1 km
// handoff to the line. This keeps the older 500 m trial and its replay intact.
export function createV91EarlyBunchTrial(settings,{plans=null}={}){
  const prepared=prepareV91Playtest(settings);
  const {stage,weather,teams,seed}=prepared;
  const recording=simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  const finalePlans=plans??recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const hasFinalAttackOrder=recording.committedInputs.teams.some(team=>
    orderAt(team.orders,recording.route.distanceKm-1).attack!=='none');
  const paidFinale=(hasFinalAttackOrder?
    recordFinaleInactiveIntentsBunchRunnerFromTour:
    recordFinaleEarlyBunchRunnerFromTour)(recording,{plans:finalePlans});
  return {version:hasFinalAttackOrder?
    V91_INACTIVE_INTENTS_BUNCH_TRIAL_VERSION:
    V91_EARLY_BUNCH_TRIAL_VERSION,
    settings:prepared.settings,recording,finalePlans,paidFinale,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateV91EarlyBunchTrial(settings,request,recorded){
  if(!isDeepStrictEqual(recorded,
    createV91EarlyBunchTrial(settings,request)))
    throw new Error('The early bunch trial does not replay.');
  return true;
}

export const V91_FINALE_TRIAL_COMPARISON_VERSION=
  'v91-finale-trial-comparison-1';

// Replay two manager plan sets against the same locked race. Only paid,
// conditional one-bunch crossings can be compared; this never ranks an
// unsupported solo or turns provisional line positions into awards.
export function compareV91FinalePlans(settings,beforeRequest,afterRequest){
  if(beforeRequest?.attackTeamId!==afterRequest?.attackTeamId||
    beforeRequest?.attackRiderId!==afterRequest?.attackRiderId||
    (beforeRequest?.leadOutTiming??'late')!==
      (afterRequest?.leadOutTiming??'late'))
    throw new Error('Compare finale plans on the same named attack.');
  const beforePrepared=prepareV91FinaleTrial(settings,beforeRequest);
  const afterPrepared=prepareV91FinaleTrial(settings,afterRequest);
  const beforeRace={...beforePrepared,finalePlans:null};
  const afterRace={...afterPrepared,finalePlans:null};
  if(!isDeepStrictEqual(beforeRace,afterRace))
    throw new Error('Finale plans must share the same recorded race.');
  const {stage,weather,teams,seed}=beforePrepared;
  const recording=simulateTacticalTour({stage,weather,
    teams,seed,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
  const before=withOrderCoverage(withSoloBounds(resolveV91FinaleTrial(
    beforePrepared,recording)));
  const after=withOrderCoverage(withSoloBounds(resolveV91FinaleTrial(
    afterPrepared,recording)));
  const comparable=before.orderCoverage.status==='paid_conditional_line'&&
    after.orderCoverage.status==='paid_conditional_line';
  const lines=comparable?before.finalePlans.map(plan=>{
    const next=after.finalePlans.find(row=>row.teamId===plan.teamId);
    const first=before.finale.line.finishers.find(row=>
      row.riderId===plan.finisherId);
    const second=after.finale.line.finishers.find(row=>
      row.riderId===next.finisherId);
    if(!first||!second)throw new Error('A nominated finisher lost their paid line.');
    return {teamId:plan.teamId,
      beforeFinisherId:plan.finisherId,
      afterFinisherId:next.finisherId,
      beforeLeadOutRiderId:plan.leadOutRiderId,
      afterLeadOutRiderId:next.leadOutRiderId,
      beforeElapsedSeconds:first.elapsedSecondsFromLastKmStart,
      afterElapsedSeconds:second.elapsedSecondsFromLastKmStart,
      elapsedChangeSeconds:plan.finisherId===next.finisherId?
        second.elapsedSecondsFromLastKmStart-
          first.elapsedSecondsFromLastKmStart:null,
      beforePossiblePlace:[first.firstPossiblePlace,
        first.lastPossiblePlace],
      afterPossiblePlace:[second.firstPossiblePlace,
        second.lastPossiblePlace]};
  }):null;
  return {version:V91_FINALE_TRIAL_COMPARISON_VERSION,
    status:comparable?'provisional_conditional_comparison':
      'unsupported_road_comparison',
    before,after,lines,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateV91FinalePlansComparison(settings,
  beforeRequest,afterRequest,recorded){
  if(!isDeepStrictEqual(recorded,
    compareV91FinalePlans(settings,beforeRequest,afterRequest)))
    throw new Error('The paired finale trial does not replay.');
  return true;
}
