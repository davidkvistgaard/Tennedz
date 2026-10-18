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
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_PAID_BUNCH_RUNNER_VERSION=
  'v2-finale-paid-bunch-runner-1';
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
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRiderId=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const ids=road.at500M.pelotonRiderIds;
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=finishM-500);
  if(ids.length!==ridersById.size||new Set(ids).size!==ids.length||
    slices.length!==5||slices.some(slice=>slice.lengthM!==100)||
    road.at500M.distanceM!==finishM-500||
    plan.decisionDistanceM!==road.at500M.distanceM||
    plan.sourceRoadTraceVersion!==road.version)
    throw new Error('The paid runner needs one locked 500 m road and plan.');
  const plansByFinisher=new Map(plan.decisions.map(row=>
    [row.finisherId,row]));
  const plansByHelper=new Map(plan.decisions.filter(row=>
    row.leadOutRiderId).map(row=>[row.leadOutRiderId,row]));
  const initialEnergy=new Map(road.at500M.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  if(initialEnergy.size!==ids.length||ids.some(id=>
    !Number.isFinite(initialEnergy.get(id))))
    throw new Error('The paid runner lost a rider at the source.');
  const state=new Map(ids.map(id=>[id,{positionM:finishM-500,
    energy:initialEnergy.get(id),elapsedToLineSeconds:null}]));
  const segment=tour.route.kilometres.at(-1);
  let elapsedSeconds=road.at500M.bunchElapsedSeconds;
  const frames=[];
  for(const [index,slice] of slices.entries()){
    const bunchStartM=slice.startDistanceM;
    const bunchIds=ids.filter(id=>state.get(id).positionM<=
      bunchStartM+EPSILON&&state.get(id).elapsedToLineSeconds===null);
    const energies=new Map(ids.map(id=>[id,state.get(id).energy]));
    const busyTeamIds=plan.decisions.filter(row=>index<2?
      row.leadOutRiderId!==null:row.leadOutRiderId!==null||
        teams.find(team=>team.id===row.teamId).orders.helperIds
          .includes(row.finisherId)).map(row=>row.teamId);
    const rotation=recordFinaleFrontRotationSlice({slice,
      route:tour.route,teams,pelotonRiderIds:bunchIds,
      energies,busyTeamIds});
    const workers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    const activeSprintIds=new Set(index<2?[]:plan.decisions
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
      if(index<2&&plansByHelper.has(riderId)){
        const lead=plansByHelper.get(riderId);
        const effort=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        velocityMps=1000/secondsPerKm(segment,effect.ability,effort,
          TUNING.breakaway.bunchDraftAdvantage);
        workCostPerKm=lead.leadOutWorkCostPerKm;
        role='lead_out';
      }else if(index<2&&plansByFinisher.get(riderId)?.leadOutRiderId){
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
  return {version:FINALE_PAID_BUNCH_RUNNER_VERSION,
    sourceRoadTraceVersion:road.version,sprintPlanVersion:plan.version,
    branch:decision.branch,startDistanceM:finishM-500,
    lineDistanceM:finishM,sourceBunchElapsedSeconds:
      road.at500M.bunchElapsedSeconds,frames,finishers,
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
