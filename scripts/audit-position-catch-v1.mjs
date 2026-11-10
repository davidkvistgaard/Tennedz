// Same-seed diagnostic only. The synthetic fixture and old group clocks
// cannot establish official result or exact rider position agreement.
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionSingleCatchRaceV2,
  recordPhysicalFirstPositionSingleCatchRaceV3,
  recordPhysicalFirstPositionSingleCatchRaceV4} from
  '../lib/engine/v2/physical-first-position-single-catch-race-v1.mjs';

const option=(name,defaultValue)=>{
  const argument=process.argv.find(arg=>
    arg.startsWith(`--${name}=`));
  return argument?argument.slice(name.length+3):
    defaultValue;
};
const teamCount=Number(option('teams','2'));
const kmCount=Number(option('km','4'));
const frontWorkerAtKm=Number(option('front-at','2'));
const profile=option('profile','hill');
const raceSeed=option('seed',
  'position-seed-a');
const corridorCount=Number(option('corridor','0'));
const leaderCost=option('leader-cost','false')==='true';
if(![0,1].includes(corridorCount))
  throw new Error('Corridor count must be 0 or 1.');
if(leaderCost&&!corridorCount)
  throw new Error('Leader cost needs the recorded passing corridor.');
const {input,grid}=prepareSyntheticPositionCatchV1({
  teamCount,kmCount,profile,
  oneTimeAttack:teamCount>2,
  frontWorkerAtKm,raceSeed});
if(corridorCount)input.positionPassingCorridorCount=
  corridorCount;
const began=performance.now();
let source=null,sourceFailure=null;
try{
  source=runPhysicalFirstWholeRaceProbeV1(input);
}catch(error){
  sourceFailure=error.message;
}
const sourceElapsedMs=performance.now()-began;
let position=null,positionFailure=null;
try{
  position=(leaderCost?
    recordPhysicalFirstPositionSingleCatchRaceV4:
    corridorCount?
    recordPhysicalFirstPositionSingleCatchRaceV3:
    recordPhysicalFirstPositionSingleCatchRaceV2)(
    {input,grid});
}catch(error){
  positionFailure=error.message;
}
const positionElapsedMs=performance.now()-
  began-sourceElapsedMs;
const rows=[];
if(source&&position){
  for(let km=1;km<=kmCount;km++){
    const sourceState=source.states[km];
    const sourcePeloton=sourceState?.roads.find(
      row=>row.roadId==='peloton');
    const step=position.steps[km-1];
    const paidState=step.sharedRoad??
      step.departure?.peloton;
    const modelPelotonIds=new Set(
      paidState.positions.filter(row=>
        row.roadId==='peloton').map(row=>
        row.riderId));
    const sourcePelotonIds=new Set(
      sourcePeloton?.riderIds??[]);
    rows.push({km,
      frontClockDeltaSeconds:
        paidState.clockSeconds-
        sourcePeloton.clockSeconds,
      sourcePelotonSize:
        sourcePelotonIds.size,
      positionPelotonSize:
        modelPelotonIds.size,
      pelotonMembershipAligned:
        sourcePelotonIds.size===
          modelPelotonIds.size&&
        [...modelPelotonIds].every(id=>
          sourcePelotonIds.has(id))});
  }
}
const absDeltas=rows.map(row=>
  Math.abs(row.frontClockDeltaSeconds));
const sourceFinal=source?.states.at(-1);
const modelFinal=position?.steps.at(-1)
  ?.sharedRoad;
const sourceFinalPelotonIds=new Set(
  sourceFinal?.roads.find(row=>
    row.roadId==='peloton')?.riderIds??[]);
const modelFinalPelotonIds=new Set(
  modelFinal?.positions.filter(row=>
    row.roadId==='peloton').map(row=>
    row.riderId)??[]);
const result={version:
  'physical-first-position-catch-audit-1',
fixture:'synthetic_only',
raceSeed,teamCount,
riderCount:teamCount*8,kmCount,
profile,frontWorkerAtKm,corridorCount,leaderCost,
source:{status:source?'complete':'failed',
  elapsedMs:+sourceElapsedMs.toFixed(1),
  failure:sourceFailure,
  completedThroughKm:source?
    source.states.length-1:null},
position:{status:position?'complete':'failed',
  elapsedMs:+positionElapsedMs.toFixed(1),
  failure:positionFailure,
  completedThroughKm:position
    ?.completedThroughKm??null,
  finishCrossings:position
    ?.finishCrossings.length??null,
  soloCatchEvents:position
    ?.soloCatchEvents.length??null,
  paidFrontPasses:position
    ?.paidFrontPasses??null,
  paidLaneChanges:position
    ?.paidLaneChanges??null},
comparison:rows.length?{
  alignedPelotonKm:rows.filter(row=>
    row.pelotonMembershipAligned).length,
  maxAbsFrontClockDeltaSeconds:
    Math.max(...absDeltas),
  finishFrontClockDeltaSeconds:
    rows.at(-1).frontClockDeltaSeconds,
  firstMembershipDifferenceKm:rows.find(row=>
    !row.pelotonMembershipAligned)
    ?.km??null,
  sourceFinalRoads:sourceFinal?.roads.map(row=>({
    roadId:row.roadId,
    riderCount:row.riderIds.length}))??null,
  modelFinalComponents:modelFinal
    ?.contactComponents.map(group=>({
      riderCount:group.length,
      riderIds:group}))??null,
  onlyInSourcePeloton:[...sourceFinalPelotonIds]
    .filter(id=>!modelFinalPelotonIds.has(id)),
  onlyInPositionPeloton:[...modelFinalPelotonIds]
    .filter(id=>!sourceFinalPelotonIds.has(id))}:null,
officialResults:false,
readyForGuidedRaces:false};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(!position||!source)process.exitCode=1;
