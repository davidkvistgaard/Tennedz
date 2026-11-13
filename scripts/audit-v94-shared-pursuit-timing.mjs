// Read-only diagnosis of when the opt-in physical chase first pays work.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const rows=[];
for(let seed=1;seed<=4;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const settings={distanceKm:120,teamCount:20,terrain,fatigue,
      attack:'none',chase:'selective',
      seed:`chase-turn-holdout-${seed}-${terrain}-${fatigue}`};
    let recording,preview;
    try{({recording,preview}=createV94RaceDynamicsPreview({
      format:'one_day',settings,roadGroupPaceVersion:3,
      chaseTurnVersion:1,bunchFrontTurnVersion:1,
      pelotonFrontTurnVersion:1}));}
    catch(error){rows.push({seed,terrain,fatigue,status:'refused',
      reason:error.message});continue;}
    const firstFront=recording.frames.find(frame=>frame.roadGroups.length);
    const firstPaidChase=recording.frames.find(frame=>
      frame.km>=firstFront.km&&frame.chasePower>0&&
      frame.roadGroups.length);
    rows.push({seed,terrain,fatigue,
      firstFrontKm:firstFront.km,
      firstPaidChaseKm:firstPaidChase?.km??null,
      gapAtFirstChase:firstPaidChase?.roadGroups[0]?.gapSeconds??null,
      remainingAtFirstChase:firstPaidChase?120-firstPaidChase.km:null,
      paidChaseKm:recording.frames.filter(frame=>frame.chasePower>0).length,
      maxLead:preview.story.widestRecordedLead.gapSeconds,
      finalFrontGap:recording.frames.at(-1).roadGroups[0]?.gapSeconds??0});
  }
console.log(JSON.stringify(rows));
