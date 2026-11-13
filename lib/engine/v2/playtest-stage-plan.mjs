import {prepareV91Playtest} from './playtest.mjs';
import {buildKilometreRoute} from './route.mjs';
import {summarizeRecordedStageTrace} from './playtest-stage-trace.mjs';

export const GUIDED_STAGE_PLAN_VERSION='v93-guided-stage-plan-1';

export function summarizeGuidedStagePlan(settings){
  const {stage,weather,seed}=prepareV91Playtest({
    distanceKm:settings?.distanceKm,terrain:settings?.terrain,
    seed:settings?.seed,profileHeightsM:settings?.profileHeightsM});
  const route=buildKilometreRoute(stage,{seed,weather});
  const trace=summarizeRecordedStageTrace({route});
  const intervals=[];
  for(let fromKm=0;fromKm<route.distanceKm;fromKm+=5){
    const rows=trace.kilometres.slice(fromKm,fromKm+5);
    const values=(key)=>rows.map(row=>row.weather[key]);
    const span=(key)=>[Math.min(...values(key)),Math.max(...values(key))];
    intervals.push({
      fromKm,toKm:fromKm+rows.length,
      startM:rows[0].startM,endM:rows.at(-1).endM,
      minM:Math.min(rows[0].startM,...rows.map(row=>row.endM)),
      maxM:Math.max(rows[0].startM,...rows.map(row=>row.endM)),
      terrains:[...new Set(rows.map(row=>row.terrain))],
      surfaces:[...new Set(rows.map(row=>row.surface))],
      exposedKm:rows.filter(row=>row.exposed).length,
      windKph:span('windKph'),rainMm:span('rainMm'),
      temperatureC:span('temperatureC'),
    });
  }
  return {version:GUIDED_STAGE_PLAN_VERSION,source:'simulated',
    distanceKm:route.distanceKm,stageTrace:trace,intervals};
}
