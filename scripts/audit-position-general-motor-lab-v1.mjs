// Same-input audit of the experimental positional recorder against
// current 120-rider Motor Lab test inputs. Group clocks are not wheels.
import {isDeepStrictEqual} from 'node:util';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {runPhysicalFirstWholeRaceProbeV1,
  runPhysicalFirstWholeRaceProbeV2,
  replayPhysicalFirstWholeRaceProbeV2} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV1,
  replayPhysicalFirstPositionGeneralRaceV1,
  recordPhysicalFirstPositionGeneralRaceV2,
  replayPhysicalFirstPositionGeneralRaceV2,
  recordPhysicalFirstPositionGeneralRaceV3,
  replayPhysicalFirstPositionGeneralRaceV3,
  recordPhysicalFirstPositionGeneralRaceV4,
  replayPhysicalFirstPositionGeneralRaceV4} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const categories=option('categories','men,women').split(',');
const terrains=option('terrains','mountain').split(',');
const chases=option('chases','selective').split(',');
const attack=option('attack','none');
const positionVersion=option('position-version','1');
const sourceVersion=option('source-version','1');
const seeds=option('seeds',
  'preview-recorded-road-1').split(',');
if(categories.some(value=>
  !['men','women'].includes(value))||
  terrains.some(value=>
    !['flat','rolling','mountain'].includes(value))||
  chases.some(value=>
    !['selective','all'].includes(value))||
  !['none','selective','repeated'].includes(attack)||
  !['1','2','3','4'].includes(positionVersion)||
  !['1','2'].includes(sourceVersion)||
  seeds.some(seed=>
    !(/^[A-Za-z0-9-]{1,64}$/).test(seed)))
  throw new Error('General audit has unsupported inputs.');
const rows=[];
const plannedCases=categories.length*terrains.length*
  chases.length*seeds.length;
