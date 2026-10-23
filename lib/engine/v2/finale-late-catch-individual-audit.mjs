import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleDepletedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinalePositionedBandRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {recordFinaleMultibandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';

export const FINALE_LATE_CATCH_INDIVIDUAL_AUDIT_VERSION=
  'v2-finale-late-catch-individual-audit-1';

// An independent sprint in each band is valid only until their first
// possible encounter. This audit never uses either unmerged line crossing as
// a result. It shows when the individual plan can diverge from the paid
// group-level road, which must then remain unclassified.
export function recordFinaleLateCatchIndividualAudit(tour,trace,{plans=null}={}){
  const finishM=tour.route.distanceKm*1000;
  const at500=trace.frames.find(frame=>frame.endDistanceM===finishM-500);
  const contact=trace.frames.at(-1)?.contact;
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  if(!at500||positioned.roadBands.length!==2||
    at500.roadGroups.length!==1||
    at500.roadGroups[0].id!==positioned.roadBands[0].id||
    contact?.kind!=='front_catch'||
    contact.atDistanceM<=finishM-100||contact.atDistanceM>=finishM)
    throw new Error('The sprint-contact audit needs one paid late catch.');
  const energy=new Map(at500.riders.map(row=>[row.riderId,row.energy]));
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleDepletedSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,roadGroups:at500.roadGroups,
      pelotonRiderIds:at500.pelotonRiderIds,
      isolatedRiderIds:positioned.droppedRiderIds,
      riderEnergy:at500.riders.map(row=>({riderId:row.riderId,
        energyAfter:row.energy}))},plans:nominations,
    sourceRoadTraceVersion:trace.version});
  const before500=trace.frames.filter(frame=>
    frame.endDistanceM<=finishM-500);
  const frontTime=positioned.roadBands[0]
    .passageSecondsFromBunchMarker+before500.reduce((sum,frame)=>
      sum+frame.roadGroups[0].elapsedSeconds,0);
  const bunchTime=before500.reduce((sum,frame)=>
    sum+frame.bunchElapsedSeconds,0);
  const bands=positioned.roadBands.map((band,index)=>{
    const riderIds=band.slots.map(slot=>slot.riderId);
    const ids=new Set(riderIds);
    const source={distanceM:finishM-500,pelotonRiderIds:riderIds,
      riderEnergy:riderIds.map(riderId=>({riderId,
        energy:energy.get(riderId)})),
      bunchElapsedSeconds:index===0?frontTime:bunchTime,
      sourceRoadTraceVersion:trace.version};
    const positionedSource={version:positioned.version,
      status:positioned.status,distanceM:source.distanceM,
      wheelSpacingM:positioned.wheelSpacingM,
      slots:band.slots.map(slot=>({...slot,
        positionM:slot.positionM+500,
        energy:energy.get(slot.riderId)}))};
    const runner=recordFinalePositionedBandRunnerFromTour(tour,{
      source,plan:{...sprintPlan,decisions:sprintPlan.decisions
        .filter(decision=>ids.has(decision.finisherId))},
      positionedSource,branch:index===0?'front_band':'bunch_band',
      coastTail:true});
    return {roadBandId:band.id,runner};
  });
  const overlap=recordFinaleMultibandOverlapAudit(bands);
  const first=overlap.firstPotentialOverlap;
  const groupContactTime=before500.reduce((sum,frame)=>
    sum+frame.bunchElapsedSeconds,0)+
    trace.frames.slice(before500.length,-1).reduce((sum,frame)=>
      sum+frame.bunchElapsedSeconds,0)+
    contact.preContactBunchSeconds;
  const beforeGroupCatch=first&&
    first.distanceM<contact.atDistanceM&&
    first.elapsedSecondsFromLastKmStart<groupContactTime;
  return {version:FINALE_LATE_CATCH_INDIVIDUAL_AUDIT_VERSION,
    sourceRoadTraceVersion:trace.version,
    status:beforeGroupCatch?'possible_earlier_sprint_contact':
      'no_prior_individual_contact_proven',
    firstPotentialOverlap:beforeGroupCatch?first:null,
    groupCatchDistanceM:contact.atDistanceM,
    groupCatchElapsedSeconds:groupContactTime,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}
