import {isDeepStrictEqual} from 'node:util';
import {resolveFinaleMultibandPositionedSource} from
  './finale-multiband-positioned-source.mjs';
import {recordFinaleIndividualBandsAt500} from
  './finale-multiband-individual-line.mjs';
import {recordFinaleCoastedIndividualLine} from
  './finale-depleted-individual-line.mjs';
import {FINALE_COAST_FRONT_CATCH_LAST_KM_CLOCK_VERSION} from
  './finale-separated-last-km.mjs';
import {recordFinaleUnorderedBandOverlapAudit} from
  './finale-multiband-overlap-audit.mjs';
import {positionedLineOrder} from './finale-paid-bunch-runner.mjs';

export const FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION=
  'v2-finale-early-front-catch-lane-line-lab-1';
export const FINALE_EARLY_FRONT_CATCH_LANE_SOURCE_VERSION=
  'v2-finale-early-front-catch-lane-source-lab-1';
export const FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION=
  'v2-finale-early-front-catch-isolated-lanes-lab-2';
const EPSILON=1e-7;

// This deliberately narrow rule needs every active rider to finish before
// the first isolated rider even reaches the kilometre marker. It therefore
// cannot silently absorb an active/isolated encounter. Separately paid
// isolated riders may share a marker or pass in outside lanes; neither gets
// shelter, changed energy or a fabricated order at an exact line tie.
function auditIsolatedOutsideLanes(tour,clock,positioned,handoff){
  const source=tour.frames[clock.sourceKm-1];
  const start=positioned.startDistanceM;
  const [at250,at500]=clock.passageFrames;
  const activeIds=new Set(positioned.roadBands[0].slots.map(row=>
    row.riderId));
  const active=handoff.conditionalCrossings.filter(row=>
    activeIds.has(row.riderId));
  const isolated=positioned.droppedRiderIds;
  if(!source||active.length!==activeIds.size||
    !isolated.length||at250?.distanceM!==start+250||
    at500?.distanceM!==start+500)return null;
  const sourceById=new Map(source.riderGroups.map(row=>[row.id,row]));
  const later=new Map(handoff.bandRunners.map(row=>[row.roadBandId,row]));
  const times=new Map();
  for(const id of isolated){
    const first=sourceById.get(id);
    const second=at250.droppedPassages.find(row=>row.riderId===id);
    const third=at500.droppedPassages.find(row=>row.riderId===id);
    const band=later.get(`isolated:${id}`);
    const frame=band?.runner?.frames?.[0];
    if(first?.group!=='dropped'||
      !Number.isFinite(first.deficitSeconds)||
      !Number.isFinite(second?.passageSecondsFromBunchMarker)||
      !Number.isFinite(third?.passageSecondsFromBunchMarker)||
      !(first.deficitSeconds<second.passageSecondsFromBunchMarker&&
        second.passageSecondsFromBunchMarker<
          third.passageSecondsFromBunchMarker)||
      second.unmetEnergyDemand>EPSILON||
      third.unmetEnergyDemand>EPSILON||
      frame?.startDistanceM!==start+500||
      frame.riders.length!==1||frame.riders[0].riderId!==id||
      Math.abs(frame.elapsedSecondsAtStart-
        third.passageSecondsFromBunchMarker)>EPSILON)return null;
    times.set(id,[first.deficitSeconds,
      second.passageSecondsFromBunchMarker,
      third.passageSecondsFromBunchMarker]);
  }
  const latestActiveFinish=Math.max(...active.map(row=>
    row.elapsedSecondsFromLastKmStart));
  const firstIsolatedSource=Math.min(...[...times.values()].map(row=>
    row[0]));
  if(!Number.isFinite(latestActiveFinish)||
    latestActiveFinish+EPSILON>=firstIsolatedSource)return null;
  const encounters=[];
  const add=(left,right,distanceM,time)=>{
    if(distanceM>=positioned.lineDistanceM-EPSILON)return;
    if(encounters.some(row=>row.riderIds[0]===left&&
      row.riderIds[1]===right))return;
    encounters.push({riderIds:[left,right],distanceM,
      elapsedSecondsFromLastKmStart:time,
      laneRule:'isolated_outside_lane_no_draft'});
  };
  for(let a=0;a<isolated.length;a++)for(let b=a+1;b<isolated.length;b++){
    const left=isolated[a],right=isolated[b];
    const first=times.get(left),second=times.get(right);
    for(let index=0;index<2;index++){
      const initial=first[index]-second[index];
      const final=first[index+1]-second[index+1];
      if(Math.abs(initial)>EPSILON&&
        Math.abs(final)>EPSILON&&initial*final>0)continue;
      const share=Math.abs(initial)<=EPSILON?0:
        initial/(initial-final);
      const distanceM=start+index*250+share*250;
      const time=first[index]+share*(first[index+1]-first[index]);
      add(left,right,distanceM,time);
    }
    const after=recordFinaleUnorderedBandOverlapAudit([
      later.get(`isolated:${left}`),later.get(`isolated:${right}`)])
      .firstPotentialOverlap;
    if(after)add(left,right,after.distanceM,
      after.elapsedSecondsFromLastKmStart);
  }
  encounters.sort((a,b)=>
    a.elapsedSecondsFromLastKmStart-b.elapsedSecondsFromLastKmStart||
    a.riderIds.join(':').localeCompare(b.riderIds.join(':')));
  return {version:FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION,
    status:'isolated_outside_lanes_after_active_finish',
    sourceClockVersion:clock.version,
    sourcePositionVersion:positioned.version,
    latestActiveFinishSeconds:latestActiveFinish,
    firstIsolatedSourceSeconds:firstIsolatedSource,
    encounters,contactResolved:true,
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

// A sub-wheel-length group gap cannot place both bands' first riders in the
// same lane. The front keeps its inferred lanes; the bunch uses open lane
// heads and queues its other riders behind the front. This changes no paid
// group clock or energy, and still cannot establish official places.
export function recordFinaleEarlyFrontCatchLaneLine(tour,clock,
  {plans=null,resolveIsolatedLanes=false}={}){
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
  const isolatedAudit=resolveIsolatedLanes?
    auditIsolatedOutsideLanes(tour,clock,merged,handoff):null;
  return {...prior,
    version:isolatedAudit?
      FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION:
      FINALE_EARLY_FRONT_CATCH_LANE_LINE_VERSION,
    sourcePositionVersion:merged.version,positionedSource:merged,
    ...handoff,
    pre500Audit:{status:'front_and_bunch_lanes_join_at_paid_group_contact',
      sourceLeadM,contactDistanceM:contact.atDistanceM,
      frontRiderIds:front.slots.map(slot=>slot.riderId),
      contactResolved:true,isolatedContactResolved:!!isolatedAudit,
      ...(isolatedAudit?{isolatedLanes:isolatedAudit}:{}),
      pointsStatus:'withheld',canCommitAwards:false},
    pre500ContactStatus:'front_and_bunch_lanes_joined',
    roadStatus:isolatedAudit?
      'conditional_early_front_catch_isolated_lanes':
      'conditional_early_front_catch_lane_line_isolated_contact_unresolved',
    ...(isolatedAudit?{overlapAudit:{version:isolatedAudit.version,
      status:isolatedAudit.status,firstPotentialOverlap:null,
      contactResolved:true,classifiedResults:null,
      pointsStatus:'withheld',canCommitAwards:false}}:{}),
    provisionalLineOrder:isolatedAudit?
      positionedLineOrder(handoff.conditionalCrossings):null,
    classifiedResults:null,
    pointsStatus:'withheld',canCommitAwards:false};
}

export function validateFinaleEarlyFrontCatchLaneLine(tour,clock,input,
  recorded){
  const resolveIsolatedLanes=recorded?.version===
    FINALE_EARLY_FRONT_CATCH_ISOLATED_LANES_VERSION;
  if(!isDeepStrictEqual(recorded,
    recordFinaleEarlyFrontCatchLaneLine(tour,clock,
      {...input,resolveIsolatedLanes})))
    throw new Error('The early front catch lane line does not replay.');
  return true;
}
