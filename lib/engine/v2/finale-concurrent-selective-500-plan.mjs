import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentSelective500StateFromTour} from
  './finale-concurrent-selective-500-state.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {selectiveFinaleChaseDecision} from './finale-multi-run.mjs';
import {finalePassiveBunchSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_SELECTIVE_500_PLAN_VERSION=
  'v2-finale-concurrent-selective-500-plan-1';

// Re-evaluate only the next 100 m bunch work when at least one attacker is
// physically ahead. The measured gap uses the last paid bunch speed, as in
// the preceding plan. This records choices but spends no energy or distance.
export function recordFinaleConcurrentSelective500PlanFromTour(tour){
  const state=recordFinaleConcurrentSelective500StateFromTour(tour);
  const previous=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  if(!['two_split','solo_ahead'].includes(state.branch))
    throw new Error('Selective 500 m plan needs a rider ahead of the bunch.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(Math.abs(slice.startDistanceM-state.boundaryM)>1e-8||
    Math.abs(previous.endDistanceM-state.boundaryM)>1e-8)
    throw new Error('Selective 500 m plan needs the adjacent 100 m slice.');
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const positions=new Map(state.riders.map(row=>
    [row.riderId,row.positionM]));
  const energies=new Map(state.riders.map(row=>
    [row.riderId,row.energyAtBoundary]));
  const bunchBand=state.roadBands.at(-1);
  const bunchIds=bunchBand.riderIds;
  const bunchPositionM=bunchBand.positionM;
  const leadingPositionM=positions.get(state.frontRiderId);
  const rearTargetId=state.branch==='two_split'?
    state.rearRiderId:state.frontRiderId;
  const rearPositionM=positions.get(rearTargetId);
  const referenceSpeedMps=previous.bunchSpeedKph/3.6;
  const rearGapSeconds=(rearPositionM-bunchPositionM)/
    referenceSpeedMps;
  const leadingGapSeconds=(leadingPositionM-bunchPositionM)/
    referenceSpeedMps;
  if(![rearGapSeconds,leadingGapSeconds].every(Number.isFinite)||
    !(rearGapSeconds>0&&leadingGapSeconds>=rearGapSeconds))
    throw new Error('Selective 500 m plan needs a measured positive gap.');
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:bunchIds,ridersById,energies,segment});
  const prior=new Map(previous.selectiveDecisions.map(row=>
    [row.teamId,row]));
  const chaseDecisions=[];
  for(const source of previous.selectiveDecisions){
    const team=teams.find(row=>row.id===source.teamId);
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.chase!=='selective')
      throw new Error('Selective 500 m plan needs unchanged chase orders.');
    const awareness=selectiveFinaleChaseDecision({team,
      awareBefore:prior.get(team.id).aware,
      rearGapSeconds,leadingGapSeconds,
      remainingKm:(tour.route.distanceKm*1000-slice.startDistanceM)/1000});
    const candidates=team.orders.helperIds.filter(id=>bunchIds.includes(id))
      .map(riderId=>{
        const energy=energies.get(riderId);
        if(energy<TUNING.chase.minHelperEnergy)return null;
        const worker=finaleWorkerStep({rider:ridersById.get(riderId),
          segment,order,energy,role:'chase',
          paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
        const fullSliceCost=energyCostForFinaleSlice(slice,
          worker.workCostPerKm);
        return fullSliceCost<=energy+1e-9?{
          teamId:team.id,riderId,speedKph:worker.speedKph,
          workCostPerKm:worker.workCostPerKm,
          fullSliceCost,energyAtDecision:energy}:null;
      }).filter(Boolean).sort((a,b)=>b.speedKph-a.speedKph||
        a.riderId.localeCompare(b.riderId));
    chaseDecisions.push({teamId:team.id,aware:awareness.aware,
      policyDecision:awareness.decision,candidate:awareness.decision===
        'engaged'?candidates[0]??null:null});
  }
  const selected=chaseDecisions.filter(row=>row.candidate)
    .sort((a,b)=>b.candidate.speedKph-a.candidate.speedKph||
      a.teamId.localeCompare(b.teamId))[0]??null;
  const selectedChase=selected?.candidate??null;
  const busyTeamIds=[...new Set([state.frontRiderId,
    state.rearRiderId].map(id=>teamByRider.get(id))
    .concat(chaseDecisions.map(row=>row.teamId)))];
  const rotation=recordFinaleFrontRotationSlice({slice,route:tour.route,
    teams,pelotonRiderIds:bunchIds,energies,busyTeamIds});
  const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
    selectedChase?.speedKph??0,rotation.bunchSpeedKph);
  return {version:FINALE_CONCURRENT_SELECTIVE_500_PLAN_VERSION,
    sourceStateVersion:state.version,
    sourcePreviousPlanVersion:previous.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,branch:state.branch,
    startDistanceM:slice.startDistanceM,
    endDistanceM:slice.endDistanceM,
    frontRiderId:state.frontRiderId,
    rearTargetId,bunchRiderIds:bunchIds,
    referenceSpeedKph:previous.bunchSpeedKph,
    rearGapSeconds,leadingGapSeconds,
    passiveBunchSpeedKph,bunchSpeedKph,
    selectiveDecisions:chaseDecisions.map(row=>({teamId:row.teamId,
      aware:row.aware,policyDecision:row.policyDecision,
      decision:row.policyDecision!=='engaged'?row.policyDecision:
        !row.candidate?'no_helper':row.teamId===selected?.teamId?
          'working':'waiting_turn',
      candidateRiderId:row.candidate?.riderId??null})),
    chase:selectedChase,rotation,
    energyAtDecision:state.riders.map(row=>({riderId:row.riderId,
      energy:row.energyAtBoundary})),
    travelStatus:'planned_unpaid',draftStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentSelective500PlanFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSelective500PlanFromTour(tour)))
    throw new Error('Concurrent selective 500 m plan does not replay.');
  return true;
}
