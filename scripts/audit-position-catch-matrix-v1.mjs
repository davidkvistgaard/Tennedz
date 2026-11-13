// Synthetic same-seed screen for the isolated paid-position catch model.
// A completed source is diagnostic only: it does not supply wheel order.
import {isDeepStrictEqual} from 'node:util';
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionSingleCatchRaceV5,
  replayPhysicalFirstPositionSingleCatchRaceV5} from
  '../lib/engine/v2/physical-first-position-single-catch-race-v1.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const kmCount=Number(option('km','30'));
const teamCounts=option('teams','2,20').split(',')
  .map(Number);
const weakCounts=option('weak','0,1,2').split(',')
  .map(Number);
if(!Number.isInteger(kmCount)||kmCount<4||
  kmCount>120||teamCounts.some(count=>
    !Number.isInteger(count)||count<2||count>20)||
  !weakCounts.length||weakCounts.some(count=>
    !Number.isInteger(count)||count<0||count>2))
  throw new Error('Catch matrix needs a supported synthetic field.');

const rows=[];
for(const teamCount of teamCounts)
  for(const profile of ['hill','alternating'])
    for(const raceSeed of [
      'position-seed-a','position-seed-b'])
      for(const weakBunchCount of weakCounts){
        const request=prepareSyntheticPositionCatchV1({
          teamCount,kmCount,profile,raceSeed,
          weakBunchCount,
          oneTimeAttack:teamCount>2,
          frontWorkerAtKm:teamCount>2?
            Math.min(25,kmCount-1):2});
        request.input.positionPassingCorridorCount=1;
        let source=null,sourceError=null;
        try{
          source=runPhysicalFirstWholeRaceProbeV1(
            request.input);
        }catch(error){
          sourceError={message:error.message,
            sourceKm:error.sourceKm??null};
        }
        let position=null,positionError=null;
        const began=performance.now();
        try{
          position=recordPhysicalFirstPositionSingleCatchRaceV5(
            request);
          replayPhysicalFirstPositionSingleCatchRaceV5(
            request,position);
        }catch(error){
          positionError={message:error.message,
            sourceKm:error.sourceKm??null};
        }
        const elapsedMs=+(performance.now()-began)
          .toFixed(1);
        const sourcePeloton=source?.states.at(-1)
          .roads.find(road=>road.roadId==='peloton')
          ?.riderIds??[];
        const modelPeloton=position?.steps.at(-1)
          .sharedRoad?.positions.filter(row=>
            row.roadId==='peloton').map(row=>
            row.riderId)??[];
        const membershipAligned=source&&position?
          isDeepStrictEqual(
            [...sourcePeloton].sort(),
            [...modelPeloton].sort()):null;
        const riderCount=teamCount*8;
        const decisionCount=position?
          position.steps[0].departure.peloton
            .decisions.length+1+
          position.steps.slice(1).reduce((sum,step)=>
            sum+step.sharedRoad.decisions.length,0):
          null;
        const firstMismatchKm=source&&position?
          source.states.slice(1).findIndex((state,index)=>{
            const sourceIds=state.roads.find(road=>
              road.roadId==='peloton')?.riderIds??[];
            const step=position.steps[index];
            const modelIds=(step.sharedRoad??
              step.departure.peloton).positions
              .filter(row=>row.roadId==='peloton')
              .map(row=>row.riderId);
            return !isDeepStrictEqual(
              [...sourceIds].sort(),
              [...modelIds].sort());
          })+1:null;
        const row={teamCount,riderCount,kmCount,
          profile,raceSeed,weakBunchCount,
          sourceStatus:source?'complete':'failed',
          sourceError,
          positionStatus:position?
            'complete_replayed':'failed',
          positionError,elapsedMs,
          ...(position?{
            decisionCount,
            decisionCoverage:decisionCount===
              riderCount*kmCount,
            checkpointCoverage:
              position.checkpointCrossings.length===
                riderCount*(kmCount-1),
            finishCoverage:
              position.finishCrossings.length===
                riderCount,
            paidFrontPasses:
              position.paidFrontPasses,
            paidLaneChanges:
              position.paidLaneChanges,
            officialResults:position.officialResults}:{}),
          membershipAligned,
          firstMismatchKm:firstMismatchKm===0?
            null:firstMismatchKm};
        rows.push(row);
        process.stderr.write(`${rows.length}/`+
          `${teamCounts.length*4*weakCounts.length} `+
          `${teamCount} teams, ${profile}, `+
          `${raceSeed}, weak=${weakBunchCount}: `+
          `${row.sourceStatus}/${row.positionStatus}\n`);
      }
const summary={version:
  'physical-first-position-catch-matrix-1',
fixture:'synthetic_only',
plannedCases:teamCounts.length*4*
  weakCounts.length,
sourceCompleted:rows.filter(row=>
  row.sourceStatus==='complete').length,
positionCompletedAndReplayed:rows.filter(row=>
  row.positionStatus==='complete_replayed').length,
bothCompleted:rows.filter(row=>
  row.sourceStatus==='complete'&&
  row.positionStatus==='complete_replayed').length,
finalMembershipAligned:rows.filter(row=>
  row.membershipAligned===true).length,
fullDecisionCoverage:rows.filter(row=>
  row.decisionCoverage===true).length,
fullCheckpointCoverage:rows.filter(row=>
  row.checkpointCoverage===true).length,
fullFinishCoverage:rows.filter(row=>
  row.finishCoverage===true).length,
officialResults:false,
readyForGuidedRaces:false};
process.stdout.write(JSON.stringify({summary,rows},
  null,2)+'\n');
if(rows.some(row=>row.positionStatus!==
  'complete_replayed'))process.exitCode=1;
