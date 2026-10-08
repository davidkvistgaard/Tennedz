import {isDeepStrictEqual} from 'node:util';
import {probeLastKmNamedAttackRoadFromTour} from
  './finale-last-km-named-attack.mjs';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {selectFinaleLeadOut,FINALE_LEAD_OUT_VERSION} from
  './finale-lead-out.mjs';

export const FINALE_SPRINT_PLAN_VERSION='v2-finale-sprint-plan-1';
export const FINALE_ROTATION_CATCH_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-catch-sprint-plan-2';
export const FINALE_ROTATION_CONTAINED_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-contained-sprint-plan-3';
export const FINALE_ROTATION_SOLO_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-solo-sprint-plan-4';

// A preview-only tactical lock at 500 m. The independent nominations are
// checked against the actual short-step road and energy at that boundary.
// It neither moves riders nor grants a lead-out or sprint advantage.
export function recordFinaleSprintPlanFromTour(tour,{attackTeamId,plans}){
  const road=probeLastKmNamedAttackRoadFromTour(tour,{teamId:attackTeamId});
  const source=road.frames.find(frame=>frame.endDistanceM===
    tour.route.distanceKm*1000-500);
  return recordSprintPlanAt500M(tour,{source,plans,
    version:FINALE_SPRINT_PLAN_VERSION,sourceRoadTraceVersion:road.version});
}

// The separate rotating-catch source must supply its own actual 500 m state.
// A valid nomination still grants no position, sprint gain or classification.
export function recordFinaleRotationCatchSprintPlanFromTour(tour,
  {attackTeamId,plans}){
  const road=probeLastKmRotationCatchFromTour(tour,{teamId:attackTeamId});
  return recordRotationPlan(tour,{road,plans,
    version:FINALE_ROTATION_CATCH_SPRINT_PLAN_VERSION});
}

// A contained named attack has a separate source version and actual energy.
// The same role validation applies only after that source reaches 500 m.
export function recordFinaleRotationContainedSprintPlanFromTour(tour,
  {attackTeamId,plans}){
  const road=probeLastKmRotationContainedFromTour(tour,{
    teamId:attackTeamId});
  return recordRotationPlan(tour,{road,plans,
    version:FINALE_ROTATION_CONTAINED_SPRINT_PLAN_VERSION});
}

// The separated solo branch locks the same player nominations against its
// own 500 m road state. A helper left in the bunch cannot lead out the solo.
export function recordFinaleRotationSoloSprintPlanFromTour(tour,
  {attackTeamId,plans}){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:attackTeamId});
  return recordRotationPlan(tour,{road,plans,
    version:FINALE_ROTATION_SOLO_SPRINT_PLAN_VERSION});
}

function recordRotationPlan(tour,{road,plans,version}){
  const source={endDistanceM:road.at500M.distanceM,
    roadGroups:road.at500M.roadGroups,
    pelotonRiderIds:road.at500M.pelotonRiderIds,
    riderEnergy:road.at500M.riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energy}))};
  return recordSprintPlanAt500M(tour,{source,plans,
    version,
    sourceRoadTraceVersion:road.version});
}

function recordSprintPlanAt500M(tour,{source,plans,version,
  sourceRoadTraceVersion}){
  const teams=tour.committedInputs.teams;
  if(!source||!Array.isArray(plans)||plans.length!==teams.length||
    new Set(plans.map(plan=>plan?.teamId)).size!==teams.length||
    plans.some(plan=>!teams.some(team=>team.id===plan?.teamId)||
      !plan||typeof plan!=='object'||Array.isArray(plan)||
      Object.keys(plan).some(key=>
        !['teamId','finisherId','leadOutRiderId'].includes(key))))
    throw new Error('Every locked team needs one distinct finale sprint plan.');
  const energyById=new Map(source.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const roadGroupById=new Map(source.roadGroups.flatMap(group=>
    group.riderIds.map(riderId=>[riderId,group.id])));
  const present=new Set([...source.pelotonRiderIds,
    ...roadGroupById.keys()]);
  const riderStates=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,energy:energyById.get(rider.id),
    roadGroupId:roadGroupById.get(rider.id)??'peloton'})));
  if(riderStates.length!==present.size||riderStates.some(state=>
    !present.has(state.riderId)||!Number.isFinite(state.energy)))
    throw new Error('The sprint decision needs the complete 500 m road state.');
  const byTeam=new Map(plans.map(plan=>[plan.teamId,plan]));
  const decisions=teams.map(team=>{
    const plan=byTeam.get(team.id);
    const finisher=team.riders.find(rider=>rider.id===plan.finisherId);
    const helper=plan.leadOutRiderId??null;
    if(!finisher||helper!==null&&
      (!team.orders.helperIds.includes(helper)||helper===finisher.id))
      throw new Error('The sprint roles must be distinct locked team riders.');
    const states=riderStates.filter(state=>team.riders.some(rider=>
      rider.id===state.riderId));
    const finisherState=states.find(state=>state.riderId===finisher.id);
    if(helper===null)return {teamId:team.id,finisherId:finisher.id,
      leadOutRiderId:null,roadGroupId:finisherState.roadGroupId,
      finisherEnergy:finisherState.energy,leadOutEnergy:null,
      leadOutWorkCostPerKm:null};
    const selection=selectFinaleLeadOut({team,finisherId:finisher.id,
      nomineeId:helper,riderStates:states,
      segment:tour.route.kilometres.at(-1)});
    if(selection.selectedRiderId!==helper)
      throw new Error('The nominated lead-out cannot work beside the finisher.');
    return {teamId:team.id,finisherId:finisher.id,
      leadOutRiderId:helper,roadGroupId:finisherState.roadGroupId,
      finisherEnergy:finisherState.energy,
      leadOutEnergy:states.find(state=>state.riderId===helper).energy,
      leadOutWorkCostPerKm:selection.selectedWorkCostPerKm};
  });
  return {version,
    sourceRoadTraceVersion,
    leadOutSelectionVersion:FINALE_LEAD_OUT_VERSION,
    decisionDistanceM:source.endDistanceM,decisions};
}

export function validateFinaleSprintPlanFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleSprintPlanFromTour(tour,input)))
    throw new Error('The finale sprint plan does not replay.');
  return true;
}

export function validateFinaleRotationCatchSprintPlanFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchSprintPlanFromTour(tour,input)))
    throw new Error('The rotating-catch sprint plan does not replay.');
  return true;
}

export function validateFinaleRotationContainedSprintPlanFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationContainedSprintPlanFromTour(tour,input)))
    throw new Error('The contained-rotation sprint plan does not replay.');
  return true;
}

export function validateFinaleRotationSoloSprintPlanFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSprintPlanFromTour(tour,input)))
    throw new Error('The solo rotation sprint plan does not replay.');
  return true;
}
