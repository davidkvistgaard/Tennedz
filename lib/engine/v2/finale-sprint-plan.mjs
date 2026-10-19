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
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {recordFinaleLastKmNamedIntentsFromTour,
  FINALE_LAST_KM_ALL_INTENTS_VERSION} from
  './finale-last-km-named-intents.mjs';
import {orderAt} from './orders.mjs';

export const FINALE_SPRINT_PLAN_VERSION='v2-finale-sprint-plan-1';
export const FINALE_ROTATION_CATCH_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-catch-sprint-plan-2';
export const FINALE_ROTATION_CONTAINED_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-contained-sprint-plan-3';
export const FINALE_ROTATION_SOLO_SPRINT_PLAN_VERSION=
  'v2-finale-rotation-solo-sprint-plan-4';
export const FINALE_EARLY_BUNCH_SPRINT_PLAN_VERSION=
  'v2-finale-early-bunch-sprint-plan-5';
export const FINALE_INACTIVE_INTENTS_SPRINT_PLAN_VERSION=
  'v2-finale-inactive-intents-sprint-plan-6';
export const FINALE_MULTIBAND_SPRINT_PLAN_VERSION=
  'v2-finale-multiband-sprint-plan-lab-7';
export const FINALE_DEPLETED_SPRINT_PLAN_VERSION=
  'v2-finale-depleted-sprint-plan-lab-8';
export const FINALE_LATE_MERGED_SPRINT_PLAN_VERSION=
  'v2-finale-late-merged-sprint-plan-lab-9';
export const FINALE_LATE_SEPARATED_SPRINT_PLAN_VERSION=
  'v2-finale-late-separated-sprint-plan-lab-10';
export const FINALE_DUAL_SEPARATED_SPRINT_PLAN_VERSION=
  'v2-finale-dual-separated-sprint-plan-lab-11';

// Two already paid solo bands remain ahead of the bunch. The nominated
// finisher still belongs to the locked team and no earlier helper work is
// inferred at this late handoff.
export function recordFinaleDualSeparatedSprintPlanFromTour(tour,{
  source,plans,sourceRoadTraceVersion}){
  const finishM=tour?.route?.distanceKm*1000;
  if(!Number.isFinite(source?.endDistanceM)||
    source.endDistanceM<=finishM-500||source.endDistanceM>=finishM||
    source.roadGroups?.length!==2||
    source.roadGroups.some(group=>group.riderIds?.length!==1)||
    source.roadGroups[0].riderIds[0]===
      source.roadGroups[1].riderIds[0]||
    typeof sourceRoadTraceVersion!=='string'||!sourceRoadTraceVersion||
    plans?.some(row=>row.leadOutRiderId!==null&&
      row.leadOutRiderId!==undefined))
    throw new Error('A dual separated plan needs two paid solos and no lead-out.');
  return recordSprintPlanAtRoad(tour,{source,plans,
    sourceRoadTraceVersion,
    version:FINALE_DUAL_SEPARATED_SPRINT_PLAN_VERSION});
}

// After the rear attack is caught, a surviving front rider remains a separate
// road group. Lock finishers for the paid bunch without inventing helper work.
export function recordFinaleLateSeparatedSprintPlanFromTour(tour,{
  source,plans,sourceRoadTraceVersion}){
  const finishM=tour?.route?.distanceKm*1000;
  if(!Number.isFinite(source?.endDistanceM)||
    source.endDistanceM<=finishM-500||source.endDistanceM>=finishM||
    source.roadGroups?.length!==1||
    source.roadGroups[0].riderIds?.length!==1||
    typeof sourceRoadTraceVersion!=='string'||!sourceRoadTraceVersion||
    plans?.some(row=>row.leadOutRiderId!==null&&
      row.leadOutRiderId!==undefined))
    throw new Error('A late separated plan needs one paid solo and no lead-out.');
  return recordSprintPlanAtRoad(tour,{source,plans,
    sourceRoadTraceVersion,
    version:FINALE_LATE_SEPARATED_SPRINT_PLAN_VERSION});
}

// A complete bunch formed after 500 m can first nominate a finisher at its
// next paid boundary. Earlier helper work cannot be inferred from this road.
export function recordFinaleLateMergedSprintPlanFromTour(tour,{
  source,plans,sourceRoadTraceVersion}){
  const finishM=tour?.route?.distanceKm*1000;
  if(!Number.isFinite(source?.endDistanceM)||
    source.endDistanceM<=finishM-500||source.endDistanceM>=finishM||
    source.roadGroups?.length||
    typeof sourceRoadTraceVersion!=='string'||!sourceRoadTraceVersion||
    plans?.some(row=>row.leadOutRiderId!==null&&
      row.leadOutRiderId!==undefined))
    throw new Error('A late merged sprint plan needs a paid bunch without a lead-out.');
  return recordSprintPlanAtRoad(tour,{source,plans,
    sourceRoadTraceVersion,
    version:FINALE_LATE_MERGED_SPRINT_PLAN_VERSION});
}

