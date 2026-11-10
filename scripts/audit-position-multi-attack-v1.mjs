// Whole-race, same-input diagnostic for multiple ordered attacks.
// The fixture is synthetic; source group clocks do not certify wheel order.
import {isDeepStrictEqual} from 'node:util';
import {prepareSyntheticPositionCatchV1} from
  '../tests/unit/synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionMultiAttackContactRaceV1,
  replayPhysicalFirstPositionMultiAttackContactRaceV1} from
  '../lib/engine/v2/physical-first-position-multi-attack-contact-race-v1.mjs';

const kmCount=Number(process.argv.find(arg=>
  arg.startsWith('--km='))?.slice(5)??'20');
if(!Number.isInteger(kmCount)||kmCount<7||kmCount>120)
  throw new Error('Multi-attack audit needs 7..120 km.');
const rows=[];
for(const teamCount of [2,20])
  for(const raceSeed of [
    'position-seed-a','position-seed-b'])
    for(const frontWorkerAtKm of [null,2]){
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
        position=recordPhysicalFirstPositionMultiAttackContactRaceV1(
          request);
        replayPhysicalFirstPositionMultiAttackContactRaceV1(
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
        departures:position?.attackDepartureEvents.length??null,
        attackRefusals:position?.attackRefusals.length??null,
        decisionCoverage:position?.decisionCount===
          teamCount*8*kmCount,
        checkpointCoverage:
          position?.checkpointCrossings.length===
            teamCount*8*(kmCount-1),
        finishCoverage:
          position?.finishCrossings.length===
            teamCount*8};
      rows.push(row);
      process.stderr.write(`${rows.length}/8 `+
        `${teamCount} teams, ${raceSeed}, `+
        `front worker ${frontWorkerAtKm??'none'}: `+
        `${row.sourceStatus}/${row.positionStatus}\n`);
    }
const summary={version:
  'physical-first-position-multi-attack-audit-1',
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
