import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91TestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {validateFinaleNamedAttackMultipleDroppedRoadFromTour} from
  '../../lib/engine/v2/finale-named-attack-dropped-road.mjs';
import {recordFinaleNamedMultipleDroppedIndividualLine,
  validateFinaleNamedMultipleDroppedIndividualLine} from
  '../../lib/engine/v2/finale-named-dropped-individual-line.mjs';
import {projectV91ProvisionalNamedMultipleDroppedPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';

const pointContext={tier:3,divisionIndex:1,divisionCount:1};

function scenario({teamCount=4,gender='M',terrain='flat',
  distanceKm=120,seed='test-drive-acceptance-1'}={}){
  return {settings:{distanceKm,terrain,fatigue:30,gender,teamCount,seed,
    attack:'none',chase:'ignore',defaultRivalPlan:'chase',
    teamOverrides:[{teamId:'you',level:74,fatigue:30},
      {teamId:'rival-1',level:88,fatigue:0},
      {teamId:'rival-2',level:66,fatigue:30}]},
  namedDroppedRoad:true,attack:{teamId:'you',riderId:'you-4'},
  pointContext};
}

test('several dropped riders keep independent paid lines across fields',()=>{
  for(const teamCount of [4,15,20])for(const gender of ['M','F'])
    for(const terrain of ['flat','rolling','mountain']){
      const trial=runV91TestDrive(scenario({teamCount,gender,terrain}),
        {full:true});
      const {summary,recording,paidRoad,individualLine}=trial;
      const expected=teamCount*8;
      const dropped=summary.lastKmSource.droppedRiderIds;
      assert.equal(summary.version,'v91-offline-test-drive-10');
      assert.equal(summary.status,'conditional_line');
      assert.ok(dropped.length>=2);
      assert.equal(individualLine.bandRunners.length,dropped.length+1);
      assert.equal(individualLine.conditionalCrossings.length,expected);
      assert.equal(new Set(individualLine.conditionalCrossings.map(row=>
        row.riderId)).size,expected);
      assert.equal(summary.finale.bandsAt500M.length,dropped.length+1);
      assert.equal(summary.provisionalPointPreview.riders.length,expected);
      assert.deepEqual(summary.provisionalPointPreview.awardRows,[]);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(validateFinaleNamedAttackMultipleDroppedRoadFromTour(
        recording.recording,{teamId:'you'},paidRoad),true);
      assert.equal(validateFinaleNamedMultipleDroppedIndividualLine(
        recording.recording,paidRoad,{plans:summary.request.plans??null},
        individualLine),true);
    }
});

test('a nominated helper changes the finish without moving isolated riders',()=>{
  const input=scenario();
  const ordinary=runV91TestDrive(input,{full:true});
  const led=runV91TestDrive({...input,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-6'}]},
  {full:true});
  assert.deepEqual(led.paidRoad,ordinary.paidRoad);
  assert.ok(led.summary.finale.leadOutWork.some(row=>
    row.riderId==='you-6'&&row.energySpent>0));
  const crossing=(trial,id)=>trial.summary.finale.lineTimes.find(row=>
    row.riderId===id);
  assert.ok(crossing(led,'you-7').elapsedSecondsFromLastKmStart<
    crossing(ordinary,'you-7').elapsedSecondsFromLastKmStart);
  for(const id of ordinary.summary.lastKmSource.droppedRiderIds)
    assert.deepEqual(crossing(led,id),crossing(ordinary,id));
  const preview=projectV91ProvisionalNamedMultipleDroppedPointPreview(
    led.recording.recording,led.paidRoad,led.individualLine,pointContext);
  assert.deepEqual(preview,led.summary.provisionalPointPreview);
  const altered=structuredClone(led.individualLine);
  altered.bandRunners[1].runner.frames[0].riders[0].energySpent+=1;
  assert.throws(()=>validateFinaleNamedMultipleDroppedIndividualLine(
    led.recording.recording,led.paidRoad,
    {plans:led.summary.request.plans},altered),/does not replay/);
});

test('long flat and mountain catches retain the paid field in both categories',()=>{
  for(const seed of ['test-drive-acceptance-1',
    'test-drive-acceptance-2'])for(const gender of ['M','F'])
    for(const terrain of ['flat','mountain']){
      const trial=runV91TestDrive(scenario({distanceKm:260,
        seed,gender,terrain}));
      assert.equal(trial.status,'conditional_line');
      assert.equal(trial.finale.lineTimes.length,32);
      assert.equal(trial.finale.provisionalLineOrder.length,32);
      assert.equal(trial.provisionalPointPreview.riders.length,32);
      assert.equal(trial.pointsStatus,'withheld');
    }
});

test('unpayable and isolated finisher plans refuse without points',()=>{
  const rolling=runV91TestDrive(scenario({distanceKm:260,
    terrain:'rolling'}));
  assert.equal(rolling.status,'unsupported');
  assert.match(rolling.reason,/cannot pay to finish/);
  assert.equal(rolling.provisionalPointPreview.status,'unavailable');
  assert.equal(rolling.pointsStatus,'withheld');
  const input=scenario();
  const isolated=runV91TestDrive({...input,finalePlans:[{
    teamId:'rival-2',finisherId:'rival-2-0'}]});
  assert.equal(isolated.status,'unsupported');
  assert.equal(isolated.reason,
    'An isolated rider cannot be a paid finisher.');
  const ordinary=runV91TestDrive(input,{full:true});
  assert.throws(()=>recordFinaleNamedMultipleDroppedIndividualLine(
    ordinary.recording.recording,ordinary.paidRoad,{
      plans:ordinary.recording.recording.committedInputs.teams.map(team=>({
        teamId:team.id,finisherId:team.id==='rival-2'?
          'rival-2-0':team.orders.captainId,
        leadOutRiderId:null}))}),/isolated rider cannot/);
});
