// Read-only coverage inventory; a paid energy entry is not a rider decision.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const requestedSeeds=process.argv.find(arg=>arg.startsWith('--seeds='));
const seedCount=requestedSeeds?Number(requestedSeeds.slice(8)):1;
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>8)
  throw new Error('Decision coverage seeds must be between 1 and 8.');
const results=[];
for(let seed=1;seed<=seedCount;seed++)
  for(const distanceKm of [120,260])for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
  const settings={distanceKm,teamCount:20,terrain,fatigue,
    attack:'none',chase:'selective',
    seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
  let recording;
  try{
    ({recording}=createV94RaceDynamicsPreview({format:'one_day',
      settings,roadGroupPaceVersion:3,chaseTurnVersion:1,
      bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1}));
  }catch(error){
    if(!String(error.message).includes('Combined fresh attack and paid pursuit'))
      throw error;
    results.push({seed,distanceKm,terrain,fatigue,
      refusal:error.message});
    continue;
  }
  const coverage={riderKilometres:0,paidEnergyRows:0,
    forwardDecisionRows:0,forwardRiderKilometres:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0};
  for(const frame of recording.frames){
    const count=frame.riderGroups.length;
    if(count!==160||frame.energyLedger.length!==count)
      throw new Error('Rider coverage source is incomplete.');
    coverage.riderKilometres+=count;
    coverage.paidEnergyRows+=frame.energyLedger.length;
    coverage.forwardDecisionRows+=frame.roadGroupRiderDecisions.length;
    const decisions=new Set(frame.roadGroupRiderDecisions.map(row=>row.riderId));
    if(decisions.size!==frame.roadGroupRiderDecisions.length)
      throw new Error('Duplicate forward rider decision.');
    for(const rider of frame.riderGroups){
      if(rider.group==='breakaway'||rider.group==='front')
        coverage.forwardRiderKilometres++;
      else if(rider.group==='peloton')coverage.pelotonRiderKilometres++;
      else if(rider.group==='dropped'){
        coverage.droppedRiderKilometres++;
        if(decisions.has(rider.id))coverage.droppedDecisionRows++;
      }
    }
  }
  results.push({seed,distanceKm,terrain,fatigue,coverage});
}
if(process.argv.includes('--summary')){
  const totals={seedCount,cases:results.length,
    validatedCases:0,refusedCases:0,riderKilometres:0,
    paidEnergyRows:0,forwardDecisionRows:0,
    pelotonRiderKilometres:0,droppedRiderKilometres:0,
    droppedDecisionRows:0};
  for(const row of results){
    if(row.refusal){totals.refusedCases++;continue;}
    totals.validatedCases++;
    for(const key of ['riderKilometres','paidEnergyRows',
      'forwardDecisionRows','pelotonRiderKilometres',
      'droppedRiderKilometres','droppedDecisionRows'])
      totals[key]+=row.coverage[key];
  }
  console.log(JSON.stringify(totals));
}else console.log(JSON.stringify(results));
