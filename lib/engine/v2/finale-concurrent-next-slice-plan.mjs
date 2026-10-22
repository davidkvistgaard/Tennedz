import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentBunchArrivalFromTour} from
  './finale-concurrent-bunch-arrival.mjs';
import {recordFinaleConcurrentNamedMultiSelectiveRotationFromTour} from
  './finale-concurrent-named-chase-rotation-launch.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {selectiveFinaleChaseDecision} from './finale-multi-run.mjs';
import {finalePassiveBunchSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NEXT_SLICE_PLAN_VERSION=
  'v2-finale-concurrent-next-slice-plan-1';

// Reselect only the bunch's next 250 m work at the measured 750 m state.
// This is a plan, not travel: nobody pays it until a later common-clock
// recording reaches an event or contact inside the slice.
export function recordFinaleConcurrentNextSlicePlanFromTour(tour){
  const state=recordFinaleConcurrentBunchArrivalFromTour(tour);
  const launch=recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(tour);
  if(state.event!=='bunch_at_first_slice_boundary'||
    launch.selectiveDecisions.length<2)
    throw new Error('Next-slice planning needs the separated paid bunch boundary.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  if(state.bunchPositionM!==slice.startDistanceM)
    throw new Error('Next-slice planning needs the canonical boundary.');
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,team.id])));
  const attackers=new Set([state.firstRiderId,state.secondRiderId]);
  const bunchIds=state.riders.map(row=>row.riderId).filter(id=>
    !attackers.has(id));
  const energies=new Map(state.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const passiveBunchSpeedKph=finalePassiveBunchSpeed({
    riderIds:bunchIds,ridersById,energies,segment});
  // A measured distance becomes a time gap using the last paid bunch speed,
  // before any new chase or rotation can alter the next slice's pace.
  const referenceSpeedMps=launch.bunchSpeedKph/3.6;
  const rearGapSeconds=(state.secondPositionM-state.bunchPositionM)/
    referenceSpeedMps;
  const leadingGapSeconds=(state.firstPositionM-state.bunchPositionM)/
    referenceSpeedMps;
  const prior=new Map(launch.selectiveDecisions.map(row=>
    [row.teamId,row]));
  const chaseDecisions=[];
  for(const source of launch.selectiveDecisions){
    const team=teams.find(row=>row.id===source.teamId);
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.chase!=='selective')
      throw new Error('Next-slice planning needs unchanged selective orders.');
    const awareness=selectiveFinaleChaseDecision({team,
      awareBefore:prior.get(team.id).decision!=='wait',
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
  const busyTeamIds=[...new Set([...attackers].map(id=>
    teamByRider.get(id)).concat(chaseDecisions.map(row=>row.teamId)))];
  const rotation=recordFinaleFrontRotationSlice({slice,route:tour.route,
    teams,pelotonRiderIds:bunchIds,energies,busyTeamIds});
  const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
    selectedChase?.speedKph??0,rotation.bunchSpeedKph);
  return {version:FINALE_CONCURRENT_NEXT_SLICE_PLAN_VERSION,
    sourceStateVersion:state.version,sourceLaunchVersion:launch.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    firstRiderId:state.firstRiderId,secondRiderId:state.secondRiderId,
    firstPositionM:state.firstPositionM,
    secondPositionM:state.secondPositionM,
    bunchPositionM:state.bunchPositionM,
    referenceSpeedKph:launch.bunchSpeedKph,
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
      energy:row.energyAtEvent})),
    travelStatus:'planned_unpaid',roadRelationshipStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNextSlicePlanFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNextSlicePlanFromTour(tour)))
    throw new Error('Concurrent next-slice plan does not replay.');
  return true;
}
