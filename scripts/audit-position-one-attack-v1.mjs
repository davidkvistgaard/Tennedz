// Whole-race same-seed audit of the opt-in one-attack position contract.
// Source group clocks are compared only with matching front/solo clocks;
// they are not individual finish-order evidence.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionOneAttackRaceV1} from
  '../lib/engine/v2/physical-first-position-one-attack-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';

const smoke=process.argv.includes('--smoke');
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
    const input={...base,positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
    const source=runPhysicalFirstWholeRaceProbeV1(base);
    const race=recordPhysicalFirstPositionOneAttackRaceV1({
      input,grid});
    const sourceFinish=source.states.at(-1);
    const sourcePeloton=sourceFinish.roads.find(row=>
      row.roadId==='peloton');
    const soloId=race.soloFinish?.riderId??null;
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
    rows.push({variant,status:'complete',
      plannedKm:input.kilometres.length,
      completedThroughKm:race.completedThroughKm,
      riderCount:race.riderCount,
      paidAttackDepartures:race.steps.filter(row=>
        row.departure).length,
      sourceRoadCount:sourceFinish.roads.length,
      modelRoadCount:race.physicalRoadCount,
      pelotonMembershipAligned,
      finishCrossings:race.finishCrossings.length,
      soloFinishSourceKm:race.soloFinish?.sourceKm??null,
      soloFinishClockDeltaSeconds:sourceSolo?
        race.soloFinish.clockSeconds-
        sourceSolo.clockSeconds:null,
      pelotonFrontClockDeltaSeconds:
        race.tail.frontClockSeconds-
        sourcePeloton.clockSeconds,
      officialResults:false});
  }catch(error){
    rows.push({variant,status:'unsupported',
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
