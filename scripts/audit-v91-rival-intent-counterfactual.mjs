// Read-only counterfactual: apply two pre-race rival plans to the same live
// kilometre motor. This does not route the internal v94 dynamics to the UI.
import {createV91Playtest,prepareV91Playtest} from
  '../lib/engine/v2/playtest.mjs';
import {resolveRandomRivalTactics} from
  '../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV94RivalIntent} from
  '../lib/engine/v2/playtest-rival-intent-v94.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function summarize(recording){
  const frames=recording.frames;
  return {attacks:frames.reduce((sum,frame)=>sum+frame.attackers.length,0),
    maxGapSeconds:Math.max(...frames.map(frame=>frame.gapSeconds)),
    kmOver60Seconds:frames.filter(frame=>frame.gapSeconds>=60).length,
    kmOver300Seconds:frames.filter(frame=>frame.gapSeconds>=300).length,
    finalGapSeconds:frames.at(-1).gapSeconds};
}

const rows=[];
for(const terrain of ['flat','mountain'])for(const fatigue of [0,30])
  for(const seed of ['sample-flat-finish','race-dynamics-1','race-dynamics-2']){
    const input={distanceKm:260,terrain,teamCount:20,fatigue,
      attack:'none',seed};
    const random=resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
    const planned=prepareV94RivalIntent({prepared:prepareV91Playtest(input),
      format:'one_day'});
    const intent=planned.teams.slice(1).map(team=>({...team.orders.baseline}));
    const actual=createV91Playtest({...input,managerTactics:random});
    const counterfactual=createV91Playtest({...input,managerTactics:intent});
    rows.push({terrain,fatigue,seed,
      randomBreakTeams:random.filter(row=>row.attack!=='none').length,
      plannedBreakTeams:intent.filter(row=>row.attack!=='none').length,
      current:summarize(actual.recording),
      plannedOrdersOnLiveMotor:summarize(counterfactual.recording)});
  }
console.log(JSON.stringify({version:'v91-rival-intent-counterfactual-1',
  note:'Synthetic intent changes only pre-race orders; live 1 km physics is unchanged. No official result is inferred.',
  rows},null,2));
