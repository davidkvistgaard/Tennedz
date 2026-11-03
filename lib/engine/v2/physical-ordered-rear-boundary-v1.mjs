// Locate the first road-clock meeting after a fully paid rear replay.
// It changes no membership; later paths remain counterfactual until
// that meeting is resolved and the same kilometre is repriced.
import {isDeepStrictEqual} from 'node:util';
import {startPhysicalBunchV1,
  runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {probePhysicalStaggeredSoloFieldV1} from
  './physical-staggered-detached-solo-v1.mjs';
import {inspectPhysicalRearEventEndStateV1} from
  './physical-staggered-rear-event-replay-v1.mjs';
import {probePhysicalOrderedSoloBunchContactV1} from
  './physical-ordered-solo-bunch-contact-v1.mjs';
import {staggeredSoloTrajectoryV1,
  findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';

export const PHYSICAL_ORDERED_REAR_BOUNDARY_VERSION=
  'v2-physical-ordered-rear-boundary-1';
const EPS=1e-6;

function soloTrack(entity,solo,km,bunchPriorSeconds,step){
  if(!solo)
    throw new Error('Ordered boundary lacks solo source.');
  const source=staggeredSoloTrajectoryV1(solo,km,
    bunchPriorSeconds,step);
  if(!source)
    throw new Error('Ordered boundary lacks later solo road.');
  const split=step.splits.find(row=>
    row.riderId===entity.riderIds[0]);
  return {...source,id:entity.id,kind:'solo',
    riderIds:[...entity.riderIds],
    domainStartM:split?
      split.atDistanceM-(km-1)*1000:0,
    domainEndM:1000};
}

function crossingTrack(probe){
  const contact=probe.contact;
  const riderId=probe.riderId;
  if(!contact||contact.sourceKm!==
    probe.throughKm||!contact.candidateOnly)
    throw new Error('Ordered boundary needs candidate crossing.');
  const metres=contact.metresIntoKm;
  const startClock=contact.clockSeconds-
    contact.soloSecondsPerKm*metres/1000;
  if(metres<=0||metres>=1000||
    !Number.isFinite(startClock))
    throw new Error('Ordered boundary needs paid solo clock.');
  return {id:`solo-${riderId}`,kind:'solo',
    riderId,riderIds:[riderId],
    domainStartM:0,domainEndM:metres,
    breaks:[],
    clockAt:distance=>startClock+
      contact.soloSecondsPerKm*distance/1000,
    energyAt:distance=>
      contact.soloEnergyBefore-
      contact.soloEnergySpentToContact*
        distance/metres};
}

function energiesAt(track,metres){
  const raw=track.energyAt(metres);
  const rows=Array.isArray(raw)?raw:[{
    riderId:track.riderIds[0],
    energyAtContact:raw}];
  if(rows.length!==track.riderIds.length||
    rows.some(row=>!Number.isFinite(
      row.energyAtContact)||
      row.energyAtContact<0))
    throw new Error('Ordered boundary lacks paid energy.');
  return rows.map(row=>({riderId:row.riderId,
    energyAtContact:+row.energyAtContact
      .toFixed(6)}));
}

function meeting(a,b,km){
  const result=findFirstPaidRoadClockMeetingV1(
    a,b,km);
  if(!result||result.metresIntoKm>
    Math.min(a.domainEndM??1000,
      b.domainEndM??1000)+EPS)
    return null;
  return {sourceKm:km,
    atDistanceM:(km-1)*1000+
      result.metresIntoKm,
    metresIntoKm:result.metresIntoKm,
    clockSeconds:result.clockSeconds,
    roadIds:[a.id,b.id],
    catchingRoadId:result.catchingRiderId,
    riders:[...energiesAt(a,
      result.metresIntoKm),
    ...(b.id==='peloton'?[]:
      energiesAt(b,result.metresIntoKm))],
    involvesBunch:a.id==='peloton'||
      b.id==='peloton'};
}

export function inspectPhysicalOrderedRearBoundaryV1({
  startInput,start,throughKm}){
  if(startInput?.physicalDraftVersion!==4||
    startInput?.physicalRearIntentVersion!==2||
    !isDeepStrictEqual(start,
      startPhysicalBunchV1(startInput))||
    !Number.isInteger(throughKm)||
    throughKm<3||
    throughKm>startInput.routeKilometres.length)
    throw new Error('Ordered boundary needs replayed opt-in start.');
  const km=throughKm;
  const prefixKm=km-1;
  const priorStaggered=
    runPhysicalStaggeredBunchLossV1({
      startInput,start,throughKm:prefixKm});
  const priorSoloField=
    probePhysicalStaggeredSoloFieldV1({
      startInput,start,
      staggered:priorStaggered,
      throughKm:prefixKm});
  if(priorSoloField.refusals.length)
    throw new Error('Ordered boundary lacks paid prefix.');
  const prior=inspectPhysicalRearEventEndStateV1({
    startInput,start,staggered:priorStaggered,
    soloField:priorSoloField,
    throughKm:prefixKm});
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:km});
  const soloField=probePhysicalStaggeredSoloFieldV1({
    startInput,start,staggered,throughKm:km});
  if(soloField.refusals.length!==1||
    soloField.refusals[0].reason!==
      'Staggered solo needs separate bunch contact.')
    throw new Error('Ordered boundary needs one first crossing.');
  const riderId=soloField.refusals[0].riderId;
  const crossing=probePhysicalOrderedSoloBunchContactV1({
    startInput,start,staggered,riderId,
    throughKm:km});
  const step=staggered.road[km-1];
  const bunchPriorSeconds=prior.source.kilometres
    .at(-1).riderStates.find(row=>
      row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  if(!Number.isFinite(bunchPriorSeconds))
    throw new Error('Ordered boundary lacks bunch clock.');
  const candidateById=new Map(soloField.candidates
    .map(row=>[row.riderId,row]));
  const oldIds=new Set(prior.endEntities
    .flatMap(row=>row.riderIds));
  const entities=[...prior.endEntities,
    ...step.splits.filter(row=>
      !oldIds.has(row.riderId)).map(row=>({
        id:`solo-${row.riderId}`,
        kind:'solo',
        riderIds:[row.riderId]}))];
  const crossingEntity=entities.find(entity=>
    entity.riderIds.includes(riderId));
  if(!crossingEntity)
    throw new Error('Ordered boundary lost crossing rider.');
  const tracks=entities.map(entity=>{
    if(entity.id===`solo-${riderId}`&&
      entity.kind==='solo')
      return crossingTrack(crossing);
    if(entity.kind==='solo')
      return soloTrack(entity,candidateById.get(
        entity.riderIds[0]),km,
      bunchPriorSeconds,step);
    const track=pricePhysicalRearEventTrackV1({
      startInput,riderIds:entity.riderIds,
      energyByRider:entity.energyByRider,
      km,startM:0,startClock:entity.clock,
      rotationIndex:entity.rotationIndex,
      groupId:entity.id});
    return {...track,id:entity.id,
      kind:'group',domainEndM:1000};
  });
  const bunch={id:'peloton',
    riderId:'peloton',riderIds:[],
    domainStartM:0,domainEndM:1000,
    breaks:[],
    clockAt:metres=>bunchPriorSeconds+
      step.elapsedSeconds*metres/1000};
  const crossingRoad=tracks.find(track=>
    track.id===`solo-${riderId}`);
  const candidateBunchClockDifference=
    crossingRoad?crossingRoad.clockAt(
      crossing.contact
      .metresIntoKm)-
    bunch.clockAt(crossing.contact
      .metresIntoKm):null;
  const events=[];
  for(let index=0;index<tracks.length;index++){
    for(let other=index+1;other<tracks.length;
      other++){
      const contact=meeting(tracks[index],
        tracks[other],km);
      if(contact)events.push(contact);
    }
    const contact=meeting(tracks[index],
      bunch,km);
    if(contact)events.push(contact);
  }
  events.sort((a,b)=>a.clockSeconds-
    b.clockSeconds||
    a.atDistanceM-b.atDistanceM||
    a.roadIds.join('|').localeCompare(
      b.roadIds.join('|')));
  return {version:PHYSICAL_ORDERED_REAR_BOUNDARY_VERSION,
    throughKm:km,prior,
    firstIndependentBunchCrossing:
      crossing.contact,
    crossingRiderActualRoadId:
      crossingEntity.id,
    independentCrossingPreemptedByRearJoin:
      crossingEntity.kind==='group',
    candidateBunchClockDifference,
    activeRoads:tracks.map(track=>({
      id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      domainStartM:track.domainStartM,
      domainEndM:track.domainEndM,
      ...(track.kind==='group'?{
        leaderRiderId:track.leaderRiderId}: {})})),
    firstEvent:events[0]??null,
    candidateEventCount:events.length,
    eventChangesMembership:false,
    laterRoadUnsettled:true,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalOrderedRearBoundaryV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalOrderedRearBoundaryV1(input)))
    throw new Error('Ordered boundary differs from paid source.');
  return true;
}
