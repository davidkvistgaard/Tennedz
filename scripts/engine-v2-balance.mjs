// Offline, deterministic diagnostics for the isolated kilometre prototype.
// This uses only the fictional Race Lab cast; it never reads game accounts.
import {runKilometreLab} from '../lib/engine/v2/lab.mjs';
import {flatScenario,STRATEGIES} from '../lib/race-lab/scenario.mjs';

const count=process.argv[2]===undefined?100:Number(process.argv[2]);
if(!Number.isInteger(count)||count<1||count>1000)
  throw new Error('Usage: node scripts/engine-v2-balance.mjs [seed count: 1–1000]');

const report={seeds:count,scenario:'fixed fictional Coast Road cast',strategies:{}};
for(const strategy of Object.keys(STRATEGIES)){
  const totals={amberWins:0,amberPodiums:0,amberBestPosition:0,amberMeanEnergy:0,
    breakawayWins:0,breakawayFinishers:0,droppedFinishers:0,attackAttempts:0,
    breakAdmissions:0,finalGapPositive:0};
  for(let index=0;index<count;index++){
    const race=runKilometreLab({scenario:flatScenario(strategy),seed:`v2-balance-${index}`});
    report.tuningVersion??=race.tuningVersion;
    const amber=race.provisionalResults.filter(rider=>rider.teamId==='team-0');
    const best=Math.min(...amber.map(rider=>rider.position));
    totals.amberWins+=Number(best===1);
    totals.amberPodiums+=Number(best<=3);
    totals.amberBestPosition+=best;
    totals.amberMeanEnergy+=amber.reduce((sum,rider)=>sum+rider.energy,0)/amber.length;
    totals.breakawayWins+=Number(race.provisionalResults[0].group==='breakaway');
    totals.breakawayFinishers+=race.provisionalResults.filter(rider=>rider.group==='breakaway').length;
    totals.droppedFinishers+=race.provisionalResults.filter(rider=>rider.group==='dropped').length;
    totals.finalGapPositive+=Number(race.frames.at(-1).gapSeconds>0);
    for(const frame of race.frames){
      totals.attackAttempts+=frame.attackers.length;
      totals.breakAdmissions+=frame.joinedBreakawayRiderIds.length;
    }
  }
  report.strategies[strategy]={
    amberWinRate:totals.amberWins/count,
    amberPodiumRate:totals.amberPodiums/count,
    amberMeanBestPosition:+(totals.amberBestPosition/count).toFixed(2),
    amberMeanEnergy:+(totals.amberMeanEnergy/count).toFixed(2),
    breakawayWinRate:totals.breakawayWins/count,
    finalGapRate:totals.finalGapPositive/count,
    meanBreakawayFinishers:+(totals.breakawayFinishers/count).toFixed(2),
    meanDroppedFinishers:+(totals.droppedFinishers/count).toFixed(2),
    meanAttackAttempts:+(totals.attackAttempts/count).toFixed(2),
    meanBreakAdmissions:+(totals.breakAdmissions/count).toFixed(2),
  };
}
console.log(JSON.stringify(report,null,2));