for(const seed of seeds)
for(const category of categories)
  for(const terrain of terrains)
    for(const chase of chases){
      let request=null,source=null,position=null;
      let sourceError=null,positionError=null;
      try{
        const prepared=preparePhysicalFirstSplitMotorInputV1(
          category,{terrain,chase,attack,
            seed});
        const input={...prepared.input,
          positionModelVersion:
            PHYSICAL_FIRST_POSITION_START_V2_VERSION,
          positionPassingCorridorCount:1};
        request={input,
          grid:{laneCount:4,
            wheelSpacingM:2.5,
            laneStaggerM:.08}};
        source=(sourceVersion==='2'?
          runPhysicalFirstWholeRaceProbeV2:
          runPhysicalFirstWholeRaceProbeV1)(input);
        if(sourceVersion==='2')
          replayPhysicalFirstWholeRaceProbeV2(input,source);
      }catch(error){
        source=null;
        sourceError={message:error.message,
          sourceKm:error.sourceKm??null};
      }
      if(request){
        try{
          position=(positionVersion==='4'?
            recordPhysicalFirstPositionGeneralRaceV4:
            positionVersion==='3'?
              recordPhysicalFirstPositionGeneralRaceV3:
            positionVersion==='2'?
              recordPhysicalFirstPositionGeneralRaceV2:
              recordPhysicalFirstPositionGeneralRaceV1)(request);
          (positionVersion==='4'?
            replayPhysicalFirstPositionGeneralRaceV4:
            positionVersion==='3'?
              replayPhysicalFirstPositionGeneralRaceV3:
            positionVersion==='2'?
              replayPhysicalFirstPositionGeneralRaceV2:
              replayPhysicalFirstPositionGeneralRaceV1)(
            request,position);
        }catch(error){
          positionError={message:error.message,
            sourceKm:error.sourceKm??null,
            activeSoloRiderIds:
              error.activeSoloRiderIds??null,
            attackAttemptRiderIds:
              error.attackAttemptRiderIds??null,
            frontPassCandidateId:
              error.frontPassCandidateId??null};
        }
      }
      const comparisons=source&&position?
        position.steps.slice(0,-1).map((step,index)=>{
          const sourceState=source.states[index+1];
          const sourcePeloton=sourceState.roads.find(
            row=>row.roadId==='peloton')
            ?.riderIds??[];
          const modelPeloton=step.sharedRoad.positions
            .filter(row=>row.roadId==='peloton')
            .map(row=>row.riderId);
          return {km:index+1,
            pelotonAligned:isDeepStrictEqual(
              [...sourcePeloton].sort(),
              [...modelPeloton].sort()),
            frontClockDifferenceSeconds:Math.abs(
              sourceState.frontClockSeconds-
                step.sharedRoad.clockSeconds)};
        }):[];
      const sourceFinal=source?.states.at(-1);
      const modelFinal=position?.steps.at(-1)
        .sharedRoad;
      const frontLeaderMismatches=source&&position?
        source.steps.flatMap((step,index)=>
          step.peloton.road.leaderRiderId===
            position.steps[index].sharedRoad
              .leaderRiderId?[]:[index+1]):[];
      const sourceAttacks=source?.steps.flatMap(step=>
        step.attackSteps.map(attackStep=>
          `${step.sourceKm}:${attackStep.choice.riderId}`))??[];
      const positionAttacks=position
        ?.attackDepartureEvents.map(event=>
          `${event.sourceKm}:${event.toRiderId}`)??[];
      const sourceEnergy=new Map(sourceFinal?.riders.map(
        row=>[row.riderId,row.reserve])??[]);
      const energyDrifts=position?.tail.decisions.map(row=>
        Math.abs(row.energyAfter-
          sourceEnergy.get(row.riderId)))??[];
      const sourceFinishClock=new Map(sourceFinal?.riders.map(
        row=>[row.riderId,row.clockSeconds])??[]);
      const finishClockDrifts=position?.finishCrossings.map(row=>
        Math.abs(row.clockSeconds-
          sourceFinishClock.get(row.riderId)))??[];
      const row={seed,category,terrain,chase,attack,
        sourceStatus:source?sourceVersion==='2'?
          'complete_replayed':'complete':'failed',
        sourceError,
        positionStatus:position?
          'complete_replayed':'failed',
        positionError,
        riderCount:position?.riderCount??null,
        plannedKm:position?.plannedKm??null,
        decisionCoverage:position?.decisionCount===
          120*120,
        terminalRecords:
          position?.terminalDecisionCount??null,
        checkpointCoverage:
          position?.checkpointCrossings.length===
            120*119,
        finishCoverage:
          position?.finishCrossings.length===120,
        attackDepartures:
          position?.attackDepartureEvents.length??null,
        attackCapacityRefusals:
          position?.attackCapacityRefusals.length??null,
        sourceAttackDepartures:source?
          sourceAttacks.length:null,
        unmatchedSourceAttacks:
          source&&position?sourceAttacks.filter(key=>
            !positionAttacks.includes(key)):null,
        unmatchedPositionAttacks:
          source&&position?positionAttacks.filter(key=>
            !sourceAttacks.includes(key)):null,
        sharedRoadFinishCrossings:
          position?.earlyFinishCrossings?.length??null,
        firstSharedRoadFinishSourceKm:
          position?.steps.find(step=>
            step.sharedRoad.earlyFinishCrossings
              ?.length)?.sourceKm??null,
        frontPasses:
          position?.frontPassEvents.length??null,
        frontLeaderMismatchKmCount:
          source&&position?
            frontLeaderMismatches.length:null,
        firstFrontLeaderMismatchKm:
          frontLeaderMismatches[0]??null,
        contactObservations:
          position?.contactEvents.length??null,
        tailContactObservations:
          position?.tail.contactEvents.length??null,
        alignedPelotonCheckpoints:
          comparisons.filter(item=>
            item.pelotonAligned).length,
        comparedPelotonCheckpoints:
          comparisons.length,
        firstPelotonMismatchKm:
          comparisons.find(item=>
            !item.pelotonAligned)?.km??null,
        maxFrontClockDifferenceSeconds:
          comparisons.length?
            +Math.max(...comparisons.map(item=>
              item.frontClockDifferenceSeconds))
              .toFixed(3):null,
        maxFinalReserveDifference:
          energyDrifts.length?
            +Math.max(...energyDrifts).toFixed(3):null,
        maxSourceGroupClockVsWheelFinishSeconds:
          finishClockDrifts.length?
            +Math.max(...finishClockDrifts).toFixed(3):null,
        sourceFinalPelotonGroupRiders:
          sourceFinal?.roads.find(row=>
            row.roadId==='peloton')?.riderIds.length??null,
        positionFinalActivePelotonRiders:
          modelFinal?.positions.filter(row=>
            row.roadId==='peloton').length??null,
        positionFinalAlreadyFinishedRiders:
          modelFinal?.positions.filter(row=>
            row.roadId==='finished').length??null};
      rows.push(row);
      process.stderr.write(`${rows.length}/${plannedCases} `+
        `${seed}, ${category}, ${terrain}, ${chase}: `+
        `${row.sourceStatus}/${row.positionStatus}\n`);
    }
const summary={version:
  'physical-first-position-general-motor-lab-audit-1',
fixture:'current_motor_lab_test_input',
attack,positionVersion,sourceVersion,
seeds,plannedCases,
sourceCompleted:rows.filter(row=>
  row.sourceStatus.startsWith('complete')).length,
sourceCompletedAndReplayed:rows.filter(row=>
  row.sourceStatus==='complete_replayed').length,
positionCompletedAndReplayed:rows.filter(row=>
  row.positionStatus==='complete_replayed').length,
bothCompleted:rows.filter(row=>
  row.sourceStatus.startsWith('complete')&&
    row.positionStatus==='complete_replayed').length,
fullDecisionCoverage:rows.filter(row=>
  row.decisionCoverage).length,
fullCheckpointCoverage:rows.filter(row=>
  row.checkpointCoverage).length,
fullFinishCoverage:rows.filter(row=>
  row.finishCoverage).length,
maxContactObservations:rows.every(row=>
  row.contactObservations!==null)?
  Math.max(...rows.map(row=>row.contactObservations)):
  null,
maxTailContactObservations:rows.every(row=>
  row.tailContactObservations!==null)?
  Math.max(...rows.map(row=>
    row.tailContactObservations)):null,
casesWithFrontLeaderMismatch:rows.filter(row=>
  (row.frontLeaderMismatchKmCount??0)>0).length,
officialResults:false,
readyForGuidedRaces:false};
process.stdout.write(JSON.stringify({summary,rows},
  null,2)+'\n');
if(rows.some(row=>row.positionStatus!==
  'complete_replayed'||
  row.sourceStatus!==(sourceVersion==='2'?
    'complete_replayed':'complete')))
  process.exitCode=1;
