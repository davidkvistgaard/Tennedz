import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91TestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleNamedMultipleDroppedSurvivorLine,
  FINALE_NAMED_MULTIPLE_DROPPED_SURVIVOR_LINE_VERSION} from
  '../../lib/engine/v2/finale-named-dropped-survivor-line.mjs';
import {projectV91ProvisionalNamedMultipleDroppedSurvivorPointPreview} from
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
  namedDroppedRoad:true,attack:{teamId:'you',riderId:'you-7'},
  pointContext};
}

test('surviving attacker and all isolated riders have paid replayed lines',()=>{
  for(const teamCount of [4,15,20])for(const gender of ['M','F'])
    for(const terrain of ['flat','rolling','mountain']){
      const trial=runV91TestDrive(scenario({teamCount,gender,terrain}),
        {full:true});
      const {summary,recording,paidRoad,individualLine}=trial;
      assert.equal(summary.status,'conditional_line');
      assert.equal(individualLine.version,
        FINALE_NAMED_MULTIPLE_DROPPED_SURVIVOR_LINE_VERSION);
      assert.equal(paidRoad.frames.at(-1).active.roadGroups.length,1);
      assert.equal(individualLine.bandRunners.length,
        summary.lastKmSource.droppedRiderIds.length+2);
      assert.equal(individualLine.conditionalCrossings.length,teamCount*8);
      assert.equal(new Set(individualLine.conditionalCrossings.map(row=>
        row.riderId)).size,teamCount*8);
      assert.equal(summary.finale.bandsAt500M.length,
        individualLine.bandRunners.length);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(validateFinaleNamedMultipleDroppedSurvivorLine(
        recording.recording,paidRoad,{plans:summary.request.plans??null},
        individualLine),true);
    }
});

test('solo sprint and helper work are paid; unresolved contact withholds points',()=>{
  const input=scenario();
  const ordinary=runV91TestDrive(input,{full:true});
  const led=runV91TestDrive({...input,finalePlans:[{
    teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-6'}]},{full:true});
  assert.deepEqual(led.paidRoad,ordinary.paidRoad);
  assert.equal(ordinary.individualLine.bandRunners[0].runner.frames.at(-1)
    .riders[0].role,'solo_sprint');
  assert.ok(ordinary.individualLine.bandRunners[0].runner.frames.at(-1)
    .riders[0].energySpent>0);
  const crossing=(trial,id)=>trial.summary.finale.lineTimes.find(row=>
    row.riderId===id);
  assert.ok(crossing(led,'rival-1-7').elapsedSecondsFromLastKmStart<
    crossing(ordinary,'rival-1-7').elapsedSecondsFromLastKmStart);
  for(const id of ordinary.summary.lastKmSource.droppedRiderIds)
    assert.deepEqual(crossing(led,id),crossing(ordinary,id));
  assert.equal(ordinary.summary.provisionalPointPreview.riders.length,32);
  assert.deepEqual(ordinary.summary.provisionalPointPreview,
    projectV91ProvisionalNamedMultipleDroppedSurvivorPointPreview(
      ordinary.recording.recording,ordinary.paidRoad,
      ordinary.individualLine,pointContext));
  assert.equal(led.summary.provisionalPointPreview.status,'unavailable');
  const altered=structuredClone(ordinary.individualLine);
  altered.bandRunners.at(-1).runner.frames[0].riders[0]
    .energySpent+=1;
  assert.throws(()=>validateFinaleNamedMultipleDroppedSurvivorLine(
    ordinary.recording.recording,ordinary.paidRoad,
    {plans:ordinary.summary.request.plans??null},altered),
  /does not replay/);
});
