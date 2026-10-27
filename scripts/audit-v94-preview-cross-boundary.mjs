// Read-only cross-boundary audit: explicit team goals and opposing own orders.
// The preview validates and source-replays every successful whole race.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const outcomes=[];
const combinedOrder=process.argv.includes('--combined-order');
const orders=combinedOrder?
  [{effort:'steady',attack:'selective',chase:'selective'}]:
  [{effort:'steady',attack:'none',chase:'selective'},
    {effort:'hard',attack:'repeated',chase:'all'}];
const alternateRoutes=process.argv.includes('--alternate-routes');
const routes=alternateRoutes?
  [{terrain:'rolling',fatigue:15,gender:'F'},
    {terrain:'exposed',fatigue:30,gender:'F'}]:
  [{terrain:'flat',fatigue:0,gender:'M'},
    {terrain:'mountain',fatigue:30,gender:'M'}];
for(const seed of ['preview-cross-1','preview-cross-2'])
  for(const format of ['one_day','stage'])
    for(const {terrain,fatigue,gender} of routes){
      const base={distanceKm:260,terrain,teamCount:20,gender,
        fatigue,seed};
      const seeded=createV94RaceDynamicsPreview({format,
        settings:{...base,...orders[0]}}).preview;
      const rivals=seeded.teamPlans.filter(plan=>plan.teamId!=='you');
      const candidates=[...rivals.filter(plan=>plan.role==='control'),
        ...rivals.filter(plan=>plan.role!=='control'&&plan.role!=='break')];
      if(candidates.length<8)throw new Error('Insufficient control candidates.');
      for(const requestedControls of [0,1,8]){
        const selected=new Set(candidates.slice(0,requestedControls)
          .map(plan=>plan.teamId));
        const rivalGoals=rivals.map(plan=>({teamId:plan.teamId,
          role:selected.has(plan.teamId)?'control':
            plan.role==='control'?'protect':plan.role}));
        for(const order of orders){
          const scenario={seed,format,terrain,gender,fatigue,requestedControls,
            ownOrder:order.attack};
          try{
            const {preview}=createV94RaceDynamicsPreview({format,
              settings:{...base,...order},rivalGoals});
            outcomes.push({...scenario,ok:true,
              widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
              ownAttackKm:preview.frames.filter(frame=>frame.attackers.some(
                id=>id.startsWith('you-'))).length,
              ownChaseKm:preview.frames.filter(frame=>
                frame.chasers.includes('you')).length,
              ownOverlapKm:preview.frames.filter(frame=>
                frame.chasers.includes('you')&&frame.attackers.some(
                  id=>id.startsWith('you-'))).length,
              paidCoastKm:preview.frames.filter(frame=>
                frame.frontCoast.length>0).length,
              finalRoadGroups:preview.story.finalRoadGroups});
          }catch(error){outcomes.push({...scenario,ok:false,
            error:error.message,cause:error.cause??null});}
          process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
        }
      }
    }
const failed=outcomes.filter(row=>!row.ok);
for(const requestedControls of [0,1,8])for(const ownOrder of
  (combinedOrder?['selective']:['none','repeated'])){
  const rows=outcomes.filter(row=>row.ok&&
    row.requestedControls===requestedControls&&row.ownOrder===ownOrder);
  process.stdout.write(`${JSON.stringify({summary:{requestedControls,
    ownOrder,validated:rows.length,refused:failed.filter(row=>
      row.requestedControls===requestedControls&&
      row.ownOrder===ownOrder).length,
    coastCases:rows.filter(row=>row.paidCoastKm>0).length,
    meanOwnAttackKm:rows.length?rows.reduce((sum,row)=>
      sum+row.ownAttackKm,0)/rows.length:null,
    meanOwnChaseKm:rows.length?rows.reduce((sum,row)=>
      sum+row.ownChaseKm,0)/rows.length:null,
    ownOverlapKm:rows.reduce((sum,row)=>sum+row.ownOverlapKm,0),
    meanWidestLeadSeconds:rows.length?rows.reduce((sum,row)=>
      sum+row.widestLeadSeconds,0)/rows.length:null}})}\n`);
}
if(failed.length)process.exitCode=1;
