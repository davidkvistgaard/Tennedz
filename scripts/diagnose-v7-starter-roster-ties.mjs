// Read-only V7 diagnostic using the game's starter sporting profiles.
// The riders and event are synthetic controls, not saved game entrants.
import seedrandom from 'seedrandom';
import {starterPack,skills} from '../lib/onboarding/starter.mjs';
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';

const category=process.argv[2]??'men';
const seed=process.argv[3]??
  `v7-starter-roster-${category}-1`;
if(!['men','women'].includes(category)||
  !/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Supply a category and bounded seed.');
const request=prepareSyntheticPositionCatchV1({
  teamCount:15,riderCount:120,kmCount:120,
  profile:'hill_then_mountain',
  oneTimeAttack:false,raceSeed:seed});
request.input.positionPassingCorridorCount=1;
request.input.teams[0].orders.baseline.attack='none';
for(const stake of request.input.stakes)
  stake.sportingGoal='sprint_finish';
const gender=category==='men'?'M':'F';
for(const [teamIndex,team] of
  request.input.teams.entries()){
  const starter=starterPack(seedrandom(
    `v7-starter-control:${seed}:${teamIndex}`))
    .filter(row=>row.gender===gender);
  if(starter.length!==team.riders.length)
    throw new Error('Starter profile field is incomplete.');
  for(const [index,rider] of team.riders.entries()){
    for(const key of skills)
      rider[key]=starter[index][key];
    rider.leadership=starter[index].leadership;
    rider.form=starter[index].form;
    rider.fatigue=starter[index].fatigue;
    rider.gender=gender;
  }
}
const byId=new Map(request.input.teams.flatMap(team=>
  team.riders.map(rider=>[rider.id,rider])));
for(const row of request.input.start.riders)
  row.reserve=replayRearEnergyCapV1({
    rider:byId.get(row.riderId),
    kilometres:request.input.kilometres,
    throughKm:0}).initialCap;
const started=Date.now();
const race=recordPhysicalFirstPositionGeneralRaceV7(
  request);
if(race.completedThroughKm!==120||
  race.decisionCount!==14_400||
  race.finishCrossings.length!==120)
  throw new Error('The starter-profile control is incomplete.');
replayPhysicalFirstPositionGeneralRaceV7(request,race);
const tiedRiders=new Set(
  race.finaleFinishTieObservations.flatMap(row=>
    row.riderIds));
console.log(JSON.stringify({
  version:'v7-starter-roster-tie-control-1',
  source:'synthetic_event_game_starter_sporting_profiles',
  category,seed,elapsedMs:Date.now()-started,
  decisions:race.decisionCount,
  finishers:race.finishCrossings.length,
  paidSprintPasses:race.finaleSprintPassEvents.length,
  tieGroups:race.finaleFinishTieObservations.length,
  tiedRiders:tiedRiders.size,
  replayVerified:true,
  officialResults:race.officialResults,
}));
