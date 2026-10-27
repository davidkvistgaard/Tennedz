// Read-only API-boundary stress audit. Each successful case validates and
// source-replays before its provisional road summary is counted.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const batch=Number(process.argv.find(arg=>arg.startsWith('--batch='))?.split('=')[1]??1);
if(![1,2,3,4].includes(batch))throw new Error('Use --batch=1, 2, 3 or 4.');
const controlWithdrawalVersion=process.argv.includes('--withdrawal-v2')?2:1;
const frontExhaustionVersion=process.argv.includes('--front-exhaustion-v4')?4:3;
const seeds=Array.from({length:4},(_,index)=>
  `preview-boundary-${(batch-1)*4+index+1}`);
const outcomes=[];
for(const seed of seeds)for(const format of ['one_day','stage'])
  for(const terrain of ['flat','mountain']){
    const scenario={seed,format,terrain};
    try{
      const {preview,recording}=createV94RaceDynamicsPreview({format,
        controlWithdrawalVersion,frontExhaustionVersion,settings:{
        distanceKm:260,terrain,teamCount:20,gender:'M',
        fatigue:terrain==='mountain'?30:0,effort:'steady',
        attack:'none',chase:'selective',seed}});
      const roles=Object.fromEntries(['break','control','protect',
        'opportunistic'].map(role=>[role,preview.teamPlans.filter(plan=>
        plan.role===role).length]));
      const controls=new Set(preview.teamPlans.filter(plan=>
        plan.role==='control').map(plan=>plan.teamId));
      const controlEnergy=recording.frames[209].riderGroups.filter(row=>
        controls.has(row.teamId)).map(row=>row.energy);
      outcomes.push({...scenario,controlWithdrawalVersion,
        frontExhaustionVersion,ok:true,
        roles,controlChaseTeamKm:preview.frames.reduce((sum,frame)=>
          sum+frame.chasers.filter(id=>controls.has(id)).length,0),
        controlFrontTeamKm:preview.frames.filter(frame=>
          controls.has(frame.paidBunchPace?.teamId)).length,
        meanControlEnergyKm210:controlEnergy.length?
          controlEnergy.reduce((sum,energy)=>sum+energy,0)/
            controlEnergy.length:null,
        widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
        kilometreAtWidestLead:preview.story.widestRecordedLead.km,
        oneMinuteLeadKm:preview.story.kilometresAtOrAboveOneMinute,
        finalRoadGroups:preview.story.finalRoadGroups});
    }catch(error){
      outcomes.push({...scenario,controlWithdrawalVersion,
        frontExhaustionVersion,ok:false,
        error:error.message});
    }
    process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
  }
const valid=outcomes.filter(row=>row.ok);
const summary={batch,controlWithdrawalVersion,frontExhaustionVersion,
  cases:outcomes.length,
  valid:valid.length,
  refused:outcomes.length-valid.length,
  widestLeadRangeSeconds:valid.length?[Math.min(...valid.map(row=>
    row.widestLeadSeconds)),Math.max(...valid.map(row=>
    row.widestLeadSeconds))]:null,
  meanWidestLeadSeconds:valid.length?valid.reduce((sum,row)=>
    sum+row.widestLeadSeconds,0)/valid.length:null};
process.stdout.write(`${JSON.stringify({summary})}\n`);
if(summary.refused)process.exitCode=1;
