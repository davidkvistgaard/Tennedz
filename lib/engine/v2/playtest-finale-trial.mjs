import {isDeepStrictEqual} from 'node:util';
import {prepareV91Playtest} from './playtest.mjs';
import {simulateTacticalTour} from './tour.mjs';
import {validateRecordedTour} from './recording.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from './tuning.mjs';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {recordLeadOutConditionalLineFromTour} from
  './finale-lead-out-longitudinal.mjs';
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
  const {stage,weather,teams,seed,attackIntent,finalePlans,
    leadOutTiming}=prepared;
  const {teamId:attackTeamId,riderId:attackRiderId}=attackIntent;
  const recording=simulateTacticalTour({stage,weather,
    teams,seed,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  validateRecordedTour(recording);
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
  const first=createV91FinaleTrial(settings,request);
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
  const prior=createV91FinaleTrialWithSoloBounds(settings,request);
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
  const before=createV91FinaleTrialWithOrderCoverage(settings,
    beforeRequest);
  const after=createV91FinaleTrialWithOrderCoverage(settings,
    afterRequest);
  if(!isDeepStrictEqual(before.recording,after.recording)||
    !isDeepStrictEqual(before.attackIntent,after.attackIntent))
    throw new Error('Finale plans must share the same recorded race.');
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
