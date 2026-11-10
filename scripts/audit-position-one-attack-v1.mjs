// Whole-race same-seed audit of the opt-in one-attack position contract.
// Source group clocks are compared only with matching front/solo clocks;
// they are not individual finish-order evidence.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionOneAttackRaceV1} from
  '../lib/engine/v2/physical-first-position-one-attack-race-v1.mjs';
import {recordPhysicalFirstPositionMultiSoloRaceV1} from
  '../lib/engine/v2/physical-first-position-multi-solo-race-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {replayRearEnergyCapV1} from
  '../lib/engine/v2/rear-energy-cap-source-v1.mjs';

const smoke=process.argv.includes('--smoke');
const multi=process.argv.includes('--multi');
const attackerAbilityShift=Number(process.argv.find(arg=>
  arg.startsWith('--attacker-ability-shift='))
  ?.slice('--attacker-ability-shift='.length)??0);
if(!Number.isInteger(attackerAbilityShift)||
  Math.abs(attackerAbilityShift)>20)
  throw new Error('Audit attacker ability shift is invalid.');
const grid={laneCount:4,wheelSpacingM:2.5,laneStaggerM:.08};
const variants=smoke?[
  {category:'men',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
  {category:'women',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
  {category:'men',terrain:'mountain',chase:'selective',
    attack:'repeated',seed:'viewer-release-holdout-2'},
  {category:'women',terrain:'mountain',chase:'selective',
    attack:'repeated',seed:'viewer-release-holdout-2'},
]:['preview-recorded-road-1','viewer-release-holdout-2']
  .flatMap(seed=>['men','women'].flatMap(category=>
    ['flat','rolling','mountain'].flatMap(terrain=>
      ['selective','all'].flatMap(chase=>
        ['selective','repeated'].map(attack=>({
          category,terrain,chase,attack,seed}))))));

const rows=[];
for(const variant of variants){
  const {category,...options}=variant;
  try{
    const {input:base}=preparePhysicalFirstSplitMotorInputV1(
      category,options);
    const input=structuredClone({...base,positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION});
    if(attackerAbilityShift){
      const staged=createPhysicalFirstPositionStartV2({
        input,grid});
      const attackerId=staged.stagedAttackRiderId;
      const attacker=input.teams.flatMap(team=>team.riders)
        .find(rider=>rider.id===attackerId);
      if(!attacker)
        throw new Error('Audit has no committed staged attacker.');
      for(const ability of ['flat','hills','mountain'])
        attacker[ability]=Math.max(0,Math.min(100,
          attacker[ability]+attackerAbilityShift));
      input.start.riders.find(row=>
        row.riderId===attackerId).reserve=
        replayRearEnergyCapV1({
          rider:attacker,
          kilometres:input.kilometres,
          throughKm:0}).initialCap;
    }
    const source=runPhysicalFirstWholeRaceProbeV1(input);
    const race=multi?
      recordPhysicalFirstPositionMultiSoloRaceV1({
        input,grid}):
      recordPhysicalFirstPositionOneAttackRaceV1({
        input,grid});
    const sourceFinish=source.states.at(-1);
    const sourcePeloton=sourceFinish.roads.find(row=>
      row.roadId==='peloton');
    const soloFinish=multi?
      race.soloFinishes[0]?.[1]??null:
      race.soloFinish;
    const soloId=soloFinish?.riderId??null;
    const sourceSolo=soloId?sourceFinish.riders.find(row=>
      row.riderId===soloId):null;
    const sourcePelotonIds=new Set(
      sourcePeloton.riderIds);
    const modelPelotonIds=new Set(race.steps.at(-1)
      .peloton.positions.map(row=>row.riderId));
    const pelotonMembershipAligned=
      sourcePelotonIds.size===modelPelotonIds.size&&
      [...modelPelotonIds].every(id=>
        sourcePelotonIds.has(id));
    rows.push({variant,attackerAbilityShift,
      status:'complete',
      plannedKm:input.kilometres.length,
      completedThroughKm:race.completedThroughKm,
      riderCount:race.riderCount,
      paidAttackDepartures:race.steps.filter(row=>
        row.departure).length,
      refusedAttackPasses:multi?
        race.refusedAttackPasses:0,
      departureKm:race.steps.find(row=>
        row.departure)?.sourceKm??null,
      minSoloGapAheadM:Math.min(
        ...race.steps.flatMap(row=>
          multi?row.soloSteps.filter(step=>
            !step.finished).map(step=>
            step.gapAheadOfPelotonM):
          row.soloStep&&!row.soloStep.finished?
            [row.soloStep.gapAheadOfPelotonM]:[])),
      sourceRoadCount:sourceFinish.roads.length,
      modelRoadCount:race.physicalRoadCount,
      sourceForwardRiderIds:sourceFinish.roads
        .filter(row=>row.roadId!=='peloton')
        .flatMap(row=>row.riderIds).sort(),
      modelForwardRiderIds:multi?
        race.soloFinishes.map(([id])=>id).sort():
        soloId?[soloId]:[],
      pelotonMembershipAligned,
      finishCrossings:race.finishCrossings.length,
      soloFinishSourceKm:soloFinish?.sourceKm??null,
      soloFinishClockDeltaSeconds:sourceSolo?
        soloFinish.clockSeconds-
        sourceSolo.clockSeconds:null,
      pelotonFrontClockDeltaSeconds:
        race.tail.frontClockSeconds-
        sourcePeloton.clockSeconds,
      officialResults:false});
  }catch(error){
    rows.push({variant,attackerAbilityShift,
      status:'unsupported',
      reason:error.message});
  }
}
const complete=rows.filter(row=>row.status==='complete');
const failures=Object.entries(rows.filter(row=>
  row.status!=='complete').reduce((counts,row)=>{
  counts[row.reason]=(counts[row.reason]??0)+1;
  return counts;
},{})).map(([reason,count])=>({reason,count}));
const summary={version:'physical-first-position-one-attack-audit-1',
  multi,
  attackerAbilityShift,
  scenarios:rows.length,
  completeRaces:complete.length,
  completeWithEveryFinish:complete.filter(row=>
    row.finishCrossings===row.riderCount).length,
  paidAttackDepartures:complete.reduce((sum,row)=>
    sum+row.paidAttackDepartures,0),
  sourceRoadStructureAligned:complete.filter(row=>
    row.sourceRoadCount===row.modelRoadCount&&
    row.pelotonMembershipAligned).length,
  maxAbsSoloClockDeltaSeconds:Math.max(0,
    ...complete.map(row=>Math.abs(
      row.soloFinishClockDeltaSeconds??0))),
  maxAbsPelotonFrontClockDeltaSeconds:Math.max(0,
    ...complete.map(row=>Math.abs(
      row.pelotonFrontClockDeltaSeconds))),
  failures,officialResultsAvailable:0,
  readyForViewerPositions:false};
process.stdout.write(`${JSON.stringify({summary,rows},null,2)}\n`);
if(process.argv.includes('--require-complete')&&
  complete.length!==rows.length)process.exitCode=1;
