import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91TestDrive} from '../../scripts/engine-v2-test-drive.mjs';
import {projectV91ProvisionalNamedDroppedPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';

const pointContext={tier:3,divisionIndex:1,divisionCount:1};

function source(attacker='you-0'){
  return runV91TestDrive({settings:{distanceKm:260,terrain:'flat',
    fatigue:30,gender:'M',teamCount:4,
    seed:'test-drive-acceptance-1',attack:'none',chase:'ignore',
    defaultRivalPlan:'chase'},
  attack:{teamId:'you',riderId:attacker},namedDroppedRoad:true,
  pointContext},{full:true});
}

test('named caught and isolated lines project only the existing policy',()=>{
  const trial=source();
  const preview=trial.summary.provisionalPointPreview;
  assert.equal(preview.version,
    'v91-provisional-named-dropped-point-preview-1');
  assert.equal(preview.riders.length,32);
  assert.equal(preview.pointsStatus,'experimental_preview_only');
  assert.equal(preview.classificationStatus,
    'provisional_separated_inferred_wheels');
  assert.equal(preview.canCommitAwards,false);
  assert.deepEqual(preview.awardRows,[]);
  assert.equal(trial.summary.pointsStatus,'withheld');
  for(const row of preview.riders){
    assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
      resultType:'ONE_DAY',placing:row.provisionalPlace,multiplier:1}));
    const crossing=trial.individualLine.conditionalCrossings.find(
      rider=>rider.riderId===row.riderId);
    assert.equal(row.elapsedSecondsFromLastKmStart,
      crossing.elapsedSecondsFromLastKmStart);
    assert.equal(row.energyAtLine,crossing.energyAtLine);
  }
  const surviving=source('you-4');
  assert.equal(surviving.summary.provisionalPointPreview.status,
    'unavailable');
});

test('named dropped preview rejects contact and ambiguous places',()=>{
  const trial=source();
  const tour=trial.recording.recording;
  const contact=structuredClone(trial.individualLine);
  contact.overlapAudit.firstPotentialOverlap={
    firstRoadBandId:'peloton',secondRoadBandId:'isolated:rival-2-0',
    firstRiderId:'you-0',secondRiderId:'rival-2-0',
    elapsedSecondsFromLastKmStart:90,distanceM:259900};
  assert.throws(()=>projectV91ProvisionalNamedDroppedPointPreview(
    tour,trial.paidRoad,contact,pointContext),
  /separate paid named and dropped lines/);
  const ambiguous=structuredClone(trial.individualLine);
  ambiguous.provisionalLineOrder[0].position=null;
  assert.throws(()=>projectV91ProvisionalNamedDroppedPointPreview(
    tour,trial.paidRoad,ambiguous,pointContext),
  /does not replay/);
});
