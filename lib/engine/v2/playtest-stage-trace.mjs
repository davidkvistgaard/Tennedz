export const PLAYTEST_STAGE_TRACE_VERSION='v93-stage-trace-1';

// A read-only view of the stage loaded for this run.
export function summarizeRecordedStageTrace(recording){
  const route=recording?.route;
  if(!route||!Array.isArray(route.kilometres)||
    route.kilometres.length!==route.distanceKm)
    throw new Error('The recorded stage has no complete kilometre overlay.');
  return {version:PLAYTEST_STAGE_TRACE_VERSION,
    kilometres:route.kilometres.map(segment=>({
      km:segment.km,startM:segment.startM,endM:segment.endM,
      terrain:segment.terrain,
      gradientPct:segment.gradientPct,surface:segment.surface,
      exposed:segment.exposed,weather:{
        temperatureC:segment.weather.temperatureC,
        windKph:segment.weather.windKph,
        rainMm:segment.weather.rainMm}}))};
}


// The recorded kilometre elevations are a coarse profile, not surveyed
// sub-kilometre geography. Keep the chart derived from the saved route.
export function recordedStageProfile(trace) {
  const rows = trace?.kilometres;
  if (!Array.isArray(rows) || !rows.length || rows.some(row =>
    !Number.isFinite(row.startM) || !Number.isFinite(row.endM))) {
    throw new Error('A complete recorded elevation trace is required.');
  }
  const elevations = [rows[0].startM, ...rows.map(row => row.endM)];
  const minElevationM = Math.min(...elevations);
  const maxElevationM = Math.max(...elevations);
  const span = Math.max(1, maxElevationM - minElevationM);
  const points = elevations.map((height, index) =>
    [20 + index / rows.length * 560, 110 - (height - minElevationM) / span * 90]);
  return {minElevationM, maxElevationM,
    points: points.map(([x, y]) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ')};
}
