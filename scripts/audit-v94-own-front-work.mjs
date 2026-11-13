// Read-only paired audit of an explicit manager bunch-front order in the
// experimental preview. Every race validates and source-replays first.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const outcomes=[];
for(const seed of ['own-front-1','own-front-2','own-front-3'])
  for(const format of ['one_day','stage'])
    for(const terrain of ['flat','mountain']){
      const settings={distanceKm:260,terrain,teamCount:20,gender:'M',
        fatigue:terrain==='mountain'?30:0,effort:'steady',attack:'none',
        chase:'ignore',seed};
      const pair=[];
      for(const ownFrontWork of ['none','rotate']){
        const {preview}=createV94RaceDynamicsPreview({format,settings,
          ownFrontWork});
        const frontKm=preview.frames.filter(frame=>
          frame.paidBunchPace?.teamId==='you').length;
        const chaseKm=preview.frames.filter(frame=>
          frame.chasers.includes('you')).length;
        const energyKm210=preview.frames[209].teamEnergy.find(row=>
          row.teamId==='you').mean;
        pair.push({ownFrontWork,frontKm,chaseKm,energyKm210,
          widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds});
      }
      outcomes.push({seed,format,terrain,pair});
      process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
    }
for(const format of ['one_day','stage'])for(const ownFrontWork of
  ['none','rotate']){
  const rows=outcomes.filter(row=>row.format===format).map(row=>
    row.pair.find(choice=>choice.ownFrontWork===ownFrontWork));
  process.stdout.write(`${JSON.stringify({summary:{format,ownFrontWork,
    cases:rows.length,meanFrontKm:rows.reduce((sum,row)=>
      sum+row.frontKm,0)/rows.length,
    meanEnergyKm210:rows.reduce((sum,row)=>
      sum+row.energyKm210,0)/rows.length,
    meanWidestLeadSeconds:rows.reduce((sum,row)=>
      sum+row.widestLeadSeconds,0)/rows.length}})}\n`);
}
