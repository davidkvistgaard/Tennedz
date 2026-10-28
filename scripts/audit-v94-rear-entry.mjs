// Read-only source-replayed audit of rider transitions behind the bunch.
// A checkpoint deficit is not a physical position or proof of rear contact.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../lib/engine/v2/replay-race-dynamics-v94.mjs';

const summary={cases:0,newDrops:0,fromBunchWorkSameKm:0,
  fromBunchWorkPreviousKm:0,caughtBreakSameKm:0,
  caughtBreakPreviousKm:0,onClimbKmDrops:0,examples:[]};
for(let seed=1;seed<=8;seed++)for(const terrain of ['flat','mountain'])
  for(const fatigue of [0,30]){
    const {recording}=createV94RaceDynamicsPreview({format:'one_day',
      settings:{distanceKm:260,teamCount:20,attack:'none',chase:'selective',
        seed:`rear-entry-holdout-${seed}-${terrain}-${fatigue}`,
        terrain,fatigue}});
    replayRaceDynamicsRecording(recording);
    summary.cases++;
    for(let index=1;index<recording.frames.length;index++){
      const prior=recording.frames[index-1],frame=recording.frames[index];
      const priorDropped=new Set(prior.riderGroups.filter(row=>
        row.group==='dropped').map(row=>row.id));
      const currentWorkers=new Set([...(frame.paidBunchPace?.riderIds??[]),
        ...frame.hardBunchWorkRiderIds,...frame.steadyBunchWorkRiderIds]);
      const priorWorkers=new Set([...(prior.paidBunchPace?.riderIds??[]),
        ...prior.hardBunchWorkRiderIds,...prior.steadyBunchWorkRiderIds]);
      for(const rider of frame.riderGroups.filter(row=>
        row.group==='dropped'&&!priorDropped.has(row.id))){
        summary.newDrops++;
        if(currentWorkers.has(rider.id))summary.fromBunchWorkSameKm++;
        if(priorWorkers.has(rider.id))summary.fromBunchWorkPreviousKm++;
        if(frame.caughtBreakawayRiderIds.includes(rider.id))
          summary.caughtBreakSameKm++;
        if(prior.caughtBreakawayRiderIds.includes(rider.id))
          summary.caughtBreakPreviousKm++;
        if(frame.terrain==='climb'||frame.terrain==='mountain')
          summary.onClimbKmDrops++;
        if(summary.examples.length<12)summary.examples.push({seed,terrain,
          fatigue,km:frame.km,kmTerrain:frame.terrain,riderId:rider.id,
          deficitSeconds:rider.deficitSeconds,
          priorDeficitSeconds:prior.riderGroups.find(row=>
            row.id===rider.id)?.deficitSeconds??null,
          bunchWorkSameKm:currentWorkers.has(rider.id),
          caughtSameKm:frame.caughtBreakawayRiderIds.includes(rider.id)});
      }
    }
  }
console.log(JSON.stringify(summary));
