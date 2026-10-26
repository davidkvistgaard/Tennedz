import {normalizeStageOverlayV3} from './stage-overlay-v3.mjs';
import {prepareRecordedRoadHandoffV3} from
  './stage-recorded-road-handoff-v3.mjs';
import {replaySeparatedRoadBandsStageV3} from
  './stage-separated-road-replay-v3.mjs';

export const STAGE_COMPLETE_INPUT_VERSION='v3-complete-stage-input-1';
export const STAGE_RECORDED_CONTINUATION_VERSION=
  'v3-recorded-separated-road-continuation-1';
const TERRAINS=new Set(['flat','hill','climb','descent']);
const SOURCES=new Set(['observed','simulated','illustrative']);

// A stage supplies both the kilometre baseline and the short-slice overlay.
// This prevents a caller from silently mixing another route's terrain with
// this stage's weather, surface, wind or short features.
export function normalizeCompleteStageInputV3(raw){
  if(raw?.version!==STAGE_COMPLETE_INPUT_VERSION)
    throw new Error('A separately versioned complete stage input is required.');
  const overlay=normalizeStageOverlayV3(raw.overlay);
  if(!Number.isInteger(overlay.distanceKm)||
    !Array.isArray(raw.kilometreBaselines)||
    raw.kilometreBaselines.length!==overlay.distanceKm)
    throw new Error('Every whole kilometre needs a stage-owned terrain baseline.');
  const kilometreBaselines=raw.kilometreBaselines.map((row,index)=>{
    if(!TERRAINS.has(row?.terrain)||
      !Number.isFinite(row.gradientPct)||!SOURCES.has(row.source))
      throw new Error(`Stage baseline at kilometre ${index+1} needs terrain, gradient and provenance.`);
    return {terrain:row.terrain,gradientPct:row.gradientPct,
      source:row.source};
  });
  return {version:STAGE_COMPLETE_INPUT_VERSION,overlay,
    kilometreBaselines};
}

// Read-only bounded continuation after a v2 paid split. Only those already
// separated road bands enter this clock; bunch/older drops remain outside it.
export function continueRecordedRoadWithCompleteStageV3({
  recording,frameIndex,stageInput,pullRiderIds,driveRiderIds=[],
  workOrders=[],effortOrders=[],
}){
  const stage=normalizeCompleteStageInputV3(stageInput);
  const handoff=prepareRecordedRoadHandoffV3({recording,frameIndex,
    overlay:stage.overlay});
  const sourceRiders=recording.frames[frameIndex].riderGroups;
  const continuedRiderIds=handoff.bands.flatMap(band=>band.members
    .map(member=>member.id));
  const continued=new Set(continuedRiderIds);
  const sourceIds=new Set(sourceRiders.map(row=>row.id));
  if(sourceIds.size!==sourceRiders.length||
    continued.size!==continuedRiderIds.length||
    continuedRiderIds.some(id=>!sourceIds.has(id)))
    throw new Error('Recorded road-band membership is not a unique subset of the race.');
  const sourceCoverage={totalRiders:sourceRiders.length,
    continuedRiderIds,
    outsideRiders:sourceRiders.filter(row=>!continued.has(row.id))
      .map(row=>({riderId:row.id,sourceGroup:row.group,
        energyAtHandoff:row.energy})),
    wholeRaceCovered:continued.size===sourceRiders.length};
  const replay=replaySeparatedRoadBandsStageV3({overlay:stage.overlay,
    kilometreBaselines:stage.kilometreBaselines,
    bands:handoff.bands,gapsSeconds:handoff.gapsSeconds,
    startKilometreIndex:handoff.startKilometreIndex,
    pullRiderIds,driveRiderIds,workOrders,effortOrders});
  return {...replay,version:STAGE_RECORDED_CONTINUATION_VERSION,
    roadReplayVersion:replay.version,stageInputVersion:stage.version,
    source:handoff.source,sourceCoverage,
    scope:'recorded separated road bands only'};
}
