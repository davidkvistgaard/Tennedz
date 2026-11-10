// Research calibration. These fixture races are synthetic and their
// group clocks are not individual wheel positions or official results.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {recordPhysicalFirstPositionOneAttackRaceV1,
  replayPhysicalFirstPositionOneAttackRaceV1} from
  '../lib/engine/v2/physical-first-position-one-attack-race-v1.mjs';

const grid={laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08};
const smoke=process.argv.includes('--smoke');
const seeds=smoke?['preview-recorded-road-1']:
  ['preview-recorded-road-1',
    'viewer-release-holdout-2'];
const terrains=smoke?['flat','mountain']:
  ['flat','rolling','mountain'];
const variants=seeds.flatMap(seed=>
  ['men','women'].flatMap(category=>
    terrains.flatMap(terrain=>
      ['selective','all'].flatMap(chase=>
        ['none','selective','repeated']
          .map(attack=>({seed,category,
            terrain,chase,attack}))))));
const rows=[];
for(const variant of variants){
  const {category,...options}=variant;
  const began=performance.now();
  try{
    const {input:base}=preparePhysicalFirstSplitMotorInputV1(
      category,options);
    const input={...base,positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION};
    const source=runPhysicalFirstWholeRaceProbeV1(input);
    const race=recordPhysicalFirstPositionOneAttackRaceV1({
      input,grid});
    replayPhysicalFirstPositionOneAttackRaceV1({
      input,grid},race);
    const riderCount=race.riderCount;
    const plannedKm=input.kilometres.length;
    const keys=new Set([
      ...race.checkpointCrossings.map(row=>
        `${row.riderId}:${row.km}`),
      ...race.finishCrossings.map(row=>
        `${row.riderId}:${plannedKm}`)]);
    let activeRiders=riderCount;
    const fullDecisionCoverage=race.steps.every(step=>{
      const covered=step.peloton.decisions.length+
        Number(Boolean(step.departure||
          step.soloStep))===activeRiders;
      if(step.soloStep?.finished)activeRiders--;
      return covered;
    });
    const complete=race.completedThroughKm===plannedKm&&
      race.finishCrossings.length===riderCount&&
      keys.size===riderCount*plannedKm;
    const sourceFinish=source.states.at(-1);
    const sourcePelotonIds=new Set(sourceFinish.roads
      .find(row=>row.roadId==='peloton').riderIds);
    const modelPelotonIds=new Set(race.steps.at(-1)
      .peloton.positions.map(row=>row.riderId));
    const finishMembershipAligned=
      sourcePelotonIds.size===modelPelotonIds.size&&
      [...modelPelotonIds].every(id=>
        sourcePelotonIds.has(id));
    rows.push({...variant,status:'complete',
      riderCount,plannedKm,
      fullDecisionCoverage,complete,
      finishMembershipAligned,
      officialResults:race.officialResults,
      elapsedMs:+(performance.now()-began)
        .toFixed(1)});
  }catch(error){
    rows.push({...variant,status:'failed',
      reason:error.message,
      elapsedMs:+(performance.now()-began)
        .toFixed(1)});
  }
}
const summary={version:
  'physical-first-position-unified-72-audit-1',
fixture:'synthetic_only',
scenarios:rows.length,
complete:rows.filter(row=>row.complete).length,
fullDecisionCoverage:rows.filter(row=>
  row.fullDecisionCoverage).length,
finishMembershipAligned:rows.filter(row=>
  row.finishMembershipAligned).length,
officialResults:rows.filter(row=>
  row.officialResults).length,
failures:rows.filter(row=>
  row.status==='failed'||!row.complete||
    !row.fullDecisionCoverage||
    !row.finishMembershipAligned)};
process.stdout.write(JSON.stringify({summary,
  rows:process.argv.includes('--rows')?rows:
    undefined},null,2)+'\n');
if(summary.failures.length)process.exitCode=1;
