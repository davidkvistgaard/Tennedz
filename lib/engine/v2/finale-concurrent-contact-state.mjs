import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNextBoundaryFromTour} from
  './finale-concurrent-next-boundary.mjs';

export const FINALE_CONCURRENT_CONTACT_STATE_VERSION=
  'v2-finale-concurrent-contact-state-1';

// Equality at a measured intersection identifies the riders physically
// together at that instant. It is not a drafting or new-work decision.
export function concurrentContactRoadBands({event,firstRiderId,
  secondRiderId,riders}){
  const kinds=['attackers_contact_uncontinued',
    'second_attacker_bunch_contact_uncontinued',
    'multiple_contacts_uncontinued'];
  if(!kinds.includes(event)||!Array.isArray(riders)||riders.length<3||
    new Set(riders.map(row=>row?.riderId)).size!==riders.length||
    !riders.some(row=>row.riderId===firstRiderId)||
    !riders.some(row=>row.riderId===secondRiderId)||
    firstRiderId===secondRiderId||riders.some(row=>
      !Number.isFinite(row.positionM)||
      !Number.isFinite(row.energyAtEvent)||row.energyAtEvent<0))
    throw new Error('Contact bands need a paid exact-intersection state.');
  const first=riders.find(row=>row.riderId===firstRiderId);
  const second=riders.find(row=>row.riderId===secondRiderId);
  const bunch=riders.filter(row=>row.riderId!==firstRiderId&&
    row.riderId!==secondRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    event==='attackers_contact_uncontinued'&&
      (Math.abs(first.positionM-second.positionM)>1e-8||
        !(second.positionM>bunchPositionM))||
    event==='second_attacker_bunch_contact_uncontinued'&&
      (Math.abs(second.positionM-bunchPositionM)>1e-8||
        !(first.positionM>second.positionM))||
    event==='multiple_contacts_uncontinued'&&
      (Math.abs(first.positionM-second.positionM)>1e-8||
        Math.abs(second.positionM-bunchPositionM)>1e-8))
    throw new Error('Contact bands disagree with measured positions.');
  const frontIds=event==='attackers_contact_uncontinued'?
    [firstRiderId,secondRiderId]:
    event==='second_attacker_bunch_contact_uncontinued'?
      [firstRiderId]:[];
  const bunchIds=event==='attackers_contact_uncontinued'?
    bunch.map(row=>row.riderId):
    event==='second_attacker_bunch_contact_uncontinued'?
      [secondRiderId,...bunch.map(row=>row.riderId)]:
      [firstRiderId,secondRiderId,...bunch.map(row=>row.riderId)];
  const bands=frontIds.length?[{kind:'front',positionM:first.positionM,
    riderIds:frontIds}]:[];
  bands.push({kind:'bunch',positionM:bunchPositionM,riderIds:bunchIds});
  if(bands.flatMap(row=>row.riderIds).length!==riders.length||
    new Set(bands.flatMap(row=>row.riderIds)).size!==riders.length)
    throw new Error('Contact bands lost a rider.');
  return bands;
}

export function recordFinaleConcurrentContactStateFromTour(tour){
  const source=recordFinaleConcurrentNextBoundaryFromTour(tour);
  const roadBands=concurrentContactRoadBands(source);
  return {version:FINALE_CONCURRENT_CONTACT_STATE_VERSION,
    sourceEventVersion:source.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:source.event,
    elapsedSinceLaunchSeconds:source.elapsedSinceLaunchSeconds,
    contactPositionM:source.contactPositionM,
    firstRiderId:source.firstRiderId,
    secondRiderId:source.secondRiderId,
    roadBands,
    riders:source.riders.map(row=>({riderId:row.riderId,
      positionM:row.positionM,energyAtContact:row.energyAtEvent})),
    riderAttackLoad:source.riderAttackLoad,
    travelStatus:'stopped_at_contact',draftStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentContactStateFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentContactStateFromTour(tour)))
    throw new Error('Concurrent contact state does not replay.');
  return true;
}
