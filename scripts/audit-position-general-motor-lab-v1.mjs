// Same-input audit of the experimental positional recorder against
// current 120-rider Motor Lab test inputs. Group clocks are not wheels.
import {isDeepStrictEqual} from 'node:util';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../lib/engine/v2/physical-first-position-start-v2.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV1,
  replayPhysicalFirstPositionGeneralRaceV1} from
  '../lib/engine/v2/physical-first-position-general-race-v1.mjs';

const option=(name,fallback)=>process.argv.find(arg=>
  arg.startsWith(`--${name}=`))?.slice(name.length+3)??
  fallback;
const categories=option('categories','men,women').split(',');
const terrains=option('terrains','mountain').split(',');
const chases=option('chases','selective').split(',');
const attack=option('attack','none');
if(categories.some(value=>
  !['men','women'].includes(value))||
  terrains.some(value=>
    !['flat','rolling','mountain'].includes(value))||
  chases.some(value=>
    !['selective','all'].includes(value))||
  !['none','selective','repeated'].includes(attack))
  throw new Error('General audit has unsupported inputs.');
const rows=[];
const plannedCases=categories.length*terrains.length*
  chases.length;
for(const category of categories)
  for(const terrain of terrains)
    for(const chase of chases){
      let request=null,source=null,position=null;
      let sourceError=null,positionError=null;
      try{
        const prepared=preparePhysicalFirstSplitMotorInputV1(
          category,{terrain,chase,attack,
            seed:'preview-recorded-road-1'});
        const input={...prepared.input,
          positionModelVersion:
            PHYSICAL_FIRST_POSITION_START_V2_VERSION,
          positionPassingCorridorCount:1};
        request={input,
          grid:{laneCount:4,
            wheelSpacingM:2.5,
            laneStaggerM:.08}};
        source=runPhysicalFirstWholeRaceProbeV1(input);
      }catch(error){
        sourceError={message:error.message,
          sourceKm:error.sourceKm??null};
      }
      if(request){
        try{
          position=recordPhysicalFirstPositionGeneralRaceV1(
            request);
          replayPhysicalFirstPositionGeneralRaceV1(
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
        position.steps.map((step,index)=>{
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
      const row={category,terrain,chase,attack,
        sourceStatus:source?'complete':'failed',
        sourceError,
        positionStatus:position?
          'complete_replayed':'failed',
        positionError,
        riderCount:position?.riderCount??null,
        plannedKm:position?.plannedKm??null,
        decisionCoverage:position?.decisionCount===
          120*120,
        checkpointCoverage:
          position?.checkpointCrossings.length===
            120*119,
        finishCoverage:
          position?.finishCrossings.length===120,
        attackDepartures:
          position?.attackDepartureEvents.length??null,
        frontPasses:
          position?.frontPassEvents.length??null,
        alignedPelotonCheckpoints:
          comparisons.filter(item=>
            item.pelotonAligned).length,
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
        maxFinishClockDifferenceSeconds:
          finishClockDrifts.length?
            +Math.max(...finishClockDrifts).toFixed(3):null,
        sourceFinalPelotonRiders:
          sourceFinal?.roads.find(row=>
            row.roadId==='peloton')?.riderIds.length??null,
        positionFinalPelotonRiders:
          modelFinal?.positions.filter(row=>
            row.roadId==='peloton').length??null};
      rows.push(row);
      process.stderr.write(`${rows.length}/${plannedCases} `+
        `${category}, ${terrain}, ${chase}: `+
        `${row.sourceStatus}/${row.positionStatus}\n`);
    }
const summary={version:
  'physical-first-position-general-motor-lab-audit-1',
fixture:'current_motor_lab_test_input',
attack,plannedCases,
sourceCompleted:rows.filter(row=>
  row.sourceStatus==='complete').length,
positionCompletedAndReplayed:rows.filter(row=>
  row.positionStatus==='complete_replayed').length,
bothCompleted:rows.filter(row=>
  row.sourceStatus==='complete'&&
    row.positionStatus==='complete_replayed').length,
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
