import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {resolveIndependentBunchSource,resolveIndependentEarlyBunchSource,
  resolvePositionedBunchSource} from
  './finale-positioned-source.mjs';
import {decideFinaleRotationSoloOutcomeFromTour,
  recordFinaleRotationSoloCatchSliceFromTour,
  recordFinaleRotationSoloSliceFromTour,
  recordFinaleRotationSoloSecondCatchFromTour,
  recordFinaleRotationSoloLateCatchFromTour} from
  './finale-rotation-solo-slice.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour,
  recordFinaleRotationSoloSprintPlanFromTour,
  recordFinaleEarlyBunchSprintPlanFromTour,
  recordFinaleInactiveIntentsSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  FINALE_LAST_KM_ALL_INTENTS_VERSION} from
  './finale-last-km-named-intents.mjs';
import {FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION,
  validateFinaleOneClockSoloFromTour,
  validateFinaleOneClockSoloWithLeadOutFromTour} from
  './finale-one-clock-solo.mjs';
import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_PAID_BUNCH_RUNNER_VERSION=
  'v2-finale-paid-bunch-runner-1';
export const FINALE_PAID_POST_CONTACT_RUNNER_VERSION=
  'v2-finale-paid-post-contact-runner-1';
export const FINALE_PAID_ONE_CLOCK_CONTACT_RUNNER_VERSION=
  'v2-finale-paid-one-clock-contact-runner-1';
export const FINALE_PAID_ONE_CLOCK_LEAD_OUT_CONTACT_RUNNER_VERSION=
  'v2-finale-paid-one-clock-lead-out-contact-runner-2';
export const FINALE_POSITIONED_BUNCH_RUNNER_VERSION=
  'v2-finale-positioned-bunch-runner-lab-2';
export const FINALE_INDEPENDENT_BUNCH_RUNNER_VERSION=
  'v2-finale-independent-bunch-runner-lab-3';
export const FINALE_ASSEMBLED_BUNCH_RUNNER_VERSION=
  'v2-finale-assembled-bunch-runner-lab-4';
export const FINALE_EARLY_BUNCH_RUNNER_VERSION=
  'v2-finale-early-bunch-runner-lab-5';
export const FINALE_INACTIVE_INTENTS_BUNCH_RUNNER_VERSION=
  'v2-finale-inactive-intents-bunch-runner-lab-6';
export const FINALE_VERIFIED_ASSEMBLY_BUNCH_RUNNER_VERSION=
  'v2-finale-verified-assembly-bunch-runner-lab-7';
export const FINALE_VERIFIED_INACTIVE_ASSEMBLY_BUNCH_RUNNER_VERSION=
  'v2-finale-verified-inactive-assembly-bunch-runner-lab-8';
const EPSILON=1e-8;
const secondsPerKm=(segment,ability,effort=0,draft=0)=>
  segmentBaseSeconds(segment)+(50-ability-effort-draft)*
    TUNING.breakaway.driftSecondsPerAbilityPoint;

// A separate complete-bunch laboratory path. Every rider moves on the same
// clock and pays for their actual travel; the old candidate remains replayable.
// The 500 m source is a collapsed road band, so this is conditional longitudinal
// movement, not a wheel order, passing rule, classification or point award.
export function recordFinalePaidBunchRunnerFromTour(tour,input){
  const decision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input?.attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    throw new Error('The paid bunch runner needs a complete bunch at 500 m.');
  const caught=decision.branch==='caught';
  const road=caught?probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId}):probeLastKmRotationContainedFromTour(tour,{
      teamId:input.attackTeamId});
  const plan=caught?recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  return runPaidBunch(tour,{source:{...road.at500M,
    bunchElapsedSeconds:road.at500M.bunchElapsedSeconds},
  plan,branch:decision.branch,sourceRoadTraceVersion:road.version,
  version:FINALE_PAID_BUNCH_RUNNER_VERSION});
}

// Experimental complete-bunch road geometry. The original paid runner and its
// replay remain unchanged. This version starts every rider in an inferred
// wheel slot behind the recorded front edge, pays their extra travel to the
// line and records the resulting conditional crossing times.
export function recordFinalePositionedBunchRunnerFromTour(tour,input){
  const decision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input?.attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    throw new Error('The positioned runner needs one complete bunch.');
  const caught=decision.branch==='caught';
  const road=caught?probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId}):probeLastKmRotationContainedFromTour(tour,{
      teamId:input.attackTeamId});
  const plan=caught?recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  const positionedSource=resolvePositionedBunchSource(tour,road,plan);
  return runPaidBunch(tour,{source:road.at500M,plan,
    branch:decision.branch,sourceRoadTraceVersion:road.version,
    positionedSource,version:FINALE_POSITIONED_BUNCH_RUNNER_VERSION});
}

