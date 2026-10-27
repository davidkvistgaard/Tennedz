// Read-only API-boundary stress audit. Each successful case validates and
// source-replays before its provisional road summary is counted.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const batch=Number(process.argv.find(arg=>arg.startsWith('--batch='))?.split('=')[1]??1);
if(![1,2,3].includes(batch))throw new Error('Use --batch=1, 2 or 3.');
const seeds=Array.from({length:4},(_,index)=>
  `preview-boundary-${(batch-1)*4+index+1}`);
const outcomes=[];
for(const seed of seeds)for(const format of ['one_day','stage'])
  for(const terrain of ['flat','mountain']){
    const scenario={seed,format,terrain};
    try{
      const {preview}=createV94RaceDynamicsPreview({format,settings:{
        distanceKm:260,terrain,teamCount:20,gender:'M',
        fatigue:terrain==='mountain'?30:0,effort:'steady',
        attack:'none',chase:'selective',seed}});
      outcomes.push({...scenario,ok:true,
        widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
        kilometreAtWidestLead:preview.story.widestRecordedLead.km,
        oneMinuteLeadKm:preview.story.kilometresAtOrAboveOneMinute,
        finalRoadGroups:preview.story.finalRoadGroups});
    }catch(error){
      outcomes.push({...scenario,ok:false,error:error.message});
    }
    process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
  }
const valid=outcomes.filter(row=>row.ok);
const summary={batch,cases:outcomes.length,valid:valid.length,
  refused:outcomes.length-valid.length,
  widestLeadRangeSeconds:valid.length?[Math.min(...valid.map(row=>
    row.widestLeadSeconds)),Math.max(...valid.map(row=>
    row.widestLeadSeconds))]:null,
  meanWidestLeadSeconds:valid.length?valid.reduce((sum,row)=>
    sum+row.widestLeadSeconds,0)/valid.length:null};
process.stdout.write(`${JSON.stringify({summary})}\n`);
if(summary.refused)process.exitCode=1;
