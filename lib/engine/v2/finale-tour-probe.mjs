import {validateRecordedTour} from './recording.mjs';
import {buildFinaleWorkerPlan,finaleWorkerStep,validateFinaleWorker} from './finale-worker.mjs';
import {simulateFinalePair} from './finale-pair.mjs';
import {simulateFinaleRelay} from './finale-relay.mjs';
import {recordFinaleLeadOutPull} from './finale-lead-out-pull.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {advanceFinaleGroupStep} from './finale-group-step.mjs';
import {simulateFinaleGroupRun,simulateFinaleGroupToLine} from './finale-group-run.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';
import {hasResidualGapAfterSufficientChase} from './balance-audit.mjs';

// Read-only bridges from a completed kilometre recording to isolated worker
// laboratories. Neither can substitute for a road-group finale.
function soloSnapshot(tour,frontRiderId){
  validateRecordedTour(tour);
  const sourceKm=tour.route.distanceKm-5;
  const frame=tour.frames[sourceKm-1];
  if(frame?.km!==sourceKm||frame.roadGroups.length!==1||
    frame.roadGroups[0].riderIds.length!==1||
    frame.roadGroups[0].riderIds[0]!==frontRiderId||
    !Number.isFinite(frame.roadGroups[0].gapSeconds)||
    frame.roadGroups[0].gapSeconds<=0)
    throw new Error('The 5 km snapshot needs the selected rider alone ahead of the bunch.');
  const frontState=frame.riderGroups.find(rider=>rider.id===frontRiderId);
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.id===frontState?.teamId);
  if(!frontTeam||frontState.group!=='breakaway')
    throw new Error('The selected solo rider must still be in the front group.');
  const sourceWarnings=hasResidualGapAfterSufficientChase(tour.frames,sourceKm-1)?
    ['residual_gap_after_sufficient_chase']:[];
  return {sourceKm,frame,frontState,frontTeam,sourceWarnings};
}

function chasingHelper(tour,frame,chaseRiderId,frontTeamId){
  const chaseState=frame.riderGroups.find(rider=>rider.id===chaseRiderId);
  const chaseTeam=tour.committedInputs.teams.find(team=>
    team.id===chaseState?.teamId);
  if(!chaseTeam||frontTeamId===chaseTeam.id||
    chaseState.group!=='peloton'||
    !frame.engagedChaseTeamIds.includes(chaseTeam.id))
    throw new Error('The selected rival must be in a team engaged in the bunch chase.');
  return {team:chaseTeam,riderId:chaseRiderId,energy:chaseState.energy};
}

export function probeFinalePairFromTour(tour,{frontRiderId,chaseRiderId}){
  const {sourceKm,frame,frontState,frontTeam,sourceWarnings}=
    soloSnapshot(tour,frontRiderId);
  const chaser=chasingHelper(tour,frame,chaseRiderId,frontTeam.id);
  const input={route:tour.route,
    initialGapSeconds:frame.roadGroups[0].gapSeconds,
    front:buildFinaleWorkerPlan({route:tour.route,team:frontTeam,
      riderId:frontRiderId,energy:frontState.energy,role:'front'}),
    rear:buildFinaleWorkerPlan({route:tour.route,...chaser,role:'chase'})};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,sourceWarnings,input,
    recording:simulateFinalePair(input)};
}

// The manager-selected rotation is counterfactual; both helpers must really be
// in the bunch and their teams must already be engaged at the source frame.
export function probeFinaleRelayFromTour(tour,{frontRiderId,chaseRiderIds,rotation}){
  const {sourceKm,frame,frontState,frontTeam,sourceWarnings}=
    soloSnapshot(tour,frontRiderId);
  if(!Array.isArray(chaseRiderIds)||chaseRiderIds.length!==2||
    new Set(chaseRiderIds).size!==2)
    throw new Error('The relay needs two different nominated helpers.');
  const input={route:tour.route,initialGapSeconds:frame.roadGroups[0].gapSeconds,
    front:{team:frontTeam,riderId:frontRiderId,energy:frontState.energy},
    chasers:chaseRiderIds.map(id=>chasingHelper(tour,frame,id,frontTeam.id)),
    rotation};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,sourceWarnings,input,
    recording:simulateFinaleRelay(input)};
}

// A real one-kilometre-to-go snapshot supplies the proposed train's roster,
// road groups and already-spent energy. The alternative pull remains read-only.
export function probeFinaleLeadOutFromTour(tour,{teamId,finisherId,nomineeId=null,
  launchIntent}){
  validateRecordedTour(tour);
  const sourceKm=tour.route.distanceKm-1;
  const frame=tour.frames[sourceKm-1];
  const team=tour.committedInputs.teams.find(candidate=>candidate.id===teamId);
  if(!frame||frame.km!==sourceKm||!team||
    !team.riders.some(rider=>rider.id===finisherId))
    throw new Error('Lead-out probe needs a locked team and finisher at one kilometre to go.');
  const riderStates=team.riders.map(rider=>{
    const state=frame.riderGroups.find(candidate=>candidate.id===rider.id);
    const roadGroup=frame.roadGroups.find(group=>group.riderIds.includes(rider.id));
    if(!state||state.group==='breakaway'&&!roadGroup)
      throw new Error('Lead-out source rider lacks a recorded road state.');
    return {riderId:rider.id,energy:state.energy,
      roadGroupId:roadGroup?.id??state.group};
  });
  const input={route:tour.route,team,finisherId,nomineeId,riderStates,launchIntent};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,
    sourceWarnings:hasResidualGapAfterSufficientChase(tour.frames,sourceKm-1)?
      ['residual_gap_after_sufficient_chase']:[],
    input,recording:recordFinaleLeadOutPull(input)};
}

