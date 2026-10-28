// Same-source opt-in audit. No generated race is stored or routed to guided.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`bunch-front-holdout-${seed}-${terrain}-${fatigue}`};
    const row={seed,terrain,fatigue};
    for(const version of [0,1])try{
      const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
        settings,bunchFrontTurnVersion:version});
      row[`v${version}`]={status:'replayed',
        maxLead:preview.story.widestRecordedLead.gapSeconds,
        frontTurnKm:version?recording.frames.filter(frame=>
          frame.bunchFrontTurnPlan!==null).length:null,
        finalRoadGroups:recording.frames.at(-1).roadGroups.length};
    }catch(error){
      row[`v${version}`]={status:'refused',reason:error.message};
    }
    rows.push(row);
  }
console.log(JSON.stringify(rows));
