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
import {decideFinaleRotationSoloOutcomeFromTour,
  recordFinaleRotationSoloCatchSliceFromTour,
  recordFinaleRotationSoloSliceFromTour,
  recordFinaleRotationSoloSecondCatchFromTour,
  recordFinaleRotationSoloLateCatchFromTour} from
  './finale-rotation-solo-slice.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour,
  recordFinaleRotationSoloSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
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

function runPaidBunch(tour,{source,plan,branch,sourceRoadTraceVersion,
  sourceCatchVersion=null,catchDistanceM=null,version}){
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRiderId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const ids=source.pelotonRiderIds;
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=source.distanceM);
  if(ids.length!==ridersById.size||new Set(ids).size!==ids.length||
    slices.length!==(finishM-source.distanceM)/100||
    slices.length<1||slices.length>5||
    slices.some(slice=>slice.lengthM!==100)||
    plan.decisionDistanceM!==finishM-500||
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
  const state=new Map(ids.map(id=>[id,{positionM:source.distanceM,
    energy:initialEnergy.get(id),elapsedToLineSeconds:null}]));
  const segment=tour.route.kilometres.at(-1);
  let elapsedSeconds=source.bunchElapsedSeconds;
  const frames=[];
  for(const slice of slices){
    const approachPhase=slice.startDistanceM<finishM-300;
    const bunchStartM=slice.startDistanceM;
    const bunchIds=ids.filter(id=>state.get(id).positionM<=
      bunchStartM+EPSILON&&state.get(id).elapsedToLineSeconds===null);
    const energies=new Map(ids.map(id=>[id,state.get(id).energy]));
    const busyTeamIds=plan.decisions.filter(row=>approachPhase?
      row.leadOutRiderId!==null:row.leadOutRiderId!==null||
        teams.find(team=>team.id===row.teamId).orders.helperIds
          .includes(row.finisherId)).map(row=>row.teamId);
    const rotation=recordFinaleFrontRotationSlice({slice,
      route:tour.route,teams,pelotonRiderIds:bunchIds,
      energies,busyTeamIds});
    const workers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    const activeSprintIds=new Set(approachPhase?[]:plan.decisions
      .map(row=>row.finisherId).filter(id=>{
        const energy=energies.get(id);
        const effect=riderKilometreEffect(ridersById.get(id),segment,{
          phase:'finale',energy,exposed:segment.exposed});
        return FINALE_SPRINT_WORK_COST_PER_KM*
          effect.energyCostMultiplier*.1<=energy+EPSILON;
      }));
    const passiveIds=bunchIds.filter(id=>!activeSprintIds.has(id));
    if(!passiveIds.length)
      throw new Error('The paid runner has no passive bunch.');
    const passiveBunchSpeedKph=finalePassiveBunchSpeed({
      riderIds:passiveIds,ridersById,energies,segment});
    const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
      rotation.selected?.speedKph??0);
    const durationSeconds=360/bunchSpeedKph;
    const bunchVelocityMps=100/durationSeconds;
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
      if(approachPhase&&plansByHelper.has(riderId)){
        const lead=plansByHelper.get(riderId);
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        velocityMps=1000/secondsPerKm(segment,effect.ability,effort,
          TUNING.breakaway.bunchDraftAdvantage);
        workCostPerKm=lead.leadOutWorkCostPerKm;
        role='lead_out';
      }else if(approachPhase&&plansByFinisher.get(riderId)?.leadOutRiderId){
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
    frames.push({startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,elapsedSecondsAtStart:elapsedSeconds,
      durationSeconds,bunchSpeedKph,passiveBunchSpeedKph,
      rotation,riders:rows});
    elapsedSeconds+=durationSeconds;
  }
  const finishers=ids.map(riderId=>({riderId,
    teamId:teamByRiderId.get(riderId),
    elapsedSecondsFromLastKmStart:state.get(riderId).elapsedToLineSeconds,
    energyAtLine:state.get(riderId).energy}));
  if(finishers.some(row=>!Number.isFinite(
    row.elapsedSecondsFromLastKmStart)))
    throw new Error('The paid runner has not brought every rider to the line.');
  return {version,sourceRoadTraceVersion,
    ...(sourceCatchVersion?{sourceCatchVersion,catchDistanceM}:{}),
    sprintPlanVersion:plan.version,
    branch,startDistanceM:source.distanceM,
    lineDistanceM:finishM,sourceBunchElapsedSeconds:
      source.bunchElapsedSeconds,frames,finishers,
    positionSourceStatus:'collapsed_road_band_candidate',
    resultStatus:'provisional_conditional',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinalePaidBunchRunnerFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePaidBunchRunnerFromTour(tour,input)))
    throw new Error('The paid bunch runner does not replay.');
  return true;
}

export function validateFinalePaidPostContactRunnerFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinalePaidPostContactRunnerFromTour(tour,input)))
    throw new Error('The post-contact runner does not replay.');
  return true;
}
