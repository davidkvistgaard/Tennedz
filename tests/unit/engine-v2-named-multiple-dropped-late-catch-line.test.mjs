import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91TestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleNamedMultipleDroppedLateCatchLine,
  FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION} from
  '../../lib/engine/v2/finale-named-dropped-late-catch-line.mjs';
import {projectV91ProvisionalNamedMultipleDroppedLateCatchPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';

const pointContext={tier:3,divisionIndex:1,divisionCount:1};

function scenario({teamCount=4,gender='M',terrain='flat',
  distanceKm=120}={}){
  return {settings:{distanceKm,terrain,fatigue:30,gender,teamCount,
    seed:'test-drive-acceptance-1',attack:'none',chase:'ignore',
    managerTactics:Array.from({length:teamCount-1},()=>({
      effort:'steady',attack:'none',chase:'ignore'})),
    teamOverrides:[{teamId:'you',level:74,fatigue:30},
      {teamId:'rival-1',level:88,fatigue:0},
      {teamId:'rival-2',level:66,fatigue:30}]},
  namedDroppedRoad:true,lateCatchLine:true,
  attack:{teamId:'you',riderId:'you-2'},pointContext};
}

test('late contact pays merged bunch and every isolated line on one clock',()=>{
  for(const teamCount of [4,15,20])for(const gender of ['M','F'])
    for(const terrain of ['flat','rolling','mountain']){
      const trial=runV91TestDrive(scenario({teamCount,gender,terrain}),
        {full:true});
      const {summary,recording,paidRoad,individualLine}=trial;
      assert.equal(summary.status,'conditional_line');
      assert.equal(individualLine.version,
        FINALE_NAMED_MULTIPLE_DROPPED_LATE_CATCH_LINE_VERSION);
      assert.equal(individualLine.bandRunners.length,
        summary.lastKmSource.droppedRiderIds.length+1);
      assert.equal(individualLine.conditionalCrossings.length,teamCount*8);
      assert.equal(new Set(individualLine.conditionalCrossings.map(row=>
        row.riderId)).size,teamCount*8);
      assert.equal(summary.finale.bandsAtContactBoundary.length,
        individualLine.bandRunners.length);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(validateFinaleNamedMultipleDroppedLateCatchLine(
        recording.recording,paidRoad,{plans:summary.request.plans??null},
        individualLine),true);
    }
});

test('long road, point preview, paid solo sprint and unpaid lead-out are gated',()=>{
  for(const terrain of ['flat','rolling','mountain']){
    const input=scenario({distanceKm:260,terrain});
    const trial=runV91TestDrive(input,{full:true});
    assert.equal(trial.summary.status,'conditional_line');
    assert.equal(trial.summary.finale.lineTimes.length,32);
    assert.equal(trial.summary.pointsStatus,'withheld');
  }
  const input=scenario();
  const trial=runV91TestDrive(input,{full:true});
  const preview=projectV91ProvisionalNamedMultipleDroppedLateCatchPointPreview(
    trial.recording.recording,trial.paidRoad,trial.individualLine,
    pointContext);
  assert.equal(preview.riders.length,32);
  assert.deepEqual(preview,trial.summary.provisionalPointPreview);
  assert.deepEqual(preview.awardRows,[]);
  const altered=structuredClone(trial.individualLine);
  altered.bandRunners.at(-1).runner.frames[0].riders[0]
    .energySpent+=1;
  assert.throws(()=>validateFinaleNamedMultipleDroppedLateCatchLine(
    trial.recording.recording,trial.paidRoad,
    {plans:trial.summary.request.plans??null},altered),
  /does not replay/);
  const solo=runV91TestDrive({...input,finalePlans:[{
    teamId:'you',finisherId:'you-2'}]});
  assert.equal(solo.status,'conditional_line');
  assert.equal(solo.version,'v91-offline-test-drive-11');
  assert.equal(solo.pointsStatus,'withheld');
  const helper=runV91TestDrive({...input,finalePlans:[{
    teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-6'}]});
  assert.equal(helper.status,'unsupported');
  assert.match(helper.reason,/pre-contact lead-out needs separate paid road work/);
});
