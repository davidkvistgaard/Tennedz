export const PLAYTEST_STAGE_TRACE_VERSION='v93-stage-trace-1';

// A read-only view of the stage loaded for this run.
export function summarizeRecordedStageTrace(recording){
  const route=recording?.route;
  if(!route||!Array.isArray(route.kilometres)||
    route.kilometres.length!==route.distanceKm)
    throw new Error('The recorded stage has no complete kilometre overlay.');
  return {version:PLAYTEST_STAGE_TRACE_VERSION,
    kilometres:route.kilometres.map(segment=>({
      km:segment.km,terrain:segment.terrain,
      gradientPct:segment.gradientPct,surface:segment.surface,
      exposed:segment.exposed,weather:{
        temperatureC:segment.weather.temperatureC,
        windKph:segment.weather.windKph,
        rainMm:segment.weather.rainMm}}))};
}
