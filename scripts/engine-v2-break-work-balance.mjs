// Paired, offline diagnostic for the break-work trade-off in the Race Lab cast.
// It uses fictional riders and never reads accounts or production services.
import {runKilometreLab} from '../lib/engine/v2/lab.mjs';
import {flatScenario} from '../lib/race-lab/scenario.mjs';

const samples=process.argv[2]===undefined?100:Number(process.argv[2]);
if(!Number.isInteger(samples)||samples<1||samples>1000)
  throw new Error('Usage: node scripts/engine-v2-break-work-balance.mjs [paired samples: 1-1000]');

const report={pairedSamples:samples,
  scenario:'fictional 160 km Coast Road; Amber attacks against unchanged opponents',
  choices:{}};
for(const breakWork of ['cooperate','drive','sit_on']){
  const totals={wins:0,bestPosition:0,captainEnergy:0,finalLeadingGapSeconds:0,
    pullRiderKm:0,driveRiderKm:0};
  for(let sample=0;sample<samples;sample++){
    const scenario=flatScenario('break');
    scenario.teams[0].breakWork=breakWork;
    const race=runKilometreLab({scenario,seed:`v2-break-work-${sample}`});
    report.tuningVersion??=race.tuningVersion;
    const amber=race.provisionalResults.filter(rider=>rider.teamId==='team-0');
    const captain=race.frames.at(-1).riderGroups.find(rider=>rider.id==='r-0-0');
    const bestPosition=Math.min(...amber.map(rider=>rider.position));
    totals.wins+=Number(bestPosition===1);
    totals.bestPosition+=bestPosition;
    totals.captainEnergy+=captain.energy;
    totals.finalLeadingGapSeconds+=race.frames.at(-1).gapSeconds;
    for(const frame of race.frames){
      totals.pullRiderKm+=frame.pullRiderIds.filter(id=>id.startsWith('r-0-')).length;
      totals.driveRiderKm+=frame.driveRiderIds.filter(id=>id.startsWith('r-0-')).length;
    }
  }
  report.choices[breakWork]={winRate:totals.wins/samples,
    meanBestPosition:+(totals.bestPosition/samples).toFixed(2),
    meanCaptainEnergy:+(totals.captainEnergy/samples).toFixed(2),
    meanFinalLeadingGapSeconds:+(totals.finalLeadingGapSeconds/samples).toFixed(2),
    meanAmberPullRiderKm:+(totals.pullRiderKm/samples).toFixed(2),
    meanAmberDriveRiderKm:+(totals.driveRiderKm/samples).toFixed(2)};
}
console.log(JSON.stringify(report,null,2));
