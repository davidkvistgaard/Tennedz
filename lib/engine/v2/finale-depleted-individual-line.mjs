import {isDeepStrictEqual} from 'node:util';
import {validateFinaleDepletedLastKmClock,
  validateFinaleNoFrontDroppedLastKmClock} from
  './finale-separated-last-km.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';

export const FINALE_DEPLETED_INDIVIDUAL_LINE_VERSION=
  'v2-finale-depleted-individual-line-lab-1';
const EPSILON=1e-7;

// Use the already recorded isolated passage and energy for each dropped
// rider. No wheel, helper, or invented shared dropped-rider group is added.
function isolatedRunners(tour,clock,at500Passage){
  const finishM=tour.route.distanceKm*1000;
  const dropped=clock.trace.sourceDroppedRiderIds;
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  const passages=clock.passageFrames.filter(frame=>
    frame.distanceM>=finishM-500);
  const traces=new Map(clock.trace.frames.map(frame=>
    [frame.endDistanceM,frame]));
  if(passages[0]!==at500Passage||
    passages.at(-1)?.distanceM!==finishM||
    passages.length!==6||
    dropped.length!==at500Passage.droppedPassages.length)
    throw new Error('The isolated riders need complete recorded passages.');
  return dropped.map(riderId=>{
    let previousTime=at500Passage.droppedPassages.find(row=>
      row.riderId===riderId)?.passageSecondsFromBunchMarker;
    let previousEnergy=traces.get(finishM-500)?.riders.find(row=>
      row.riderId===riderId)?.energy;
    if(!Number.isFinite(previousTime)||
      !Number.isFinite(previousEnergy))
      throw new Error('A dropped rider has no paid 500 m state.');
    const frames=[];
    for(let index=1;index<passages.length;index++){
      const before=passages[index-1].distanceM;
      const after=passages[index].distanceM;
      const row=passages[index].droppedPassages.find(value=>
        value.riderId===riderId);
      const energy=traces.get(after)?.riders.find(value=>
        value.riderId===riderId)?.energy;
      const seconds=row?.passageSecondsFromBunchMarker-previousTime;
      if(after-before!==100||!Number.isFinite(seconds)||
        seconds<=0||!Number.isFinite(energy)||
        row.unmetEnergyDemand>EPSILON||
        Math.abs(previousEnergy-row.energySpent-energy)>EPSILON)
        throw new Error('A dropped rider has unpaid or discontinuous travel.');
      frames.push({startDistanceM:before,endDistanceM:after,
        elapsedSecondsAtStart:previousTime,durationSeconds:seconds,
        riders:[{riderId,role:'dropped',positionBeforeM:before,
          positionM:after,activeSeconds:seconds,activeDistanceM:100,
          shelteredSeconds:0,shelteredDistanceM:0,
          energyAtDecision:previousEnergy,energySpent:row.energySpent,
          energyAfter:energy,
          elapsedToLineSeconds:after===finishM?
            row.passageSecondsFromBunchMarker:null}]});
      previousTime=row.passageSecondsFromBunchMarker;
      previousEnergy=energy;
    }
    return {roadBandId:`isolated:${riderId}`,
      runner:{frames,finishers:[{riderId,teamId:roster.get(riderId),
        elapsedSecondsFromLastKmStart:previousTime,
        energyAtLine:previousEnergy}]}};
  });
}

// The active riders continue with the existing individual runner. The
// dropped riders keep their independent, paid last-kilometre trajectory.
// The first 500 m has no individual wheel/contact audit, so no combined
// result or point preview follows even when the final 500 m is separate.
export function recordFinaleDepletedIndividualLine(tour,clock,
  {plans=null}={}){
  const noFront=clock?.line?.outcome==='bunch_with_dropped_reserve';
  if(noFront)validateFinaleNoFrontDroppedLastKmClock(tour,clock);
  else validateFinaleDepletedLastKmClock(tour,clock);
  const finishM=tour.route.distanceKm*1000;
  if(clock.passageFrames.some(frame=>frame.droppedPassages.some(row=>
    row.unmetEnergyDemand>EPSILON)))
    throw new Error('The depleted individual line has unmet energy demand.');
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const passage=clock.passageFrames.find(frame=>
    frame.distanceM===finishM-500);
  if(!at500||!passage||
    passage.groups.length!==positioned.roadBands.length-1||
    passage.groups.some((group,index)=>group.id!==
      positioned.roadBands[index].id))
    throw new Error('The depleted line has no paid 500 m passage.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,
      roadGroups:at500.roadGroups,
      pelotonRiderIds:at500.pelotonRiderIds,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy:at500.riders.map(row=>({
        riderId:row.riderId,energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:clock.version});
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500,sourceRoadTraceVersion:clock.version,
    passageTimes:[...passage.groups.map(group=>
      group.passageSecondsFromBunchMarker),
    passage.bunchPassageSecondsFromBunchMarker],
    isolatedSprintPlan:sprintPlan,
    isolatedBandRunners:isolatedRunners(tour,clock,passage),
    withholdProvisionalOrder:true});
  return {version:FINALE_DEPLETED_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    ...handoff,pre500ContactStatus:'unresolved',
    roadStatus:'conditional_isolated_and_active_lines_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDepletedIndividualLine(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleDepletedIndividualLine(tour,clock,input)))
    throw new Error('The depleted individual line does not replay.');
  return true;
}
