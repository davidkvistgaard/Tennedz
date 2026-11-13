import {isDeepStrictEqual} from 'node:util';
import {FINALE_GROUP_COMMON_CLOCK_VERSION,
  validateFinaleCooperativeGroupCommonClock} from
  './finale-group-common-clock.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';

export const FINALE_GROUP_RESULT_BOUNDS_VERSION=
  'v2-finale-group-result-bounds-1';
export const FINALE_GROUP_CHASE_RESULT_BOUNDS_VERSION=
  'v2-finale-group-result-bounds-2';
export const FINALE_GROUP_ROTATING_CHASE_RESULT_BOUNDS_VERSION=
  'v2-finale-group-result-bounds-3';
const EPSILON=1e-7;

// A paid band crossing can prove which road band leads, but cannot order
// wheels inside either band. Exact catch removes even that ordering evidence.
export function recordFinaleGroupResultBounds(tour,clock,{
  chasePullRiderId=null,chaseRotationRiderIds=null}={}){
  const snapshot=finaleSnapshotFromTour(tour,{
    remainingKm:1,includeAttackLoad:true});
  validateFinaleCooperativeGroupCommonClock({
    route:tour.route,snapshot,teams:tour.committedInputs.teams,
    frontPullRiderId:null,chasePullRiderId,
    passiveChase:chasePullRiderId===null,
    ...(chasePullRiderId!==null?{bunchPaceFloor:true}:{}),
    ...(chaseRotationRiderIds?{chaseRotationRiderIds}:{}),
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION,
    cooperativeFront:true},clock);
  const source=clock?.roadFrames?.[0];
  const line=clock?.line;
  const teams=tour?.committedInputs?.teams;
  if(clock?.version!==FINALE_GROUP_COMMON_CLOCK_VERSION||
    !['survived','caught_merged'].includes(line?.outcome)||
    !Array.isArray(teams)||!Array.isArray(source?.frontRiderEnergy)||
    !Array.isArray(source?.bunchRiderEnergy)||
    clock.lineDistanceM!==tour.route.distanceKm*1000||
    line.endDistanceM!==clock.lineDistanceM)
    throw new Error('Group result bounds need one paid common-clock line.');
  const front=new Set(source.frontRiderEnergy.map(row=>row.riderId));
  const bunch=new Set(source.bunchRiderEnergy.map(row=>row.riderId));
  const roster=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id})));
  const finalEnergy=new Map(line.finalRiderEnergy.map(row=>
    [row.riderId,row.energy]));
  if(!front.size||!bunch.size||
    roster.length!==front.size+bunch.size||
    finalEnergy.size!==roster.length||
    roster.some(row=>(front.has(row.riderId)===bunch.has(row.riderId))||
      !finalEnergy.has(row.riderId))||
    line.outcome==='survived'&&
      (!Number.isFinite(clock.frontLineTime)||
        !(clock.frontLineTime+EPSILON<clock.bunchLineTime)))
    throw new Error('Group result bounds lost their locked road bands.');
  const riders=roster.map(row=>({
    ...row,roadBand:line.outcome==='survived'?
      front.has(row.riderId)?'front':'bunch':'merged',
    firstPossiblePlace:line.outcome==='survived'&&
      !front.has(row.riderId)?front.size+1:1,
    lastPossiblePlace:line.outcome==='survived'&&
      front.has(row.riderId)?front.size:roster.length}));
  return {version:chaseRotationRiderIds?
    FINALE_GROUP_ROTATING_CHASE_RESULT_BOUNDS_VERSION:
    chasePullRiderId===null?
    FINALE_GROUP_RESULT_BOUNDS_VERSION:
    FINALE_GROUP_CHASE_RESULT_BOUNDS_VERSION,
    sourceClockVersion:clock.version,
    sourceLineVersion:line.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    outcome:line.outcome,roadGroupId:line.outcome==='survived'?
      snapshot.roadGroups[0].id:null,
    riders,resultStatus:'band_bounds_only',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleGroupResultBounds(tour,clock,recorded,
  options={}){
  if(!isDeepStrictEqual(recorded,
    recordFinaleGroupResultBounds(tour,clock,options)))
    throw new Error('The group result bounds do not replay.');
  return true;
}
