// Offline paired diagnostic for the first planned attack-from-break rule.
// This fixed cast is useful for regressions, not a balance target for the game.
import {flatScenario} from '../lib/race-lab/scenario.mjs';
import {runKilometreLab} from '../lib/engine/v2/lab.mjs';

const samples=process.argv[2]===undefined?50:Number(process.argv[2]);
const attackAtKm=process.argv[3]===undefined?40:Number(process.argv[3]);
if(!Number.isInteger(samples)||samples<1||samples>500||
  !Number.isInteger(attackAtKm)||attackAtKm<10||attackAtKm>150||attackAtKm%10!==0)
  throw new Error('Usage: node scripts/engine-v2-break-split.mjs [paired samples: 1–500] [attack marker: 10–150, multiple of 10]');

const summary={pairedSamples:samples,attackAtKm,
  description:'fictional fixed Race Lab cast; no live data',
  plannedAttacks:0,outcomeCounts:{},splits:0,contained:0,otherOutcomes:0,mergeEvents:0,
  splitGroupKilometres:0,splitSurvivalsToFinish:0,attackerCaughtWithinFiveKm:0,
  baselineAmberWins:0,plannedAmberWins:0,baselineAmberPodiums:0,plannedAmberPodiums:0,
  changedWinners:0,attackerMeanFinalEnergyDelta:0};

for(let sample=0;sample<samples;sample++){
  const seed=`break-split:${sample}`;
  const scenario=flatScenario('break');
  const attackerId=scenario.teams[0].captainId;
  const baseline=runKilometreLab({scenario,seed});
  const plannedScenario=structuredClone(scenario);
  plannedScenario.teams[0].breakAttackAtKm=attackAtKm;
  const planned=runKilometreLab({scenario:plannedScenario,seed});
  const firstAttempt=planned.frames.find(frame=>frame.splitAttack?.riderId===attackerId);
  summary.plannedAttacks+=Number(Boolean(firstAttempt));
  const outcome=firstAttempt?.splitAttack.status??'no_attempt';
  summary.outcomeCounts[outcome]=(summary.outcomeCounts[outcome]??0)+1;
  summary.splits+=Number(firstAttempt?.splitAttack.status==='split');
  summary.contained+=Number(firstAttempt?.splitAttack.status==='contained');
  summary.otherOutcomes+=Number(Boolean(firstAttempt)&&
    !['split','contained'].includes(firstAttempt.splitAttack.status));
  summary.mergeEvents+=planned.frames.reduce((total,frame)=>total+frame.mergedRoadGroupIds.length,0);
  summary.splitGroupKilometres+=planned.frames.filter(frame=>frame.roadGroups.length===2).length;
  summary.splitSurvivalsToFinish+=Number(planned.frames.at(-1).roadGroups.length===2);
  if(firstAttempt?.splitAttack.status==='split'){
    const caughtSoon=planned.frames.slice(firstAttempt.km-1,firstAttempt.km+5)
      .some(frame=>frame.caughtBreakawayRiderIds.includes(attackerId));
    summary.attackerCaughtWithinFiveKm+=Number(caughtSoon);
  }
  const bestPosition=race=>Math.min(...race.provisionalResults
    .filter(result=>result.teamId===scenario.teams[0].id).map(result=>result.position));
  summary.baselineAmberWins+=Number(bestPosition(baseline)===1);
  summary.plannedAmberWins+=Number(bestPosition(planned)===1);
  summary.baselineAmberPodiums+=Number(bestPosition(baseline)<=3);
  summary.plannedAmberPodiums+=Number(bestPosition(planned)<=3);
  summary.changedWinners+=Number(baseline.provisionalResults[0].riderId!==
    planned.provisionalResults[0].riderId);
  summary.attackerMeanFinalEnergyDelta+=planned.provisionalResults.find(result=>
    result.riderId===attackerId).energy-baseline.provisionalResults.find(result=>
    result.riderId===attackerId).energy;
  summary.tuningVersion=planned.tuningVersion;
}

summary.meanSplitGroupKilometres=+(summary.splitGroupKilometres/samples).toFixed(2);
summary.attackerMeanFinalEnergyDelta=+(summary.attackerMeanFinalEnergyDelta/samples).toFixed(2);
console.log(JSON.stringify(summary,null,2));
