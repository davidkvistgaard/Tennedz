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
const mode=process.argv[4]??'sprint_control';
const profile=process.argv[5]??'hill_then_mountain';
if(!['men','women'].includes(category)||
  !['sprint_control','selective_attack'].includes(mode)||
  !['hill','alternating','hill_then_mountain']
    .includes(profile)||
  !/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Supply a category, bounded seed, mode and profile.');
const request=prepareSyntheticPositionCatchV1({
  teamCount:15,riderCount:120,kmCount:120,
  profile,
  oneTimeAttack:mode==='selective_attack',
  raceSeed:seed});
request.input.positionPassingCorridorCount=1;
if(mode==='sprint_control')
  request.input.teams[0].orders.baseline.attack='none';
for(const stake of request.input.stakes)
  stake.sportingGoal=mode==='selective_attack'&&
    stake.teamId===request.input.teams[0].id?
      'break_stage':'sprint_finish';
const gender=category==='men'?'M':'F';
for(const [teamIndex,team] of
  request.input.teams.entries()){
  const starter=starterPack(seedrandom(
    `v7-starter-control:${seed}:${teamIndex}`))
    .filter(row=>row.gender===gender);
  if(starter.length!==team.riders.length)
    throw new Error('Starter profile field is incomplete.');
  for(const [index,rider] of team.riders.entries()){
    delete rider.acceleration;
    delete rider.positioning;
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
const sectionBytes=Object.fromEntries(
  Object.entries(race).map(([key,value])=>
    [key,Buffer.byteLength(JSON.stringify(value))]));
const riderIndex=new Map(request.input.start.riders
  .map((row,index)=>[row.riderId,index]));
const packedSteps=race.steps.map(step=>({
  ...step,sharedRoad:{...step.sharedRoad,
    contactEvents:undefined,
    contactEventsPacked:step.sharedRoad.contactEvents.map(event=>{
      const groups=event.components;
      if(event.version!==step.sharedRoad.version||
        event.type!=='paid_contact_topology_observation'||
        event.sourceKm!==step.sourceKm||
        groups.length>255||groups.some(group=>
        !Array.isArray(group)||group.length>255||
        group.some(id=>!riderIndex.has(id))))
        throw new Error('Contact topology cannot be packed.');
      const bytes=[groups.length,
        ...groups.map(group=>group.length),
        ...groups.flatMap(group=>group.map(id=>
          riderIndex.get(id)))];
      return [event.observedAtClockSeconds,
        event.observedAfterPaidStepSeconds,
        Buffer.from(bytes).toString('base64')];
    })}}));
const packedRecordBytes=Buffer.byteLength(
  JSON.stringify({request,race:{...race,
    steps:packedSteps,contactEvents:undefined,
    checkpointCrossings:undefined}}));
console.log(JSON.stringify({
  version:'v7-starter-roster-tie-control-1',
  source:'synthetic_event_game_starter_sporting_profiles',
  category,seed,mode,profile,
  elapsedMs:Date.now()-started,
  decisions:race.decisionCount,
  finishers:race.finishCrossings.length,
  attackDepartures:race.attackDepartureEvents.length,
  paidContactEvents:race.contactEvents.length,
  finaleFrames:race.tail.positionFrames.length,
  motorRecordBytes:Buffer.byteLength(
    JSON.stringify({request,race})),
  sectionBytes,
  packedRecordBytes,
  paidSprintPasses:race.finaleSprintPassEvents.length,
  tieGroups:race.finaleFinishTieObservations.length,
  tiedRiders:tiedRiders.size,
  replayVerified:true,
  officialResults:race.officialResults,
}));
