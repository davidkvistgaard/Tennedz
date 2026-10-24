// Reproducible whole-race search for a dissolved front meeting a survivor.
// Synthetic riders only; this never settles a race or saves points.
import {createV93PlayableTest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const patterns=[
  {effort:'hard',attack:'repeated',chase:'all'},
  {effort:'conserve',attack:'none',chase:'ignore'},
  {effort:'steady',attack:'selective',chase:'selective'}];
const rows=[];
for(const teamCount of [4,15])for(const gender of ['M','F'])
  for(const terrain of ['rolling','mountain','exposed'])
    for(const fatigue of [0,30])for(const seedIndex of [0,1]){
      const distanceKm=260;
      const settings={distanceKm,teamCount,gender,terrain,fatigue,
        seed:`v93-mixed-late-${teamCount}-${gender}-${terrain}-${
          fatigue}-${seedIndex}`,
        defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
        chase:'all',managerTactics:Array.from({length:teamCount-1},
          (_,index)=>patterns[(index+seedIndex)%3]),
        managerFinaleOrders:[
          {teamId:'you',atKm:distanceKm-5,
            effort:seedIndex?'conserve':'hard'},
          {teamId:'rival-1',atKm:distanceKm-5,
            effort:seedIndex?'hard':'conserve'}]};
      try{
        const race=createV93PlayableTest(settings);
        rows.push({seed:settings.seed,
          status:race.roadStatus??race.clock?.line?.outcome});
      }catch(error){
        rows.push({seed:settings.seed,refusal:error.message,
          reason:error.roadPreview?.unsupportedReason??null,
          source:error.roadPreview?.kilometreFrames.at(-1)?.roadGroups
            .map(group=>({id:group.id,gapSeconds:group.gapSeconds,
              riders:group.riderIds.length}))??null});
      }
    }
const refused=rows.filter(row=>row.refusal);
console.log(JSON.stringify({scenarios:rows.length,
  complete:rows.length-refused.length,refused},null,2));