// The source grid is held fixed across manager choices. A helper may pull a
// finisher only from an adjacent source wheel; distant helpers cannot appear
// beside the finisher for free. Lateral passing remains unmodelled, so this
// still records an experimental, non-awarding order.
export function recordFinaleIndependentBunchRunnerFromTour(tour,input){
  const decision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input?.attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    throw new Error('The independent runner needs one complete bunch.');
  const caught=decision.branch==='caught';
  const road=caught?probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId}):probeLastKmRotationContainedFromTour(tour,{
      teamId:input.attackTeamId});
  const plan=caught?recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  const positionedSource=resolveIndependentBunchSource(tour,road,plan);
  const slots=new Map(positionedSource.slots.map(row=>[row.riderId,row]));
  for(const order of plan.decisions){
    if(order.leadOutRiderId===null)continue;
    const helper=slots.get(order.leadOutRiderId);
    const finisher=slots.get(order.finisherId);
    if(!helper||!finisher||
      Math.abs(helper.lane-finisher.lane)>1||
      helper.positionM<finisher.positionM-EPSILON||
      helper.positionM-finisher.positionM>
        positionedSource.wheelSpacingM+EPSILON)
      throw new Error(`Lead-out helper is not on the finisher's source wheel: ${
        order.teamId}.`);
  }
  return runPaidBunch(tour,{source:road.at500M,plan,
    branch:decision.branch,sourceRoadTraceVersion:road.version,
    positionedSource,version:FINALE_INDEPENDENT_BUNCH_RUNNER_VERSION});
}

// A rear helper may pay to approach an independently placed finisher. The
// pair can pull only at a later measured boundary, after the helper reaches
// an adjacent wheel. Open-lane geometry remains provisional and non-awarding.
export function recordFinaleAssembledBunchRunnerFromTour(tour,input){
  const decision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input?.attackTeamId});
  if(!['caught','contained'].includes(decision.branch))
    throw new Error('The assembled runner needs one complete bunch.');
  const caught=decision.branch==='caught';
  const road=caught?probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId}):probeLastKmRotationContainedFromTour(tour,{
      teamId:input.attackTeamId});
  const plan=caught?recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  const positionedSource=resolveIndependentBunchSource(tour,road,plan);
  const slots=new Map(positionedSource.slots.map(row=>[row.riderId,row]));
  for(const order of plan.decisions){
    if(order.leadOutRiderId===null)continue;
    const helper=slots.get(order.leadOutRiderId);
    const finisher=slots.get(order.finisherId);
    if(!helper||!finisher||
      Math.abs(helper.lane-finisher.lane)>1||
      helper.positionM>finisher.positionM+
        positionedSource.wheelSpacingM+EPSILON)
      throw new Error(`A rear lead-out helper needs an adjacent source lane: ${
        order.teamId}.`);
  }
  return runPaidBunch(tour,{source:road.at500M,plan,
    branch:decision.branch,sourceRoadTraceVersion:road.version,
    positionedSource,allowAssembly:true,
    version:FINALE_ASSEMBLED_BUNCH_RUNNER_VERSION});
}

// Complete-bunch, inactive-attack laboratory path from the recorded 1 km
// handoff to each rider's exact line crossing. The earlier source gives more
// paid road for a nominated pair to assemble; it does not move the old 500 m
// source or settle the conditional order as an official result.
export function recordFinaleEarlyBunchRunnerFromTour(tour,input){
  return recordEarlyBunch(tour,
    recordFinaleEarlyBunchSprintPlanFromTour(tour,input),
    FINALE_EARLY_BUNCH_RUNNER_VERSION);
}

export function recordFinaleInactiveIntentsBunchRunnerFromTour(tour,input){
  return recordEarlyBunch(tour,
    recordFinaleInactiveIntentsSprintPlanFromTour(tour,input),
    FINALE_INACTIVE_INTENTS_BUNCH_RUNNER_VERSION);
}

// The old assembly status describes wheel proximity only. In the last
// approach it can say "ready next boundary" even though the next interval
// is the sprint. These versions keep every paid metre and debit, then report
// whether the promised following pull actually happened in the replay.
function verifiedAssembly(paid,version){
  const frames=paid.frames.map((frame,index)=>({
    ...frame,
    ...(frame.assemblyAttempts?{assemblyAttempts:
      frame.assemblyAttempts.map(attempt=>{
        if(attempt.status!=='ready_next_boundary')return attempt;
        const next=paid.frames[index+1];
        const helper=next?.riders.find(row=>
          row.riderId===attempt.helperId);
        const finisher=next?.riders.find(row=>
          row.riderId===attempt.finisherId);
        return {...attempt,status:helper?.role==='lead_out'&&
          finisher?.role==='lead_out_finisher'?
            'paid_pull_next_boundary':'ready_without_following_pull'};
      })}:{}),
  }));
  return {...paid,version,sourceRunnerVersion:paid.version,frames};
}

export function recordFinaleVerifiedAssemblyBunchRunnerFromTour(tour,input){
  return verifiedAssembly(recordFinaleEarlyBunchRunnerFromTour(tour,input),
    FINALE_VERIFIED_ASSEMBLY_BUNCH_RUNNER_VERSION);
}

