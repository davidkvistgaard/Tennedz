// Whole-race, same-input diagnostic for multiple ordered attacks.
// The fixture is synthetic; source group clocks do not certify wheel order.
import {isDeepStrictEqual} from 'node:util';
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionMultiAttackContactRaceV1,
  replayPhysicalFirstPositionMultiAttackContactRaceV1,
  recordPhysicalFirstPositionMultiAttackContactRaceV2,
  replayPhysicalFirstPositionMultiAttackContactRaceV2,
  recordPhysicalFirstPositionMultiAttackContactRaceV3,
  replayPhysicalFirstPositionMultiAttackContactRaceV3} from
  '../lib/engine/v2/physical-first-position-multi-attack-contact-race-v1.mjs';

const kmCount=Number(process.argv.find(arg=>
  arg.startsWith('--km='))?.slice(5)??'20');
const positionVersion=Number(process.argv.find(arg=>
  arg.startsWith('--position-version='))
  ?.slice('--position-version='.length)??'1');
if(!Number.isInteger(kmCount)||kmCount<7||kmCount>120)
  throw new Error('Multi-attack audit needs 7..120 km.');
if(![1,2,3].includes(positionVersion))
  throw new Error('Multi-attack audit needs position version 1..3.');
const teamCounts=(process.argv.find(arg=>
  arg.startsWith('--teams='))?.slice(8)??'2,20')
  .split(',').map(Number);
const frontWorkers=(process.argv.find(arg=>
  arg.startsWith('--front-workers='))
  ?.slice('--front-workers='.length)??'none,2')
  .split(',').map(value=>value==='none'?
    null:Number(value));
if(!teamCounts.length||teamCounts.some(count=>
  ![2,20].includes(count))||
  !frontWorkers.length||frontWorkers.some(value=>
    value!==null&&value!==2))
  throw new Error('Multi-attack audit has invalid matrix axes.');
const plannedCases=teamCounts.length*2*frontWorkers.length;
const rows=[];
for(const teamCount of teamCounts)
  for(const raceSeed of [
    'position-seed-a','position-seed-b'])
    for(const frontWorkerAtKm of frontWorkers){
      const request=prepareSyntheticPositionCatchV1({
        teamCount,kmCount,raceSeed,
        profile:'hill_then_mountain',
        oneTimeAttack:true,
        secondAttackAtKm:5,
        frontWorkerAtKm});
      request.input.positionPassingCorridorCount=1;
      let source=null,sourceError=null;
      try{
        source=runPhysicalFirstWholeRaceProbeV1(
          request.input);
      }catch(error){
        sourceError=error.message;
      }
      let position=null,positionError=null;
      try{
        position=(positionVersion===3?
          recordPhysicalFirstPositionMultiAttackContactRaceV3:
          positionVersion===2?
          recordPhysicalFirstPositionMultiAttackContactRaceV2:
          recordPhysicalFirstPositionMultiAttackContactRaceV1)(
          request);
        (positionVersion===3?
          replayPhysicalFirstPositionMultiAttackContactRaceV3:
          positionVersion===2?
          replayPhysicalFirstPositionMultiAttackContactRaceV2:
          replayPhysicalFirstPositionMultiAttackContactRaceV1)(
          request,position);
      }catch(error){
        positionError=error.message;
      }
      const sourceRear=source?.states.at(-1)
        .roads.filter(road=>road.roadId
          .startsWith('rear:'))
        .map(road=>[...road.riderIds].sort())??[];
      const positionRear=position?
        Object.values(Object.groupBy(
          position.steps.at(-1).sharedRoad
            .positions.filter(row=>row.roadId
              .startsWith('rear:')),
          row=>row.roadId))
          .map(group=>group.map(row=>
            row.riderId).sort()):[];
      const normalized=groups=>groups.sort((a,b)=>
        a.join(',').localeCompare(b.join(',')));
      const checkpointComparisons=source&&position?
        position.steps.map((step,index)=>{
          const sourceState=source.states[index+1];
          const positionalState=step.sharedRoad??
            step.departure.peloton;
          const sourcePeloton=sourceState.roads.find(
            road=>road.roadId==='peloton')
            ?.riderIds??[];
          const positionPeloton=positionalState
            .positions.filter(row=>
              row.roadId==='peloton')
            .map(row=>row.riderId);
          return {km:index+1,
            pelotonAligned:isDeepStrictEqual(
              [...sourcePeloton].sort(),
              [...positionPeloton].sort()),
            frontClockDifferenceSeconds:
              Math.abs(sourceState.frontClockSeconds-
                positionalState.clockSeconds)};
        }):[];
      const row={teamCount,riderCount:teamCount*8,
        kmCount,raceSeed,frontWorkerAtKm,
        sourceStatus:source?'complete':'failed',
        sourceError,
        sourcePaidAttackSteps:source?.steps.reduce(
          (sum,state)=>sum+
            (state.attackSteps?.length??0),0)??null,
        positionStatus:position?
          'complete_replayed':'failed',
        positionError,
        sourceRear:normalized(sourceRear),
        positionRear:normalized(positionRear),
        rearMembershipAligned:source&&position?
          isDeepStrictEqual(
            normalized(sourceRear),
            normalized(positionRear)):null,
        alignedPelotonCheckpoints:
          checkpointComparisons.filter(item=>
            item.pelotonAligned).length,
        firstPelotonMismatchKm:
          checkpointComparisons.find(item=>
            !item.pelotonAligned)?.km??null,
        maxFrontClockDifferenceSeconds:
          checkpointComparisons.length?
            +Math.max(...checkpointComparisons.map(
              item=>item.frontClockDifferenceSeconds))
              .toFixed(3):null,
        departures:position?.attackDepartureEvents.length??null,
        attackRefusals:position?.attackRefusals.length??null,
        cooperativePaceEvents:
          position?.contactPaceEvents?.length??null,
        decisionCoverage:position?.decisionCount===
          teamCount*8*kmCount,
        checkpointCoverage:
          position?.checkpointCrossings.length===
            teamCount*8*(kmCount-1),
        finishCoverage:
          position?.finishCrossings.length===
            teamCount*8};
      rows.push(row);
      process.stderr.write(`${rows.length}/${plannedCases} `+
        `${teamCount} teams, ${raceSeed}, `+
        `front worker ${frontWorkerAtKm??'none'}: `+
        `${row.sourceStatus}/${row.positionStatus}\n`);
    }
const summary={version:
  'physical-first-position-multi-attack-audit-1',
positionVersion,
fixture:'synthetic_only',plannedCases:rows.length,
sourceCompleted:rows.filter(row=>
  row.sourceStatus==='complete').length,
positionCompletedAndReplayed:rows.filter(row=>
  row.positionStatus==='complete_replayed').length,
bothCompleted:rows.filter(row=>
  row.sourceStatus==='complete'&&
    row.positionStatus==='complete_replayed').length,
rearMembershipAligned:rows.filter(row=>
  row.rearMembershipAligned===true).length,
fullDecisionCoverage:rows.filter(row=>
  row.decisionCoverage).length,
fullCheckpointCoverage:rows.filter(row=>
  row.checkpointCoverage).length,
fullFinishCoverage:rows.filter(row=>
  row.finishCoverage).length,
officialResults:false,
readyForGuidedRaces:false};
process.stdout.write(JSON.stringify({summary,rows},
  null,2)+'\n');
if(rows.some(row=>row.positionStatus!==
  'complete_replayed'))process.exitCode=1;
