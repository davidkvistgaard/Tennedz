// Read-only, same-seed V94 versus paid physical road-clock diagnostic.
// Source gaps are compared as claims; they never become physical inputs.
import {prepareV91Playtest} from '../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {calibratePhysicalFirstFinishV1} from
  '../lib/engine/v2/physical-first-finish-calibration-v1.mjs';

const values=Object.fromEntries(process.argv.slice(2).map(argument=>{
  const match=/^--(category|terrain|chase|attack|seed)=(.+)$/.exec(argument);
  if(!match)throw new Error(`Unknown diagnostic option: ${argument}`);
  return [match[1],match[2]];
}));
const category=values.category??'men';
const terrain=values.terrain??'flat';
const chase=values.chase??'all';
const attack=values.attack??'none';
const seed=values.seed??'preview-recorded-road-1';
if(!['men','women'].includes(category)||
  !['flat','rolling','mountain'].includes(terrain)||
  !['selective','all'].includes(chase)||
  !['none','selective','repeated'].includes(attack)||
  !/^[A-Za-z0-9-]{1,64}$/.test(seed))
  throw new Error('Unknown diagnostic race variant.');
const settings={distanceKm:120,teamCount:15,
  gender:category==='men'?'M':'F',terrain,fatigue:0,
  attack,chase,seed};
const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
  teamId:team.id,goal:team.id==='you'?'summit_attack':'none',
  captainId:team.orders.captainId}));
const rivalGoals=Array.from({length:14},(_,index)=>({
  teamId:`rival-${index+1}`,role:'protect'}));
const {recording}=createV94RaceDynamicsPreview({
  format:'one_day',settings,sportingStakes,rivalGoals,
  ownFrontWork:'rotate',roadGroupPaceVersion:3,chaseTurnVersion:1,
  bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
  pelotonDraftCostVersion:1,pelotonExposureCostVersion:1,
  freshAttackDecisionVersion:1,roadGroupRiderDecisionVersion:1,
  protectorSportingPursuitVersion:1});
const {teams,rivalIntent}=recording.committedInputs;
const kilometres=recording.route.kilometres;
const riders=teams.flatMap(team=>team.riders.map(rider=>({
  riderId:rider.id,teamId:team.id,roadId:'peloton',
  distanceM:0,clockSeconds:0,
  reserve:replayRearEnergyCapV1({rider,kilometres,
    throughKm:0}).initialCap,quietKm:0})));
const start={sourceKm:0,roads:[{roadId:'peloton',
  riderIds:riders.map(row=>row.riderId),clockSeconds:0}],riders};
const probe=runPhysicalFirstWholeRaceProbeV1({start,kilometres,
  teams,stakes:rivalIntent,raceSeed:recording.raceSeed});
const finish=calibratePhysicalFirstFinishV1(recording,probe);
const firstPaidDrops=probe.steps.find(step=>
  step.peloton.startDropEvents.length);
const dropEvents=firstPaidDrops?.peloton.startDropEvents??[];
const EPS=.002;
const checkpointRows=recording.frames.map((frame,index)=>{
  const state=probe.states[index+1];
  if(frame.km!==state?.sourceKm)
    throw new Error('Source and paid checkpoints differ.');
  const breakLead=new Map(frame.roadGroups.flatMap(group=>
    group.riderIds.map(id=>[id,group.gapSeconds])));
  const source=new Map(frame.riderGroups.map(row=>[row.id,
    row.group==='peloton'?0:
      row.group==='dropped'?-row.deficitSeconds:
        breakLead.get(row.id)]));
  if(source.size!==frame.riderGroups.length||
    source.size!==state.riders.length)
    throw new Error(`Checkpoint ${frame.km} lacks complete riders.`);
  const comparisons=state.riders.map(row=>({
    riderId:row.riderId,
    claim:source.get(row.riderId),
    paid:state.frontClockSeconds-row.clockSeconds}));
  const invalid=comparisons.filter(row=>!Number.isFinite(row.claim));
  if(invalid.length)throw new Error(
    `Source checkpoint ${frame.km} lacks rider gaps: ${JSON.stringify({
      invalid:invalid.slice(0,3),
      sourceRows:frame.riderGroups.filter(row=>invalid.some(
        entry=>entry.riderId===row.id)).slice(0,3),
      roads:frame.roadGroups.map(row=>({id:row.id,
        riderIds:row.riderIds.slice(0,3)}))})}`);
  const mismatches=comparisons.filter(row=>
    Math.abs(row.claim-row.paid)>EPS);
  const worst=[...comparisons].sort((a,b)=>
    Math.abs(b.claim-b.paid)-Math.abs(a.claim-a.paid))[0];
  return {km:frame.km,mismatches:mismatches.length,
    maximumSeconds:+Math.abs(worst.claim-worst.paid).toFixed(6),
    worstRiderId:worst.riderId,
    sourceClaimSeconds:worst.claim,
    paidLeadSeconds:+worst.paid.toFixed(6),
    sourcePeloton:frame.riderGroups.filter(row=>
      row.group==='peloton').length,
    paidPeloton:state.roads.find(row=>
      row.roadId==='peloton')?.riderIds.length??0};
});
const first=checkpointRows.find(row=>row.mismatches);
process.stdout.write(`${JSON.stringify({
  version:'physical-first-finish-diagnostic-v1',
  settings,finish:{mismatchCount:finish.mismatchCount,
    maxAbsoluteMismatchSeconds:finish.maxAbsoluteMismatchSeconds,
    maxMismatchRiderId:finish.maxMismatchRiderId},
  firstMismatch:first??null,
  firstPaidPelotonDrop:firstPaidDrops?{
    km:firstPaidDrops.sourceKm,
    leaderId:firstPaidDrops.peloton.road.leaderRiderId,
    count:dropEvents.length,
    abilityShortfallRange:[
      +Math.min(...dropEvents.map(row=>
        row.leaderAbility-row.perceivedShelterHoldAbility)).toFixed(6),
      +Math.max(...dropEvents.map(row=>
        row.leaderAbility-row.perceivedShelterHoldAbility)).toFixed(6)],
    riders:dropEvents.map(row=>row.riderId),
  }:null,
  checkpoints:checkpointRows.filter(row=>
    row.km<=5||row.km%10===0||row.km===first?.km),
  worstFinish:finish.comparisons.toSorted((a,b)=>
    Math.abs(b.claimedMinusPaidSeconds)-
      Math.abs(a.claimedMinusPaidSeconds)).slice(0,8),
},null,2)}\n`);
