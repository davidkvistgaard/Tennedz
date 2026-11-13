import {isDeepStrictEqual} from 'node:util';
import {recordFinalePaidCrossBandOverlap,
  paidQueuedRiderAt} from './finale-late-active-wheel-contact.mjs';
import {FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION} from
  './finale-dissolved-front-conditional-line.mjs';

export const FINALE_DISSOLVED_FRONT_POST500_WHEEL_VERSION=
  'v2-finale-dissolved-front-post500-wheel-1';
const EPSILON=1e-7;

function riderBand(band,riderId,shiftM){
  return {runner:{frames:band.runner.frames.map(frame=>({
    ...frame,riders:frame.riders.filter(row=>
      row.riderId===riderId).map(row=>({
        ...row,positionBeforeM:row.positionBeforeM+shiftM,
        positionM:row.positionM+shiftM,
        ...(row.motionSegments?{motionSegments:
          row.motionSegments.map(part=>({
            ...part,startPositionM:part.startPositionM+shiftM,
            endPositionM:part.endPositionM+shiftM}))}:{} )}))}))}};
}

// The shoulder rule gives each exhausted leaver a separate outside lane.
// Source-isolated riders remain independent as before. Only the surviving
// active group and bunch share source lanes, so their paid individual
// motion is checked for the first occupied-lane wheel encounter here.
export function recordFinaleDissolvedFrontPost500Wheel(tour,line){
  const finishM=tour.route.distanceKm*1000;
  const bands=line?.positionedSource?.roadBands;
  const runners=line?.bandRunners;
  const spacing=line?.positionedSource?.wheelSpacingM;
  if(line?.version!==FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION||
    !Array.isArray(bands)||bands.length!==2||
    bands[1].id!=='peloton'||
    !Array.isArray(runners)||runners.length<2||
    runners[0].roadBandId!==bands[0].id||
    runners[1].roadBandId!==bands[1].id||
    !Number.isFinite(spacing)||spacing<=0||
    line.shoulder.passages.find(row=>
      row.distanceM===finishM-500)?.isolated.length!==
      runners.length-2||
    line.shoulder.laneAssignments.some(row=>
      row.outsideLane<line.positionedSource.laneCount))
    throw new Error('A post-500 wheel audit needs the paid shoulder line.');
  const candidates=[];
  for(const frontSlot of bands[0].slots){
    for(const bunchSlot of bands[1].slots.filter(row=>
      row.lane===frontSlot.lane)){
      const commonStart=Math.max(
        runners[0].runner.frames[0].elapsedSecondsAtStart,
        runners[1].runner.frames[0].elapsedSecondsAtStart);
      const frontFinish=runners[0].runner.finishers.find(row=>
        row.riderId===frontSlot.riderId)?.elapsedSecondsFromLastKmStart;
      const bunchFinish=runners[1].runner.finishers.find(row=>
        row.riderId===bunchSlot.riderId)?.elapsedSecondsFromLastKmStart;
      if(!Number.isFinite(frontFinish)||
        !Number.isFinite(bunchFinish))
        throw new Error('An active source wheel has no paid crossing.');
      if(commonStart>=Math.min(frontFinish,bunchFinish)-EPSILON)
        continue;
      const frontAtStart=paidQueuedRiderAt(runners[0],
        frontSlot.riderId,commonStart);
      const bunchAtStart=paidQueuedRiderAt(runners[1],
        bunchSlot.riderId,commonStart);
      // Moving the front wheel back by one wheel spacing turns first
      // physical approach into the existing exact paid-overlap solver.
      const shifted=riderBand(runners[0],frontSlot.riderId,-spacing);
      const approaching=riderBand(runners[1],bunchSlot.riderId,0);
      const initialGap=frontAtStart.positionM-bunchAtStart.positionM;
      const contact=initialGap<=spacing+EPSILON?{
        elapsedSecondsFromLastKmStart:commonStart,
        distanceM:bunchAtStart.positionM,
        atHandoff:true}:
        recordFinalePaidCrossBandOverlap(shifted,approaching);
      if(!contact)continue;
      const time=contact.elapsedSecondsFromLastKmStart;
      const front=paidQueuedRiderAt(runners[0],frontSlot.riderId,time);
      const bunch=paidQueuedRiderAt(runners[1],bunchSlot.riderId,time);
      if(!contact.atHandoff&&
        Math.abs(front.positionM-bunch.positionM-spacing)>EPSILON||
        front.positionM<finishM-500-EPSILON||
        front.positionM>finishM+EPSILON)
        throw new Error('A post-500 wheel encounter has no paid spacing.');
      candidates.push({frontRiderId:frontSlot.riderId,
        bunchRiderId:bunchSlot.riderId,lane:frontSlot.lane,
        elapsedSecondsFromLastKmStart:time,
        atHandoff:!!contact.atHandoff,
        frontWheelM:front.positionM,
        bunchWheelM:bunch.positionM,
        frontEnergyAtContact:front.energy,
        bunchEnergyAtContact:bunch.energy});
    }
  }
  candidates.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.lane-b.lane||
    a.frontRiderId.localeCompare(b.frontRiderId)||
    a.bunchRiderId.localeCompare(b.bunchRiderId));
  return {version:FINALE_DISSOLVED_FRONT_POST500_WHEEL_VERSION,
    sourceIndividualLineVersion:line.version,
    sourceShoulderVersion:line.shoulder.version,
    status:candidates.length?
      'active_cross_band_wheel_contact_unresolved':
      'no_active_cross_band_wheel_contact',
    firstPotentialWheelContact:candidates[0]??null,
    candidates,classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDissolvedFrontPost500Wheel(tour,line,
  recording){
  if(!isDeepStrictEqual(recording,
    recordFinaleDissolvedFrontPost500Wheel(tour,line)))
    throw new Error('The post-500 dissolved-front wheel audit does not replay.');
  return true;
}
