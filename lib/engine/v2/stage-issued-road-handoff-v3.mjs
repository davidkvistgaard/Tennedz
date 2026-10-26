import {prepareRecordedRoadHandoffV3} from
  './stage-recorded-road-handoff-v3.mjs';
import {sameRunHandoffStateAtV3,
  MOTOR_HANDOFF_STATE_TRACE_VERSION} from './tour.mjs';

export const STAGE_ISSUED_ROAD_HANDOFF_VERSION=
  'v3-issued-source-road-state-handoff-1';

// This audits all riders at a paid v2 boundary. Only riders in already
// separated road bands have a v3 movement clock; the rest remain unadvanced.
export function prepareIssuedRoadHandoffV3({recording,frameIndex,overlay}){
  const roadHandoff=prepareRecordedRoadHandoffV3({recording,frameIndex,
    overlay});
  const issued=sameRunHandoffStateAtV3({recording,frameIndex});
  const source=recording.frames[frameIndex];
  const sourceById=new Map(source.riderGroups.map(row=>[row.id,row]));
  const issuedById=new Map(issued.riders.map(row=>[row.riderId,row]));
  if(sourceById.size!==source.riderGroups.length||
    issuedById.size!==issued.riders.length||
    issuedById.size!==sourceById.size||issued.km!==source.km||
    issued.riders.some(row=>{
      const saved=sourceById.get(row.riderId);
      return !saved||row.teamId!==saved.teamId||
        row.group!==saved.group||row.energy!==saved.energy||
        row.deficitSeconds!==saved.deficitSeconds;
    }))
    throw new Error('Issued rider state does not match the paid road frame.');
  const leaders=new Map(source.activeLeaders.map(row=>
    [row.teamId,row.riderId]));
  const teamIds=new Set(issued.teams.map(row=>row.teamId));
  if(leaders.size!==source.activeLeaders.length||
    teamIds.size!==issued.teams.length||teamIds.size!==leaders.size||
    issued.teams.some(row=>leaders.get(row.teamId)!==row.activeLeaderId))
    throw new Error('Issued team state does not match the paid race frame.');
  const continuedIds=roadHandoff.bands.flatMap(band=>band.members
    .map(member=>member.id));
  const continued=new Set(continuedIds);
  if(continued.size!==continuedIds.length||
    continuedIds.some(id=>!issuedById.has(id)))
    throw new Error('Issued road membership is not a unique race subset.');
  return {version:STAGE_ISSUED_ROAD_HANDOFF_VERSION,
    stateTraceVersion:MOTOR_HANDOFF_STATE_TRACE_VERSION,
    source:roadHandoff.source,roadHandoff,
    totalRiders:issued.riders.length,
    continuedRiderStates:continuedIds.map(id=>issuedById.get(id)),
    outsideRiderStates:issued.riders.filter(row=>!continued.has(row.riderId)),
    teamStates:issued.teams,
    wholeRaceCovered:continued.size===issued.riders.length,
    scope:'same-run source state only; outside riders are not advanced'};
}
