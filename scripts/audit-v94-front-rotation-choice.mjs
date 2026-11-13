// Read-only paired preview audit. createV94RaceDynamicsPreview validates and
// source-replays each complete recording before returning its road evidence.
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';

const seeds=['sample-flat-finish','preview-boundary-1',
  'preview-boundary-2','preview-boundary-3'];
const rows=[];
for(const seed of seeds)for(const format of ['one_day','stage'])
  for(const terrain of ['flat','mountain']){
    const scenario={seed,format,terrain};
    const policies=[];
    for(const frontRotationVersion of [1,3]){
      const {preview}=createV94RaceDynamicsPreview({format,
        frontRotationVersion,settings:{distanceKm:260,terrain,
          teamCount:20,gender:'M',fatigue:terrain==='mountain'?30:0,
          effort:'steady',attack:'none',chase:'selective',seed}});
      policies.push({frontRotationVersion,
        widestLeadSeconds:preview.story.widestRecordedLead.gapSeconds,
        kilometresAtOrAboveOneMinute:
          preview.story.kilometresAtOrAboveOneMinute,
        paidFrontRiderKm:preview.frames.reduce((sum,frame)=>
          sum+frame.frontWorkers.length,0),
        finalRecordedLeadSeconds:preview.story.finalRecordedLeadSeconds});
    }
    rows.push({...scenario,policies});
    process.stdout.write(`${JSON.stringify(rows.at(-1))}\n`);
  }
process.stdout.write(`${JSON.stringify({summary:{pairedCases:rows.length,
  activeAtOrAboveOneMinute:rows.filter(row=>row.policies[0]
    .kilometresAtOrAboveOneMinute>0).length,
  economyAtOrAboveOneMinute:rows.filter(row=>row.policies[1]
    .kilometresAtOrAboveOneMinute>0).length}})}\n`);