// An explicit, counterfactual first distance slice for a recorded road group
// and the bunch. Worker speed and every rider's cost come from their locked
// roster, orders, route and actual five-kilometre energy. Later slices, group
// merges and finish placement remain outside this isolated probe.
export function probeFinaleGroupStepFromTour(tour,{frontPullRiderId,
  chasePullRiderId}){
  const snapshot=finaleSnapshotFromTour(tour);
  if(snapshot.roadGroups.length!==1||!snapshot.peloton.riderIds.length)
    throw new Error('The group-step probe needs one road group and the bunch.');
  const frontGroup=snapshot.roadGroups[0];
  if(!frontGroup.riderIds.includes(frontPullRiderId))
    throw new Error('The front puller must be in the recorded road group.');
  const source= tour.frames[snapshot.sourceKm-1];
  const stateById=new Map(snapshot.riders.map(rider=>[rider.riderId,rider]));
  const teamByRider=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team])));
  const frontTeam=teamByRider.get(frontPullRiderId);
  const frontState=stateById.get(frontPullRiderId);
  const frontOrder=orderAt(frontTeam.orders,snapshot.sourceKm);
  if(frontOrder.breakWork==='sit_on')
    throw new Error('A rider ordered to sit on cannot pull the front group.');
  const chase=chasingHelper(tour,source,chasePullRiderId,frontTeam.id);
  validateFinaleWorker({team:frontTeam,riderId:frontPullRiderId,
    energy:frontState.energy,role:'front'});
  validateFinaleWorker({...chase,role:'chase'});
  const slice=finaleDistanceGrid(tour.route)[0];
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const pullStep=(riderId,role)=>{
    const team=teamByRider.get(riderId);
    return finaleWorkerStep({rider:team.riders.find(rider=>rider.id===riderId),
      segment,order:orderAt(team.orders,slice.sourceKm-1),
      energy:stateById.get(riderId).energy,role});
  };
  const frontStep=pullStep(frontPullRiderId,'front');
  const chaseStep=pullStep(chasePullRiderId,'chase');
  const riderPlans=[...frontGroup.riderIds,...snapshot.peloton.riderIds]
    .map(riderId=>{
      const state=stateById.get(riderId);
      const rider=teamByRider.get(riderId)?.riders.find(row=>row.id===riderId);
      if(!state||!rider)throw new Error('A group rider lacks a locked state.');
      const pulling=riderId===frontPullRiderId||riderId===chasePullRiderId;
      const workCostPerKm=pulling?
        (riderId===frontPullRiderId?frontStep:chaseStep).workCostPerKm:
        TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
          phase:'chase',energy:state.energy,exposed:segment.exposed,
        }).energyCostMultiplier;
      return {riderId,energy:state.energy,workCostPerKm};
    });
  const input={slice,frontGroup,pelotonRiderIds:snapshot.peloton.riderIds,
    frontPull:{riderId:frontPullRiderId,speedKph:frontStep.speedKph},
    chasePull:{riderId:chasePullRiderId,speedKph:chaseStep.speedKph},
    riderPlans};
  return {sourceKm:snapshot.sourceKm,sourceTuningVersion:tour.tuningVersion,
    sourceWarnings:hasResidualGapAfterSufficientChase(tour.frames,
      snapshot.sourceKm-1)?['residual_gap_after_sufficient_chase']:[],
    snapshot,input,recording:advanceFinaleGroupStep(input)};
}

// Reuse the same validated source for a continuous counterfactual run. The
// nominated workers must be present and the rival chase already engaged.
export function probeFinaleGroupRunFromTour(tour,{frontPullRiderId,
  chasePullRiderId,chaseRotationRiderIds=null,paceVersion=null}){
  const snapshot=finaleSnapshotFromTour(tour);
  if(snapshot.roadGroups.length!==1||
    !snapshot.roadGroups[0].riderIds.includes(frontPullRiderId))
    throw new Error('The run needs one recorded group and its front puller.');
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.riders.some(rider=>rider.id===frontPullRiderId));
  if(!frontTeam)throw new Error('The front puller lacks a locked team.');
  chasingHelper(tour,tour.frames[snapshot.sourceKm-1],chasePullRiderId,
    frontTeam.id);
  if(chaseRotationRiderIds!==null){
    if(!Array.isArray(chaseRotationRiderIds))
      throw new Error('The chase rotation must name recorded helpers.');
    for(const id of new Set(chaseRotationRiderIds))chasingHelper(tour,
      tour.frames[snapshot.sourceKm-1],id,frontTeam.id);
  }
  const input={route:tour.route,snapshot,teams:tour.committedInputs.teams,
    frontPullRiderId,chasePullRiderId,chaseRotationRiderIds,paceVersion};
  return {sourceKm:snapshot.sourceKm,sourceTuningVersion:tour.tuningVersion,
    sourceWarnings:hasResidualGapAfterSufficientChase(tour.frames,
      snapshot.sourceKm-1)?['residual_gap_after_sufficient_chase']:[],
    input,recording:simulateFinaleGroupRun(input)};
}

export function probeFinaleGroupToLineFromTour(tour,options){
  const probe=probeFinaleGroupRunFromTour(tour,options);
  return {...probe,recording:simulateFinaleGroupToLine(probe.input)};
}