export function recordFinaleVerifiedInactiveAssemblyBunchRunnerFromTour(
  tour,input){
  return verifiedAssembly(
    recordFinaleInactiveIntentsBunchRunnerFromTour(tour,input),
    FINALE_VERIFIED_INACTIVE_ASSEMBLY_BUNCH_RUNNER_VERSION);
}

function recordEarlyBunch(tour,plan,version){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const source={distanceM:field.startDistanceM,
    pelotonRiderIds:field.pelotonRiderIds,
    roadGroups:field.roadGroups,
    riderEnergy:field.riders.map(row=>({riderId:row.riderId,
      energy:row.energy})),bunchElapsedSeconds:0};
  const positionedSource=resolveIndependentEarlyBunchSource(tour,
    {version:field.version,at500M:source,frames:[]},plan);
  const slots=new Map(positionedSource.slots.map(row=>
    [row.riderId,row]));
  for(const order of plan.decisions){
    if(order.leadOutRiderId===null)continue;
    const helper=slots.get(order.leadOutRiderId);
    const finisher=slots.get(order.finisherId);
    if(!helper||!finisher||
      Math.abs(helper.lane-finisher.lane)>1||
      helper.positionM>finisher.positionM+
        positionedSource.wheelSpacingM+EPSILON)
      throw new Error(`An early lead-out helper needs an adjacent lane: ${
        order.teamId}.`);
  }
  const paid=runPaidBunch(tour,{source,plan,branch:'early_complete_bunch',
    sourceRoadTraceVersion:field.version,positionedSource,
    allowAssembly:true,earlySource:true,
    version});
  return version===FINALE_INACTIVE_INTENTS_BUNCH_RUNNER_VERSION?
    {...paid,sourceIntentLedger:recordFinaleLastKmNamedIntentsFromTour(
      tour,{version:FINALE_LAST_KM_ALL_INTENTS_VERSION})}:paid;
}

// A measured solo catch supplies an already paid merged state. With no
// nominated lead-out, the remaining bunch can use the same individual
// distance/energy runner. Contact in the final 100 m still lacks a paid
// post-contact sprint and remains outside this version.
export function recordFinalePaidPostContactRunnerFromTour(tour,input){
  const decision=decideFinaleRotationSoloOutcomeFromTour(tour,input);
  if(!['first_catch','second_catch','late_catch',
    'penultimate_catch'].includes(decision.branch))
    throw new Error('The post-contact runner needs a paid solo catch.');
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  if(plan.decisions.some(row=>row.leadOutRiderId))
    throw new Error('A pre-contact lead-out needs separate paid road work.');
  let caught,elapsedSeconds;
  if(decision.branch==='first_catch'){
    caught=recordFinaleRotationSoloCatchSliceFromTour(tour,input);
    elapsedSeconds=road.at500M.bunchElapsedSeconds+
      caught.bunchTravelSeconds;
  }else if(decision.branch==='second_catch'){
    const first=recordFinaleRotationSoloSliceFromTour(tour,input);
    caught=recordFinaleRotationSoloSecondCatchFromTour(tour,input);
    elapsedSeconds=road.at500M.bunchElapsedSeconds+
      first.bunchTravelSeconds+caught.bunchTravelSeconds;
  }else{
    caught=recordFinaleRotationSoloLateCatchFromTour(tour,input);
    elapsedSeconds=caught.bunchElapsedSecondsAtMerge;
  }
  if(caught.catchDistanceM!==decision.catchDistanceM||
    caught.endDistanceM!==decision.nextDecisionDistanceM||
    caught.roadGroups.length!==0)
    throw new Error('The measured solo contact lost its merged road.');
  const source={distanceM:caught.endDistanceM,
    pelotonRiderIds:caught.pelotonRiderIds,
    riderEnergy:caught.riderEnergy.map(row=>({riderId:row.riderId,
      energy:row.energyAfter??row.energy})),bunchElapsedSeconds:elapsedSeconds};
  return runPaidBunch(tour,{source,plan,branch:decision.branch,
    sourceRoadTraceVersion:road.version,
    sourceCatchVersion:caught.version,
    catchDistanceM:caught.catchDistanceM,
    version:FINALE_PAID_POST_CONTACT_RUNNER_VERSION});
}

