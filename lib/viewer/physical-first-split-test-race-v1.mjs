import {prepareV91Playtest} from '../engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../engine/v2/physical-first-whole-race-probe-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../engine/v2/physical-first-whole-race-replay-v1.mjs';
import {calibratePhysicalFirstFinishV1} from
  '../engine/v2/physical-first-finish-calibration-v1.mjs';
import {CLUB_PALETTES,KIT_PATTERNS,defaultKit} from
  '../riders/club-kit.mjs';
import {adaptSplitPhysicalFirstRaceV1} from
  './physical-first-split-adapter-v1.mjs';
import {createHash} from 'node:crypto';

// Fixed, current Motor Lab inputs. This remains an experimental race,
// separate from guided recordings and official results.
const cache=new Map();
const CACHE_LIMIT=8;
export function createPhysicalFirstSplitViewerTestRaceV1(
  category='men',{chase='selective',terrain='mountain',
    attack='none',seed='preview-recorded-road-1'}={}){
  if(!['men','women'].includes(category))
    throw new Error('Choose a valid test field category.');
  if(!['selective','all'].includes(chase))
    throw new Error('Choose a valid test chase order.');
  if(!['flat','rolling','mountain'].includes(terrain)||
    !['none','selective','repeated'].includes(attack)||
    typeof seed!=='string'||!(/^[A-Za-z0-9-]{1,64}$/).test(seed))
    throw new Error('Choose a valid test profile, attack and seed.');
  const cacheKey=JSON.stringify({category,chase,terrain,attack,seed});
  if(cache.has(cacheKey)){
    const saved=cache.get(cacheKey);
    cache.delete(cacheKey);
    cache.set(cacheKey,saved);
    return saved;
  }
  const settings={distanceKm:120,teamCount:15,
    gender:category==='men'?'M':'F',
    terrain,fatigue:0,attack,chase,seed};
  const defaultInputs=chase==='selective'&&terrain==='mountain'&&
    attack==='none'&&seed==='preview-recorded-road-1';
  const variantId=defaultInputs?'':`-${createHash('sha256')
    .update(cacheKey).digest('hex').slice(0,12)}`;
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({teamId:team.id,
      goal:team.id==='you'?'summit_attack':'none',
      captainId:team.orders.captainId}));
  const rivalGoals=Array.from({length:14},
    (_,index)=>({teamId:`rival-${index+1}`,
      role:'protect'}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals,ownFrontWork:'rotate',
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,
    pelotonDraftCostVersion:1,
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
  if(replay.validatedKm!==120||
    replay.validatedRiderKm!==120*120)
    throw new Error('Split viewer test race did not replay every rider-kilometre.');
  const teamStyles=teams.map(team=>{
    const kit=defaultKit(team.id);
    const palette=CLUB_PALETTES[kit.palette];
    const pattern=KIT_PATTERNS[kit.pattern];
    return {id:team.id,name:team.name,
      color:palette.primary,accent:palette.accent,
      pattern:'paths',paths:[...pattern.paths]};
  });
  const exportResult=adaptSplitPhysicalFirstRaceV1({
    race,kilometres,teams,teamStyles,
    raceId:`motor-lab-physical-120km-${category}-seed1${variantId}`,
    category});
  const calibration=calibratePhysicalFirstFinishV1(
    recording,race);
  const result={...exportResult,coverage:{...exportResult.coverage,
    sameSeedFinishMismatches:calibration.mismatchCount,
    maxFinishMismatchSeconds:
      calibration.maxAbsoluteMismatchSeconds}};
  cache.set(cacheKey,result);
  if(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value);
  return result;
}
