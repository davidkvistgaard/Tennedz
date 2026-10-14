import {isDeepStrictEqual} from 'node:util';
import {recordFinaleRotationLeadOutCandidateFromTour} from
  './finale-rotation-lead-out-candidate.mjs';
import {recordPositionedFinaleLineFromTour} from
  './finale-positioned-line.mjs';

export const FINALE_LEAD_OUT_LONGITUDINAL_VERSION=
  'v2-finale-lead-out-longitudinal-candidate-1';
export const FINALE_LEAD_OUT_CONDITIONAL_LINE_VERSION=
  'v2-finale-lead-out-conditional-line-1';
const EPSILON=1e-8;

// The recorded road band has one coordinate, not a starting order of wheels.
// This one-dimensional trace carries only movement paid in the existing four
// slices. It does not assert that riders can pass, draft or occupy a lane.
export function resolveLeadOutLongitudinal(candidate){
  if(candidate?.version!=='v2-finale-rotation-lead-out-candidate-1'||
    !['caught','contained'].includes(candidate.branch)||
    candidate.resultStatus!=='unclassified')
    throw new Error('Longitudinal movement needs a complete-bunch candidate.');
  const approach=candidate.approach;
  const sprint=candidate.sprint;
  const first=approach?.frames?.[0];
  const ids=first?.pelotonRiderIds;
  const lineDistanceM=sprint?.endDistanceM;
  if(!Array.isArray(ids)||ids.length<2||
    new Set(ids).size!==ids.length||
    !Number.isFinite(lineDistanceM)||
    approach.frames.length!==2||sprint.frames.length!==3||
    approach.startDistanceM!==lineDistanceM-500||
    sprint.startDistanceM!==lineDistanceM-300)
    throw new Error('Longitudinal movement needs a complete 500 m trace.');
  let positionById=new Map(ids.map(id=>[id,approach.startDistanceM]));
  const frames=[];
  for(const [index,frame] of [...approach.frames,
    ...sprint.frames.slice(0,2)].entries()){
    const approachSlice=index<2;
    const duration=approachSlice?frame.bunchElapsedSeconds:
      frame.bunchTravelSeconds;
    const startDistanceM=approach.startDistanceM+index*100;
    const endDistanceM=startDistanceM+100;
    const movements=new Map();
    if(approachSlice){
      for(const move of frame.leadOutMovement??[]){
        if(!ids.includes(move.helperId)||!ids.includes(move.finisherId)||
          move.helperId===move.finisherId||
          movements.has(move.helperId)||
          movements.has(move.finisherId)||
          !Number.isFinite(move.pullSeconds)||move.pullSeconds<=0||
          Math.abs(move.bunchSeconds-duration)>EPSILON)
          throw new Error('A paid lead-out pair has invalid movement.');
        const distanceM=100*duration/move.pullSeconds;
        movements.set(move.helperId,distanceM);
        movements.set(move.finisherId,distanceM);
      }
    }else{
      for(const row of frame.riderEnergy){
        if(row.role!=='sprint')continue;
        if(!ids.includes(row.riderId)||
          !Number.isFinite(row.attemptedMovementSeconds)||
          row.attemptedMovementSeconds<=0)
          throw new Error('A sprint rider has invalid paid movement.');
        movements.set(row.riderId,
          100*duration/row.attemptedMovementSeconds);
      }
    }
    if(frame.startDistanceM!==startDistanceM||
      frame.endDistanceM!==endDistanceM||
      !Number.isFinite(duration)||duration<=0||
      !Array.isArray(frame.pelotonRiderIds)||
      frame.pelotonRiderIds.length!==ids.length||
      new Set(frame.pelotonRiderIds).size!==ids.length||
      ids.some(id=>!frame.pelotonRiderIds.includes(id)))
      throw new Error('Longitudinal frames must share one paid clock and roster.');
    const riders=ids.map(riderId=>{
      const before=positionById.get(riderId);
      const paidDistanceM=movements.get(riderId)??100;
      // A slower attempt is reabsorbed by the already paid bunch movement.
      const positionM=Math.max(endDistanceM,before+paidDistanceM);
      if(positionM>lineDistanceM+EPSILON)
        throw new Error('A rider crossed the line before the recorded slice.');
      return {riderId,positionBeforeM:before,paidDistanceM,
        positionM,absorbedByBunch:positionM>before+paidDistanceM+
          EPSILON};
    });
    positionById=new Map(riders.map(row=>[row.riderId,row.positionM]));
    frames.push({startDistanceM,endDistanceM,bunchTravelSeconds:duration,
      riders});
  }
  const positionsAt100M=ids.map(riderId=>({riderId,
    distanceToLineM:lineDistanceM-positionById.get(riderId)}));
  if(positionsAt100M.some(row=>row.distanceToLineM<=0||
    row.distanceToLineM>100+EPSILON))
    throw new Error('The paid trace cannot provide a final-100 m handoff.');
  return {version:FINALE_LEAD_OUT_LONGITUDINAL_VERSION,
    sourceCandidateVersion:candidate.version,
    positionSourceStatus:'collapsed_road_band_candidate',
    firstDistanceM:approach.startDistanceM,
    finalHandoffDistanceM:lineDistanceM-100,lineDistanceM,
    frames,positionsAt100M,resultStatus:'unclassified',
    pointsStatus:'withheld',canCommitAwards:false};
}

export function recordLeadOutLongitudinalFromTour(tour,input){
  return resolveLeadOutLongitudinal(
    recordFinaleRotationLeadOutCandidateFromTour(tour,input));
}

export function validateLeadOutLongitudinalFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordLeadOutLongitudinalFromTour(tour,input)))
    throw new Error('The longitudinal finale does not replay.');
  return true;
}

// A complete test-only handoff from the paid bunch source to individual line
// crossings. The collapsed starting road band and unresolved lateral passing
// make this a conditional outcome, never a classified or point-paying race.
export function recordLeadOutConditionalLineFromTour(tour,input){
  const longitudinal=recordLeadOutLongitudinalFromTour(tour,input);
  const line=recordPositionedFinaleLineFromTour(tour,input,
    longitudinal.positionsAt100M);
  if(line.startDistanceM!==longitudinal.finalHandoffDistanceM||
    line.lineDistanceM!==longitudinal.lineDistanceM||
    line.finishers.length!==longitudinal.positionsAt100M.length)
    throw new Error('The conditional line lost its paid position handoff.');
  return {version:FINALE_LEAD_OUT_CONDITIONAL_LINE_VERSION,
    sourceLongitudinalVersion:longitudinal.version,
    sourceLineVersion:line.version,
    longitudinal,line,resultStatus:'provisional_conditional',
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateLeadOutConditionalLineFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordLeadOutConditionalLineFromTour(tour,input)))
    throw new Error('The conditional finale line does not replay.');
  return true;
}
