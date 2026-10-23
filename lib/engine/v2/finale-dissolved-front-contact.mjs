export const FINALE_DISSOLVED_FRONT_CONTACT_AUDIT_VERSION=
  'v2-finale-dissolved-front-contact-audit-1';

const EPSILON=1e-9;

// Compare band-marker passage times at the same distance. A negative
// difference means the isolated rider is ahead of that marker. A sign change
// is only a provisional marker overlap, not an occupied-lane wheel encounter.
export function auditDissolvedFrontContact(trace){
  if(!Array.isArray(trace?.frames)||!trace.frames.length||
    trace.frames.some(frame=>!Number.isFinite(frame?.startDistanceM)||
      !Number.isFinite(frame?.endDistanceM)||
      frame.endDistanceM<=frame.startDistanceM||
      !Number.isFinite(frame?.bunchElapsedSeconds)||
      frame.bunchElapsedSeconds<=0||
      !Array.isArray(frame.roadGroups)||
      !Array.isArray(frame.droppedTravel?.riders)))
    throw new Error('A dissolved-front audit needs a paid road trace.');
  const firstByPair=new Map();
  for(const frame of trace.frames){
    const bands=[...frame.roadGroups.map(group=>({
      bandId:group.id,offsetBefore:-group.gapSeconds+
        frame.bunchElapsedSeconds-group.elapsedSeconds,
      offsetAfter:-group.gapSeconds})),
    {bandId:'peloton',offsetBefore:0,offsetAfter:0}];
    for(const rider of frame.droppedTravel.riders){
      for(const band of bands){
        const before=rider.deficitSecondsBefore-band.offsetBefore;
        const after=rider.deficitSecondsAfter-band.offsetAfter;
        if(!Number.isFinite(before)||!Number.isFinite(after))
          throw new Error('An isolated rider has no comparable passage.');
        if(before>=-EPSILON||after<-EPSILON||
          Math.abs(after-before)<=EPSILON)continue;
        const distanceM=frame.startDistanceM+
          (frame.endDistanceM-frame.startDistanceM)*(-before)/(after-before);
        const key=`${rider.riderId}:${band.bandId}`;
        const previous=firstByPair.get(key);
        if(!previous||distanceM<previous.distanceM)
          firstByPair.set(key,{riderId:rider.riderId,
            activeBandId:band.bandId,distanceM});
      }
    }
  }
  const encounters=[...firstByPair.values()].sort((a,b)=>
    a.distanceM-b.distanceM||a.riderId.localeCompare(b.riderId)||
    a.activeBandId.localeCompare(b.activeBandId));
  return {version:FINALE_DISSOLVED_FRONT_CONTACT_AUDIT_VERSION,
    status:encounters.length?'unresolved_active_isolated_contact':
      'no_active_isolated_contact',
    firstPotentialContact:encounters[0]??null,
    encounters,classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}
