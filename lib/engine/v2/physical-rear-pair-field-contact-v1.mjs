// Read-only first encounter after one sourced rear pair forms. Solo
// candidates and the pair road are valid only until this next event.
import {isDeepStrictEqual} from 'node:util';
import {inspectFirstStaggeredSoloFieldContactV1,
  staggeredSoloTrajectoryV1,
  findFirstPaidRoadClockMeetingV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {inspectPhysicalStaggeredLossKmContactsV1} from
  './physical-staggered-loss-km-contact-v1.mjs';
import {finishPhysicalLossKmContactV1,
  finishPhysicalSoloFieldContactKmV1} from
  './physical-loss-km-contact-road-v1.mjs';
import {runPhysicalLossKmRearPairV1,
  runPhysicalSoloFieldRearPairV1} from
  './physical-loss-km-rear-pair-v1.mjs';

export const PHYSICAL_REAR_PAIR_FIELD_CONTACT_VERSION=
  'v2-physical-rear-pair-field-contact-1';
const EPS=1e-7;

function replayPairSource(input){
  const {startInput,start,staggered,soloField,
    firstFieldContact,contactRoad,pair}=input;
  const expectedFirst=
    inspectFirstStaggeredSoloFieldContactV1({
      startInput,start,staggered,soloField});
  if(!isDeepStrictEqual(firstFieldContact,
    expectedFirst)||!firstFieldContact.firstContact||
    pair?.sourceKm!==soloField.throughKm)
    throw new Error('Pair field needs first paid contact.');
  const first=firstFieldContact.firstContact;
  const lossKms=first.riderIds.map(id=>
    staggered.losses.find(row=>
      row.riderId===id)?.sourceKm);
  const withinLoss=lossKms.every(km=>
    km===first.sourceKm);
  let expectedRoad;
  let expectedPair;
  if(withinLoss){
    const lossSource=
      inspectPhysicalStaggeredLossKmContactsV1({
        startInput,start,staggered});
    const contact=lossSource.contacts.find(row=>
      Math.abs(row.atDistanceM-
        first.atDistanceM)<1e-5&&
      isDeepStrictEqual([...row.riderIds].sort(),
        [...first.riderIds].sort()));
    if(!contact)
      throw new Error('Pair field lacks paid loss contact.');
    expectedRoad=finishPhysicalLossKmContactV1({
      startInput,start,staggered,contact});
    expectedPair=runPhysicalLossKmRearPairV1({
      startInput,start,staggered,contact,
      contactRoad:expectedRoad,
      throughKm:soloField.throughKm});
  }else{
    expectedRoad=finishPhysicalSoloFieldContactKmV1({
      startInput,start,staggered,soloField,
      fieldContact:firstFieldContact});
    expectedPair=runPhysicalSoloFieldRearPairV1({
      startInput,start,staggered,soloField,
      fieldContact:firstFieldContact,
      contactRoad:expectedRoad,
      throughKm:soloField.throughKm});
  }
  if(!isDeepStrictEqual(contactRoad,expectedRoad)||
    !isDeepStrictEqual(pair,expectedPair))
    throw new Error('Pair field needs replayed shared road.');
  return first;
}

function groupTrajectory(contact,contactRoad,pair,km){
  if(km<contact.sourceKm)return null;
  if(km===contact.sourceKm){
    const domainStartM=contact.atDistanceM-
      (km-1)*1000;
    const fraction=metres=>
      (metres-domainStartM)/
        (1000-domainStartM);
    return {riderId:contactRoad.physicalGroup.id,
      domainStartM,breaks:[],
      clockAt:metres=>contact.clockSeconds+
        contactRoad.secondsPerKm*
          (metres-domainStartM)/1000,
      energyAt:metres=>contactRoad.riders.map(row=>({
        riderId:row.riderId,
        energyAtContact:row.energyBefore-
          row.energySpent*fraction(metres)}))};
  }
  const step=pair.steps.find(row=>
    row.sourceKm===km);
  if(!step)
    throw new Error('Pair field lacks paid group step.');
  return {riderId:contactRoad.physicalGroup.id,
    domainStartM:0,breaks:[],
    clockAt:metres=>step.elapsedSeconds-
      step.seconds+step.seconds*metres/1000,
    energyAt:metres=>step.riders.map(row=>({
      riderId:row.riderId,
      energyAtContact:row.energyBefore-
        row.energySpent*metres/1000}))};
}

function paidEnergy(row,metres){
  const value=row.energyAt(metres);
  if(!Number.isFinite(value)||value<0)
    throw new Error('Next contact lacks paid solo energy.');
  return {riderId:row.riderId,
    energyAtContact:+value.toFixed(6)};
}

export function inspectNextRearPairFieldContactV1(input){
  const first=replayPairSource(input);
  const {staggered,soloField,contactRoad,pair}=input;
  const paired=new Set(first.riderIds);
  const otherSolos=soloField.candidates.filter(row=>
    !paired.has(row.riderId));
  let bunchPriorSeconds=0;
  const possible=[];
  for(const step of staggered.road.slice(0,
    soloField.throughKm)){
    const km=step.sourceKm;
    const group=groupTrajectory(first,
      contactRoad,pair,km);
    const solos=otherSolos.map(solo=>
      staggeredSoloTrajectoryV1(solo,km,
        bunchPriorSeconds,step)).filter(Boolean);
    for(const solo of solos){
      if(!group)break;
      const meeting=findFirstPaidRoadClockMeetingV1(
        group,solo,km);
      if(!meeting)continue;
      const riders=[...group.energyAt(
        meeting.metresIntoKm),
      paidEnergy(solo,meeting.metresIntoKm)];
      if(riders.some(row=>
        !Number.isFinite(row.energyAtContact)||
        row.energyAtContact<0))
        throw new Error('Next contact lacks paid group energy.');
      possible.push({kind:'rear_pair_meets_solo',
        sourceKm:km,
        groupRiderIds:[...first.riderIds],
        soloRiderId:solo.riderId,
        atDistanceM:(km-1)*1000+
          meeting.metresIntoKm,
        clockSeconds:meeting.clockSeconds,
        riders:riders.map(row=>({...row,
          energyAtContact:+row.energyAtContact
            .toFixed(6)})),
        sharedRoadUnsettled:true});
    }
    for(let left=0;left<solos.length;left++)
      for(let right=left+1;right<solos.length;
        right++){
        const meeting=findFirstPaidRoadClockMeetingV1(
          solos[left],solos[right],km);
        if(!meeting)continue;
        possible.push({kind:'two_other_solos_meet',
          sourceKm:km,
          riderIds:[solos[left].riderId,
            solos[right].riderId],
          atDistanceM:(km-1)*1000+
            meeting.metresIntoKm,
          clockSeconds:meeting.clockSeconds,
          riders:[paidEnergy(solos[left],
            meeting.metresIntoKm),
          paidEnergy(solos[right],
            meeting.metresIntoKm)],
          sharedRoadUnsettled:true});
      }
    bunchPriorSeconds+=step.elapsedSeconds;
  }
  if(possible.some(row=>row.clockSeconds<
    first.clockSeconds-EPS))
    throw new Error('Next contact precedes first paid contact.');
  const after=possible.filter(row=>
    row.clockSeconds>=first.clockSeconds-EPS)
    .sort((a,b)=>a.clockSeconds-
      b.clockSeconds||a.atDistanceM-
      b.atDistanceM);
  return {version:PHYSICAL_REAR_PAIR_FIELD_CONTACT_VERSION,
    throughKm:soloField.throughKm,
    firstContact:structuredClone(first),
    candidateOtherRiders:otherSolos.length,
    nextContacts:after.filter(row=>
      Math.abs(row.clockSeconds-
        after[0]?.clockSeconds)<=EPS),
    laterRoadUnsettled:after.length>0,
    movesGuidedRace:false,officialResults:false};
}

export function validateNextRearPairFieldContactV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    inspectNextRearPairFieldContactV1(input)))
    throw new Error('Next rear contact differs from source.');
  return true;
}
