// Read-only same-seed holdout for the opt-in shared bunch-front road clock.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
    const row={seed,terrain,fatigue};
    for(const [name,versions] of [
      ['legacy',{}],
      ['separate',{chaseTurnVersion:1,bunchFrontTurnVersion:1}],
      ['shared',{chaseTurnVersion:1,bunchFrontTurnVersion:1,
        pelotonFrontTurnVersion:1}],
    ])try{
      const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
        settings,...versions});
      row[name]={status:'replayed',
        maxLead:preview.story.widestRecordedLead.gapSeconds,
        finalRoadGroups:recording.frames.at(-1).roadGroups.length,
        simultaneousKm:name==='shared'?recording.frames.filter(frame=>
          frame.chaseTurnPlan.status==='worked'&&frame.paidBunchPace).length:
          null};
    }catch(error){
      row[name]={status:'refused',reason:error.message};
    }
    rows.push(row);
  }
console.log(JSON.stringify(rows));
