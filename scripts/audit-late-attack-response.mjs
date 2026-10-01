import {flatScenario} from '../lib/race-lab/scenario.mjs';
import {runKilometreLab} from '../lib/engine/v2/lab.mjs';

const seedCount=Number(process.argv[2]??20);
if(!Number.isInteger(seedCount)||seedCount<1||seedCount>200)
 throw new Error('Choose 1-200 scenario seeds.');

// Every paired run uses the same fictional cast, coast route and weather seed.
// This probes whether more teams chasing can counter Amber's late move; the
// last case also removes opposing attacks, so it is a different road contest.
const responses=['fixture','birch_all','all_chase','all_chase_no_opponent_attacks'];
const report={kind:'fictional-late-attack-response-audit',seedCount,responses:{}};
for(const response of responses){
 let amberWins=0,opponentChaseTeamKm=0,amberAttackAttempts=0;
 for(let seed=0;seed<seedCount;seed++){
  const scenario=flatScenario('break');
  Object.assign(scenario.teams[0],{attackPosture:'none',phaseAtKm:120,
   phaseAttack:'selective'});
  if(response==='birch_all')scenario.teams[1].chaseContribution='all';
  if(response==='all_chase'||response==='all_chase_no_opponent_attacks')
   for(const team of scenario.teams.slice(1)){
    team.chaseContribution='all';
    if(response==='all_chase_no_opponent_attacks')team.attackPosture='none';
   }
  const race=runKilometreLab({scenario,seed:`guided-preview:${seed}`});
  amberWins+=Number(race.provisionalResults[0].teamId==='team-0');
  opponentChaseTeamKm+=race.frames.reduce((sum,frame)=>sum+
   frame.chasers.filter(teamId=>teamId!=='team-0').length,0);
  amberAttackAttempts+=race.frames.reduce((sum,frame)=>sum+
   frame.attackers.filter(riderId=>riderId.startsWith('r-0-')).length,0);
 }
 report.responses[response]={amberWins,
  meanOpponentChaseTeamKm:+(opponentChaseTeamKm/seedCount).toFixed(1),
  meanAmberAttackAttempts:+(amberAttackAttempts/seedCount).toFixed(1)};
}
console.log(JSON.stringify(report,null,2));
