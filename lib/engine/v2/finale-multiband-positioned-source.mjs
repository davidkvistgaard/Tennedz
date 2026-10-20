import {isDeepStrictEqual} from 'node:util';
import seedrandom from 'seedrandom';
import {sportingSkills} from './physiology.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {LANES,WHEEL_SPACING_M,LANE_STAGGER_M} from
  './finale-positioned-source.mjs';

export const FINALE_MULTIBAND_POSITIONED_SOURCE_VERSION=
  'v2-finale-multiband-positioned-source-lab-1';
export const FINALE_DEPLETED_POSITIONED_SOURCE_VERSION=
  'v2-finale-depleted-positioned-source-lab-2';
export const FINALE_BUNCH_ONLY_POSITIONED_SOURCE_VERSION=
  'v2-finale-bunch-only-positioned-source-lab-3';
export const FINALE_COAST_NO_FRONT_POSITIONED_SOURCE_VERSION=
  'v2-finale-coast-no-front-positioned-source-lab-4';
export const FINALE_COAST_DYNAMIC_NO_FRONT_POSITIONED_SOURCE_VERSION=
  'v2-finale-coast-dynamic-no-front-positioned-source-lab-5';
export const FINALE_COAST_DYNAMIC_FRONT_POSITIONED_SOURCE_VERSION=
  'v2-finale-coast-dynamic-front-positioned-source-lab-6';
export const FINALE_COAST_DYNAMIC_ACTIVE_POSITIONED_SOURCE_VERSION=
  'v2-finale-coast-dynamic-active-positioned-source-lab-7';

// The front bands retain their source wheels. Boundary leavers from the
// bunch are carried only as separately paid passages; the original bunch
// slots cannot also appear in its 500 m sprint handoff.
export function resolveFinaleDynamicActivePositionedSource(tour,clock){
  const source=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const first500=clock?.trace?.frames?.filter(frame=>
    frame.endDistanceM<=source.startDistanceM+500)??[];
  const moved=first500.flatMap(frame=>frame.exhaustionDrops??[]);
  const finalDropped=clock?.trace?.finalDroppedRiderIds;
  const sourceDropped=new Set(source.droppedRiderIds);
  const bunch=source.roadBands.at(-1);
  const bunchIds=new Set(bunch?.slots.map(slot=>slot.riderId));
  if(source.roadBands.length<2||bunch?.id!=='peloton'||
    !moved.length||!Array.isArray(finalDropped)||
    first500.some(frame=>frame.frontExhaustionDrops?.length)||
    new Set(moved.map(row=>row.riderId)).size!==moved.length||
    moved.some(row=>!bunchIds.has(row.riderId))||
    finalDropped.length!==sourceDropped.size+moved.length||
    finalDropped.some(id=>!sourceDropped.has(id)&&
      !moved.some(row=>row.riderId===id)))
    throw new Error('Dynamic active positioning needs recorded pre-500 m bunch drops.');
  const movedIds=new Set(moved.map(row=>row.riderId));
  return {...source,
    version:FINALE_COAST_DYNAMIC_ACTIVE_POSITIONED_SOURCE_VERSION,
    roadBands:source.roadBands.map(band=>({...band,
      slots:band.slots.filter(slot=>!movedIds.has(slot.riderId))})),
    droppedRiderIds:[...finalDropped],
    status:'provisional_inferred_front_and_surviving_bunch_wheels'};
}

// The source front band's provisional wheels exclude recorded boundary
// leavers. Their independent travel and possible bunch pass are in the
// clock, not an invented place in the remaining front group.
export function resolveFinaleDynamicFrontPositionedSource(tour,clock){
  const source=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true});
  const first500=clock?.trace?.frames?.filter(frame=>
    frame.endDistanceM<=source.startDistanceM+500)??[];
  const moved=first500.flatMap(frame=>[
    ...(frame.frontExhaustionDrops??[]),
    ...(frame.exhaustionDrops??[])]);
  const finalDropped=clock?.trace?.finalDroppedRiderIds;
  const sourceDropped=new Set(source.droppedRiderIds);
  const active=new Set(source.roadBands.flatMap(band=>
    band.slots.map(slot=>slot.riderId)));
  if(!moved.some(row=>row.fromRoadGroupId)||
    !Array.isArray(finalDropped)||
    new Set(moved.map(row=>row.riderId)).size!==moved.length||
    moved.some(row=>!active.has(row.riderId))||
    finalDropped.length!==sourceDropped.size+moved.length||
    finalDropped.some(id=>!sourceDropped.has(id)&&
      !moved.some(row=>row.riderId===id)))
    throw new Error('Dynamic front positioning needs recorded pre-500 m drops.');
  const movedIds=new Set(moved.map(row=>row.riderId));
  return {...source,
    version:FINALE_COAST_DYNAMIC_FRONT_POSITIONED_SOURCE_VERSION,
    roadBands:source.roadBands.map(band=>({...band,
      slots:band.slots.filter(slot=>!movedIds.has(slot.riderId))})),
    droppedRiderIds:[...finalDropped],
    status:'provisional_inferred_surviving_front_wheels_contact_unresolved'};
}

