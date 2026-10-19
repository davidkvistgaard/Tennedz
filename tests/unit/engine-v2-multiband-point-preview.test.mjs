import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleMultibandIndividualLine} from
  '../../lib/engine/v2/finale-multiband-individual-line.mjs';
import {projectV91ProvisionalMultibandPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';
import {pointsForDivisionResult} from
  '../../lib/calendar/points.mjs';

function source(){
  const trial=createV91ConditionalRaceFinal({distanceKm:40,
    terrain:'flat',fatigue:0,gender:'M',teamCount:4,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'});
  return {tour:trial.recording,
    line:recordFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale)};
}

test('separated provisional lines use existing points policy without awards',()=>{
  const {tour,line}=source();
  const result=projectV91ProvisionalMultibandPointPreview(tour,line,
    {tier:3,divisionIndex:1,divisionCount:1});
  assert.equal(result.riders.length,32);
  assert.equal(result.pointsStatus,'experimental_preview_only');
  assert.equal(result.classificationStatus,
    'provisional_separated_inferred_wheels');
  assert.equal(result.canCommitAwards,false);
  assert.deepEqual(result.awardRows,[]);
  assert.deepEqual(result.riders.map(row=>row.provisionalPlace),
    Array.from({length:32},(_,index)=>index+1));
  for(const row of result.riders)
    assert.equal(row.previewPoints,pointsForDivisionResult({tier:3,
      resultType:'ONE_DAY',placing:row.provisionalPlace,multiplier:1}));
});

test('a possible contact or ambiguous place withholds preview points',()=>{
  const {tour,line}=source();
  const contact=structuredClone(line);
  contact.overlapAudit.status='potential_longitudinal_overlap';
  contact.overlapAudit.firstPotentialOverlap={frontRiderId:'front',
    bunchRiderId:'bunch',distanceM:39700,
    elapsedSecondsFromLastKmStart:70};
  assert.throws(()=>projectV91ProvisionalMultibandPointPreview(
    tour,contact,{tier:3,divisionIndex:1,divisionCount:1}),
  /separate paid individual bands/);
  const ambiguous=structuredClone(line);
  ambiguous.provisionalLineOrder[0].position=null;
  assert.throws(()=>projectV91ProvisionalMultibandPointPreview(
    tour,ambiguous,{tier:3,divisionIndex:1,divisionCount:1}),
  /unambiguous multiband order/);
});
