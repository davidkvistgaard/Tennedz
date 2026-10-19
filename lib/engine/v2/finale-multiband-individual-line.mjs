import {isDeepStrictEqual} from 'node:util';
import {recordFinaleGroupResultBounds} from './finale-group-result-bounds.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  positionedLineOrder} from
  './finale-paid-bunch-runner.mjs';
import {recordFinaleMultibandSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleMultibandOverlapAudit,
  recordFinaleAllBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {recordFinalePre500ActiveOverlapAudit} from
  './finale-pre500-active-overlap-audit.mjs';

export const FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION=
  'v2-finale-multiband-individual-line-lab-3';
const PRE500_LEGACY_INDIVIDUAL_LINE_VERSION=
  'v2-finale-multiband-individual-line-lab-2';
const LEGACY_INDIVIDUAL_LINE_VERSION=
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
  if(positioned.roadBands.some(band=>band.slots.length<2))
    throw new Error('The individual multiband line needs at least two riders in each active band.');
  const before500=clock.line.approachFrames.filter(frame=>
    frame.endDistanceM<=finishM-500);
  if(!at500||before500.length!==2||
    at500.roadGroups.length!==1||
    at500.roadGroups[0].id!==positioned.roadBands[0].id||
    at500.pelotonRiderIds.length!==
      positioned.roadBands[1].slots.length)
    throw new Error('The multiband line has no complete paid 500 m handoff.');
  const frontPassageSeconds=positioned.roadBands[0]
    .passageSecondsFromBunchMarker+before500.reduce((sum,frame)=>
      sum+frame.frontElapsedSeconds,0);
  const bunchPassageSeconds=before500.reduce((sum,frame)=>
    sum+frame.pelotonElapsedSeconds,0);
  let frontTime=positioned.roadBands[0].passageSecondsFromBunchMarker;
  let bunchTime=0;
  const pre500Audit=recordFinalePre500ActiveOverlapAudit(positioned,
    before500.map(frame=>{
      frontTime+=frame.frontElapsedSeconds;
      bunchTime+=frame.pelotonElapsedSeconds;
      return {endDistanceM:frame.endDistanceM,
        bandTimes:[frontTime,bunchTime],riderEnergy:frame.riders};
    }));
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned,at500,plans,sourceRoadTraceVersion:clock.version,
    passageTimes:[frontPassageSeconds,bunchPassageSeconds],
    withholdProvisionalOrder:!!pre500Audit.firstPotentialOverlap});
  return {version:FINALE_MULTIBAND_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    ...handoff,pre500Audit,
    roadStatus:'band_local_individual_lines_cross_band_contact_unresolved',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// Reuse the locked paid 500 m passage and the same rider-level runner for
// one or several surviving road groups. Callers must supply each band's
// passage time from its own versioned common-clock source.
export function recordFinaleIndividualBandsAt500(tour,{
  positioned,at500,passageTimes,sourceRoadTraceVersion,plans=null,
  isolatedBandRunners=[],isolatedSprintPlan=null,
  withholdProvisionalOrder=false}){
  const finishM=tour.route.distanceKm*1000;
  const bands=positioned?.roadBands;
  if(at500?.endDistanceM!==finishM-500||
    !Array.isArray(bands)||bands.length<
      (isolatedBandRunners.length?1:2)||
    !Array.isArray(at500.roadGroups)||
    at500.roadGroups.length!==bands.length-1||
    at500.roadGroups.some((group,index)=>group.id!==bands[index].id)||
    bands.at(-1).id!=='peloton'||
    !Array.isArray(at500.pelotonRiderIds)||
    !Array.isArray(at500.riders)||
    !Array.isArray(passageTimes)||passageTimes.length!==bands.length||
    passageTimes.some(time=>!Number.isFinite(time))||
    typeof sourceRoadTraceVersion!=='string'||!sourceRoadTraceVersion)
    throw new Error('The individual bands need one complete paid 500 m road.');
  const energy=new Map(at500.riders.map(row=>[row.riderId,row.energy]));
  const sprintSource={endDistanceM:finishM-500,
    roadGroups:at500.roadGroups,
    pelotonRiderIds:at500.pelotonRiderIds,
    riderEnergy:at500.riders.map(row=>({
      riderId:row.riderId,energyAfter:row.energy}))};
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=isolatedSprintPlan??
    recordFinaleMultibandSprintPlanFromTour(tour,{
      source:sprintSource,plans:nominations,
      sourceRoadTraceVersion});
  if(sprintPlan.sourceRoadTraceVersion!==sourceRoadTraceVersion||
    sprintPlan.decisionDistanceM!==finishM-500||
    sprintPlan.decisions.length!==tour.committedInputs.teams.length)
    throw new Error('The individual bands need a matching sprint plan.');
  const bandInputs=bands.map((band,index)=>({band,
    ids:new Set(index===bands.length-1?at500.pelotonRiderIds:
      at500.roadGroups[index].riderIds),
    elapsedSeconds:passageTimes[index],
    branch:index===bands.length-1?'bunch_band':'front_band'}));
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
      sourceRoadTraceVersion};
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
  const allBandRunners=[...bandRunners,...isolatedBandRunners];
  const conditionalCrossings=allBandRunners.flatMap(band=>
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
  const overlapAudit=allBandRunners.length===2&&
    !isolatedBandRunners.length?
      recordFinaleMultibandOverlapAudit(allBandRunners):
      recordFinaleAllBandOverlapAudit(allBandRunners);
  const provisionalLineOrder=withholdProvisionalOrder||
    overlapAudit.firstPotentialOverlap?
    null:positionedLineOrder(conditionalCrossings);
  return {sprintPlan,bandRunners:allBandRunners,
    conditionalCrossings,overlapAudit,
    provisionalLineOrder};
}

export function validateFinaleMultibandIndividualLine(tour,clock,input,
  recorded){
  const expected=recordFinaleMultibandIndividualLine(tour,clock,input);
  const {pre500Audit,...prior}=expected;
  const priorVersion={...prior,
    version:PRE500_LEGACY_INDIVIDUAL_LINE_VERSION,
    provisionalLineOrder:pre500Audit.firstPotentialOverlap&&
      !prior.overlapAudit.firstPotentialOverlap?
        positionedLineOrder(prior.conditionalCrossings):
        prior.provisionalLineOrder};
  const {overlapAudit,provisionalLineOrder,...legacyRest}=priorVersion;
  const legacy={...legacyRest,version:LEGACY_INDIVIDUAL_LINE_VERSION};
  if(!isDeepStrictEqual(recorded,expected)&&
    !isDeepStrictEqual(recorded,priorVersion)&&
    !isDeepStrictEqual(recorded,legacy)&&
    !isDeepStrictEqual(recorded,{...legacy,overlapAudit}))
    throw new Error('The multiband individual line does not replay.');
  return true;
}
