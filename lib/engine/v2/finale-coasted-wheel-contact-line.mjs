import {isDeepStrictEqual} from 'node:util';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING,MOTOR_EXHAUSTION_COAST_VERSION} from './tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION} from './finale-multi-run.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleLaneQueuedCoastedContactRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION=
  'v2-finale-coasted-wheel-contact-line-lab-1';
const EPSILON=1e-7;

function firstSharedWheelContact(trace,positioned,finishM){
  const [front,bunch]=positioned.roadBands;
  const sourceM=positioned.startDistanceM;
  const sourceGapSeconds=-front.passageSecondsFromBunchMarker;
  const first=trace.frames[0];
  const firstFrontSpeed=(first.endDistanceM-first.startDistanceM)/
    first.roadGroups[0].elapsedSeconds;
  let frontEdgeM=sourceM+sourceGapSeconds*firstFrontSpeed;
  let bunchEdgeM=sourceM,elapsedSeconds=0;
  if(!Number.isFinite(frontEdgeM)||frontEdgeM>=first.endDistanceM)
    throw new Error('The front reached a decision boundary before the bunch source.');
  let frontFrameIndex=0,bunchFrameIndex=0;
  const pairs=front.slots.flatMap(frontSlot=>bunch.slots
    .filter(bunchSlot=>frontSlot.lane===bunchSlot.lane)
    .map(bunchSlot=>({frontSlot,bunchSlot})));
  if(!pairs.length||pairs.some(({frontSlot,bunchSlot})=>
    frontEdgeM+frontSlot.positionM-sourceM-
      (bunchEdgeM+bunchSlot.positionM-sourceM)<
      positioned.wheelSpacingM-EPSILON))
    throw new Error('Shared lanes have no separated paid source wheels.');
  while(frontEdgeM<finishM-500&&bunchEdgeM<finishM-500){
    const frontFrame=trace.frames[frontFrameIndex];
    const bunchFrame=trace.frames[bunchFrameIndex];
    if(!frontFrame?.roadGroups?.length||!bunchFrame||
      frontFrame.exhaustionDrops.length||bunchFrame.exhaustionDrops.length)
      throw new Error('Shared wheel contact needs unchanged active bands.');
    const frontSpeed=(frontFrame.endDistanceM-
      frontFrame.startDistanceM)/
      frontFrame.roadGroups[0].elapsedSeconds;
    const bunchSpeed=(bunchFrame.endDistanceM-
      bunchFrame.startDistanceM)/bunchFrame.bunchElapsedSeconds;
    const frontBoundarySeconds=(frontFrame.endDistanceM-frontEdgeM)/
      frontSpeed;
    const bunchBoundarySeconds=(bunchFrame.endDistanceM-bunchEdgeM)/
      bunchSpeed;
    const intervalSeconds=Math.min(frontBoundarySeconds,
      bunchBoundarySeconds);
    if(intervalSeconds<-EPSILON)
      throw new Error('A shared band passed its paid decision boundary.');
    const closingSpeed=bunchSpeed-frontSpeed;
    const possible=closingSpeed>EPSILON?pairs.map(pair=>{
      const gapM=frontEdgeM+pair.frontSlot.positionM-sourceM-
        bunchEdgeM-pair.bunchSlot.positionM+sourceM;
      const seconds=(gapM-positioned.wheelSpacingM)/closingSpeed;
      return {pair,seconds};
    }).filter(row=>row.seconds>=-EPSILON&&
      row.seconds<=intervalSeconds+EPSILON)
      .sort((a,b)=>a.seconds-b.seconds||
        a.pair.frontSlot.riderId.localeCompare(b.pair.frontSlot.riderId)):[];
    if(possible.length){
      const firstSeconds=possible[0].seconds;
      const simultaneous=possible.filter(row=>
        Math.abs(row.seconds-firstSeconds)<=EPSILON)
        .sort((a,b)=>a.pair.frontSlot.lane-
          b.pair.frontSlot.lane);
      const seconds=Math.max(0,firstSeconds);
      const contactFrontEdgeM=frontEdgeM+frontSpeed*seconds;
      const contactBunchEdgeM=bunchEdgeM+bunchSpeed*seconds;
      const firstPair=simultaneous[0].pair;
      return {elapsedSecondsFromLastKmStart:elapsedSeconds+seconds,
        frontEdgeM:contactFrontEdgeM,bunchEdgeM:contactBunchEdgeM,
        frontRiderId:firstPair.frontSlot.riderId,
        bunchRiderId:firstPair.bunchSlot.riderId,
        lane:firstPair.frontSlot.lane,
        frontWheelM:contactFrontEdgeM+
          firstPair.frontSlot.positionM-sourceM,
        bunchWheelM:contactBunchEdgeM+
          firstPair.bunchSlot.positionM-sourceM,
        simultaneousWheelPairs:simultaneous.map(row=>({
          lane:row.pair.frontSlot.lane,
          frontRiderId:row.pair.frontSlot.riderId,
          bunchRiderId:row.pair.bunchSlot.riderId}))};
    }
    elapsedSeconds+=intervalSeconds;
    frontEdgeM+=frontSpeed*intervalSeconds;
    bunchEdgeM+=bunchSpeed*intervalSeconds;
    if(Math.abs(frontEdgeM-frontFrame.endDistanceM)<EPSILON)
      frontFrameIndex++;
    if(Math.abs(bunchEdgeM-bunchFrame.endDistanceM)<EPSILON)
      bunchFrameIndex++;
  }
  throw new Error('Shared wheels did not contact before the sprint handoff.');
}