// A one-clock solo catch may feed the existing paid bunch movement only if
// every locked rider is at the measured contact coordinate. A sprint rider
// ahead of the bunch is a separate road group and cannot be flattened here.
export function recordFinalePaidOneClockContactRunnerFromTour(tour,input,
  oneClock){
  const leadOutVersion=oneClock?.version===
    FINALE_ONE_CLOCK_SOLO_LEAD_OUT_VERSION;
  if(leadOutVersion)
    validateFinaleOneClockSoloWithLeadOutFromTour(tour,input,oneClock);
  else validateFinaleOneClockSoloFromTour(tour,input,oneClock);
  const contact=oneClock.contact;
  const last=oneClock.frames.at(-1);
  const ids=last?.riders.map(row=>row.riderId)??[];
  if(oneClock.outcome!=='contact_uncontinued'||!contact||
    last.riders.some(row=>row.elapsedToLineSeconds!==null||
      Math.abs(row.positionM-contact.distanceM)>EPSILON)||
    contact.riderIds.length!==ids.length-1||
    last.pelotonRiderIds.length!==ids.length-1)
    throw new Error('One-clock contact has not merged the entire bunch.');
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  if(plan.decisions.some(row=>row.leadOutRiderId))
    throw new Error('One-clock contact cannot erase pre-contact lead-out.');
  const source={distanceM:contact.distanceM,
    pelotonRiderIds:ids,
    riderEnergy:last.riders.map(row=>({riderId:row.riderId,
      energy:row.energyAfter})),
    bunchElapsedSeconds:contact.elapsedSeconds};
  return runPaidBunch(tour,{source,plan,
    branch:'one_clock_bunch_contact',
    sourceRoadTraceVersion:oneClock.sourceRoadTraceVersion,
    sourceCatchVersion:oneClock.version,
    catchDistanceM:contact.distanceM,
    version:leadOutVersion?
      FINALE_PAID_ONE_CLOCK_LEAD_OUT_CONTACT_RUNNER_VERSION:
      FINALE_PAID_ONE_CLOCK_CONTACT_RUNNER_VERSION});
}

