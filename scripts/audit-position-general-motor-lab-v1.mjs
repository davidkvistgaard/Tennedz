// Same-input audit of the experimental positional recorder against
// current 120-rider Motor Lab test inputs. Group clocks are not wheels.
// --require-ready exits nonzero unless complete V7 replay, an unambiguous
// finish, source-comparable decisions and official results all exist.
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
  replayPhysicalFirstPositionGeneralRaceV4,
  recordPhysicalFirstPositionGeneralRaceV5,
  replayPhysicalFirstPositionGeneralRaceV5,
  recordPhysicalFirstPositionGeneralRaceV6,
  replayPhysicalFirstPositionGeneralRaceV6,
  recordPhysicalFirstPositionGeneralRaceV7,
  replayPhysicalFirstPositionGeneralRaceV7} from
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
const sprintStakes=option('sprint-stakes','none');
const requireReady=process.argv.includes('--require-ready');
const seeds=option('seeds',
  'preview-recorded-road-1').split(',');
if(categories.some(value=>
  !['men','women'].includes(value))||
  terrains.some(value=>
    !['flat','rolling','mountain'].includes(value))||
  chases.some(value=>
    !['selective','all'].includes(value))||
  !['none','selective','repeated'].includes(attack)||
  !['1','2','3','4','5','6','7'].includes(positionVersion)||
  !['1','2'].includes(sourceVersion)||
  !['none','you','rivals','all'].includes(sprintStakes)||
  sprintStakes!=='none'&&
    !['6','7'].includes(positionVersion)||
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
        if(sprintStakes!=='none')
          input.stakes=input.stakes.map(stake=>({
            ...stake,sportingGoal:sprintStakes==='all'||
              sprintStakes==='you'&&stake.teamId==='you'||
              sprintStakes==='rivals'&&
                stake.teamId!=='you'?
              'sprint_finish':stake.sportingGoal}));
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
          position=(positionVersion==='7'?
            recordPhysicalFirstPositionGeneralRaceV7:
            positionVersion==='6'?
            recordPhysicalFirstPositionGeneralRaceV6:
            positionVersion==='5'?
            recordPhysicalFirstPositionGeneralRaceV5:
            positionVersion==='4'?
            recordPhysicalFirstPositionGeneralRaceV4:
            positionVersion==='3'?
              recordPhysicalFirstPositionGeneralRaceV3:
            positionVersion==='2'?
              recordPhysicalFirstPositionGeneralRaceV2:
              recordPhysicalFirstPositionGeneralRaceV1)(request);
          (positionVersion==='7'?
            replayPhysicalFirstPositionGeneralRaceV7:
            positionVersion==='6'?
            replayPhysicalFirstPositionGeneralRaceV6:
            positionVersion==='5'?
            replayPhysicalFirstPositionGeneralRaceV5:
            positionVersion==='4'?
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
      const firstFrontLeaderMismatch=
        frontLeaderMismatches.length?(()=>{
          const index=frontLeaderMismatches[0]-1;
          const before=index===0?position.start:
            position.steps[index-1].sharedRoad;
          const candidate=before.positions.find(row=>
            row.riderId===source.steps[index]
              .peloton.road.leaderRiderId);
          const modelFront=before.positions.find(row=>
            row.riderId===before.leaderRiderId);
          return {sourceKm:index+1,
            sourceLeaderRiderId:source.steps[index]
              .peloton.road.leaderRiderId,
            positionLeaderRiderId:position.steps[index]
              .sharedRoad.leaderRiderId,
            positionFrontPassRefusal:
              position.steps[index].frontPassRefusal??null,
            positionFrontPassEvent:
              position.steps[index].sharedRoad
                .frontPassEvent??null,
            sourceLeaderPriorPosition:candidate?{
              roadId:candidate.roadId,
              lane:candidate.lane,
              distanceBehindModelFrontM:modelFront?
                modelFront.distanceM-candidate.distanceM:null,
              aheadInLaneCount:before.positions.filter(row=>
                row.roadId==='peloton'&&
                row.lane===candidate.lane&&
                row.distanceM>candidate.distanceM).length}:null};
        })():null;
      const attackChoiceMismatches=source&&position?
        source.steps.flatMap((step,index)=>
          step.attackChoices.flatMap(sourceChoice=>{
            const modelChoice=position.steps[index]
              .attackChoices.find(row=>
                row.teamId===sourceChoice.teamId);
            return modelChoice&&
              modelChoice.choice===sourceChoice.choice&&
              modelChoice.riderId===sourceChoice.riderId&&
              modelChoice.forwardRiderCount===
                sourceChoice.forwardRiderCount?[]:[{
                sourceKm:index+1,
                teamId:sourceChoice.teamId,
                sourceChoice:sourceChoice.choice,
                positionChoice:modelChoice?.choice??null,
                sourceForwardRiderCount:
                  sourceChoice.forwardRiderCount,
                positionForwardRiderCount:
                  modelChoice?.forwardRiderCount??null,
                sourceOtherRoadRiders:
                  source.states[index].riders.filter(row=>
                    row.teamId===sourceChoice.teamId&&
                    row.roadId!=='peloton').map(row=>({
                    riderId:row.riderId,
                    roadId:row.roadId,
                    leadSeconds:
                      source.states[index].roads.find(road=>
                        road.roadId===row.roadId)
                        ?.leadOverFrontSeconds??null})),
                positionOtherRoadRiders:index===0?[]:
                  position.steps[index-1].sharedRoad
                    .positions.filter(row=>
                      row.teamId===sourceChoice.teamId&&
                      row.roadId!=='peloton').map(row=>({
                      riderId:row.riderId,
                      roadId:row.roadId,
                      distanceM:row.distanceM,
                      frontDistanceM:
                        position.steps[index-1].sharedRoad
                          .frontDistanceM}))}];
          })):[];
      const sourceAttacks=source?.steps.flatMap(step=>
        step.attackSteps.map(attackStep=>
          `${step.sourceKm}:${attackStep.choice.riderId}`))??[];
      const mismatchesWithFinishedSourceRider=
        attackChoiceMismatches.filter(mismatch=>
          mismatch.sourceOtherRoadRiders.some(sourceRider=>
            mismatch.positionOtherRoadRiders.some(
              positionRider=>
                positionRider.riderId===sourceRider.riderId&&
                positionRider.roadId==='finished')));
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
        officialResults:position?.officialResults??null,
        unresolvedFinishClockTies:
          position?.finaleFinishTieObservations
            ?.length??null,
        attackDepartures:
          position?.attackDepartureEvents.length??null,
        attackCapacityRefusals:
          position?.attackCapacityRefusals.length??null,
        sprintAttempts:position?.finaleSprintDecisions
          ?.filter(choice=>choice.choice===
            'attempt_paid_sprint').length??null,
        sprintPasses:position?.finaleSprintPassEvents
          ?.length??null,
        sprintLaneEvents:position?.finaleSprintLaneEvents
          ?.length??null,
        finalePositionFrames:
          position?.tail.positionFrames?.length??null,
        finaleFrameRiderCoverage:
          position?.tail.positionFrames?.every(frame=>
            frame.positions.length===
              position.riderCount)??null,
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
        firstFrontLeaderMismatch,
        attackChoiceMismatchCount:source&&position?
          attackChoiceMismatches.length:null,
        attackChoiceMismatchesWithSourceRiderAlreadyFinished:
          source&&position?
            mismatchesWithFinishedSourceRider.length:null,
        attackChoiceMismatchesWithoutFinishedSourceRider:
          source&&position?
            attackChoiceMismatches.length-
              mismatchesWithFinishedSourceRider.length:null,
        firstAttackChoiceMismatch:
          attackChoiceMismatches[0]??null,
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
enginePath:positionVersion==='7'?
  'physical-first-position-general-race-v7':
  'physical-first-position-general-race-earlier',
fixture:sprintStakes==='none'?
  'current_motor_lab_test_input':
  'synthetic_stake_variant_of_motor_lab_test_input',
attack,positionVersion,sourceVersion,sprintStakes,
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
fullFinaleFrameCoverage:rows.filter(row=>
  row.finaleFrameRiderCoverage===true).length,
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
casesWithAttackChoiceMismatch:rows.filter(row=>
  (row.attackChoiceMismatchCount??0)>0).length,
casesWithAttackChoiceMismatchWithoutFinishedSourceRider:
  rows.filter(row=>
    (row.attackChoiceMismatchesWithoutFinishedSourceRider??0)>0)
    .length,
casesWithPelotonMembershipMismatch:rows.filter(row=>
  row.firstPelotonMismatchKm!==null).length,
maxFinalReserveDifference:rows.every(row=>
  row.maxFinalReserveDifference!==null)?
  Math.max(...rows.map(row=>
    row.maxFinalReserveDifference)):null,
maxSourceGroupClockVsWheelFinishSeconds:
  rows.every(row=>
    row.maxSourceGroupClockVsWheelFinishSeconds!==null)?
    Math.max(...rows.map(row=>
      row.maxSourceGroupClockVsWheelFinishSeconds)):null,
casesWithSprintPasses:rows.filter(row=>
  (row.sprintPasses??0)>0).length,
casesWithUnresolvedFinishClockTies:rows.filter(row=>
  (row.unresolvedFinishClockTies??0)>0).length,
officialResultsAvailable:rows.filter(row=>
  row.officialResults===true).length,
officialResults:rows.length>0&&rows.every(row=>
  row.officialResults===true),
readyForGuidedRaces:positionVersion==='7'&&
  sourceVersion==='2'&&rows.length>0&&
  rows.every(row=>row.sourceStatus==='complete_replayed'&&
    row.positionStatus==='complete_replayed'&&
    row.decisionCoverage&&row.checkpointCoverage&&
    row.finishCoverage&&row.finaleFrameRiderCoverage&&
    row.unresolvedFinishClockTies===0&&
    row.officialResults===true&&
    row.attackChoiceMismatchesWithoutFinishedSourceRider===0&&
    row.firstPelotonMismatchKm===null)};
process.stdout.write(JSON.stringify({summary,rows},
  null,2)+'\n');
if(rows.some(row=>row.positionStatus!==
  'complete_replayed'||
  row.sourceStatus!==(sourceVersion==='2'?
    'complete_replayed':'complete')||
  !row.decisionCoverage||
  !row.checkpointCoverage||
  !row.finishCoverage||
  positionVersion==='7'&&
    !row.finaleFrameRiderCoverage)||
  requireReady&&!summary.readyForGuidedRaces)
  process.exitCode=1;
