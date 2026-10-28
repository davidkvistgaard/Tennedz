// Read-only same-source holdout for the opt-in one-leader road-group version.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`paid-turn-holdout-${seed}-${terrain}-${fatigue}`};
    const row={seed,terrain,fatigue};
    for(const version of [2,3])try{
      const {recording,preview}=createV94RaceDynamicsPreview({format:'one_day',
        settings,roadGroupPaceVersion:version});
      row[`v${version}`]={status:'replayed',
        maxLead:preview.story.widestRecordedLead.gapSeconds,
        finalRoadGroups:recording.frames.at(-1).roadGroups.length,
        turns:version===3?recording.frames.reduce((sum,frame)=>sum+
          frame.roadGroupTurnPlans.reduce((sub,plan)=>sub+plan.turns.length,0),0):
          null};
    }catch(error){
      row[`v${version}`]={status:'refused',reason:error.message};
    }
    rows.push(row);
  }
console.log(JSON.stringify(rows));