function runPaidBunch(tour,{source,plan,branch,sourceRoadTraceVersion,
  sourceCatchVersion=null,catchDistanceM=null,positionedSource=null,
  allowAssembly=false,earlySource=false,version}){
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRiderId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const ids=source.pelotonRiderIds;
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.endDistanceM>source.distanceM);
  if(ids.length!==ridersById.size||new Set(ids).size!==ids.length||
    (earlySource?slices.length!==7:
      slices.length<1||slices.length>5)||
    slices.some(slice=>earlySource?![100,250].includes(slice.lengthM):
      slice.lengthM!==100)||
    slices[0].startDistanceM>source.distanceM||
    slices[0].endDistanceM<=source.distanceM||
    slices.at(-1).endDistanceM!==finishM||
    plan.decisionDistanceM!==(earlySource?source.distanceM:finishM-500)||
    earlySource&&source.distanceM!==finishM-1000||
    plan.sourceRoadTraceVersion!==sourceRoadTraceVersion)
    throw new Error('The paid runner needs one locked road and plan.');
  const plansByFinisher=new Map(plan.decisions.map(row=>
    [row.finisherId,row]));
  const plansByHelper=new Map(plan.decisions.filter(row=>
    row.leadOutRiderId).map(row=>[row.leadOutRiderId,row]));
  const initialEnergy=new Map(source.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  if(initialEnergy.size!==ids.length||ids.some(id=>
    !Number.isFinite(initialEnergy.get(id))))
    throw new Error('The paid runner lost a rider at the source.');
  const positionedById=new Map(positionedSource?.slots.map(row=>
    [row.riderId,row])??[]);
  if(positionedSource&&(positionedById.size!==ids.length||
    ids.some(id=>!positionedById.has(id))))
    throw new Error('The positioned runner lost a source wheel.');
  const state=new Map(ids.map(id=>[id,{positionM:positionedById.get(id)
    ?.positionM??source.distanceM,
    energy:initialEnergy.get(id),elapsedToLineSeconds:null}]));
  const segment=tour.route.kilometres.at(-1);
  let elapsedSeconds=source.bunchElapsedSeconds;
  const frames=[];
  for(const slice of slices){
    const travelStartM=Math.max(source.distanceM,slice.startDistanceM);
    const travelLengthM=slice.endDistanceM-travelStartM;
    const approachPhase=slice.startDistanceM<finishM-300;
    const bunchStartM=travelStartM;
    const bunchIds=ids.filter(id=>state.get(id).positionM<=
      bunchStartM+EPSILON&&state.get(id).elapsedToLineSeconds===null);
    const frontWorkIds=positionedSource?bunchIds.filter(id=>
      state.get(id).positionM>=bunchStartM-
        positionedSource.wheelSpacingM-EPSILON):bunchIds;
    const energies=new Map(ids.map(id=>[id,state.get(id).energy]));
    const readyHelpers=new Set(plan.decisions.filter(order=>{
      if(!order.leadOutRiderId)return false;
      const helper=state.get(order.leadOutRiderId);
      const finisher=state.get(order.finisherId);
      return helper.elapsedToLineSeconds===null&&
        finisher.elapsedToLineSeconds===null&&
        helper.positionM>=finisher.positionM-EPSILON&&
        helper.positionM-finisher.positionM<=
          (positionedSource?.wheelSpacingM??0)+EPSILON;
    }).map(order=>order.leadOutRiderId));
    const busyTeamIds=plan.decisions.filter(row=>approachPhase?
      row.leadOutRiderId!==null:row.leadOutRiderId!==null||
        teams.find(team=>team.id===row.teamId).orders.helperIds
          .includes(row.finisherId)).map(row=>row.teamId);
    const rotation=recordFinaleFrontRotationSlice({slice,
      route:tour.route,teams,pelotonRiderIds:frontWorkIds,
      energies,busyTeamIds});
    const workers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    const activeSprintIds=new Set(approachPhase?[]:plan.decisions
      .map(row=>row.finisherId).filter(id=>{
        const energy=energies.get(id);
        const effect=riderKilometreEffect(ridersById.get(id),segment,{
          phase:'finale',energy,exposed:segment.exposed});
        return FINALE_SPRINT_WORK_COST_PER_KM*
          effect.energyCostMultiplier*travelLengthM/1000<=energy+EPSILON;
      }));
    const passiveIds=bunchIds.filter(id=>!activeSprintIds.has(id));
    if(!passiveIds.length)
      throw new Error('The paid runner has no passive bunch.');
    const passiveBunchSpeedKph=finalePassiveBunchSpeed({
      riderIds:passiveIds,ridersById,energies,segment});
    const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
      rotation.selected?.speedKph??0);
    const durationSeconds=3.6*travelLengthM/bunchSpeedKph;
    const bunchVelocityMps=travelLengthM/durationSeconds;
    const rows=ids.map(riderId=>{
      const prior=state.get(riderId);
      const energyAtDecision=prior.energy;
      const positionBeforeM=prior.positionM;
      if(prior.elapsedToLineSeconds!==null)return {
        riderId,role:'finished',positionBeforeM,positionM:finishM,
        distanceTravelledM:0,activeDistanceM:0,shelteredDistanceM:0,
        activeSeconds:0,shelteredSeconds:0,
        activeWorkCostPerKm:0,shelteredWorkCostPerKm:0,
        reabsorbedAt:null,
        energyAtDecision,energySpent:0,energyAfter:energyAtDecision,
        elapsedToLineSeconds:prior.elapsedToLineSeconds};
      const effect=riderKilometreEffect(ridersById.get(riderId),segment,{
        phase:activeSprintIds.has(riderId)?'finale':'chase',
        energy:energyAtDecision,exposed:segment.exposed});
      let shelteredCostPerKm=TUNING.effortCost.conserve*
        effect.energyCostMultiplier;
      let role='sheltered',velocityMps=bunchVelocityMps;
      let workCostPerKm=shelteredCostPerKm;
      if(approachPhase&&plansByHelper.has(riderId)&&
        (!allowAssembly||readyHelpers.has(riderId))){
        const lead=plansByHelper.get(riderId);
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        velocityMps=1000/secondsPerKm(segment,effect.ability,effort,
          TUNING.breakaway.bunchDraftAdvantage);
        workCostPerKm=lead.leadOutWorkCostPerKm;
        role='lead_out';
      }else if(approachPhase&&plansByFinisher.get(riderId)
        ?.leadOutRiderId&&(!allowAssembly||readyHelpers.has(
          plansByFinisher.get(riderId).leadOutRiderId))){
        const lead=plansByFinisher.get(riderId);
        const helperEnergy=energies.get(lead.leadOutRiderId);
        const helperEffect=riderKilometreEffect(
          ridersById.get(lead.leadOutRiderId),segment,{
            phase:'chase',energy:helperEnergy,
            exposed:segment.exposed});
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,helperEnergy/TUNING.finish.fullEffortEnergy);
        velocityMps=1000/secondsPerKm(segment,helperEffect.ability,
          effort,TUNING.breakaway.bunchDraftAdvantage);
        role='lead_out_finisher';
      }else if(allowAssembly&&approachPhase&&
        plansByHelper.has(riderId)){
        const lead=plansByHelper.get(riderId);
        const finisher=state.get(lead.finisherId);
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        const maximumMps=1000/secondsPerKm(segment,effect.ability,
          effort,TUNING.breakaway.bunchDraftAdvantage);
        const targetM=finisher.positionM+
          bunchVelocityMps*durationSeconds+
          positionedSource.wheelSpacingM;
        const targetMps=(targetM-positionBeforeM)/durationSeconds;
        const affordableMps=energyAtDecision*1000/
          (lead.leadOutWorkCostPerKm*durationSeconds);
        const chosenMps=Math.min(maximumMps,targetMps,affordableMps);
        if(chosenMps>bunchVelocityMps+EPSILON){
          velocityMps=chosenMps;
          workCostPerKm=lead.leadOutWorkCostPerKm;
          role='lead_out_assembly';
        }
      }else if(activeSprintIds.has(riderId)){
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        velocityMps=1000/secondsPerKm(segment,effect.ability,effort);
        workCostPerKm=FINALE_SPRINT_WORK_COST_PER_KM*
          effect.energyCostMultiplier;
        role='sprint';
      }else if(positionBeforeM>bunchStartM+EPSILON){
        velocityMps=1000/secondsPerKm(segment,effect.ability);
        workCostPerKm=(TUNING.effortCost.conserve+
          TUNING.breakaway.extraCostPerKm)*effect.energyCostMultiplier;
        role='exposed_coast';
      }else if(workers.has(riderId)){
        workCostPerKm=workers.get(riderId).energySpent*10;
        role='front_rotation';
      }
      if(!Number.isFinite(velocityMps)||velocityMps<=0)
        throw new Error(`A rider has no finite finale pace: ${riderId}.`);
      let travelSeconds=durationSeconds;
      let coastSeconds=travelSeconds,shelteredSeconds=0;
      const gapM=Math.max(0,positionBeforeM-bunchStartM);
      if(gapM>EPSILON&&velocityMps<bunchVelocityMps){
        const contactSeconds=gapM/(bunchVelocityMps-velocityMps);
        if(contactSeconds<travelSeconds){
          coastSeconds=contactSeconds;
          shelteredSeconds=travelSeconds-contactSeconds;
        }
      }else if(gapM<=EPSILON&&velocityMps<bunchVelocityMps){
        coastSeconds=0;
        shelteredSeconds=travelSeconds;
        // An unsuccessful ordered effort still spends its actual work even
        // when the moving bunch keeps the rider at the same coordinate.
        if(role==='lead_out'||role==='sprint')
          shelteredCostPerKm=workCostPerKm;
      }
      const projectedM=positionBeforeM+velocityMps*coastSeconds+
        bunchVelocityMps*shelteredSeconds;
      if(projectedM>=finishM-EPSILON){
        // A crossing terminates this rider's work on the common clock.
        const toLine=finishM-positionBeforeM;
        const coastDistanceM=velocityMps*coastSeconds;
        travelSeconds=toLine<=coastDistanceM+EPSILON?
          toLine/velocityMps:coastSeconds+
            (toLine-coastDistanceM)/bunchVelocityMps;
        coastSeconds=Math.min(coastSeconds,travelSeconds);
        shelteredSeconds=travelSeconds-coastSeconds;
      }
      const activeDistanceM=velocityMps*coastSeconds;
      const shelteredDistanceM=bunchVelocityMps*shelteredSeconds;
      const reabsorbedAt=gapM>EPSILON&&shelteredSeconds>EPSILON?{
        distanceM:positionBeforeM+activeDistanceM,
        elapsedSeconds:elapsedSeconds+coastSeconds}:null;
      const distanceTravelledM=activeDistanceM+shelteredDistanceM;
      const energySpent=(activeDistanceM*workCostPerKm+
        shelteredDistanceM*shelteredCostPerKm)/1000;
      if(energySpent>energyAtDecision+EPSILON)
        throw new Error(`A rider cannot pay for actual finale travel: ${riderId}.`);
      const positionM=Math.min(finishM,positionBeforeM+distanceTravelledM);
      const elapsedToLineSeconds=positionM>=finishM-EPSILON?
        elapsedSeconds+travelSeconds:null;
      return {riderId,role,positionBeforeM,positionM,
        distanceTravelledM,activeDistanceM,shelteredDistanceM,
        activeSeconds:coastSeconds,shelteredSeconds,
        activeWorkCostPerKm:workCostPerKm,
        shelteredWorkCostPerKm:shelteredCostPerKm,
        reabsorbedAt,
        energyAtDecision,energySpent,
        energyAfter:Math.max(0,energyAtDecision-energySpent),
        elapsedToLineSeconds};
    });
    for(const row of rows)state.set(row.riderId,{
      positionM:row.positionM,energy:row.energyAfter,
      elapsedToLineSeconds:row.elapsedToLineSeconds??
        state.get(row.riderId).elapsedToLineSeconds});
    const assemblyAttempts=allowAssembly?rows.filter(row=>
      row.role==='lead_out_assembly').map(helper=>{
      const order=plansByHelper.get(helper.riderId);
      const finisher=rows.find(row=>row.riderId===order.finisherId);
      const gapM=helper.positionM-finisher.positionM;
      return {teamId:order.teamId,helperId:helper.riderId,
        finisherId:order.finisherId,
        helperDistanceM:helper.distanceTravelledM,
        helperEnergySpent:helper.energySpent,
        gapAtStartM:helper.positionBeforeM-
          finisher.positionBeforeM,gapAtEndM:gapM,
        status:gapM>=-EPSILON&&gapM<=
          positionedSource.wheelSpacingM+EPSILON?
          'ready_next_boundary':'still_separated'};
    }):null;
    frames.push({startDistanceM:travelStartM,
      endDistanceM:slice.endDistanceM,elapsedSecondsAtStart:elapsedSeconds,
      durationSeconds,bunchSpeedKph,passiveBunchSpeedKph,
      rotation,riders:rows,
      ...(allowAssembly?{assemblyAttempts}:{}),
      ...(positionedSource?{roadEvents:positionedRoadEvents(rows,
        durationSeconds,elapsedSeconds,finishM)}:{})});
    elapsedSeconds+=durationSeconds;
  }
  if(positionedSource){
    const tail=positionedBunchTail({ids,state,frames,finishM,
      elapsedSeconds});
    tail.roadEvents=positionedRoadEvents(tail.riders,
      tail.durationSeconds,elapsedSeconds,finishM);
    frames.push(tail);
    for(const row of tail.riders)state.set(row.riderId,{
      positionM:row.positionM,energy:row.energyAfter,
      elapsedToLineSeconds:row.elapsedToLineSeconds});
  }
  const finishers=ids.map(riderId=>({riderId,
    teamId:teamByRiderId.get(riderId),
    elapsedSecondsFromLastKmStart:state.get(riderId).elapsedToLineSeconds,
    energyAtLine:state.get(riderId).energy}));
  if(finishers.some(row=>!Number.isFinite(
    row.elapsedSecondsFromLastKmStart)))
    throw new Error('The paid runner has not brought every rider to the line.');
  const lineOrder=positionedSource?positionedLineOrder(finishers):null;
  return {version,sourceRoadTraceVersion,
    ...(sourceCatchVersion?{sourceCatchVersion,catchDistanceM}:{}),
    ...(positionedSource?{positionedSource}:{}),
    sprintPlanVersion:plan.version,
    branch,startDistanceM:source.distanceM,
    lineDistanceM:finishM,sourceBunchElapsedSeconds:
      source.bunchElapsedSeconds,frames,finishers,
    ...(positionedSource?{passingRule:'open-road-lab-1',lineOrder}:{}),
    positionSourceStatus:positionedSource?
      positionedSource.status:'collapsed_road_band_candidate',
    resultStatus:positionedSource?
      lineOrder.some(row=>row.position===null)?
        'photo_finish_unresolved':'experimental_inferred_order':
      'provisional_conditional',pointsStatus:'withheld',
    canCommitAwards:false};
}

