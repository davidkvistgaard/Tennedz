import {isDeepStrictEqual} from 'node:util';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinalePaidCrossBandOverlap} from
  './finale-late-active-wheel-contact.mjs';

export const FINALE_DISSOLVED_FRONT_WHEEL_AUDIT_VERSION=
  'v2-finale-dissolved-front-wheel-audit-1';
const EPSILON=1e-7;

function singleWheel(riderId,positionM,startSeconds,durationSeconds,
  lengthM,offsetM=0){
  return {runner:{frames:[{elapsedSecondsAtStart:startSeconds,
    durationSeconds,riders:[{riderId,
      positionBeforeM:positionM-offsetM,
      positionM:positionM+lengthM-offsetM,
      activeSeconds:durationSeconds,activeDistanceM:lengthM,
      shelteredSeconds:0,shelteredDistanceM:0}]}]}};
}

function energyAt(row,fraction){
  const before=row.energyBefore??row.energy+row.energySpent;
  const after=row.energyAfter??row.energy;
  const at=before-row.energySpent*fraction;
  if(!Number.isFinite(before)||!Number.isFinite(after)||
    !Number.isFinite(row.energySpent)||!Number.isFinite(at)||
    fraction<-EPSILON||fraction>1+EPSILON||
    Math.abs(before-row.energySpent-after)>EPSILON||
    at<-EPSILON)
    throw new Error('A wheel encounter lacks paid energy.');
  return Math.max(0,at);
}

// Source wheel slots are explicitly inferred, as in the normal individual
// finale. This finds occupied-lane wheel spacing before any rule permits a
// pass, yield, draft or merge. All work and energy stop at the first event.
export function recordDissolvedFrontFirstWheel(tour,trace){
  const source=resolveFinaleMultibandPositionedSource(tour,
    {includeDropped:true});
  const frame=trace?.frames?.[0];
  const front=source.roadBands[0];
  const exits=frame?.frontExhaustionDrops;
  const lengthM=frame?.endDistanceM-frame?.startDistanceM;
  if(trace?.version!=='v2-finale-coast-dissolved-front-last-km-22'||
    trace.sourceRoadGroupIds?.[0]!==front?.id||
    source.startDistanceM!==frame?.startDistanceM||
    !Number.isFinite(lengthM)||lengthM<=0||
    !Array.isArray(exits)||exits.length!==front.slots.length||
    !Array.isArray(frame.droppedTravel?.riders)||
    !Array.isArray(frame.riders)||
    exits.some(row=>row.fromRoadGroupId!==front.id||
      row.atDistanceM!==frame.startDistanceM||
      !front.slots.some(slot=>slot.riderId===row.riderId)))
    throw new Error('A dissolved-front wheel audit needs its locked source exit.');
  const activeEnergy=new Map(frame.riders.map(row=>[row.riderId,row]));
  const candidates=[];
  for(const exit of exits){
    const slot=front.slots.find(row=>row.riderId===exit.riderId);
    const solo=frame.droppedTravel.riders.find(row=>
      row.riderId===exit.riderId);
    if(!solo||!Number.isFinite(solo.elapsedSeconds)||
      solo.elapsedSeconds<=0)
      throw new Error('A dissolved rider has no first paid passage.');
    const lead=singleWheel(exit.riderId,slot.positionM,
      front.passageSecondsFromBunchMarker,solo.elapsedSeconds,
      lengthM,source.wheelSpacingM);
    for(const active of source.roadBands.slice(1)){
      const seconds=active.id==='peloton'?
        frame.bunchElapsedSeconds:
        frame.roadGroups.find(row=>row.id===active.id)?.elapsedSeconds;
      if(!Number.isFinite(seconds)||seconds<=0)
        throw new Error('An approaching band has no first paid passage.');
      for(const activeSlot of active.slots.filter(row=>
        row.lane===slot.lane)){
        const approach=singleWheel(activeSlot.riderId,
          activeSlot.positionM,active.passageSecondsFromBunchMarker,
          seconds,lengthM);
        const contact=recordFinalePaidCrossBandOverlap(lead,approach);
        if(!contact)continue;
        const time=contact.elapsedSecondsFromLastKmStart;
        const soloShare=(time-front.passageSecondsFromBunchMarker)/
          solo.elapsedSeconds;
        const activeShare=(time-active.passageSecondsFromBunchMarker)/
          seconds;
        const activeRow=activeEnergy.get(activeSlot.riderId);
        if(!activeRow||activeRow.role==='dropped')
          throw new Error('An approaching wheel lacks active paid work.');
        candidates.push({leaverRiderId:exit.riderId,
          approachingRiderId:activeSlot.riderId,
          approachingBandId:active.id,lane:slot.lane,
          elapsedSecondsFromLastKmStart:time,
          approachingWheelM:contact.distanceM,
          leaverWheelM:contact.distanceM+source.wheelSpacingM,
          wheelSpacingM:source.wheelSpacingM,
          leaverEnergyAtContact:energyAt(solo,soloShare),
          approachingEnergyAtContact:energyAt(activeRow,activeShare)});
      }
    }
  }
  candidates.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.lane-b.lane||
    a.leaverRiderId.localeCompare(b.leaverRiderId)||
    a.approachingRiderId.localeCompare(b.approachingRiderId));
  return {version:FINALE_DISSOLVED_FRONT_WHEEL_AUDIT_VERSION,
    sourceTraceVersion:trace.version,
    sourcePositionVersion:source.version,
    status:candidates.length?'unresolved_occupied_lane_wheel_contact':
      'no_occupied_lane_wheel_contact_in_first_slice',
    firstPotentialWheelContact:candidates[0]??null,
    candidates,contactResolved:false,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateDissolvedFrontFirstWheel(tour,trace,recording){
  if(!isDeepStrictEqual(recording,
    recordDissolvedFrontFirstWheel(tour,trace)))
    throw new Error('The dissolved-front wheel audit does not replay.');
  return true;
}
