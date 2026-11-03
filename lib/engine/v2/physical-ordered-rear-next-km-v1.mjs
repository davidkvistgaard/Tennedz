// Complete the next field kilometre only when all paid roads remain
// separate and the sourced event search finds no contact.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearNextBoundaryV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_NEXT_KM_VERSION=
  'v2-physical-ordered-rear-next-km-1';
const EPS=.002;

export function replayPhysicalOrderedRearNextKmV1(input){
  const {recording:boundary,tracks,next}=
    sourcePhysicalOrderedRearNextBoundaryV1(input);
  if(boundary.firstEvent||
    boundary.candidateEventCount!==0)
    throw new Error(
      'Next rear kilometre needs ordered contact choice.');
  const km=next.sourceKm;
  const {step}=next;
  const prior=next.sources.prior;
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const bunchClock=next.bunchStartClock+
    step.elapsedSeconds;
  const byDecision=new Map(step.riderDecisions
    .map(row=>[row.riderId,row]));
  const byBunchRow=new Map(step.riders
    .map(row=>[row.riderId,row]));
  const bunchStates=step.physicalGroup.riderIds
    .map(riderId=>{
      const row=byBunchRow.get(riderId);
      const decision=byDecision.get(riderId);
      if(!row||!decision||
        row.energyAfter!==
          step.energyByRider[riderId])
        throw new Error(
          'Next rear kilometre lacks paid bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchClock,
        energyAfter:row.energyAfter,
        decisions:[decision]};
    });
  const rearStates=[];
  const endRearEntities=tracks.map(track=>{
    const old=oldEntities.get(track.id);
    if(!old||
      !isDeepStrictEqual(track.riderIds,
        old.riderIds)||
      Math.abs(track.startClock-old.clock)>EPS)
      throw new Error(
        'Next rear kilometre lacks prior road.');
    for(const row of track.rows){
      const endEnergy=track.energyAt(1000);
      const measuredEndEnergy=Array.isArray(
        endEnergy)?endEnergy.find(item=>
          item.riderId===row.riderId)
          ?.energyAtContact:endEnergy;
      if(Math.abs(row.energyBefore-
        old.energyByRider[row.riderId])>EPS||
        !Number.isFinite(measuredEndEnergy)||
        Math.abs(measuredEndEnergy-
          row.energyAfter)>EPS)
        throw new Error(
          'Next rear kilometre breaks paid energy.');
      rearStates.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]});
    }
    const leaders=track.rows.filter(row=>
      row.role==='leader');
    if(track.kind==='group'&&(
      leaders.length!==1||
      track.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Next rear kilometre lacks one paid leader.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:(old.rotationIndex+1)%
          track.riderIds.length,
        formedKm:old.formedKm}:{})};
  });
  const byId=new Map([...bunchStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    bunchStates.length+rearStates.length!==
      prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId)))
    throw new Error(
      'Next rear kilometre lacks full field.');
  return {version:PHYSICAL_ORDERED_REAR_NEXT_KM_VERSION,
    sourceKm:km,
    sources:{next,boundary},
    riderStates:prior.riderStates.map(row=>
      byId.get(row.riderId)),
    endBunchState:{
      riderIds:[...step.physicalGroup.riderIds],
      energyByRider:step.energyByRider,
      quietKmByRider:step.quietKmByRider},
    endRearEntities,
    riderCount:byId.size,
    physicalGroups:[step.physicalGroup,
      ...endRearEntities.map(entity=>({
        id:entity.id,
        riderIds:entity.riderIds,
        atDistanceM:km*1000}))],
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalOrderedRearNextKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearNextKmV1(input)))
    throw new Error(
      'Next rear kilometre differs from paid source.');
  return true;
}