function positionedBunchTail({ids,state,frames,finishM,elapsedSeconds}){
  const prior=frames.at(-1);
  const priorById=new Map(prior.riders.map(row=>[row.riderId,row]));
  const riders=ids.map(riderId=>{
    const current=state.get(riderId);
    const last=priorById.get(riderId);
    if(current.elapsedToLineSeconds!==null)return {
      riderId,role:'finished',positionBeforeM:finishM,
      positionM:finishM,distanceTravelledM:0,
      activeDistanceM:0,shelteredDistanceM:0,
      activeSeconds:0,shelteredSeconds:0,
      activeWorkCostPerKm:0,shelteredWorkCostPerKm:0,
      energyAtDecision:current.energy,energySpent:0,
      energyAfter:current.energy,
      elapsedToLineSeconds:current.elapsedToLineSeconds};
    const remainingM=finishM-current.positionM;
    const sheltered=last.shelteredSeconds>EPSILON;
    const velocityMps=sheltered?prior.bunchSpeedKph/3.6:
      last.activeDistanceM/last.activeSeconds;
    const workCostPerKm=sheltered?last.shelteredWorkCostPerKm:
      last.activeWorkCostPerKm;
    if(remainingM<=0||!Number.isFinite(velocityMps)||
      velocityMps<=0||!Number.isFinite(workCostPerKm)||
      workCostPerKm<0)
      throw new Error('A positioned rider has no paid line continuation.');
    const travelSeconds=remainingM/velocityMps;
    const energySpent=remainingM*workCostPerKm/1000;
    if(energySpent>current.energy+EPSILON)
      throw new Error(`A positioned rider cannot pay to finish: ${riderId}.`);
    return {riderId,role:last.role,
      positionBeforeM:current.positionM,positionM:finishM,
      distanceTravelledM:remainingM,
      activeDistanceM:sheltered?0:remainingM,
      shelteredDistanceM:sheltered?remainingM:0,
      activeSeconds:sheltered?0:travelSeconds,
      shelteredSeconds:sheltered?travelSeconds:0,
      activeWorkCostPerKm:sheltered?0:workCostPerKm,
      shelteredWorkCostPerKm:sheltered?workCostPerKm:0,
      energyAtDecision:current.energy,energySpent,
      energyAfter:Math.max(0,current.energy-energySpent),
      elapsedToLineSeconds:elapsedSeconds+travelSeconds};
  });
  return {phase:'positioned_bunch_tail',
    startDistanceM:Math.min(...riders.map(row=>row.positionBeforeM)),
    endDistanceM:finishM,
    elapsedSecondsAtStart:elapsedSeconds,
    durationSeconds:Math.max(0,...riders.map(row=>
      row.elapsedToLineSeconds-elapsedSeconds)),
    riders};
}

