// Read-only boundary audit of exposed opening orders on long preview races.
// The preview boundary validates and source-replays each successful case.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const orders=[
  {effort:'conserve',attack:'none',chase:'ignore'},
  {effort:'steady',attack:'selective',chase:'selective'},
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'hard',attack:'repeated',chase:'all'},
];
const frontExhaustionVersion=process.argv.includes('--front-exhaustion-v4')?4:3;
const outcomes=[];
for(const format of ['one_day','stage'])for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30])for(const order of orders){
    const scenario={format,terrain,fatigue,...order};
    if(process.argv.includes('--only-last')&&
      !(format==='stage'&&terrain==='mountain'&&fatigue===30&&
        order.effort==='hard'&&order.attack==='repeated'))continue;
    try{
      const {preview}=createV94RaceDynamicsPreview({format,
        frontExhaustionVersion,settings:{
        distanceKm:260,terrain,teamCount:20,gender:'M',fatigue,
        seed:`preview-orders-${format}-${terrain}-${fatigue}`,...order}});
      outcomes.push({...scenario,frontExhaustionVersion,ok:true,
        widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
        ownEnergyAtLine:preview.frames.at(-1).ownRiders.map(row=>row.energy),
        frontCoastKm:preview.frames.filter(frame=>frame.frontCoast.length>0)
          .length});
    }catch(error){outcomes.push({...scenario,frontExhaustionVersion,
      ok:false,error:error.message,cause:error.cause??null});}
    process.stdout.write(`${JSON.stringify(outcomes.at(-1))}\n`);
  }
const refused=outcomes.filter(row=>!row.ok);
process.stdout.write(`${JSON.stringify({summary:{frontExhaustionVersion,
  cases:outcomes.length,
  validated:outcomes.length-refused.length,refused:refused.length}})}\n`);
if(refused.length)process.exitCode=1;
