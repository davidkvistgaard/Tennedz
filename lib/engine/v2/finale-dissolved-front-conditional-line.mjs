import {isDeepStrictEqual} from 'node:util';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDissolvedFrontShoulderRoad} from
  './finale-dissolved-front-shoulder-road.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';

export const FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION=
  'v2-finale-dissolved-front-conditional-line-1';
const EPSILON=1e-7;

// Continue the complete paid shoulder road through the existing 500 m
// individual runners. This remains a conditional crossing ledger: the
// independent runners do not yet resolve every encounter or award points.
export function recordFinaleDissolvedFrontConditionalLine(tour,
  {plans=null}={}){
  const shoulder=recordFinaleDissolvedFrontShoulderRoad(tour);
  const finishM=tour.route.distanceKm*1000;
  const source=resolveFinaleMultibandPositionedSource(tour,
    {includeDropped:true});
  const leavers=new Set(shoulder.laneAssignments.map(row=>row.riderId));
  const positioned={...source,
    version:FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION,
    status:'provisional_paid_shoulder_and_active_wheels',
    roadBands:source.roadBands.slice(1),
    droppedRiderIds:[...source.droppedRiderIds,...leavers]};
  const first=shoulder.passages.find(row=>row.distanceM===finishM-500);
  const traceFrame=shoulder.trace.frames.find(row=>
    row.endDistanceM===finishM-500);
  if(!first||!traceFrame||positioned.roadBands.length!==2||
    first.roadGroups.length!==1||
    first.roadGroups[0].id!==positioned.roadBands[0].id||
    positioned.droppedRiderIds.length!==first.isolated.length||
    positioned.droppedRiderIds.some(id=>
      !first.isolated.some(row=>row.riderId===id)))
    throw new Error('The dissolved front has no complete 500 m handoff.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:traceFrame.roadGroups,
      pelotonRiderIds:traceFrame.pelotonRiderIds,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy:traceFrame.riders.map(row=>({
        riderId:row.riderId,energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:shoulder.version});
  const teamById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const passages=shoulder.passages.filter(row=>
    row.distanceM>=finishM-500);
  const isolatedBandRunners=positioned.droppedRiderIds.map(riderId=>{
    const frames=[];
    for(let index=1;index<passages.length;index++){
      const before=passages[index-1],after=passages[index];
      const previous=before.isolated.find(row=>row.riderId===riderId);
      const current=after.isolated.find(row=>row.riderId===riderId);
      const previousEnergy=before.riderEnergy.find(row=>
        row.riderId===riderId)?.energy;
      const currentEnergy=after.riderEnergy.find(row=>
        row.riderId===riderId)?.energy;
      const paid=shoulder.trace.frames.find(row=>
        row.endDistanceM===after.distanceM)?.droppedTravel.riders.find(row=>
          row.riderId===riderId);
      const duration=current?.passageSecondsFromBunchMarker-
        previous?.passageSecondsFromBunchMarker;
      if(after.distanceM-before.distanceM!==100||
        !Number.isFinite(duration)||duration<=0||
        !Number.isFinite(previousEnergy)||
        !Number.isFinite(currentEnergy)||!paid||
        Math.abs(previousEnergy-paid.energySpent-currentEnergy)>EPSILON)
        throw new Error('An isolated shoulder rider has unpaid travel.');
      frames.push({startDistanceM:before.distanceM,
        endDistanceM:after.distanceM,
        elapsedSecondsAtStart:previous.passageSecondsFromBunchMarker,
        durationSeconds:duration,riders:[{riderId,role:'dropped',
          positionBeforeM:before.distanceM,positionM:after.distanceM,
          activeSeconds:duration,activeDistanceM:100,
          shelteredSeconds:0,shelteredDistanceM:0,
          energyAtDecision:previousEnergy,energySpent:paid.energySpent,
          energyAfter:currentEnergy,
          elapsedToLineSeconds:after.distanceM===finishM?
            current.passageSecondsFromBunchMarker:null}]});
    }
    const line=passages.at(-1).isolated.find(row=>
      row.riderId===riderId);
    return {roadBandId:`isolated:${riderId}`,
      paidTo500Seconds:passages[0].isolated.find(row=>
        row.riderId===riderId).passageSecondsFromBunchMarker,
      outsideLane:shoulder.laneAssignments.find(row=>
        row.riderId===riderId)?.outsideLane??null,
      runner:{frames,finishers:[{riderId,teamId:teamById.get(riderId),
        elapsedSecondsFromLastKmStart:line.passageSecondsFromBunchMarker,
        energyAtLine:passages.at(-1).riderEnergy.find(row=>
          row.riderId===riderId).energy}]}};
  });
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500:traceFrame,
    passageTimes:[first.roadGroups[0].passageSecondsFromBunchMarker,
      first.bunchPassageSecondsFromBunchMarker],
    sourceRoadTraceVersion:shoulder.version,
    isolatedSprintPlan:sprintPlan,isolatedBandRunners,
    withholdProvisionalOrder:true,allowCoastedTail:true});
  return {version:FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION,
    sourceShoulderVersion:shoulder.version,
    sourcePositionVersion:source.version,
    shoulder,positionedSource:positioned,...handoff,
    roadStatus:'conditional_paid_shoulder_individual_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDissolvedFrontConditionalLine(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleDissolvedFrontConditionalLine(tour,input)))
    throw new Error('The dissolved-front conditional line does not replay.');
  return true;
}
