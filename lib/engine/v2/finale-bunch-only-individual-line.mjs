import {isDeepStrictEqual} from 'node:util';
import {validateFinaleBunchOnlyLastKmClock} from
  './finale-bunch-only-last-km.mjs';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleMultibandSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinalePositionedBandRunnerFromTour,
  positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_BUNCH_ONLY_INDIVIDUAL_LINE_VERSION=
  'v2-finale-bunch-only-individual-line-lab-1';
export const FINALE_BUNCH_ONLY_BAND_AUDIT_VERSION=
  'v2-finale-bunch-only-band-audit-1';

export function recordFinaleBunchOnlyIndividualLine(tour,clock,
  {plans=null}={}){
  validateFinaleBunchOnlyLastKmClock(tour,clock);
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    allowNoFront:true});
  const band=positioned.roadBands[0];
  const finishM=tour.route.distanceKm*1000;
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const passage=clock.passageFrames.find(frame=>
    frame.distanceM===finishM-500);
  const roster=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(positioned.roadBands.length!==1||band.id!=='peloton'||
    band.slots.length!==roster.length||
    at500?.roadGroups.length||
    at500?.pelotonRiderIds.length!==roster.length||
    passage?.groups.length||
    !Number.isFinite(passage?.bunchPassageSecondsFromBunchMarker))
    throw new Error('The bunch-only line needs one paid 500 m field.');
  const energy=new Map(at500.riders.map(row=>
    [row.riderId,row.energy]));
  if(energy.size!==roster.length||
    roster.some(id=>!Number.isFinite(energy.get(id))||
      energy.get(id)<0))
    throw new Error('The bunch-only line lost a paid rider.');
  const nominations=plans??tour.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:null}));
  const sprintPlan=recordFinaleMultibandSprintPlanFromTour(tour,{
    source:{endDistanceM:finishM-500,roadGroups:[],
      pelotonRiderIds:[...at500.pelotonRiderIds],
      riderEnergy:at500.riders.map(row=>({riderId:row.riderId,
        energyAfter:row.energy}))},
    plans:nominations,sourceRoadTraceVersion:clock.version});
  const source={distanceM:finishM-500,
    pelotonRiderIds:[...at500.pelotonRiderIds],
    riderEnergy:at500.riders.map(row=>({riderId:row.riderId,
      energy:row.energy})),
    bunchElapsedSeconds:passage.bunchPassageSecondsFromBunchMarker,
    sourceRoadTraceVersion:clock.version};
  const positionedSource={version:positioned.version,
    status:positioned.status,distanceM:source.distanceM,
    wheelSpacingM:positioned.wheelSpacingM,
    slots:band.slots.map(slot=>({...slot,
      positionM:slot.positionM+500,
      energy:energy.get(slot.riderId)}))};
  const runner=recordFinalePositionedBandRunnerFromTour(tour,{
    source,plan:sprintPlan,positionedSource,branch:'bunch_band'});
  const bandRunners=[{roadBandId:'peloton',
    paidTo500Seconds:passage.bunchPassageSecondsFromBunchMarker,
    runner}];
  const conditionalCrossings=runner.finishers.map(row=>({
    ...row,roadBandId:'peloton'}));
  if(conditionalCrossings.length!==roster.length||
    new Set(conditionalCrossings.map(row=>row.riderId)).size!==roster.length)
    throw new Error('The bunch-only line lost an individual crossing.');
  const noCrossBand={version:FINALE_BUNCH_ONLY_BAND_AUDIT_VERSION,
    status:'single_road_band',firstPotentialOverlap:null,
    contactResolved:false,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
  return {version:FINALE_BUNCH_ONLY_INDIVIDUAL_LINE_VERSION,
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    startDistanceM:positioned.startDistanceM,
    lineDistanceM:finishM,positionedSource:positioned,
    sprintPlan,bandRunners,conditionalCrossings,
    provisionalLineOrder:positionedLineOrder(conditionalCrossings),
    pre500Audit:noCrossBand,overlapAudit:noCrossBand,
    roadStatus:'paid_single_bunch_inferred_wheels',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleBunchOnlyIndividualLine(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleBunchOnlyIndividualLine(tour,clock,input)))
    throw new Error('The bunch-only individual line does not replay.');
  return true;
}