function paidEnergyAtEdge(trace,slot,edgeM,sourceM){
  let travelM=edgeM-sourceM,energy=slot.energy;
  for(const frame of trace.frames){
    if(travelM<=EPSILON)break;
    const lengthM=frame.endDistanceM-frame.startDistanceM;
    const paidM=Math.min(lengthM,travelM);
    const row=frame.riders.find(item=>item.riderId===slot.riderId);
    if(!row||!Number.isFinite(row.energySpent))
      throw new Error('A shared rider has no paid decision interval.');
    energy-=paidM*row.energySpent/lengthM;
    travelM-=paidM;
  }
  if(travelM>EPSILON||energy<-EPSILON)
    throw new Error('A shared rider cannot pay for contact.');
  return Math.max(0,energy);
}

function isolatedPassages(tour,trace,positioned){
  const sourceFrame=tour.frames.at(-2);
  const sourceById=new Map(sourceFrame.riderGroups.map(row=>[row.id,row]));
  return positioned.droppedRiderIds.map(riderId=>{
    const source=sourceById.get(riderId);
    if(source?.group!=='dropped'||
      !Number.isFinite(source.deficitSeconds)||
      source.deficitSeconds<=0||!Number.isFinite(source.energy))
      throw new Error('A shared road lost an isolated source rider.');
    let time=source.deficitSeconds,energy=source.energy;
    const frames=trace.frames.map(frame=>{
      const paid=frame.droppedTravel?.riders.find(row=>
        row.riderId===riderId);
      if(!paid||Math.abs(energy-paid.energyBefore)>EPSILON)
        throw new Error('An isolated rider lost paid travel.');
      time+=paid.elapsedSeconds;
      energy=paid.energyAfter;
      return {distanceM:frame.endDistanceM,
        elapsedSecondsFromLastKmStart:time,energy,
        energySpent:paid.energySpent,
        curtailedEnergyDemand:paid.curtailedEnergyDemand};
    });
    return {riderId,frames,elapsedSecondsFromLastKmStart:time,
      energyAtLine:energy};
  });
}

