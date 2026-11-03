// Assemble one complete field kilometre after the source-ordered
// two-rider return. Other rear roads remain separate and fully paid.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalOrderedRearBunchJoinKmV1} from
  './physical-ordered-rear-bunch-join-v1.mjs';
import {sourcePhysicalOrderedRearBoundaryRoadsV1,
  findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_KM_VERSION=
  'v2-physical-ordered-rear-km-1';
const EPS=1e-5;

export function replayPhysicalOrderedRearKmV1(input){
  const joined=finishPhysicalOrderedRearBunchJoinKmV1(
    input);
  const {recording:boundary,tracks,bunch,
    soloField,step}=
      sourcePhysicalOrderedRearBoundaryRoadsV1(
        input);
  const {start,startInput,throughKm:km}=input;
  if(!isDeepStrictEqual(boundary,
    joined.sources.contact.sources.first
      .sources.boundary))
    throw new Error(
      'Ordered rear kilometre lacks same source.');
  const removed=new Set(joined.sources.contact
    .sources.first.contact.roadIds);
  const remaining=tracks.filter(track=>
    !removed.has(track.id));
  if(findPhysicalOrderedBoundaryEventsV1(
    remaining,bunch,km).length)
    throw new Error(
      'Ordered rear kilometre needs later contact.');
  const previous=new Map(boundary.prior
    .endEntities.flatMap(entity=>
      entity.riderIds.map(riderId=>[
        riderId,entity])));
  const candidates=new Map(soloField
    .candidates.map(row=>[
      row.riderId,row]));
  const rearRoads=[];
  const rearStates=[];
  for(const track of remaining){
    const states=track.riderIds.map(riderId=>{
      const prior=previous.get(riderId);
      const split=step.splits.find(row=>
        row.riderId===riderId);
      const priorStep=step.riders.find(row=>
        row.riderId===riderId);
      const candidate=candidates.get(riderId);
      const sourceRow=track.kind==='solo'?
        candidate?.lossKm===km?
          candidate.completion:
          candidate?.steps.find(row=>
            row.sourceKm===km):
        track.rows.find(row=>
          row.riderId===riderId);
      if(!sourceRow||
        !prior&&!split||
        track.kind==='group'&&
          (split||!prior)||
        track.kind==='solo'&&
          candidate?.riderId!==riderId)
        throw new Error(
          'Ordered rear kilometre lacks paid road.');
      const startEnergy=split?
        priorStep?.energyAfter:
        prior.energyByRider[riderId];
      const startClock=split?
        joined.bunchEndClock:
        prior.clock;
      const endEnergy=sourceRow.energyAfter;
      const endClock=track.kind==='group'?
        track.endClock:
        sourceRow.elapsedSeconds;
      const rawStartEnergy=track.kind==='group'?
        sourceRow.energyBefore:
        track.energyAt(track.domainStartM);
      const rawEndEnergy=track.kind==='group'?
        sourceRow.energyAfter:
        track.energyAt(1000);
      if(!Number.isFinite(startEnergy)||
        !Number.isFinite(endEnergy)||
        endEnergy<0||
        !Number.isFinite(startClock)||
        !Number.isFinite(endClock)||
        endClock<=startClock||
        Math.abs(rawStartEnergy-
          startEnergy)>EPS||
        Math.abs(rawEndEnergy-
          endEnergy)>.002||
        Math.abs(track.clockAt(
          track.domainStartM)-
          startClock)>EPS||
        Math.abs(track.clockAt(1000)-
          endClock)>EPS)
        throw new Error(
          'Ordered rear kilometre breaks paid continuity.');
      const splitDecision=split?
        step.riderDecisions.find(row=>
          row.riderId===riderId):null;
      const decision=sourceRow.decision;
      if(!decision||split&&!splitDecision)
        throw new Error(
          'Ordered rear kilometre lacks decision.');
      const state={riderId,sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:endClock,
        energyAfter:endEnergy,
        decisions:[...(split?[
          splitDecision]:[]),decision]};
      rearStates.push(state);
      return {riderId,
        role:track.kind==='group'?
          sourceRow.role:'solo',
        energyBefore:startEnergy,
        energyAfter:endEnergy,
        decision,
        ...(track.kind==='group'?{
          draftFraction:
            sourceRow.draftFraction}:{})};
    });
    if(track.kind==='group'&&(
      states.filter(row=>
        row.role==='leader').length!==1||
      states.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Ordered rear kilometre lacks one paid leader.');
    rearRoads.push({id:track.id,
      kind:track.kind,
      riderIds:[...track.riderIds],
      startDistanceM:(km-1)*1000+
        track.domainStartM,
      endDistanceM:km*1000,
      startClock:track.clockAt(
        track.domainStartM),
      endClock:track.clockAt(1000),
      ...(track.kind==='group'?{
        leaderRiderId:
          track.leaderRiderId}:{}),
      riders:states});
  }
  const byId=new Map([...joined.riderStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==start.riderIds.length||
    joined.riderStates.length+
      rearStates.length!==start.riderIds.length||
    start.riderIds.some(id=>!byId.has(id)))
    throw new Error(
      'Ordered rear kilometre lacks full field.');
  const riderStates=start.riderIds.map(id=>
    byId.get(id));
  const endRearEntities=remaining.map(track=>{
    const rows=track.riderIds.map(id=>
      byId.get(id));
    const clock=rows[0].elapsedSeconds;
    if(rows.some(row=>
      row.physicalGroupId!==track.id||
      Math.abs(row.elapsedSeconds-clock)>EPS))
      throw new Error(
        'Ordered rear end state lacks shared road.');
    const prior=previous.get(track.riderIds[0]);
    if(track.kind==='group'&&(
      !prior||prior.id!==track.id||
      !Number.isInteger(prior.rotationIndex)))
      throw new Error(
        'Ordered rear end state lacks rotation source.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock,
      energyByRider:Object.fromEntries(
        rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:prior.formedKm===km?
          prior.rotationIndex:
          (prior.rotationIndex+1)%
            track.riderIds.length,
        formedKm:prior.formedKm}:{})};
  });
  return {version:PHYSICAL_ORDERED_REAR_KM_VERSION,
    sourceKm:km,
    sources:{joined,boundary},
    rearRoads,
    riderStates,
    endBunchState:
      joined.nextBunchState,
    endRearEntities,
    physicalGroups:[joined.physicalGroup,
      ...rearRoads.map(row=>({id:row.id,
        riderIds:row.riderIds,
        atDistanceM:km*1000}))],
    riderCount:riderStates.length,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalOrderedRearKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearKmV1(input)))
    throw new Error(
      'Ordered rear kilometre differs from paid source.');
  return true;
}
