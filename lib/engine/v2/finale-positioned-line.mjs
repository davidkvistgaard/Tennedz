import {isDeepStrictEqual} from 'node:util';
import {recordFinaleRotationLeadOutCandidateFromTour} from
  './finale-rotation-lead-out-candidate.mjs';

export const FINALE_POSITIONED_LINE_VERSION=
  'v2-finale-positioned-line-lab-1';
const EPSILON=1e-9;

// Conditional laboratory result. Positions at 100 m must be supplied by an
// independently recorded road-position model; v91 does not provide them.
// The candidate's last 100 m is a pace/work proposal, not a completed line:
// every rider stops and pays at their own exact crossing on one clock.
export function resolvePositionedFinaleLine(candidate,positionsAt100M){
  const sprint=candidate?.sprint;
  const frames=sprint?.frames;
  const approach=candidate?.approach;
  if(candidate?.version!==
      'v2-finale-rotation-lead-out-candidate-1'||
    !['caught','contained'].includes(candidate.branch)||
    candidate.resultStatus!=='unclassified'||
    !Array.isArray(frames)||frames.length!==3||
    !Array.isArray(approach?.frames)||approach.frames.length!==2||
    !Array.isArray(positionsAt100M))
    throw new Error('The positioned line needs a paid complete-bunch candidate.');
  const prior=frames[1];
  const proposed=frames[2];
  const ids=prior.pelotonRiderIds;
  const positionById=new Map(positionsAt100M.map(row=>
    [row?.riderId,row?.distanceToLineM]));
  const priorEnergyById=new Map(prior.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const proposedById=new Map(proposed.riderEnergy.map(row=>
    [row.riderId,row]));
  if(ids.length===0||new Set(ids).size!==ids.length||
    positionsAt100M.length!==ids.length||positionById.size!==ids.length||
    priorEnergyById.size!==ids.length||proposedById.size!==ids.length||
    ids.some(id=>!positionById.has(id)||
      !Number.isFinite(positionById.get(id))||
      positionById.get(id)<=0||positionById.get(id)>100||
      !priorEnergyById.has(id)||!proposedById.has(id))||
    !Number.isFinite(proposed.bunchTravelSeconds)||
    proposed.bunchTravelSeconds<=0||
    !Number.isFinite(sprint.sourceBunchElapsedSecondsAt300M))
    throw new Error('The positioned line needs every rider within the final 100 m.');
  const elapsedAt100M=sprint.sourceBunchElapsedSecondsAt300M+
    frames[0].bunchTravelSeconds+frames[1].bunchTravelSeconds;
  const finishers=ids.map(riderId=>{
    const row=proposedById.get(riderId);
    const distanceToLineM=positionById.get(riderId);
    const energyAt100M=priorEnergyById.get(riderId);
    if(!Number.isFinite(row.energyAtDecision)||
      Math.abs(row.energyAtDecision-energyAt100M)>EPSILON||
      !Number.isFinite(row.energySpent)||row.energySpent<0)
      throw new Error('The last-slice work does not follow paid rider energy.');
    const secondsPer100M=row.role==='sprint'?
      row.attemptedMovementSeconds:proposed.bunchTravelSeconds;
    if(!Number.isFinite(secondsPer100M)||secondsPer100M<=0)
      throw new Error('A line rider needs a finite last-slice pace.');
    const elapsedToLineSeconds=secondsPer100M*distanceToLineM/100;
    const energySpentToLine=row.energySpent*distanceToLineM/100;
    if(energySpentToLine>energyAt100M+EPSILON)
      throw new Error(`A line rider cannot pay to finish: ${riderId}.`);
    return {riderId,role:row.role,distanceToLineM,
      energyAt100M,energySpentToLine,
      energyAtLine:Math.max(0,energyAt100M-energySpentToLine),
      elapsedToLineSeconds,
      elapsedSecondsFromLastKmStart:elapsedAt100M+
        elapsedToLineSeconds};
  }).sort((a,b)=>a.elapsedToLineSeconds-b.elapsedToLineSeconds||
    a.riderId.localeCompare(b.riderId));
  const ambiguous=finishers.some((row,index)=>index>0&&
    Math.abs(row.elapsedToLineSeconds-
      finishers[index-1].elapsedToLineSeconds)<=EPSILON);
  const ranked=finishers.map((row,index)=>{
    let first=index,last=index;
    while(first>0&&Math.abs(finishers[first-1].elapsedToLineSeconds-
      row.elapsedToLineSeconds)<=EPSILON)first--;
    while(last<finishers.length-1&&Math.abs(
      finishers[last+1].elapsedToLineSeconds-
      row.elapsedToLineSeconds)<=EPSILON)last++;
    return {...row,position:first===last?index+1:null,
      firstPossiblePlace:first+1,lastPossiblePlace:last+1};
  });
  return {version:FINALE_POSITIONED_LINE_VERSION,
    sourceCandidateVersion:candidate.version,
    sourceSprintVersion:sprint.version,
    positionSourceStatus:'external_unverified',
    startDistanceM:sprint.endDistanceM-100,
    lineDistanceM:sprint.endDistanceM,
    elapsedSecondsAt100M:elapsedAt100M,
    resultStatus:ambiguous?'photo_finish_unresolved':
      'conditional_order',
    finishers:ranked,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function recordPositionedFinaleLineFromTour(tour,input,
  positionsAt100M){
  const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,input);
  const line=resolvePositionedFinaleLine(candidate,positionsAt100M);
  const teamByRiderId=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  if(teamByRiderId.size!==line.finishers.length||
    line.finishers.some(row=>!teamByRiderId.has(row.riderId)))
    throw new Error('The positioned line differs from the locked roster.');
  return {...line,finishers:line.finishers.map(row=>({
    ...row,teamId:teamByRiderId.get(row.riderId)}))};
}

export function validatePositionedFinaleLineFromTour(tour,input,
  positionsAt100M,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPositionedFinaleLineFromTour(tour,input,positionsAt100M)))
    throw new Error('The positioned finale line does not replay.');
  return true;
}
