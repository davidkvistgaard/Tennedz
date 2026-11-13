// Measure the opt-in positional contract on the actual Motor Lab test inputs.
// This is diagnostic evidence, not a claim that the current viewer has wheels.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v1.mjs';
import {recordPhysicalFirstPositionTraceV1} from
  '../lib/engine/v2/physical-first-position-trace-v1.mjs';
import {settlePhysicalFirstPositionFinishTailV1} from
  '../lib/engine/v2/physical-first-position-finish-tail-v1.mjs';

const smoke=process.argv.includes('--smoke');
const strict=process.argv.includes('--require-complete');
const grid={laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08};
const cases=smoke?[
  {category:'men',terrain:'mountain',chase:'selective',
    attack:'none',seed:'preview-recorded-road-1'},
  {category:'women',terrain:'mountain',chase:'selective',
    attack:'none',seed:'preview-recorded-road-1'},
  {category:'men',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
  {category:'women',terrain:'flat',chase:'all',
    attack:'selective',seed:'preview-recorded-road-1'},
]:['preview-recorded-road-1','viewer-release-holdout-2']
  .flatMap(seed=>['men','women'].flatMap(category=>
    ['flat','rolling','mountain'].flatMap(terrain=>
      ['selective','all'].flatMap(chase=>
        ['none','selective','repeated'].map(attack=>({
          category,terrain,chase,attack,seed}))))));
const rows=[];
for(const variant of cases){
  try{
    const {category,...options}=variant;
    const {input}=preparePhysicalFirstSplitMotorInputV1(
      category,options);
    const committed={...input,
      positionModelVersion:
        PHYSICAL_FIRST_POSITION_START_VERSION};
    const trace=recordPhysicalFirstPositionTraceV1(
      committed,grid);
    const tail=trace.unsupported?null:
      settlePhysicalFirstPositionFinishTailV1(
        committed,trace);
    rows.push({variant,status:'complete',
      raceValidatedKm:trace.raceValidatedKm,
      positionKm:trace.completedThroughKm,
      riderCount:trace.riderCount,
      positionRiderKm:trace.validatedPositionRiderKm,
      unsupported:trace.unsupported,
      finishCrossings:tail?.lineCrossings.length??
        trace.finishCrossings.length,
      finishCrossingCoverage:tail?.lineCrossingCoverage??
        trace.finishCrossingCoverage,
      officialResults:false});
  }catch(error){
    rows.push({variant,status:'failed',
      sourceKm:error.sourceKm??null,
      error:error.message});
  }
}
const complete=rows.filter(row=>row.status==='complete');
const summary={version:'motor-position-coverage-audit-1',
  scenarios:rows.length,completed:complete.length,
  failed:rows.length-complete.length,
  fullPositionRaces:complete.filter(row=>
    row.positionKm===row.raceValidatedKm).length,
  completeFinishCoverage:complete.filter(row=>
    row.finishCrossingCoverage===
      `${row.riderCount}/${row.riderCount}`).length,
  officialResultsAvailable:0,
  readyForViewerPositions:rows.length>0&&rows.every(row=>
    row.status==='complete'&&
    row.positionKm===row.raceValidatedKm&&
    row.finishCrossingCoverage===
      `${row.riderCount}/${row.riderCount}`&&
    row.officialResults)};
process.stdout.write(`${JSON.stringify({summary,rows},null,2)}\n`);
if(strict&&!summary.readyForViewerPositions)process.exitCode=1;
