import {isDeepStrictEqual} from 'node:util';
import {recordFinaleGroupResultBounds} from './finale-group-result-bounds.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinalePositionedBandRunnerFromTour} from
  './finale-paid-bunch-runner.mjs';
import {recordFinaleMultibandSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleMultibandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';

export const FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION=
  'v2-finale-multiband-individual-line-lab-1';

// Continue every surviving band from its own paid 500 m passage to each
// rider's crossing. This is one full-field conditional trace, but the band
// runners do not yet respond to cross-band contact and cannot classify it.
export function recordFinaleMultibandIndividualLine(tour,clock,{plans=null}={}){
  const chasePullRiderId=clock?.line?.chasePullRiderId??null;
  const chaseRotationRiderIds=clock?.line?.chaseRotationRiderIds??null;
  recordFinaleGroupResultBounds(tour,clock,{
    chasePullRiderId,chaseRotationRiderIds});
  if(clock.line.outcome!=='survived'||
    clock.line.approachFrames.some(frame=>frame.event)||
    clock.line.mergedFrames.length)
    throw new Error('An individual multiband line needs a surviving paid group.');
  const positioned=resolveFinaleMultibandPositionedSource(tour);
  if(positioned.roadBands.length!==2)
    throw new Error('The individual multiband line needs one front group and the bunch.');
  const finishM=tour.route.distanceKm*1000;
  const at500=clock.line.approachFrames.find(frame=>
    frame.endDistanceM===finishM-500);
  const before500=clock.line.approachFrames.filter(frame=>
    frame.endDistanceM<=finishM-500);
  if(!at500||before500.length!==2||
    at500.roadGroups.length!==1||
    at500.roadGroups[0].id!==positioned.roadBands[0].id||
    at500.pelotonRiderIds.length!==
      positioned.roadBands[1].slots.length)
    throw new Error('The multiband line has no complete paid 500 m handoff.');
  const frontIds=new Set(at500.roadGroups[0].riderIds);
  const bunchIds=new Set(at500.pelotonRiderIds);
  const energy=new Map(at500.riders.map(row=>[row.riderId,row.energy]));
  const sprintSource={endDistanceM:finishM-500,
    roadGroups:at500.roadGroups,
    pelotonRiderIds:at500.pelotonRiderIds,
    riderEnergy:at500.riders.map(row=>({
      riderId:row.riderId,energyAfter:row.energy}))};
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleMultibandSprintPlanFromTour(tour,{
    source:sprintSource,plans:nominations,
    sourceRoadTraceVersion:clock.version});
  const frontPassageSeconds=positioned.roadBands[0]
    .passageSecondsFromBunchMarker+before500.reduce((sum,frame)=>
      sum+frame.frontElapsedSeconds,0);
  const bunchPassageSeconds=before500.reduce((sum,frame)=>
    sum+frame.pelotonElapsedSeconds,0);
  const bandInputs=[{band:positioned.roadBands[0],ids:frontIds,
    elapsedSeconds:frontPassageSeconds,branch:'front_band'},
  {band:positioned.roadBands[1],ids:bunchIds,
    elapsedSeconds:bunchPassageSeconds,branch:'bunch_band'}];
  const bandRunners=bandInputs.map(({band,ids,elapsedSeconds,branch})=>{
    if(band.slots.length!==ids.size||
      band.slots.some(slot=>!ids.has(slot.riderId)||
        !Number.isFinite(energy.get(slot.riderId))))
      throw new Error('The positioned band differs from the paid 500 m road.');
    const source={distanceM:finishM-500,
      pelotonRiderIds:band.slots.map(slot=>slot.riderId),
      riderEnergy:band.slots.map(slot=>({riderId:slot.riderId,
        energy:energy.get(slot.riderId)})),
      bunchElapsedSeconds:elapsedSeconds,
      sourceRoadTraceVersion:clock.version};
    const positionedSource={version:positioned.version,
      status:positioned.status,distanceM:source.distanceM,
      wheelSpacingM:positioned.wheelSpacingM,
      slots:band.slots.map(slot=>({...slot,
        positionM:slot.positionM+500,
        energy:energy.get(slot.riderId)}))};
    const localPlan={...sprintPlan,
      decisions:sprintPlan.decisions.filter(decision=>
        ids.has(decision.finisherId))};
    return {roadBandId:band.id,
      paidTo500Seconds:elapsedSeconds,
      runner:recordFinalePositionedBandRunnerFromTour(tour,{
        source,plan:localPlan,positionedSource,branch})};
  });
  const conditionalCrossings=bandRunners.flatMap(band=>
    band.runner.finishers.map(row=>({
      ...row,roadBandId:band.roadBandId})));
  const roster=new Set(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id)));
  if(conditionalCrossings.length!==roster.size||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==roster.size||
    conditionalCrossings.some(row=>!roster.has(row.riderId)||
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0))
    throw new Error('The multiband line lost an individual crossing.');
  const overlapAudit=recordFinaleMultibandOverlapAudit(bandRunners);
  return {version:FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    sprintPlan,bandRunners,conditionalCrossings,overlapAudit,
    roadStatus:'band_local_individual_lines_cross_band_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMultibandIndividualLine(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMultibandIndividualLine(tour,clock,input)))
    throw new Error('The multiband individual line does not replay.');
  return true;
}
