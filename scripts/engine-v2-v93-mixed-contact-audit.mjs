// Whole-race search for paid roads that still cannot reach an individual line.
import {createV93PlayableTest} from '../lib/engine/v2/playtest-v93-coasted.mjs';

const rows=[];
for(const teamCount of [4])for(const gender of ['M','F'])
  for(const terrain of ['rolling','mountain','exposed'])
    for(const fatigue of [30])for(const seedIndex of
      [0,1,2,3,4,5,6,7,8,9]){
      const settings={distanceKm:260,teamCount,gender,terrain,fatigue,
        seed:`v93-contact-audit-${teamCount}-${gender}-${terrain}-${fatigue}-${seedIndex}`,
        defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
        managerTactics:Array.from({length:teamCount-1},()=>({
          effort:'hard',attack:'repeated',chase:'all'}))};
      try{
        const race=createV93PlayableTest(settings);
        rows.push({settings,status:race.roadStatus??race.clock?.line?.outcome});
      }catch(error){
        rows.push({settings,refusal:error.message,
          reason:error.roadPreview?.unsupportedReason??null,
          sourceKm:error.roadPreview?.handoffKm??null});
      }
      if(rows.length%12===0)
        console.error(`Audited ${rows.length}/60 whole races.`);
    }
const refused=rows.filter(row=>row.refusal);
const byRefusal=Object.entries(Object.groupBy(refused,row=>row.refusal))
  .map(([reason,cases])=>({reason,count:cases.length}));
console.log(JSON.stringify({scenarios:rows.length,
  completed:rows.length-refused.length,byRefusal,
  firstRefusal:refused[0]?{
    seed:refused[0].settings.seed,
    sourceKm:refused[0].sourceKm,
    reason:refused[0].reason}:null},null,2));
