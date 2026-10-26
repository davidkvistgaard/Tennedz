import {createV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {resolveRandomRivalTactics} from '../lib/engine/v2/playtest-rival-random.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function audit({seed,terrain,fatigue}){
  const managerTactics=resolveRandomRivalTactics({teamCount:20,
    random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
  const {recording}=createV91Playtest({distanceKm:260,terrain,teamCount:20,
    fatigue,attack:'none',seed,managerTactics});
  const frames=recording.frames;
  const gaps=frames.map(frame=>frame.gapSeconds);
  return {seed,terrain,fatigue,teamCount:20,distanceKm:260,
    attackAttempts:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    joinedAttackers:frames.reduce((sum,frame)=>sum+frame.joinedBreakawayRiderIds.length,0),
    caughtRiders:frames.reduce((sum,frame)=>sum+frame.caughtBreakawayRiderIds.length,0),
    maxFrontRiders:Math.max(...frames.map(frame=>frame.roadGroups[0]?.riderIds.length??0)),
    maxGapSeconds:Math.max(...gaps),
    kilometresOverOneMinute:gaps.filter(gap=>gap>=60).length,
    kilometresOverFiveMinutes:gaps.filter(gap=>gap>=300).length,
    finalGapSeconds:gaps.at(-1)};
}

const seeds=['sample-flat-finish','race-dynamics-1','race-dynamics-2'];
const rows=[];
for(const terrain of ['flat','mountain'])for(const fatigue of [0,30])
  for(const seed of seeds)rows.push(audit({seed,terrain,fatigue}));
console.log(JSON.stringify({version:'v91-read-only-breakaway-audit-1',
  note:'These inputs do not encode one-day versus stage-race format. No official result is inferred.',
  rows},null,2));
