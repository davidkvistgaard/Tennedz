// Find only the first contact among independently paid detached solo
// candidates. Their paths after that contact are counterfactual.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalStaggeredSoloFieldV1} from
  './physical-staggered-detached-solo-v1.mjs';

export const PHYSICAL_STAGGERED_SOLO_FIELD_CONTACT_VERSION=
  'v2-physical-staggered-solo-field-contact-1';
const EPS=1e-7;

export function staggeredSoloTrajectoryV1(solo,km,
  bunchPriorSeconds,bunchStep){
  if(km<solo.lossKm)return null;
  if(km===solo.lossKm){
    const split=bunchStep.splits.find(row=>
      row.riderId===solo.riderId);
    const partial=bunchStep.riders.find(row=>
      row.riderId===solo.riderId);
    const completion=solo.completion;
    if(!split||!partial)
      throw new Error('Field contact lacks paid loss road.');
    const partialM=split.atDistanceM-
      (km-1)*1000;
    const bunchClock=bunchPriorSeconds+
      bunchStep.elapsedSeconds;
    return {riderId:solo.riderId,
      breaks:[partialM],
      clockAt:metres=>metres<=partialM?
        bunchPriorSeconds+bunchStep.elapsedSeconds*
          metres/partialM:
        bunchClock+(completion.elapsedSeconds-bunchClock)*
          (metres-partialM)/(1000-partialM),
      energyAt:metres=>metres<=partialM?
        partial.energyBefore+
          (partial.energyAfter-partial.energyBefore)*
            metres/partialM:
        completion.energyBefore-
          completion.energySpent*
            (metres-partialM)/(1000-partialM)};
  }
  const current=solo.steps.find(row=>
    row.sourceKm===km);
  const prior=km===solo.lossKm+1?
    solo.completion:solo.steps.find(row=>
      row.sourceKm===km-1);
  if(!current||!prior)
    throw new Error('Field contact lacks paid solo step.');
  return {riderId:solo.riderId,breaks:[],
    clockAt:metres=>prior.elapsedSeconds+
      current.seconds*metres/1000,
    energyAt:metres=>current.energyBefore-
      current.energySpent*metres/1000};
}

export function findFirstPaidRoadClockMeetingV1(left,
  right,km){
  const domainStartM=Math.max(left.domainStartM??0,
    right.domainStartM??0);
  const breaks=[domainStartM,...left.breaks,
    ...right.breaks,1000].filter(value=>
    value>=domainStartM-EPS).sort((a,b)=>a-b)
    .filter((value,
    index,values)=>index===0||
    Math.abs(value-values[index-1])>EPS);
  const difference=metres=>left.clockAt(metres)-
    right.clockAt(metres);
  for(let index=1;index<breaks.length;index++){
    const a=breaks[index-1];
    const b=breaks[index];
    const da=difference(a);
    const db=difference(b);
    let metres=null;
    if(a>EPS&&Math.abs(da)<=EPS)metres=a;
    else if(Math.abs(db)<=EPS)metres=b;
    else if(da*db<0)
      metres=a-da*(b-a)/(db-da);
    if(metres!==null&&metres>EPS&&
      metres<=1000+EPS){
      if(Math.abs(difference(metres))>EPS)
        throw new Error('Field contact clocks differ.');
      const beforeMetres=(a+metres)/2;
      const beforeDifference=difference(beforeMetres);
      const catchingRiderId=beforeDifference>0?
        left.riderId:beforeDifference<0?
          right.riderId:null;
      return {sourceKm:km,
        metresIntoKm:+Math.min(1000,metres)
          .toFixed(6),
        clockSeconds:left.clockAt(metres),
        catchingRiderId};
    }
  }
  return null;
}

function firstPairContact(left,right,km){
  const meeting=findFirstPaidRoadClockMeetingV1(
    left,right,km);
  if(!meeting)return null;
  const riders=[left,right].map(row=>{
    const energyAtContact=row.energyAt(
      meeting.metresIntoKm);
    if(!Number.isFinite(energyAtContact)||
      energyAtContact<0)
      throw new Error('Field contact lacks paid energy.');
    return {riderId:row.riderId,
      energyAtContact:+energyAtContact
        .toFixed(6)};
  });
  return {sourceKm:km,
    riderIds:[left.riderId,right.riderId],
    catchingRiderId:meeting.catchingRiderId,
    atDistanceM:(km-1)*1000+
      meeting.metresIntoKm,
    clockSeconds:meeting.clockSeconds,riders,
    source:'paid_independent_solo_road',
    sharedRoadUnsettled:true};
}

export function inspectFirstStaggeredSoloFieldContactV1({
  startInput,start,staggered,soloField}){
  if(!isDeepStrictEqual(soloField,
    probePhysicalStaggeredSoloFieldV1({startInput,
      start,staggered,throughKm:soloField?.throughKm}))||
    soloField.refusals.length||
    soloField.candidates.length!==
      staggered.losses.filter(row=>
        row.sourceKm<=soloField.throughKm).length)
    throw new Error('Field contact needs paid solo candidates.');
  let bunchPriorSeconds=0;
  let firstContact=null;
  for(const step of staggered.road.slice(0,
    soloField.throughKm)){
    const tracks=soloField.candidates.map(solo=>
      staggeredSoloTrajectoryV1(solo,step.sourceKm,
        bunchPriorSeconds,step)).filter(Boolean);
    for(let left=0;left<tracks.length;left++)
      for(let right=left+1;right<tracks.length;
        right++){
        const contact=firstPairContact(tracks[left],
          tracks[right],step.sourceKm);
        if(contact&&(!firstContact||
          contact.clockSeconds<firstContact
            .clockSeconds))
          firstContact=contact;
      }
    bunchPriorSeconds+=step.elapsedSeconds;
  }
  return {version:
    PHYSICAL_STAGGERED_SOLO_FIELD_CONTACT_VERSION,
  throughKm:soloField.throughKm,
  soloCandidateVersion:soloField.version,
  candidateRiders:soloField.candidates.length,
  firstContact,
  laterRoadUnsettled:firstContact!==null,
  movesGuidedRace:false,officialResults:false};
}

export function validateFirstStaggeredSoloFieldContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectFirstStaggeredSoloFieldContactV1(input)))
    throw new Error('Field contact differs from paid source.');
  return true;
}
