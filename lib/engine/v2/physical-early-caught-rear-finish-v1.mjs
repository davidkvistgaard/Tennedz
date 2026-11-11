// Complete a caught-break/later-drop race after their paid rear contact.
// A further split or bunch return requires a new source and is refused.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalEarlyCaughtNextRearKmV1} from
  './physical-early-caught-next-rear-km-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';

export const PHYSICAL_EARLY_CAUGHT_REAR_FINISH_VERSION=
  'v2-physical-early-caught-rear-finish-1';

function recordedTrack(track){
  return Object.fromEntries(Object.entries(track)
    .filter(([key])=>key!=='clockAt'&&
      key!=='energyAt'));
}

export function replayPhysicalEarlyCaughtRearFinishV1(input){
  const first=replayPhysicalEarlyCaughtNextRearKmV1(
    input);
  const {startInput,start,throughKm}=input;
  if(!first.sources.group||
    !Number.isInteger(throughKm)||
    throughKm<=first.sourceKm||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Caught rear finish needs paid group contact.');
  const loss=first.sources.partial.sources.loss;
  const caughtRiderId=first.sources.partial.sources
    .priorRace.sources.slide.riderId;
  const detachedRiderIds=loss.splits.map(row=>
    row.riderId);
  const groupId=first.sources.group.groupId;
  const groupRiderIds=first.sources.group.riderIds;
  let groupClock=first.sources.group.endClock;
  let groupEnergy=Object.fromEntries(
    first.sources.group.rows.map(row=>[
      row.riderId,row.energyAfter]));
  let bunchPrior=first.sources.bunch;
  let bunchClock=first.kilometres.at(-1)
    .riderStates.find(row=>row.physicalGroupId===
      'peloton')?.elapsedSeconds;
  if(!Number.isFinite(bunchClock)||
    groupRiderIds.length!==2||
    !groupRiderIds.includes(caughtRiderId)||
    !groupRiderIds.includes(detachedRiderIds[0]))
    throw new Error('Caught rear finish lacks paid road state.');
  const kilometres=[...first.kilometres];
  const later=[];
  for(let km=first.sourceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:bunchPrior
      .physicalGroup.riderIds,
    energyByRider:bunchPrior.energyByRider,
    quietKmByRider:bunchPrior.quietKmByRider};
    const bunch=advancePhysicalBunchAfterPostcatchLossKmV1({
      startInput,prior,segment,caughtRiderId,
      detachedRiderIds});
    const nextBunchClock=bunchClock+
      bunch.elapsedSeconds;
    const rear=pricePhysicalRearEventTrackV1({
      startInput,riderIds:groupRiderIds,
      energyByRider:groupEnergy,km,startM:0,
      startClock:groupClock,
      rotationIndex:(km-first.sourceKm)%
        groupRiderIds.length,groupId});
    const bunchTrack={riderId:'peloton',
      domainStartM:0,breaks:[],
      clockAt:metres=>bunchClock+
        bunch.elapsedSeconds*metres/1000};
    if(findFirstPaidRoadClockMeetingV1(
      rear,bunchTrack,km)||
      rear.endClock<=nextBunchClock)
      throw new Error('Caught rear finish needs paid bunch return.');
    if(rear.rows.filter(row=>
      row.role==='leader').length!==1||
      rear.rows.filter(row=>
        row.role==='sheltered').length!==1||
      rear.rows.some(row=>
        row.draftFraction!==(row.role===
          'leader'?1:.8)||
        Math.abs(row.energyBefore-
          groupEnergy[row.riderId])>1e-6)||
      Math.abs(rear.startClock-groupClock)>1e-6)
      throw new Error('Caught rear finish lacks paid rotation.');
    const decisions=new Map(bunch.riderDecisions
      .map(row=>[row.riderId,row]));
    const states=bunch.physicalGroup.riderIds.map(
      riderId=>{
        const row=bunch.riders.find(item=>
          item.riderId===riderId);
        return {riderId,sourceKm:km,
          physicalGroupId:'peloton',
          atDistanceM:km*1000,
          elapsedSeconds:nextBunchClock,
          energyAfter:row.energyAfter,
          decisions:[decisions.get(riderId)]};
      });
    for(const row of rear.rows)states.push({
      riderId:row.riderId,sourceKm:km,
      physicalGroupId:groupId,
      atDistanceM:km*1000,
      elapsedSeconds:rear.endClock,
      energyAfter:row.energyAfter,
      decisions:[row.decision]});
    if(states.length!==start.riderIds.length||
      new Set(states.map(row=>row.riderId))
        .size!==start.riderIds.length||
      states.some(row=>!row.decisions[0]||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0))
      throw new Error('Caught rear finish lacks rider kilometre.');
    const riderStates=states.sort((a,b)=>
      start.riderIds.indexOf(a.riderId)-
        start.riderIds.indexOf(b.riderId));
    kilometres.push({sourceKm:km,riderStates});
    later.push({sourceKm:km,bunch,
      rear:recordedTrack(rear)});
    bunchPrior=bunch;
    bunchClock=nextBunchClock;
    groupClock=rear.endClock;
    groupEnergy=Object.fromEntries(rear.rows
      .map(row=>[row.riderId,row.energyAfter]));
  }
  return {version:PHYSICAL_EARLY_CAUGHT_REAR_FINISH_VERSION,
    throughKm,riderIds:[...start.riderIds],
    kilometres,sources:{first,later},
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        kilometres.at(-1).riderStates.map(row=>[
          row.riderId,row.elapsedSeconds]))}:{}),
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalEarlyCaughtRearFinishV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalEarlyCaughtRearFinishV1(input)))
    throw new Error('Caught rear finish differs from paid source.');
  return true;
}
