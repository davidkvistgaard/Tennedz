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

// Reuse the complete-bunch laboratory grid, without promoting its inferred
// wheels to observed road positions. A band edge passes the last-kilometre
// marker at its recorded time; every rider starts at or behind that edge.
export function resolveFinaleMultibandPositionedSource(tour,
  {includeDropped=false}={}){
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm:1,includeAttackLoad:true});
  if((!snapshot.roadGroups.length&&!includeDropped)||
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
  return {version:includeDropped?FINALE_DEPLETED_POSITIONED_SOURCE_VERSION:
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
