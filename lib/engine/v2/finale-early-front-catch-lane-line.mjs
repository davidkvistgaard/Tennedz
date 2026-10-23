import {isDeepStrictEqual} from 'node:util';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';

export const FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION=
  'v2-finale-early-front-catch-lane-line-lab-1';
export const FINALE_EARLY_FRONT_CATCH_LANE_SOURCE_VERSION=
  'v2-finale-early-front-catch-lane-source-lab-1';
const EPSILON=1e-7;

// A sub-wheel-length group gap cannot place both bands' first riders in the
// same lane. The front keeps its inferred lanes; the bunch uses open lane
// heads and queues its other riders behind the front. This changes no paid
// group clock or energy, and still cannot establish official places.
export function recordFinaleEarlyFrontCatchLaneLine(tour,clock,
  {plans=null}={}){
  if(clock?.version!==FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION)
    throw new Error('The early lane line needs a paid front catch.');
  const prior=recordFinaleCoastedIndividualLine(tour,clock,{plans});
  const positioned=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const [front,bunch]=positioned.roadBands;
  const finishM=positioned.lineDistanceM;
  const contact=clock.contact;
  const at500=clock.trace.frames.find(frame=>
    frame.endDistanceM===finishM-500);
  const passage=clock.passageFrames.find(frame=>
    frame.distanceM===finishM-500);
  const sourceGapSeconds=-front?.passageSecondsFromBunchMarker;
  const catchTravelM=contact?.atDistanceM-positioned.startDistanceM;
  const frontSpeedMps=catchTravelM/
    (contact?.preContactBunchSeconds+sourceGapSeconds);
  const sourceLeadM=sourceGapSeconds*frontSpeedMps;
  if(positioned.roadBands.length!==2||
    !front.slots.length||front.slots.length>=positioned.laneCount||
    front.slots.some(slot=>slot.depth!==0)||
    !bunch.slots.length||
    !positioned.droppedRiderIds.length||
    contact?.kind!=='front_catch'||contact.groupId!==front.id||
    contact.atDistanceM<=positioned.startDistanceM||
    contact.atDistanceM>=finishM-500||
    !(sourceLeadM>0&&sourceLeadM<positioned.wheelSpacingM)||
    clock.trace.frames.some(frame=>
      frame.frontExhaustionDrops?.length||frame.exhaustionDrops?.length)||
    at500?.roadGroups.length||
    at500?.pelotonRiderIds.length!==
      front.slots.length+bunch.slots.length||
    passage?.groups.length||
    !Number.isFinite(passage?.bunchPassageSecondsFromBunchMarker))
    throw new Error('The early lane line needs one intact close front.');

  const occupied=new Set(front.slots.map(slot=>slot.lane));
  const open=Array.from({length:positioned.laneCount},(_,lane)=>lane)
    .filter(lane=>!occupied.has(lane));
  const bunchSlots=bunch.slots.map((slot,index)=>{
    const head=index<open.length;
    const afterHead=index-open.length;
    const lane=head?open[index]:afterHead%positioned.laneCount;
    const depth=head?0:1+Math.floor(afterHead/positioned.laneCount);
    return {...slot,lane,depth,
      positionM:positioned.startDistanceM-
        depth*positioned.wheelSpacingM-
        lane*positioned.laneStaggerM};
  });
  const slots=[...front.slots,...bunchSlots];
  const lanes=Array.from({length:positioned.laneCount},(_,lane)=>
    slots.filter(slot=>slot.lane===lane).sort((a,b)=>
      b.positionM-a.positionM));
  if(lanes.some(lane=>lane.some((slot,index)=>index>0&&
    lane[index-1].positionM-slot.positionM<
      positioned.wheelSpacingM-EPSILON))||
    slots.some(slot=>!at500.pelotonRiderIds.includes(slot.riderId)))
    throw new Error('The early front and bunch have overlapping lanes.');
  const merged={...positioned,
    version:FINALE_EARLY_FRONT_CATCH_LANE_SOURCE_VERSION,
    status:'provisional_source_lanes_join_at_paid_group_contact',
    sourceLeadM,roadBands:[{
      id:'peloton',passageSecondsFromBunchMarker:0,
      edgeDistanceM:positioned.startDistanceM,slots}]};
  const handoff=recordFinaleIndividualBandsAt500(tour,{
    positioned:merged,at500,
    passageTimes:[passage.bunchPassageSecondsFromBunchMarker],
    sourceRoadTraceVersion:clock.version,
    isolatedSprintPlan:prior.sprintPlan,
    isolatedBandRunners:prior.bandRunners.filter(band=>
      band.roadBandId.startsWith('isolated:')),
    withholdProvisionalOrder:true});
  const rosterCount=tour.committedInputs.teams.length*8;
  if(handoff.conditionalCrossings.length!==rosterCount||
    handoff.bandRunners[0].runner.finishers.length!==slots.length||
    handoff.conditionalCrossings.some(row=>
      !Number.isFinite(row.elapsedSecondsFromLastKmStart)||
      !Number.isFinite(row.energyAtLine)||row.energyAtLine<0))
    throw new Error('The early lane line lost a paid rider.');
  return {...prior,
    version:FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION,
    sourcePositionVersion:merged.version,positionedSource:merged,
    ...handoff,
    pre500Audit:{status:'front_and_bunch_lanes_join_at_paid_group_contact',
      sourceLeadM,contactDistanceM:contact.atDistanceM,
      frontRiderIds:front.slots.map(slot=>slot.riderId),
      contactResolved:true,isolatedContactResolved:false,
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:'front_and_bunch_lanes_joined',
    roadStatus:'conditional_early_front_catch_lane_line_isolated_contact_unresolved',
    provisionalLineOrder:null,classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleEarlyFrontCatchLaneLine(tour,clock,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleEarlyFrontCatchLaneLine(tour,clock,input)))
    throw new Error('The early front catch lane line does not replay.');
  return true;
}