// The v93 source wheels remain inferred. Remove riders who have a recorded
// boundary drop before 500 m; their independent passage replaces a bunch
// wheel, while the original source recording remains untouched.
export function resolveFinaleDynamicNoFrontPositionedSource(tour,clock){
  const source=resolveFinaleMultibandPositionedSource(tour,{
    includeDropped:true,allowNoFront:true});
  const first500=clock?.trace?.frames?.filter(frame=>
    frame.endDistanceM<=source.startDistanceM+500)??[];
  const moved=first500.flatMap(frame=>frame.exhaustionDrops??[]);
  const finalDropped=clock?.trace?.finalDroppedRiderIds;
  const sourceDropped=new Set(source.droppedRiderIds);
  if(!moved.length||!Array.isArray(finalDropped)||
    moved.some(row=>!source.roadBands[0].slots.some(slot=>
      slot.riderId===row.riderId))||
    finalDropped.length!==sourceDropped.size+moved.length||
    finalDropped.some(id=>!sourceDropped.has(id)&&
      !moved.some(row=>row.riderId===id)))
    throw new Error('Dynamic positioning needs recorded pre-500 m drops.');
  const movedIds=new Set(moved.map(row=>row.riderId));
  return {...source,
    version:FINALE_COAST_DYNAMIC_NO_FRONT_POSITIONED_SOURCE_VERSION,
    roadBands:source.roadBands.map(band=>({...band,
      slots:band.slots.filter(slot=>!movedIds.has(slot.riderId))})),
    droppedRiderIds:[...finalDropped],
    status:'provisional_inferred_surviving_wheels_new_drops_unpositioned'};
}

// Reuse the complete-bunch laboratory grid, without promoting its inferred
// wheels to observed road positions. A band edge passes the last-kilometre
// marker at its recorded time; every rider starts at or behind that edge.
export function resolveFinaleMultibandPositionedSource(tour,
  {includeDropped=false,allowNoFront=false}={}){
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm:1,includeAttackLoad:true});
  if((!snapshot.roadGroups.length&&!allowNoFront)||
    allowNoFront&&snapshot.roadGroups.length||
    (snapshot.droppedRiderIds.length>0)!==includeDropped||
    !snapshot.peloton.riderIds.length)
    throw new Error('A positioned multiband source needs road groups and a complete bunch.');
  const roster=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,{teamId:team.id,rider}])));
  const states=new Map(snapshot.riders.map(row=>[row.riderId,row]));
  const bands=[...snapshot.roadGroups.map(group=>({
    id:group.id,passageSecondsFromBunchMarker:-group.gapSeconds,
    riderIds:group.riderIds})),{
    id:'peloton',passageSecondsFromBunchMarker:0,
    riderIds:snapshot.peloton.riderIds}];
  const activeIds=bands.flatMap(band=>band.riderIds);
  const allIds=[...activeIds,...snapshot.droppedRiderIds];
  if(allIds.length!==roster.size||new Set(allIds).size!==allIds.length||
    states.size!==roster.size||
    allIds.some(id=>!roster.has(id)||!states.has(id))||
    bands.some(band=>!Number.isFinite(
      band.passageSecondsFromBunchMarker)||
      band.passageSecondsFromBunchMarker>0||
      !band.riderIds.length))
    throw new Error('The positioned multiband source lost the locked field.');
  const score=id=>sportingSkills(roster.get(id).rider).positioning;
  const roadBands=bands.map(band=>{
    const ordered=band.riderIds.map(id=>({riderId:id,
      positioningScore:score(id),
      tie:seedrandom(`${tour.raceSeed}:finale-position:${id}`)()}))
      .sort((a,b)=>b.positioningScore-a.positioningScore||
        b.tie-a.tie||a.riderId.localeCompare(b.riderId));
    const laneDepths=Array(LANES).fill(0);
    const slots=ordered.map(row=>{
      const lane=laneDepths.indexOf(Math.min(...laneDepths));
      const depth=laneDepths[lane]++;
      const state=states.get(row.riderId);
      const positionM=snapshot.startDistanceM-
        depth*WHEEL_SPACING_M-lane*LANE_STAGGER_M;
      if(state.roadGroupId!==band.id||
        !Number.isFinite(state.energy)||state.energy<0||
        positionM>snapshot.startDistanceM)
        throw new Error('A positioned multiband rider differs from the recorded road.');
      return {riderId:row.riderId,
        teamId:roster.get(row.riderId).teamId,
        lane,depth,positionM,energy:state.energy,
        positioningScore:row.positioningScore};
    });
    return {id:band.id,
      passageSecondsFromBunchMarker:band.passageSecondsFromBunchMarker,
      edgeDistanceM:snapshot.startDistanceM,slots};
  });
  return {version:allowNoFront&&includeDropped?
    FINALE_COAST_NO_FRONT_POSITIONED_SOURCE_VERSION:
    allowNoFront?FINALE_BUNCH_ONLY_POSITIONED_SOURCE_VERSION:
    includeDropped?FINALE_DEPLETED_POSITIONED_SOURCE_VERSION:
      FINALE_MULTIBAND_POSITIONED_SOURCE_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceMotorVersion:tour.tuningVersion,
    startDistanceM:snapshot.startDistanceM,
    lineDistanceM:tour.route.distanceKm*1000,
    status:includeDropped?
      'provisional_inferred_active_wheels_dropped_unpositioned':
      'provisional_inferred_wheels_at_band_passage',
    laneCount:LANES,wheelSpacingM:WHEEL_SPACING_M,
    laneStaggerM:LANE_STAGGER_M,roadBands,
    ...(includeDropped?{droppedRiderIds:[...snapshot.droppedRiderIds]}:{}),
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMultibandPositionedSource(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    resolveFinaleMultibandPositionedSource(tour)))
    throw new Error('The positioned multiband source does not replay.');
  return true;
}