// This opt-in laboratory path begins at the locked 1 km source. It pays
// each band's motion to the first shared-lane wheel encounter, joins their
// lanes at that encounter, and carries every active and isolated rider to
// an individual crossing. Inferred lanes and photo ties remain provisional;
// this record cannot save an official result or award.
export function recordFinaleCoastedWheelContactLine(tour,{plans=null}={}){
  if(tour?.tuningVersion!==MOTOR_EXHAUSTION_COAST_VERSION)
    throw new Error('Shared wheel contact needs a v93 tour.');
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const finishM=tour.route.distanceKm*1000;
  const [front,bunch]=positioned.roadBands;
  const originalContact=trace.frames.find(frame=>frame.contact)?.contact;
  if(positioned.roadBands.length!==2||
    !positioned.droppedRiderIds.length||
    front.slots.length>positioned.laneCount||
    front.slots.some(slot=>slot.depth!==0)||
    originalContact?.atDistanceM<=finishM-500||
    trace.frames.at(-1)?.endDistanceM!==finishM||
    trace.frames.some(frame=>frame.frontExhaustionDrops?.length||
      frame.exhaustionDrops.length))
    throw new Error('Shared wheel contact needs one intact late front.');
  const contact=firstSharedWheelContact(trace,positioned,finishM);
  const sourceM=positioned.startDistanceM;
  if(contact.frontWheelM-contact.bunchWheelM<
    positioned.wheelSpacingM-EPSILON||
    contact.bunchEdgeM<=sourceM+250||
    contact.bunchEdgeM>=finishM-500)
    throw new Error('A shared wheel has no paid early contact.');
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{teamId:team.id,rider}])));
  const frontIds=new Set(front.slots.map(slot=>slot.riderId));
  const atContact=[...front.slots,...bunch.slots].map(slot=>{
    const edgeM=frontIds.has(slot.riderId)?contact.frontEdgeM:
      contact.bunchEdgeM;
    return {...slot,positionM:edgeM+slot.positionM-sourceM,
      energy:paidEnergyAtEdge(trace,slot,edgeM,sourceM)};
  });
  const ridersById=new Map([...roster].map(([id,row])=>
    [id,row.rider]));
  const contactEnergy=new Map(atContact.map(row=>
    [row.riderId,row.energy]));
  const segment=tour.route.kilometres.at(-1);
  const mergedSpeedKph=finalePassiveBunchSpeed({
    riderIds:atContact.map(row=>row.riderId),ridersById,
    energies:contactEnergy,segment});
  const mergedTravelM=finishM-500-contact.bunchEdgeM;
  const at500Time=contact.elapsedSecondsFromLastKmStart+
    mergedTravelM*3.6/mergedSpeedKph;
  const at500=atContact.map(row=>{
    const effect=riderKilometreEffect(ridersById.get(row.riderId),
      segment,{phase:'chase',energy:row.energy,
        exposed:segment.exposed});
    const spent=mergedTravelM*TUNING.effortCost.conserve*
      effect.energyCostMultiplier/1000;
    if(spent>row.energy+EPSILON)
      throw new Error('A merged rider cannot pay to the sprint handoff.');
    return {...row,positionM:row.positionM+mergedTravelM,
      energy:Math.max(0,row.energy-spent),
      postContactEnergySpent:spent};
  });
  const lanes=Array.from({length:positioned.laneCount},(_,lane)=>
    at500.filter(row=>row.lane===lane).sort((a,b)=>
      b.positionM-a.positionM||a.riderId.localeCompare(b.riderId)));
  for(const lane of lanes)for(let i=1;i<lane.length;i++)
    if(lane[i-1].positionM-lane[i].positionM<
      positioned.wheelSpacingM-EPSILON)
      throw new Error('A merged source has overlapping lane wheels.');
  const slots=lanes.flatMap((lane,laneNumber)=>lane.map((row,index)=>
    ({...row,lane:laneNumber,row:index})));
  const isolated=isolatedPassages(tour,trace,positioned);
  const isolatedAt500=new Map(isolated.map(row=>[row.riderId,
    row.frames.find(frame=>frame.distanceM===finishM-500)]));
  const ids=slots.map(row=>row.riderId);
  const nomination=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const riderEnergy=[...slots.map(row=>({riderId:row.riderId,
    energyAfter:row.energy})),...isolated.map(row=>({
    riderId:row.riderId,
    energyAfter:isolatedAt500.get(row.riderId)?.energy}))];
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,roadGroups:[],
      pelotonRiderIds:ids,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy},plans:nomination,
    sourceRoadTraceVersion:FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION});
  const source={distanceM:finishM-500,
    pelotonRiderIds:ids,
    riderEnergy:slots.map(row=>({riderId:row.riderId,
      energy:row.energy})),
    bunchElapsedSeconds:at500Time,
    sourceRoadTraceVersion:FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION};
  const positionedSource={version:positioned.version,
    status:'provisional_shared_wheels_after_paid_contact',
    distanceM:source.distanceM,wheelSpacingM:positioned.wheelSpacingM,
    slots};
  const runner=recordFinaleLaneQueuedCoastedContactRunnerFromTour(tour,
    {source,plan:sprintPlan,positionedSource});
  const active=runner.finishers.map(row=>({...row,
    roadBandId:'peloton'}));
  const dropped=isolated.map(row=>({riderId:row.riderId,
    teamId:roster.get(row.riderId).teamId,
    roadBandId:`isolated:${row.riderId}`,
    elapsedSecondsFromLastKmStart:
      row.elapsedSecondsFromLastKmStart,
    energyAtLine:row.energyAtLine}));
  const finishers=[...active,...dropped];
  const lineOrder=positionedLineOrder(finishers);
  if(finishers.length!==roster.size||
    new Set(finishers.map(row=>row.riderId)).size!==roster.size||
    finishers.some(row=>!Number.isFinite(
      row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0)||
    Math.min(...dropped.map(row=>
      row.elapsedSecondsFromLastKmStart))<=
      Math.max(...active.map(row=>
        row.elapsedSecondsFromLastKmStart))+EPSILON)
    throw new Error('Shared contact did not bring the whole field to line.');
  const activeEnergy=new Map(active.map(row=>
    [row.riderId,row.energyAtLine]));
  for(const slot of [...front.slots,...bunch.slots]){
    const paidBefore=slot.energy-(slots.find(row=>
      row.riderId===slot.riderId)?.energy??NaN);
    const paidAfter=runner.frames.reduce((sum,frame)=>sum+
      frame.riders.find(row=>row.riderId===slot.riderId)
        .energySpent,0);
    if(Math.abs(slot.energy-paidBefore-paidAfter-
      activeEnergy.get(slot.riderId))>EPSILON)
      throw new Error('Shared contact lost rider energy.');
  }
  return {version:FINALE_COASTED_WHEEL_CONTACT_LINE_VERSION,
    sourceRoadTraceVersion:trace.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:sourceM,lineDistanceM:finishM,
    source:{frontGroupId:front.id,frontRiderIds:front.slots.map(row=>
      row.riderId),bunchRiderIds:bunch.slots.map(row=>row.riderId),
      droppedRiderIds:[...positioned.droppedRiderIds]},
    contact:{...contact,mergedSpeedKph,
      postContactTravelM:mergedTravelM},
    atContact:{elapsedSecondsFromLastKmStart:
      contact.elapsedSecondsFromLastKmStart,
      frontEdgeM:contact.frontEdgeM,
      bunchEdgeM:contact.bunchEdgeM,riders:atContact},
    at500:{elapsedSecondsFromLastKmStart:at500Time,
      bunchEdgeM:finishM-500,
      frontWheelM:finishM-500+positioned.wheelSpacingM,
      slots},sprintPlan,runner,isolated,
    finishers,lineOrder,
    resultStatus:lineOrder.some(row=>row.position===null)?
      'photo_finish_unresolved':'experimental_inferred_order',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleCoastedWheelContactLine(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleCoastedWheelContactLine(tour,input)))
    throw new Error('Shared wheel contact differs from the locked race.');
  return true;
}
