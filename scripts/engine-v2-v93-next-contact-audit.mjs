// Reproducible whole-race search for unsupported late-road contact.
// Synthetic riders only; no result or official award is saved.
import {createV93PlayableTest} from
  '../lib/engine/v2/playtest-v93-coasted.mjs';

const rows=[];
const mode=process.argv[2]??'mixed';
const allHard=mode==='all-hard';
const fourMixed=mode==='four-mixed';
const fieldMixed=mode==='field-mixed';
const teamCounts=fourMixed?[4]:[15,20];
const terrains=fieldMixed?['flat','custom']:
  fourMixed?['flat','rolling','mountain','exposed','custom']:
  ['rolling','mountain','exposed'];
const seedIndices=fourMixed?[0,1,2,3,4]:fieldMixed?[0,1,2]:[0,1];
for(const teamCount of teamCounts)for(const gender of ['M','F'])
  for(const terrain of terrains)
    for(const fatigue of [0,15,30])for(const seedIndex of seedIndices){
      const seed=`v93-next-contact-${mode}-${
        teamCount}-${gender}-${terrain}-${
        fatigue}-${seedIndex}`;
      const settings={distanceKm:260,teamCount,gender,terrain,fatigue,seed,
        defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
        chase:'all',managerTactics:Array.from({length:teamCount-1},
          (_,index)=>({effort:allHard?'hard':fourMixed||fieldMixed?
            ['hard','conserve','steady'][(index+seedIndex)%3]:
            index%5===0?'conserve':'hard',
          attack:(fourMixed||fieldMixed)&&index%3===1?
            'selective':'repeated',
          chase:(fourMixed||fieldMixed)&&index%3===1?'ignore':'all'})),
        managerFinaleOrders:[
          {teamId:'you',atKm:255,effort:seedIndex?'conserve':'hard'},
          {teamId:'rival-1',atKm:255,
            effort:seedIndex?'hard':'conserve'}]};
      try{
        const race=createV93PlayableTest(settings);
        rows.push({seed,version:race.version,
          outcome:race.clock?.line?.outcome??null});
      }catch(error){
        rows.push({seed,refusal:error.message,
          cause:error.cause?.message??null,
          road:error.roadPreview?.unsupportedReason??null,
          source:error.roadPreview?.kilometreFrames.at(-1)?.roadGroups
            .map(group=>({id:group.id,riders:group.riderIds.length}))??null});
      }
    }
const refusals=rows.filter(row=>row.refusal);
const versions=Object.entries(rows.reduce((counts,row)=>{
  if(row.version)counts[row.version]=(counts[row.version]??0)+1;
  return counts;
},{}));
console.log(JSON.stringify({mode,scenarios:rows.length,
  completed:rows.length-refusals.length,versions,
  refused:refusals.length,
  refusalReasons:Object.entries(refusals.reduce((counts,row)=>{
    const reason=row.road??row.refusal;
    counts[reason]=(counts[reason]??0)+1;
    return counts;
  },{})),
  refusals:refusals.map(row=>({seed:row.seed,reason:row.road??row.refusal,
    source:row.source}))},null,2));
