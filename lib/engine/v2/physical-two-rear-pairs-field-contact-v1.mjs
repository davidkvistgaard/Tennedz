// Read-only first encounter after two separately paid rear pairs form.
// Both pair roads and remaining solo roads end as race sources there.
import {isDeepStrictEqual} from 'node:util';
import {inspectNextRearPairFieldContactV1,
  paidRearPairTrajectoryV1} from
  './physical-rear-pair-field-contact-v1.mjs';
import {staggeredSoloTrajectoryV1,
  findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {finishPhysicalSecondRearPairContactV1,
  runPhysicalSecondRearPairV1} from
  './physical-second-rear-pair-v1.mjs';

export const PHYSICAL_TWO_REAR_PAIRS_FIELD_CONTACT_VERSION=
  'v2-physical-two-rear-pairs-field-contact-1';
const EPS=1e-7;

function paidRiders(track,metres){
  const energy=track.energyAt(metres);
  const rows=Array.isArray(energy)?energy:[{
    riderId:track.riderId,energyAtContact:energy}];
  if(rows.some(row=>!Number.isFinite(
    row.energyAtContact)||row.energyAtContact<0))
    throw new Error('Two-pair contact lacks paid energy.');
  return rows.map(row=>({riderId:row.riderId,
    energyAtContact:+row.energyAtContact.toFixed(6)}));
}

export function inspectTwoRearPairsFieldContactV1(input){
  const {startInput,start,staggered,soloField,
    firstFieldContact,contactRoad,pair,
    secondContact,secondContactRoad,secondPair}=input;
  const priorInput={startInput,start,staggered,
    soloField,firstFieldContact,contactRoad,pair};
  const source=inspectNextRearPairFieldContactV1(
    priorInput);
  if(source.nextContacts.length!==1||
    !isDeepStrictEqual(secondContact,
      source.nextContacts[0])||
    secondContact.kind!=='two_other_solos_meet')
    throw new Error('Two-pair field needs paid second contact.');
  const secondInput={...priorInput,secondContact};
  if(!isDeepStrictEqual(secondContactRoad,
    finishPhysicalSecondRearPairContactV1(secondInput))||
    !isDeepStrictEqual(secondPair,
      runPhysicalSecondRearPairV1({...secondInput,
        secondContactRoad,throughKm:
          soloField.throughKm}))||
    pair.sourceKm!==soloField.throughKm)
    throw new Error('Two-pair field needs replayed second road.');
  const grouped=new Set([...firstFieldContact
    .firstContact.riderIds,...secondContact.riderIds]);
  const otherSolos=soloField.candidates.filter(row=>
    !grouped.has(row.riderId));
  const possible=[];
  let bunchPriorSeconds=0;
  for(const step of staggered.road.slice(0,
    soloField.throughKm)){
    const km=step.sourceKm;
    const first=paidRearPairTrajectoryV1(
      firstFieldContact.firstContact,
      contactRoad,pair,km);
    const second=paidRearPairTrajectoryV1(
      secondContact,secondContactRoad,
      secondPair,km);
    const groups=[first,second].filter(Boolean);
    const solos=otherSolos.map(solo=>
      staggeredSoloTrajectoryV1(solo,km,
        bunchPriorSeconds,step)).filter(Boolean);
    const tracks=[...groups,...solos];
    for(let left=0;left<tracks.length;left++)
      for(let right=left+1;right<tracks.length;
        right++){
        const a=tracks[left];
        const b=tracks[right];
        const meeting=findFirstPaidRoadClockMeetingV1(
          a,b,km);
        if(!meeting)continue;
        const aGroup=groups.includes(a);
        const bGroup=groups.includes(b);
        possible.push({kind:aGroup&&bGroup?
          'rear_pair_meets_rear_pair':
          aGroup||bGroup?'rear_pair_meets_solo':
            'two_other_solos_meet',
        sourceKm:km,
        roadIds:[a.riderId,b.riderId],
        catchingRoadId:meeting.catchingRiderId,
        atDistanceM:(km-1)*1000+
          meeting.metresIntoKm,
        clockSeconds:meeting.clockSeconds,
        riders:[...paidRiders(a,
          meeting.metresIntoKm),
        ...paidRiders(b,meeting.metresIntoKm)],
        sharedRoadUnsettled:true});
      }
    bunchPriorSeconds+=step.elapsedSeconds;
  }
  const earlier=possible.find(row=>
    row.clockSeconds<secondContact.clockSeconds-EPS);
  if(earlier)
    throw new Error('Two-pair encounter precedes second contact.');
  const after=possible.filter(row=>
    row.clockSeconds>=secondContact.clockSeconds-EPS)
    .sort((a,b)=>a.clockSeconds-b.clockSeconds||
      a.atDistanceM-b.atDistanceM);
  return {version:
    PHYSICAL_TWO_REAR_PAIRS_FIELD_CONTACT_VERSION,
  throughKm:soloField.throughKm,
  secondContact:structuredClone(secondContact),
  candidateOtherRiders:otherSolos.length,
  nextContacts:after.filter(row=>
    Math.abs(row.clockSeconds-
      after[0]?.clockSeconds)<=EPS),
  laterRoadUnsettled:after.length>0,
  movesGuidedRace:false,officialResults:false};
}

export function validateTwoRearPairsFieldContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectTwoRearPairsFieldContactV1(input)))
    throw new Error('Two-pair contact differs from paid source.');
  return true;
}
