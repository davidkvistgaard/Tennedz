// Read-only, controlled V7 finish diagnostic. The strength variant is
// deliberately synthetic; it is never a source of game rider ratings.
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';

const seed=process.argv[2]??'tie-ability-diagnostic-1';
if(!/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Supply a bounded diagnostic seed.');
const base=prepareSyntheticPositionCatchV1({
  teamCount:15,kmCount:120,
  profile:'hill_then_mountain',
  oneTimeAttack:false,raceSeed:seed});
base.input.positionPassingCorridorCount=1;
base.input.teams[0].orders.baseline.attack='none';
for(const stake of base.input.stakes)
  stake.sportingGoal='sprint_finish';

for(const variant of ['identical','distinct']){
  const request=structuredClone(base);
  if(variant==='distinct'){
    const riders=request.input.teams.flatMap(team=>
      team.riders);
    riders.forEach((rider,index)=>{
      const delta=(index+1)*.006;
      for(const key of ['flat','hills',
        'mountain','sprint'])rider[key]+=delta;
    });
    const byId=new Map(riders.map(rider=>
      [rider.id,rider]));
    for(const row of request.input.start.riders)
      row.reserve=replayRearEnergyCapV1({
        rider:byId.get(row.riderId),
        kilometres:request.input.kilometres,
        throughKm:0}).initialCap;
  }
  const race=recordPhysicalFirstPositionGeneralRaceV7(
    request);
  if(race.completedThroughKm!==120||
    race.decisionCount!==14_400||
    race.finishCrossings.length!==120)
    throw new Error('The diagnostic race is incomplete.');
  const tiedRiders=new Set(
    race.finaleFinishTieObservations.flatMap(row=>
      row.riderIds));
  console.log(JSON.stringify({
    diagnosticVersion:'v7-finish-tie-strength-probe-1',
    seed,variant,source:'synthetic_control',
    strengthDelta:variant==='distinct'?
      'index times 0.006 in flat/hills/mountain/sprint':
      'none',
    decisions:race.decisionCount,
    finishers:race.finishCrossings.length,
    tieGroups:race.finaleFinishTieObservations.length,
    tiedRiders:tiedRiders.size,
    paidSprintPasses:
      race.finaleSprintPassEvents.length,
    officialResults:race.officialResults,
  }));
}
