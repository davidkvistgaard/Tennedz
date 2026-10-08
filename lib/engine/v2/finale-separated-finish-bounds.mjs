import {isDeepStrictEqual} from 'node:util';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_SEPARATED_DROPPED_TRAVEL_VERSION} from './finale-multi-run.mjs';

export const FINALE_SEPARATED_FINISH_BOUNDS_VERSION=
  'v2-finale-separated-finish-bounds-1';

// Report only the places proved by a complete separated road trace. The
// source kilometre has no short-step clock, so these are not official times,
// classified places or an input to point settlement.
export function probeFinaleSeparatedFinishBoundsFromTour(tour){
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_SEPARATED_DROPPED_TRAVEL_VERSION});
  const line=trace.frames.at(-1);
  const allRiders=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>({riderId:rider.id,teamId:team.id})));
  const energies=new Map(trace.finalRiderEnergy.map(row=>[
    row.riderId,row.energy]));
  if(energies.size!==allRiders.length||
    allRiders.some(row=>!energies.has(row.riderId)))
    throw new Error('Separated finish bounds need every source rider energy.');
  const unranked=[];
  let previousGap=Infinity;
  for(const group of line.roadGroups){
    if(!Number.isFinite(group.gapSeconds)||group.gapSeconds<=0||
      group.gapSeconds>=previousGap)
      throw new Error('Separated finish bounds need ordered road groups.');
    unranked.push({bandId:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      gapAheadOfBunchSeconds:group.gapSeconds,
      gapBehindBunchSeconds:0});
    previousGap=group.gapSeconds;
  }
  unranked.push({bandId:'peloton',kind:'peloton',
    riderIds:[...line.pelotonRiderIds],
    gapAheadOfBunchSeconds:0,gapBehindBunchSeconds:0});
  const dropped=[...trace.finalDroppedRiderDeficits].sort((a,b)=>
    a.deficitSeconds-b.deficitSeconds||
    a.riderId.localeCompare(b.riderId));
  for(const row of dropped){
    if(!Number.isFinite(row.deficitSeconds)||row.deficitSeconds<=0)
      throw new Error('Separated finish bounds need positive dropped deficits.');
    const prior=unranked.at(-1);
    if(prior.kind==='dropped'&&
      prior.gapBehindBunchSeconds===row.deficitSeconds)
      prior.riderIds.push(row.riderId);
    else unranked.push({bandId:`dropped-${unranked.length}`,
      kind:'dropped',riderIds:[row.riderId],
      gapAheadOfBunchSeconds:0,
      gapBehindBunchSeconds:row.deficitSeconds});
  }
  const bands=assignFinishBandPlaces(unranked);
  const bandByRider=new Map(bands.flatMap(band=>
    band.riderIds.map(riderId=>[riderId,band])));
  if(bandByRider.size!==allRiders.length||
    bands.at(-1).lastPossiblePlace!==allRiders.length||
    allRiders.some(row=>!bandByRider.has(row.riderId)))
    throw new Error('Separated finish bounds must account for every rider once.');
  const bunchTravelSecondsFromSource=trace.frames.reduce((sum,frame)=>
    sum+frame.bunchElapsedSeconds,0);
  if(!Number.isFinite(bunchTravelSecondsFromSource)||
    bunchTravelSecondsFromSource<=0)
    throw new Error('Separated finish bounds need recorded bunch travel.');
  return {version:FINALE_SEPARATED_FINISH_BOUNDS_VERSION,
    sourceTraceVersion:trace.version,sourceKm:trace.sourceKm,
    lineDistanceM:line.endDistanceM,bunchTravelSecondsFromSource,
    bands,riders:allRiders.map(row=>({
      ...row,bandId:bandByRider.get(row.riderId).bandId,
      energyAtLine:energies.get(row.riderId),
      firstPossiblePlace:bandByRider.get(row.riderId).firstPossiblePlace,
      lastPossiblePlace:bandByRider.get(row.riderId).lastPossiblePlace})),
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleSeparatedFinishBoundsFromTour(tour,recording){
  if(!isDeepStrictEqual(recording,
    probeFinaleSeparatedFinishBoundsFromTour(tour)))
    throw new Error('Separated finish bounds do not replay.');
  return true;
}