// Lock the same finisher and optional helper roles at a paid multiband
// 500 m passage. A helper in another band is still unavailable.
export function recordFinaleMultibandSprintPlanFromTour(tour,{
  source,plans,sourceRoadTraceVersion}){
  if(source?.endDistanceM!==tour?.route?.distanceKm*1000-500||
    typeof sourceRoadTraceVersion!=='string'||
    !sourceRoadTraceVersion)
    throw new Error('A multiband sprint plan needs the paid 500 m road.');
  return recordSprintPlanAtRoad(tour,{source,plans,
    sourceRoadTraceVersion,
    version:FINALE_MULTIBAND_SPRINT_PLAN_VERSION});
}

// Keep an isolated dropped rider in the locked roster without pretending
// that several dropped riders form one cooperative road group. Their helper
// cannot work beside a finisher in another road band.
export function recordFinaleDepletedSprintPlanFromTour(tour,{
  source,plans,sourceRoadTraceVersion}){
  if(source?.endDistanceM!==tour?.route?.distanceKm*1000-500||
    !Array.isArray(source.isolatedRiderIds)||
    !source.isolatedRiderIds.length||
    typeof sourceRoadTraceVersion!=='string'||
    !sourceRoadTraceVersion)
    throw new Error('A depleted sprint plan needs the paid 500 m road.');
  return recordSprintPlanAtRoad(tour,{source,plans,
    sourceRoadTraceVersion,
    version:FINALE_DEPLETED_SPRINT_PLAN_VERSION});
}

// Lock the same rider roles against the recorded one-kilometre energy and
// road, before any positioning work. This path admits only a complete bunch
// with no final-kilometre attack order; other roads keep their older plans.
export function recordFinaleEarlyBunchSprintPlanFromTour(tour,{plans}){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  if(field.roadGroups.length||field.droppedRiderIds.length||
    field.pelotonRiderIds.length!==field.riders.length||
    tour.committedInputs.teams.some(team=>
      orderAt(team.orders,tour.route.distanceKm-1).attack!=='none'))
    throw new Error('An early bunch plan needs one inactive-attack bunch.');
  const source={endDistanceM:field.startDistanceM,
    roadGroups:[],pelotonRiderIds:field.pelotonRiderIds,
    riderEnergy:field.riders.map(row=>({riderId:row.riderId,
      energyAfter:row.energy}))};
  return recordSprintPlanAtRoad(tour,{source,plans,
    version:FINALE_EARLY_BUNCH_SPRINT_PLAN_VERSION,
    sourceRoadTraceVersion:field.version});
}

export function validateFinaleEarlyBunchSprintPlanFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleEarlyBunchSprintPlanFromTour(tour,input)))
    throw new Error('The early bunch plan does not replay.');
  return true;
}

// A manager may retain an attack order that is not due or cannot launch at
// the locked handoff. Only the complete, nonlaunching ledger admits this
// independent bunch path; eligible attacks still need paid road movement.
export function recordFinaleInactiveIntentsSprintPlanFromTour(tour,{plans}){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour,{
    version:FINALE_LAST_KM_ALL_INTENTS_VERSION});
  if(field.roadGroups.length||field.droppedRiderIds.length||
    field.pelotonRiderIds.length!==field.riders.length||
    intents.named.some(row=>row.canEnterRoadContest)||
    intents.unnamed.some(row=>row.canEnterRoadContest)||
    intents.otherPendingActions.length)
    throw new Error('The inactive-intents bunch has an unresolved road action.');
  const source={endDistanceM:field.startDistanceM,
    roadGroups:[],pelotonRiderIds:field.pelotonRiderIds,
    riderEnergy:field.riders.map(row=>({riderId:row.riderId,
      energyAfter:row.energy}))};
  return {...recordSprintPlanAtRoad(tour,{source,plans,
    version:FINALE_INACTIVE_INTENTS_SPRINT_PLAN_VERSION,
    sourceRoadTraceVersion:field.version}),
  sourceIntentVersion:intents.version};
}

// A preview-only tactical lock at 500 m. The independent nominations are
// checked against the actual short-step road and energy at that boundary.
// It neither moves riders nor grants a lead-out or sprint advantage.
export function recordFinaleSprintPlanFromTour(tour,{attackTeamId,plans}){
  const road=probeLastKmNamedAttackRoadFromTour(tour,{teamId:attackTeamId});
  const source=road.frames.find(frame=>frame.endDistanceM===
    tour.route.distanceKm*1000-500);
  return recordSprintPlanAtRoad(tour,{source,plans,
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
  return recordSprintPlanAtRoad(tour,{source,plans,
    version,
    sourceRoadTraceVersion:road.version});
}

function recordSprintPlanAtRoad(tour,{source,plans,version,
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
  const isolatedRiderIds=source.isolatedRiderIds??[];
  const isolated=new Set(isolatedRiderIds);
  const present=new Set([...source.pelotonRiderIds,
    ...roadGroupById.keys(),...isolated]);
  const riderStates=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,energy:energyById.get(rider.id),
    roadGroupId:roadGroupById.get(rider.id)??
      (isolated.has(rider.id)?`isolated:${rider.id}`:'peloton')})));
  if(riderStates.length!==present.size||
    isolatedRiderIds.length!==isolated.size||
    source.pelotonRiderIds.length+
      [...roadGroupById.keys()].length+isolatedRiderIds.length!==
      present.size||riderStates.some(state=>
    !present.has(state.riderId)||!Number.isFinite(state.energy)))
    throw new Error('The sprint decision needs a complete road state.');
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
