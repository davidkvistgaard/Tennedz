// Diagnose unresolved paid-wheel finish clocks without assigning places.
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {recordPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV7} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const category=process.argv.find(arg=>
  arg.startsWith('--category='))?.slice(11)??'men';
if(!['men','women'].includes(category))
  throw new Error('Choose men or women.');
const prepared=preparePhysicalFirstSplitMotorInputV1(
  category,{terrain:'flat',chase:'selective',
    attack:'none',seed:'preview-recorded-road-1'});
const request={input:{...prepared.input,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  positionPassingCorridorCount:1},
grid:{laneCount:4,wheelSpacingM:2.5,
  laneStaggerM:.08}};
const race=recordPhysicalFirstPositionGeneralRaceV7(request);
replayPhysicalFirstPositionGeneralRaceV7(request,race);
const frames=race.tail.positionFrames;
const ties=race.finaleFinishTieObservations.map(tie=>{
  const before=frames.findLast(frame=>
    frame.clockSeconds<tie.clockSeconds-1e-8);
  const riders=tie.riderIds.map(riderId=>{
    const row=before.positions.find(position=>
      position.riderId===riderId);
    return {riderId,lane:row.lane,
      distanceM:row.distanceM};
  });
  const spreadM=Math.max(...riders.map(row=>
    row.distanceM))-Math.min(...riders.map(row=>
      row.distanceM));
  return {clockSeconds:tie.clockSeconds,
    riderIds:tie.riderIds,
    lanes:riders.map(row=>row.lane),
    preCrossingDistanceSpreadM:spreadM,
    sameDistanceAtPriorSample:spreadM<=1e-6,
    sameLaneAtPriorSample:
      new Set(riders.map(row=>row.lane)).size<
        riders.length};
});
console.log(JSON.stringify({category,
  raceSeed:race.raceSeed,
  finishCrossings:race.finishCrossings.length,
  unresolvedTieGroups:ties.length,
  tiedRiders:ties.reduce((sum,row)=>
    sum+row.riderIds.length,0),
  sameDistanceGroups:ties.filter(row=>
    row.sameDistanceAtPriorSample).length,
  sameLaneGroups:ties.filter(row=>
    row.sameLaneAtPriorSample).length,
  ties},null,2));
