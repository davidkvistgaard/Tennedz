import {prepareV91Playtest} from '../engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../engine/v2/physical-first-whole-race-probe-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../engine/v2/physical-first-whole-race-replay-v1.mjs';
import {CLUB_PALETTES,KIT_PATTERNS,defaultKit} from
  '../riders/club-kit.mjs';
import {adaptConnectedPhysicalFirstRaceV1} from
  './physical-first-adapter-v1.mjs';

// Fixed Motor Lab seed, generated from the current committed engine inputs.
// Neither historical source frames nor their gaps supply display positions.
export function createPhysicalFirstViewerTestRaceV1(category='men'){
  if(!['men','women'].includes(category))
    throw new Error('Choose a valid test field category.');
  const settings={distanceKm:40,teamCount:4,
    gender:category==='men'?'M':'F',
    terrain:'flat',fatigue:0,attack:'none',
    chase:'selective',seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({teamId:team.id,
      goal:'sprint_finish',captainId:team.orders.captainId}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals:Array.from({length:3},(_,index)=>({
      teamId:`rival-${index+1}`,role:'protect'})),
    ownFrontWork:'rotate',roadGroupPaceVersion:3,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,
    roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const {teams,rivalIntent}=recording.committedInputs;
  const kilometres=recording.route.kilometres;
  const riders=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,roadId:'peloton',
    distanceM:0,clockSeconds:0,
    reserve:replayRearEnergyCapV1({
      rider,kilometres,throughKm:0}).initialCap,
    quietKm:0})));
  const start={sourceKm:0,
    roads:[{roadId:'peloton',
      riderIds:riders.map(row=>row.riderId),
      clockSeconds:0}],riders};
  const input={start,kilometres,teams,
    stakes:rivalIntent,raceSeed:recording.raceSeed};
  const race=runPhysicalFirstWholeRaceProbeV1(input);
  const replay=replayPhysicalFirstWholeRaceV1(input,race);
  if(replay.validatedRiderKm!==32*40)
    throw new Error('Viewer test race did not replay every rider-kilometre.');
  const teamStyles=teams.map(team=>{
    const kit=defaultKit(team.id);
    const palette=CLUB_PALETTES[kit.palette];
    const pattern=KIT_PATTERNS[kit.pattern];
    return {id:team.id,name:team.name,
      color:palette.primary,accent:palette.accent,
      pattern:'paths',paths:[...pattern.paths]};
  });
  return adaptConnectedPhysicalFirstRaceV1({
    race,kilometres,teams,teamStyles,
    raceId:`motor-lab-physical-40km-${category}-seed1`,
    category});
}