function positionedLineOrder(finishers){
  const ordered=[...finishers].sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderId.localeCompare(b.riderId));
  return ordered.map((row,index)=>{
    let first=index,last=index;
    while(first>0&&Math.abs(ordered[first-1]
      .elapsedSecondsFromLastKmStart-
      row.elapsedSecondsFromLastKmStart)<=EPSILON)first--;
    while(last<ordered.length-1&&Math.abs(ordered[last+1]
      .elapsedSecondsFromLastKmStart-
      row.elapsedSecondsFromLastKmStart)<=EPSILON)last++;
    return {riderId:row.riderId,teamId:row.teamId,
      elapsedSecondsFromLastKmStart:
        row.elapsedSecondsFromLastKmStart,
      energyAtLine:row.energyAtLine,
      position:first===last?index+1:null,
      firstPossiblePlace:first+1,lastPossiblePlace:last+1};
  });
}

function positionDuringFrame(row,seconds,finishM){
  const active=Math.min(seconds,row.activeSeconds);
  const sheltered=Math.min(Math.max(0,seconds-row.activeSeconds),
    row.shelteredSeconds);
  const activeSpeed=row.activeSeconds>0?
    row.activeDistanceM/row.activeSeconds:0;
  const shelteredSpeed=row.shelteredSeconds>0?
    row.shelteredDistanceM/row.shelteredSeconds:0;
  return Math.min(finishM,row.positionBeforeM+
    active*activeSpeed+sheltered*shelteredSpeed);
}

