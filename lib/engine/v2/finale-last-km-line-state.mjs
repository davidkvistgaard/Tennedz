import {isDeepStrictEqual} from 'node:util';
import {probeLastKmNamedAttackRoadFromTour} from
  './finale-last-km-named-attack.mjs';

export const FINALE_LAST_KM_LINE_STATE_VERSION=
  'v2-finale-last-km-line-state-1';

// An auditable input to a future finish calculation. The kilometre source
// has no sub-kilometre elapsed time, so this reports only last-kilometre
// bunch travel and road-band gaps, never an official stage time or placing.
export function lastKmLineStateFromTour(tour,options){
  const road=probeLastKmNamedAttackRoadFromTour(tour,options);
  const teams=tour.committedInputs.teams;
  const allIds=teams.flatMap(team=>team.riders.map(rider=>rider.id));
  const final=road.frames.at(-1);
  const energyById=new Map(final.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const groupById=new Map(road.lineRoadGroups.flatMap(group=>
    group.riderIds.map(riderId=>[riderId,group])));
  const bunchIds=new Set(road.linePelotonRiderIds);
  if(energyById.size!==allIds.length||
    allIds.some(id=>!energyById.has(id)||
      Number(bunchIds.has(id))+Number(groupById.has(id))!==1)||
    bunchIds.size+[...groupById.keys()].length!==allIds.length)
    throw new Error('The line state needs every rider in exactly one road band.');
  const bunchTravelSeconds=road.frames.reduce((sum,frame)=>
    sum+frame.bunchElapsedSeconds,0);
  if(!Number.isFinite(bunchTravelSeconds)||bunchTravelSeconds<=0)
    throw new Error('The line state needs finite final-kilometre travel.');
  const riders=teams.flatMap(team=>team.riders.map(rider=>{
    const group=groupById.get(rider.id);
    return {riderId:rider.id,teamId:team.id,
      roadGroupId:group?.id??null,
      roadBandGapAheadOfBunchSeconds:group?.gapSeconds??0,
      energyAtLine:energyById.get(rider.id)};
  }));
  return {version:FINALE_LAST_KM_LINE_STATE_VERSION,
    roadTraceVersion:road.version,sourceKm:road.sourceKm,
    lineDistanceM:final.endDistanceM,
    bunchTravelSeconds,roadGroups:road.lineRoadGroups,
    riders};
}

export function validateLastKmLineStateFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,lastKmLineStateFromTour(tour,options)))
    throw new Error('The last-kilometre line state does not replay.');
  return true;
}
