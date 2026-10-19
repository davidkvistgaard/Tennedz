import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91TestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {recordFinaleNamedAttackMultipleDroppedRoadFromTour,
  validateFinaleNamedAttackMultipleDroppedSprintRoadFromTour} from
  '../../lib/engine/v2/finale-named-attack-dropped-road.mjs';
import {validateFinaleNamedMultipleDroppedSprintSurvivorLine} from
  '../../lib/engine/v2/finale-named-dropped-survivor-line.mjs';
import {validateFinaleNamedMultipleDroppedSprintLateCatchLine} from
  '../../lib/engine/v2/finale-named-dropped-late-catch-line.mjs';
import {paidSoloSprintPassage} from
  '../../lib/engine/v2/finale-solo-sprint-work.mjs';
import {projectV91ProvisionalNamedMultipleDroppedSprintSurvivorPointPreview,
  projectV91ProvisionalNamedMultipleDroppedSprintLateCatchPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';

const pointContext={tier:3,divisionIndex:1,divisionCount:1};

function scenario({teamCount=4,gender='M',terrain='flat'}={}){
  const riderId=terrain==='mountain'?'you-6':'you-7';
  return {settings:{distanceKm:40,terrain,fatigue:0,gender,teamCount,
    seed:'test-drive-acceptance-1',attack:'none',chase:'all',
    managerTactics:Array.from({length:teamCount-1},()=>({
      effort:'steady',attack:'none',chase:'all'})),
    teamOverrides:[{teamId:'you',level:74,fatigue:0},
      {teamId:'rival-1',level:88,fatigue:0},
      {teamId:'rival-2',level:66,fatigue:0}]},
  namedDroppedRoad:true,lateCatchLine:true,
  attack:{teamId:'you',riderId},
  finalePlans:[{teamId:'you',finisherId:riderId}],pointContext};
}

test('a nominated solo sprint changes contact on the same paid road clock',()=>{
  for(const teamCount of [4,15,20])for(const gender of ['M','F'])
    for(const terrain of ['flat','mountain']){
      const trial=runV91TestDrive(scenario({teamCount,gender,terrain}),
        {full:true});
      const {summary,recording,paidRoad,individualLine}=trial;
      const riderId=paidRoad.attackIntent.riderId;
      assert.equal(summary.version,'v91-offline-test-drive-11');
      assert.equal(summary.status,'conditional_line');
      assert.equal(paidRoad.sprintRiderId,riderId);
      assert.equal(paidRoad.sprintFromDistanceM,39700);
      assert.equal(individualLine.conditionalCrossings.length,teamCount*8);
      assert.equal(new Set(individualLine.conditionalCrossings.map(row=>
        row.riderId)).size,teamCount*8);
      assert.ok(summary.lastKmSource.droppedRiderIds.length>=2);
      const oldRoad=recordFinaleNamedAttackMultipleDroppedRoadFromTour(
        recording.recording,{teamId:'you'});
      const oldContact=oldRoad.frames.find(frame=>
        frame.active.catchDistanceM)?.active.catchDistanceM;
      const newContact=paidRoad.frames.find(frame=>
        frame.active.catchDistanceM)?.active.catchDistanceM;
      assert.ok(oldContact>39700);
      if(terrain==='flat'){
        assert.equal(newContact,undefined);
        assert.equal(paidRoad.frames.at(-1).active.roadGroups.length,1);
      }else{
        assert.ok(newContact>oldContact);
        assert.equal(paidRoad.frames.at(-1).active.roadGroups.length,0);
      }
      const sprintFrames=paidRoad.frames.filter(frame=>
        frame.active.frontWorkKind==='solo_sprint');
      assert.ok(sprintFrames.length>=1);
      for(const frame of sprintFrames){
        const energy=frame.active.riderEnergy.find(row=>
          row.riderId===riderId);
        const rider=recording.recording.committedInputs.teams
          .flatMap(team=>team.riders).find(row=>row.id===riderId);
        const paid=paidSoloSprintPassage(rider,
          recording.recording.route.kilometres.at(-1),
          energy.energyAtDecision);
        assert.ok(Math.abs(frame.active.frontSpeedKph-
          360/paid.durationSeconds)<1e-7);
        const fraction=((frame.active.catchDistanceM??frame.distanceM)-
          frame.active.startDistanceM)/100;
        assert.ok(energy.energySpent+1e-7>=
          paid.energySpent*fraction);
        assert.ok(energy.energyAfter>=0);
      }
      assert.equal(validateFinaleNamedAttackMultipleDroppedSprintRoadFromTour(
        recording.recording,{teamId:'you',finisherId:riderId},paidRoad),
      true);
      const validateLine=terrain==='flat'?
        validateFinaleNamedMultipleDroppedSprintSurvivorLine:
        validateFinaleNamedMultipleDroppedSprintLateCatchLine;
      assert.equal(validateLine(recording.recording,paidRoad,
        {plans:summary.request.plans},individualLine),true);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
    }
});

test('separated sprint roads permit read-only points; contact withholds them',
  ()=>{
    for(const terrain of ['flat','mountain']){
      const trial=runV91TestDrive(scenario({terrain}),{full:true});
      const preview=(terrain==='flat'?
        projectV91ProvisionalNamedMultipleDroppedSprintSurvivorPointPreview:
        projectV91ProvisionalNamedMultipleDroppedSprintLateCatchPointPreview)(
        trial.recording.recording,trial.paidRoad,trial.individualLine,
        pointContext);
      assert.equal(preview.riders.length,32);
      assert.deepEqual(preview,trial.summary.provisionalPointPreview);
      assert.deepEqual(preview.awardRows,[]);
      const altered=structuredClone(trial.paidRoad);
      altered.frames.at(-1).active.riderEnergy[0].energySpent+=1;
      assert.throws(()=>
        validateFinaleNamedAttackMultipleDroppedSprintRoadFromTour(
          trial.recording.recording,{teamId:'you',finisherId:
            trial.paidRoad.sprintRiderId},altered),/does not replay/);
    }
    const crowded=runV91TestDrive(scenario({teamCount:15}));
    assert.equal(crowded.provisionalPointPreview.status,'unavailable');
    assert.equal(crowded.pointsStatus,'withheld');
  });
