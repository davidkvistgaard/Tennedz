import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentDoubleCatchMergeFromTour} from
  './finale-concurrent-double-catch-merge.mjs';
import {recordFinaleMultibandSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {resolveIndependentBunchSource} from
  './finale-positioned-source.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  recordFinaleLaneQueuedDoubleCatchBandRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';

export const FINALE_CONCURRENT_DOUBLE_CATCH_LINE_VERSION=
  'v2-finale-concurrent-double-catch-line-lab-1';
export const FINALE_CONCURRENT_DOUBLE_CATCH_ASSEMBLED_LINE_VERSION=
  'v2-finale-concurrent-double-catch-line-lab-2';
export const FINALE_CONCURRENT_DOUBLE_CATCH_LANE_QUEUED_LINE_VERSION=
  'v2-finale-concurrent-double-catch-line-lab-3';
const EPSILON=1e-8;

// The shared paid runner can pull a finisher only longitudinally. The newly
// caught bunch has provisional lanes, so reject a helper that would need a
// free lateral move before allowing its lead-out to start.
export function assertConcurrentDoubleCatchLeadOutWheels(positionedSource,
  sprintPlan){
  const slots=new Map(positionedSource.slots.map(row=>[row.riderId,row]));
  for(const order of sprintPlan.decisions){
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
}

function assertConcurrentDoubleCatchAssemblyLanes(positionedSource,sprintPlan){
  const slots=new Map(positionedSource.slots.map(row=>[row.riderId,row]));
  for(const order of sprintPlan.decisions){
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
}

// Two independently ordered attacks and the chase have already met at exact
// recorded contacts. Continue the resulting complete 500 m bunch through
// the existing individual paid sprint runner. Its wheels and passing remain
// experimental, so this is a conditional line and never an award path.
function recordDoubleCatchLine(tour,{plans=null}={},allowAssembly=false,
  laneQueue=false){
  const road=recordFinaleConcurrentDoubleCatchMergeFromTour(tour);
  const finishM=tour.route.distanceKm*1000;
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const riderIds=road.roadBands[0]?.riderIds;
  if(road.event!=='bunch_at_next_boundary'||
    road.endDistanceM!==finishM-500||
    road.roadBands.length!==1||
    road.roadBands[0].positionM!==road.endDistanceM||
    !Array.isArray(riderIds)||riderIds.length!==roster.length||
    new Set(riderIds).size!==roster.length||
    roster.some(id=>!riderIds.includes(id))||
    road.riders.length!==roster.length||
    road.riders.some(row=>row.positionM!==road.endDistanceM||
      !Number.isFinite(row.energyAtBoundary)))
    throw new Error('A double-catch line needs the complete paid 500 m bunch.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintSource={endDistanceM:road.endDistanceM,
    roadGroups:[],pelotonRiderIds:riderIds,
    riderEnergy:road.riders.map(row=>({riderId:row.riderId,
      energyAfter:row.energyAtBoundary}))};
  const sprintPlan=recordFinaleMultibandSprintPlanFromTour(tour,{
    source:sprintSource,plans:nominations,
    sourceRoadTraceVersion:road.version});
  const source={distanceM:road.endDistanceM,
    roadGroups:[],pelotonRiderIds:riderIds,
    riderEnergy:road.riders.map(row=>({riderId:row.riderId,
      energy:row.energyAtBoundary})),
    bunchElapsedSeconds:road.elapsedSinceLaunchSeconds,
    sourceRoadTraceVersion:road.version};
  const worked=new Set(road.rotationRiderIds);
  const positionedSource=resolveIndependentBunchSource(tour,{
    version:road.version,at500M:source,
    frames:[{rotation:{selected:{work:[...worked].map(riderId=>({
      riderId}))}}}]},sprintPlan);
  if(allowAssembly)
    assertConcurrentDoubleCatchAssemblyLanes(positionedSource,sprintPlan);
  else assertConcurrentDoubleCatchLeadOutWheels(positionedSource,sprintPlan);
  const runner=(laneQueue?
    recordFinaleLaneQueuedDoubleCatchBandRunnerFromTour:
    recordFinalePositionedBandRunnerFromTour)(tour,{
    source,plan:sprintPlan,positionedSource,branch:'bunch_band',
    allowAssembly});
  const crossings=runner.finishers;
  const energyAt500=new Map(road.riders.map(row=>[
    row.riderId,row.energyAtBoundary]));
  if(crossings.length!==roster.length||
    new Set(crossings.map(row=>row.riderId)).size!==roster.length||
    crossings.some(row=>!roster.includes(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      row.elapsedSecondsFromLastKmStart<=road.elapsedSinceLaunchSeconds||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0||
      row.energyAtLine>energyAt500.get(row.riderId)+1e-8))
    throw new Error('The double-catch line lost an individual crossing.');
  return {version:laneQueue?
    FINALE_CONCURRENT_DOUBLE_CATCH_LANE_QUEUED_LINE_VERSION:
    allowAssembly?
    FINALE_CONCURRENT_DOUBLE_CATCH_ASSEMBLED_LINE_VERSION:
    FINALE_CONCURRENT_DOUBLE_CATCH_LINE_VERSION,
    sourceRoadTraceVersion:road.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    road,sprintPlan,positionedSource,runner,
    conditionalCrossings:crossings,
    provisionalLineOrder:runner.lineOrder,
    roadStatus:'paid_double_catch_conditional_individual_line',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function recordFinaleConcurrentDoubleCatchLineFromTour(tour,
  input={}){
  return recordDoubleCatchLine(tour,input);
}

// The later opt-in recording lets a nominated helper behind the finisher pay
// to reach an adjacent wheel. The pull can begin only at a later boundary.
export function recordFinaleConcurrentDoubleCatchAssembledLineFromTour(tour,
  input={}){
  return recordDoubleCatchLine(tour,input,true);
}

export function recordFinaleConcurrentDoubleCatchLaneQueuedLineFromTour(tour,
  input={}){
  return recordDoubleCatchLine(tour,input,false,true);
}

export function validateFinaleConcurrentDoubleCatchLineFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDoubleCatchLineFromTour(tour,input)))
    throw new Error('Concurrent double-catch individual line does not replay.');
  return true;
}

export function validateFinaleConcurrentDoubleCatchAssembledLineFromTour(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDoubleCatchAssembledLineFromTour(tour,input)))
    throw new Error('Concurrent assembled double-catch line does not replay.');
  return true;
}

export function validateFinaleConcurrentDoubleCatchLaneQueuedLineFromTour(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDoubleCatchLaneQueuedLineFromTour(tour,input)))
    throw new Error('Concurrent queued double-catch line does not replay.');
  return true;
}
