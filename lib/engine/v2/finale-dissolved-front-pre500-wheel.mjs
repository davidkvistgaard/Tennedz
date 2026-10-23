import {isDeepStrictEqual} from 'node:util';
import {recordFinalePaidCrossBandOverlap,
  paidQueuedRiderAt} from './finale-late-active-wheel-contact.mjs';
import {FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION} from
  './finale-dissolved-front-conditional-line.mjs';

export const FINALE_DISSOLVED_FRONT_PRE500_WHEEL_VERSION=
  'v2-finale-dissolved-front-pre500-wheel-1';
const EPSILON=1e-7;

function runnerForRider(line,band,slot,shiftM,finishM){
  const sourceM=finishM-1000;
  let time=band.passageSecondsFromBunchMarker;
  let position=slot.positionM+shiftM;
  let energy=slot.energy;
  const frames=[];
  for(const paid of line.shoulder.trace.frames.filter(row=>
    row.endDistanceM<=sourceM+500)){
    const lengthM=paid.endDistanceM-paid.startDistanceM;
    const seconds=band.id==='peloton'?paid.bunchElapsedSeconds:
      paid.roadGroups.find(row=>row.id===band.id)?.elapsedSeconds;
    const state=paid.riders.find(row=>row.riderId===slot.riderId);
    if(!Number.isFinite(seconds)||seconds<=0||!state||
      !Number.isFinite(state.energySpent)||
      Math.abs(energy-state.energySpent-state.energy)>EPSILON)
      throw new Error('An active pre-500 wheel lacks paid movement.');
    frames.push({elapsedSecondsAtStart:time,
      durationSeconds:seconds,riders:[{
        riderId:slot.riderId,role:state.role,
        positionBeforeM:position,positionM:position+lengthM,
        activeSeconds:seconds,activeDistanceM:lengthM,
        shelteredSeconds:0,shelteredDistanceM:0,
        activeWorkCostPerKm:state.energySpent*1000/lengthM,
        energyAtDecision:energy,energySpent:state.energySpent,
        energyAfter:state.energy}]});
    position+=lengthM;
    time+=seconds;
    energy=state.energy;
  }
  if(frames.length!==2||
    frames.at(-1).riders[0].positionM!==slot.positionM+shiftM+500)
    throw new Error('An active pre-500 wheel has no complete paid half.');
  return {runner:{frames}};
}

// The surviving group and bunch move on their own paid passage clocks.
// The inferred source slots retain their lanes and 2.5 m spacing through
// the two paid 250 m slices; a same-lane approach remains a refusal.
export function recordFinaleDissolvedFrontPre500Wheel(tour,line){
  const finishM=tour.route.distanceKm*1000;
  const [front,bunch]=line?.positionedSource?.roadBands??[];
  const spacing=line?.positionedSource?.wheelSpacingM;
  const trace=line?.shoulder?.trace;
  if(line?.version!==FINALE_DISSOLVED_FRONT_CONDITIONAL_LINE_VERSION||
    !front||bunch?.id!=='peloton'||
    !Number.isFinite(spacing)||spacing<=0||
    trace?.frames?.[0]?.endDistanceM!==finishM-750||
    trace?.frames?.[1]?.endDistanceM!==finishM-500)
    throw new Error('The pre-500 wheel audit needs two paid active bands.');
  const candidates=[];
  for(const frontSlot of front.slots)
    for(const bunchSlot of bunch.slots.filter(row=>
      row.lane===frontSlot.lane)){
      const frontBand=runnerForRider(line,front,frontSlot,0,finishM);
      const shifted=runnerForRider(line,front,frontSlot,-spacing,finishM);
      const bunchBand=runnerForRider(line,bunch,bunchSlot,0,finishM);
      const commonStart=Math.max(
        frontBand.runner.frames[0].elapsedSecondsAtStart,
        bunchBand.runner.frames[0].elapsedSecondsAtStart);
      const frontAtStart=paidQueuedRiderAt(frontBand,
        frontSlot.riderId,commonStart);
      const bunchAtStart=paidQueuedRiderAt(bunchBand,
        bunchSlot.riderId,commonStart);
      const initialGap=frontAtStart.positionM-bunchAtStart.positionM;
      const contact=initialGap<=spacing+EPSILON?{
        elapsedSecondsFromLastKmStart:commonStart,
        atHandoff:true}:
        recordFinalePaidCrossBandOverlap(shifted,bunchBand);
      if(!contact)continue;
      const time=contact.elapsedSecondsFromLastKmStart;
      const frontAt=paidQueuedRiderAt(frontBand,frontSlot.riderId,time);
      const bunchAt=paidQueuedRiderAt(bunchBand,bunchSlot.riderId,time);
      if(!contact.atHandoff&&
        Math.abs(frontAt.positionM-bunchAt.positionM-spacing)>EPSILON)
        throw new Error('The pre-500 active wheel has no paid spacing.');
      candidates.push({frontRiderId:frontSlot.riderId,
        bunchRiderId:bunchSlot.riderId,lane:frontSlot.lane,
        elapsedSecondsFromLastKmStart:time,
        frontWheelM:frontAt.positionM,
        bunchWheelM:bunchAt.positionM,
        atHandoff:!!contact.atHandoff});
    }
  candidates.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.lane-b.lane||
    a.frontRiderId.localeCompare(b.frontRiderId)||
    a.bunchRiderId.localeCompare(b.bunchRiderId));
  return {version:FINALE_DISSOLVED_FRONT_PRE500_WHEEL_VERSION,
    sourceIndividualLineVersion:line.version,
    sourceTraceVersion:trace.version,
    status:candidates.length?'active_pre500_wheel_contact_unresolved':
      'no_active_pre500_wheel_contact',
    firstPotentialWheelContact:candidates[0]??null,
    candidates,classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleDissolvedFrontPre500Wheel(tour,line,
  recording){
  if(!isDeepStrictEqual(recording,
    recordFinaleDissolvedFrontPre500Wheel(tour,line)))
    throw new Error('The pre-500 dissolved-front wheel audit does not replay.');
  return true;
}
