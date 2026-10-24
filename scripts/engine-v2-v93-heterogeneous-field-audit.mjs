// Read-only whole-race audit with unequal synthetic team strengths.
// No calendar event, official result, point ledger or account data is saved.
import {createV93PlayableTest,summarizeV93CoastedPlaytest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const rows=[];
for(const teamCount of [4,15,20])for(const gender of ['M','F'])
  for(const terrain of ['flat','rolling','mountain','exposed','custom'])
    for(const fatigue of [0,30]){
      const seed=`v93-heterogeneous-${teamCount}-${gender}-${terrain}-${
        fatigue}`;
      const settings={distanceKm:260,teamCount,gender,terrain,fatigue,seed,
        defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
        chase:'all',managerTactics:Array.from({length:teamCount-1},
          (_,index)=>({
            effort:['hard','steady','conserve'][index%3],
            attack:index%3===0?'repeated':'selective',
            chase:index%3===1?'all':'selective'})),
        teamOverrides:[{teamId:'you',level:45},
          ...Array.from({length:teamCount-1},(_,index)=>({
            teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
        managerFinaleOrders:[
          {teamId:'you',atKm:255,effort:'steady',chase:'all'},
          {teamId:'rival-1',atKm:255,effort:'hard'}]};
      try{
        const race=createV93PlayableTest(settings);
        const summary=summarizeV93CoastedPlaytest(race);
        if(summary.lineTimes?.length!==teamCount*8||
          summary.pointsStatus!=='withheld'||
          summary.canCommitAwards!==false)
          throw new Error('A conditional race lost riders or award guards.');
        rows.push({seed,status:'conditional_finish',version:race.version});
      }catch(error){
        if(error.message===
          'A conditional race lost riders or award guards.')throw error;
        rows.push({seed,status:'refused',
          reason:error.roadPreview?.unsupportedReason??error.message,
          sourceRoadGroups:error.roadPreview?.kilometreFrames.at(-1)
            ?.roadGroups.map(group=>({id:group.id,
              count:group.riderIds.length}))??null});
      }
    }
const refusals=rows.filter(row=>row.status==='refused');
const versions=Object.entries(rows.reduce((counts,row)=>{
  if(row.version)counts[row.version]=(counts[row.version]??0)+1;
  return counts;
},{}));
console.log(JSON.stringify({scenarios:rows.length,
  conditionalFinishes:rows.length-refusals.length,
  explicitRefusals:refusals.length,versions,refusals},null,2));
