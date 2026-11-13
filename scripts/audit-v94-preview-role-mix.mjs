// Read-only, same-source role-composition boundary for the experimental
// preview. Every case validates and replays before its road summary is used.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const controlCounts=[0,1,8];
const outcomes=[];
for(const seed of ['preview-role-mix-1','preview-role-mix-2'])
  for(const format of ['one_day','stage'])
    for(const terrain of ['flat','mountain']){
      const settings={distanceKm:260,terrain,teamCount:20,gender:'M',
        fatigue:terrain==='mountain'?30:0,effort:'steady',attack:'none',
        chase:'selective',seed};
      const seeded=createV94RaceDynamicsPreview({format,settings}).preview;
      const rivals=seeded.teamPlans.filter(plan=>plan.teamId!=='you');
      const candidates=[...rivals.filter(plan=>plan.role==='control'),
        ...rivals.filter(plan=>plan.role!=='control'&&plan.role!=='break')];
      if(candidates.length<8)throw new Error('Insufficient control candidates.');
      for(const requestedControls of controlCounts){
        const selected=new Set(candidates.slice(0,requestedControls)
          .map(plan=>plan.teamId));
        const rivalGoals=rivals.map(plan=>({teamId:plan.teamId,
          role:selected.has(plan.teamId)?'control':
            plan.role==='control'?'protect':plan.role}));
        try{
          const {preview,recording}=createV94RaceDynamicsPreview({
            format,settings,rivalGoals});
          const controls=new Set(preview.teamPlans.filter(plan=>
            plan.role==='control').map(plan=>plan.teamId));
          const controlEnergy=recording.frames[209].riderGroups.filter(row=>
            controls.has(row.teamId)).map(row=>row.energy);
          outcomes.push({seed,format,terrain,requestedControls,ok:true,
            breakTeams:preview.teamPlans.filter(plan=>plan.role==='break').length,
            widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
            controlChaseTeamKm:preview.frames.reduce((sum,frame)=>
              sum+frame.chasers.filter(id=>controls.has(id)).length,0),
            controlFrontTeamKm:preview.frames.filter(frame=>
              controls.has(frame.paidBunchPace?.teamId)).length,
            meanControlEnergyKm210:controlEnergy.length?
              controlEnergy.reduce((sum,value)=>sum+value,0)/
                controlEnergy.length:null});
        }catch(error){outcomes.push({seed,format,terrain,
          requestedControls,ok:false,error:error.message});}
        process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
      }
    }
const failed=outcomes.filter(row=>!row.ok);
for(const count of controlCounts)for(const format of ['one_day','stage']){
  const rows=outcomes.filter(row=>row.ok&&row.requestedControls===count&&
    row.format===format);
  process.stdout.write(`${JSON.stringify({summary:{requestedControls:count,
    format,validated:rows.length,refused:failed.filter(row=>
      row.requestedControls===count&&row.format===format).length,
    meanWidestLeadSeconds:rows.reduce((sum,row)=>
      sum+row.widestLeadSeconds,0)/rows.length,
    meanControlChaseTeamKm:count?rows.reduce((sum,row)=>
      sum+row.controlChaseTeamKm,0)/rows.length:null,
    meanControlFrontTeamKm:count?rows.reduce((sum,row)=>
      sum+row.controlFrontTeamKm,0)/rows.length:null,
    meanControlEnergyKm210:count?rows.reduce((sum,row)=>
      sum+row.meanControlEnergyKm210,0)/rows.length:null}})}\n`);
}
if(failed.length)process.exitCode=1;