// Test-only open-road passing: crossing trajectories have a measured event,
// but no lane blockage, drafting or contact response is inferred from it.
// The explicit limitation keeps this order out of official settlement.
export function positionedRoadEvents(rows,durationSeconds,elapsedSeconds,
  finishM){
  const events=[];
  for(let index=0;index<rows.length;index++)for(let otherIndex=0;
    otherIndex<rows.length;otherIndex++){
    if(index===otherIndex)continue;
    const passer=rows[index],passed=rows[otherIndex];
    if(passer.positionBeforeM>=passed.positionBeforeM-EPSILON)
      continue;
    const finishedEarlier=passer.elapsedToLineSeconds!==null&&
      passed.elapsedToLineSeconds!==null&&
      passer.elapsedToLineSeconds<passed.elapsedToLineSeconds-EPSILON;
    if(!finishedEarlier&&
      passer.positionM<=passed.positionM+EPSILON)continue;
    const boundaries=[0,durationSeconds,
      passer.activeSeconds,passer.activeSeconds+passer.shelteredSeconds,
      passed.activeSeconds,passed.activeSeconds+passed.shelteredSeconds]
      .filter(value=>value>=0&&value<=durationSeconds+EPSILON)
      .sort((a,b)=>a-b);
    for(let part=1;part<boundaries.length;part++){
      const from=boundaries[part-1],to=boundaries[part];
      if(to-from<=EPSILON)continue;
      const gapFrom=positionDuringFrame(passer,from,finishM)-
        positionDuringFrame(passed,from,finishM);
      const gapTo=positionDuringFrame(passer,to,finishM)-
        positionDuringFrame(passed,to,finishM);
      if(gapFrom>=-EPSILON||gapTo<0)continue;
      const seconds=from+(to-from)*(-gapFrom)/(gapTo-gapFrom);
      events.push({kind:'open_road_pass',passerId:passer.riderId,
        passedId:passed.riderId,
        elapsedSeconds:elapsedSeconds+seconds,
        positionM:positionDuringFrame(passer,seconds,finishM)});
      break;
    }
  }
  return events.sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds||
    a.passerId.localeCompare(b.passerId)||
    a.passedId.localeCompare(b.passedId));
}

export function validateFinalePaidBunchRunnerFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePaidBunchRunnerFromTour(tour,input)))
    throw new Error('The paid bunch runner does not replay.');
  return true;
}

export function validateFinalePositionedBunchRunnerFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePositionedBunchRunnerFromTour(tour,input)))
    throw new Error('The positioned bunch runner does not replay.');
  return true;
}

export function validateFinaleIndependentBunchRunnerFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleIndependentBunchRunnerFromTour(tour,input)))
    throw new Error('The independent bunch runner does not replay.');
  return true;
}

export function validateFinaleAssembledBunchRunnerFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleAssembledBunchRunnerFromTour(tour,input)))
    throw new Error('The assembled bunch runner does not replay.');
  return true;
}

export function validateFinaleEarlyBunchRunnerFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleEarlyBunchRunnerFromTour(tour,input)))
    throw new Error('The early bunch runner does not replay.');
  return true;
}

export function validateFinalePaidPostContactRunnerFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePaidPostContactRunnerFromTour(tour,input)))
    throw new Error('The post-contact runner does not replay.');
  return true;
}

export function validateFinalePaidOneClockContactRunnerFromTour(tour,input,
  oneClock,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePaidOneClockContactRunnerFromTour(tour,input,oneClock)))
    throw new Error('The one-clock contact continuation does not replay.');
  return true;
}
