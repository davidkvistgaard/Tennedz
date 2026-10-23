import {auditDissolvedFrontContact} from
  './finale-dissolved-front-contact.mjs';

export const FINALE_DISSOLVED_FRONT_PAID_CONTACT_VERSION=
  'v2-finale-dissolved-front-paid-contact-audit-1';
const EPSILON=1e-7;

function paidEnergy(row,fraction){
  const before=row.energyBefore??row.energy+row.energySpent;
  const spent=row.energySpent*fraction;
  const remaining=before-spent;
  if(!Number.isFinite(before)||!Number.isFinite(spent)||
    !Number.isFinite(remaining)||before<-EPSILON||spent<-EPSILON||
    remaining<-EPSILON||Math.abs(before-row.energySpent-
      (row.energyAfter??row.energy))>EPSILON)
    throw new Error('A contact split has no continuous paid energy.');
  return {energyBefore:before,energySpentToContact:spent,
    energyAtContact:Math.max(0,remaining)};
}

// This splits already-paid, constant-pace slice movement at the calculated
// encounter. It records energy and simultaneous passage only to contact;
// the candidate post-contact motion is not a resolved road or paid result.
export function auditDissolvedFrontPaidContact(trace){
  const base=auditDissolvedFrontContact(trace);
  let bunchStartSeconds=0;
  const events=[];
  for(const frame of trace.frames){
    if(!Array.isArray(frame.riders))
      throw new Error('A paid encounter needs rider energy at each marker.');
    const inSlice=base.encounters.filter(row=>
      row.distanceM>=frame.startDistanceM-EPSILON&&
      row.distanceM<=frame.endDistanceM+EPSILON);
    const activeById=new Map(frame.riders.map(row=>[row.riderId,row]));
    const soloById=new Map(frame.droppedTravel.riders.map(row=>
      [row.riderId,row]));
    for(const event of inSlice){
      const fraction=(event.distanceM-frame.startDistanceM)/
        (frame.endDistanceM-frame.startDistanceM);
      const solo=soloById.get(event.riderId);
      const band=event.activeBandId==='peloton'?{
        elapsedSeconds:frame.bunchElapsedSeconds,
        sourceOffsetSeconds:0,riderIds:frame.pelotonRiderIds}:
        frame.roadGroups.find(row=>row.id===event.activeBandId);
      const sourceOffsetSeconds=band?.sourceOffsetSeconds??
        (band?-band.gapSeconds+frame.bunchElapsedSeconds-
          band.elapsedSeconds:NaN);
      const soloTime=bunchStartSeconds+solo?.deficitSecondsBefore+
        solo?.elapsedSeconds*fraction;
      const activeTime=bunchStartSeconds+sourceOffsetSeconds+
        band?.elapsedSeconds*fraction;
      if(!solo||!band||!Array.isArray(band.riderIds)||
        !Number.isFinite(soloTime)||!Number.isFinite(activeTime)||
        Math.abs(soloTime-activeTime)>EPSILON||
        fraction<-EPSILON||fraction>1+EPSILON)
        throw new Error('An active-isolated encounter has no paid instant.');
      const activeRiders=band.riderIds.map(riderId=>{
        const row=activeById.get(riderId);
        if(!row||row.role==='dropped')
          throw new Error('A contact band has no paid rider energy.');
        return {riderId,...paidEnergy(row,fraction)};
      });
      events.push({...event,
        elapsedSecondsFromLastKmStart:soloTime,
        split:{startDistanceM:frame.startDistanceM,
          contactDistanceM:event.distanceM,
          unresolvedSliceEndDistanceM:frame.endDistanceM,
          fractionBefore:fraction,
          solo:{riderId:event.riderId,
            secondsBefore:solo.elapsedSeconds*fraction,
            ...paidEnergy(solo,fraction)},
          activeBand:{id:event.activeBandId,
            secondsBefore:band.elapsedSeconds*fraction,
            riders:activeRiders}}});
    }
    bunchStartSeconds+=frame.bunchElapsedSeconds;
  }
  if(events.length!==base.encounters.length)
    throw new Error('An active-isolated encounter lacks a paid slice.');
  events.sort((a,b)=>a.elapsedSecondsFromLastKmStart-
    b.elapsedSecondsFromLastKmStart||a.distanceM-b.distanceM||
    a.riderId.localeCompare(b.riderId)||
    a.activeBandId.localeCompare(b.activeBandId));
  return {version:FINALE_DISSOLVED_FRONT_PAID_CONTACT_VERSION,
    sourceTraceVersion:trace.version,
    sourceAuditVersion:base.version,status:base.status,
    firstPaidSplit:events[0]??null,encounters:events,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}
