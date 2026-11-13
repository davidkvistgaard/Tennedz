// Read-only contact geometry inside a shared loss kilometre. A rider
// pays a partial road at the bunch's kilometre clock, then pays the
// remaining road alone. Equal end clocks are only one possible meeting.
import {isDeepStrictEqual} from 'node:util';
import {partitionPhysicalStaggeredLossArrivalsV1} from
  './physical-pace-loss-completion-v1.mjs';

export const PHYSICAL_STAGGERED_LOSS_KM_CONTACT_VERSION=
  'v2-physical-staggered-loss-km-contact-1';
const EPS=1e-7;

function sameKmContact(first,second,bunchPriorSeconds,
  bunchSeconds){
  const left=[0,first.partialM,second.partialM,1000]
    .sort((a,b)=>a-b).filter((value,index,values)=>
      index===0||Math.abs(value-values[index-1])>EPS);
  const bunchClock=bunchPriorSeconds+bunchSeconds;
  const clock=(item,metres)=>metres<=item.partialM?
    bunchPriorSeconds+bunchSeconds*metres/item.partialM:
    bunchClock+(item.finishClock-bunchClock)*
      (metres-item.partialM)/(1000-item.partialM);
  const difference=metres=>clock(first,metres)-
    clock(second,metres);
  for(let index=1;index<left.length;index++){
    const a=left[index-1];
    const b=left[index];
    const da=difference(a);
    const db=difference(b);
    let contactM=null;
    if(a>EPS&&Math.abs(da)<=EPS)contactM=a;
    else if(Math.abs(db)<=EPS)contactM=b;
    else if(da*db<0)
      contactM=a-da*(b-a)/(db-da);
    if(contactM!==null&&contactM>EPS&&
      contactM<=1000+EPS){
      if(Math.abs(clock(first,contactM)-
        clock(second,contactM))>EPS)
        throw new Error('Loss contact clocks differ.');
      return {metresIntoKm:+Math.min(1000,contactM)
        .toFixed(6),clockSeconds:clock(first,contactM)};
    }
  }
  return null;
}

export function inspectPhysicalStaggeredLossKmContactsV1({
  startInput,start,staggered}){
  const arrivals=partitionPhysicalStaggeredLossArrivalsV1({
    startInput,start,staggered});
  const completionById=new Map(arrivals.completions.map(row=>
    [row.riderId,row]));
  let bunchPriorSeconds=0;
  const contacts=[];
  for(const step of staggered.road){
    const entries=step.splits.map(split=>{
      const completion=completionById.get(split.riderId);
      const partial=step.riders.find(row=>
        row.riderId===split.riderId);
      if(!completion||!partial||
        completion.sourceKm!==step.sourceKm)
        throw new Error('Loss contact lacks paid solo completion.');
      return {riderId:split.riderId,
        partialM:split.atDistanceM-
          (step.sourceKm-1)*1000,
        finishClock:completion.elapsedSeconds,
        partial,completion};
    });
    for(let first=0;first<entries.length;first++)
      for(let second=first+1;second<entries.length;
        second++){
        const meeting=sameKmContact(entries[first],
          entries[second],bunchPriorSeconds,
          step.elapsedSeconds);
        if(meeting)
          contacts.push({sourceKm:step.sourceKm,
            riderIds:[entries[first].riderId,
              entries[second].riderId],
            atDistanceM:(step.sourceKm-1)*1000+
              meeting.metresIntoKm,
            clockSeconds:meeting.clockSeconds,
            riders:[entries[first],entries[second]].map(
              entry=>{
                const fraction=meeting.metresIntoKm<=
                  entry.partialM?
                  meeting.metresIntoKm/entry.partialM:
                  (meeting.metresIntoKm-entry.partialM)/
                    (1000-entry.partialM);
                const energyAtContact=
                  meeting.metresIntoKm<=entry.partialM?
                    entry.partial.energyBefore+
                      (entry.partial.energyAfter-
                        entry.partial.energyBefore)*fraction:
                    entry.completion.energyBefore-
                      entry.completion.energySpent*fraction;
                if(!Number.isFinite(energyAtContact)||
                  energyAtContact<0)
                  throw new Error('Loss contact lacks paid energy.');
                const spent=meeting.metresIntoKm<=
                  entry.partialM?
                    entry.partial.energySpent*fraction:
                    entry.partial.energySpent+
                      entry.completion.energySpent*fraction;
                return {riderId:entry.riderId,
                  energyBeforeAtKm:
                    entry.partial.energyBefore,
                  energySpentToContact:+spent.toFixed(6),
                  energyAtContact:+energyAtContact.toFixed(6),
                  sourcePhase:meeting.metresIntoKm<=
                    entry.partialM?'partial':'solo'};
              }),
            source:'paid_partial_and_solo_road',
            sharedRoadUnsettled:true});
      }
    bunchPriorSeconds+=step.elapsedSeconds;
  }
  contacts.sort((a,b)=>a.clockSeconds-b.clockSeconds||
    a.atDistanceM-b.atDistanceM||
    a.riderIds.join('|').localeCompare(b.riderIds.join('|')));
  return {version:PHYSICAL_STAGGERED_LOSS_KM_CONTACT_VERSION,
    bunchSourceVersion:staggered.version,
    paidArrivalSourceVersion:arrivals.version,
    throughKm:staggered.throughKm,contacts,
    laterRoadUnsettled:true,movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalStaggeredLossKmContactsV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalStaggeredLossKmContactsV1(input)))
    throw new Error('Loss-kilometre contacts differ from source.');
  return true;
}
