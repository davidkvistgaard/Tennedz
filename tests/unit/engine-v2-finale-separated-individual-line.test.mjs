import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleSeparatedIndividualLine,
  validateFinaleSeparatedIndividualLine} from
  '../../lib/engine/v2/finale-separated-individual-line.mjs';
import {projectV91ProvisionalMultibandPointPreview} from
  '../../lib/engine/v2/playtest-point-preview.mjs';

function race(gender='M',teamCount=4){
  return createV91ConditionalRaceFinal({distanceKm:260,
    terrain:'mountain',fatigue:30,gender,teamCount,
    seed:'test-drive-acceptance-1',defaultRivalPlan:'attack',
    attack:'repeated',chase:'ignore'});
}

test('several paid groups and bunch reach distinct conditional lines',()=>{
  for(const gender of ['M','F'])for(const teamCount of [4,15,20]){
    const trial=race(gender,teamCount);
    assert.equal(trial.roadStatus,'paid_separated_bands');
    const line=recordFinaleSeparatedIndividualLine(
      trial.recording,trial.paidFinale);
    assert.equal(line.bandRunners.length,3);
    assert.equal(line.conditionalCrossings.length,teamCount*8);
    assert.equal(new Set(line.conditionalCrossings.map(row=>row.riderId))
      .size,teamCount*8);
    assert.equal(line.overlapAudit.status,
      'separated_through_conditional_lines');
    assert.equal(line.pre500Audit.status,
      'separated_through_conditional_lines');
    assert.deepEqual(line.provisionalLineOrder.map(row=>row.position),
      Array.from({length:teamCount*8},(_,index)=>index+1));
    assert.equal(line.classifiedResults,null);
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(line.canCommitAwards,false);
    const at500=trial.paidFinale.trace.frames.find(frame=>
      frame.endDistanceM===259500);
    const energy=new Map(at500.riders.map(row=>
      [row.riderId,row.energy]));
    for(const band of line.bandRunners)
      for(const rider of band.runner.finishers){
        const spent=band.runner.frames.reduce((sum,frame)=>sum+
          frame.riders.find(row=>row.riderId===rider.riderId)
            .energySpent,0);
        assert.ok(Math.abs(energy.get(rider.riderId)-spent-
          rider.energyAtLine)<1e-7);
      }
    assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
      trial.paidFinale,{},line),true);
    const {pre500Audit,...earlier}=line;
    assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
      trial.paidFinale,{}, {...earlier,
        version:'v2-finale-separated-individual-line-lab-1'}),true);
    const changed=structuredClone(line);
    changed.conditionalCrossings[0].energyAtLine+=1;
    assert.throws(()=>validateFinaleSeparatedIndividualLine(
      trial.recording,trial.paidFinale,{},changed),/does not replay/);
  }
});

test('same-band lead-out affects the selected bunch finisher',()=>{
  const trial=race();
  const plans=trial.recording.committedInputs.teams.map(team=>({
    teamId:team.id,
    finisherId:team.id==='you'?'you-4':team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':null}));
  const baselinePlans=plans.map(row=>({...row,leadOutRiderId:null}));
  const baseline=recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans:baselinePlans});
  const helped=recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans});
  assert.deepEqual(baseline.positionedSource,helped.positionedSource);
  const time=line=>line.conditionalCrossings.find(row=>
    row.riderId==='you-4').elapsedSecondsFromLastKmStart;
  assert.ok(time(helped)<time(baseline));
  assert.ok(helped.bandRunners[2].runner.frames.flatMap(frame=>
    frame.riders).some(row=>row.riderId==='you-5'&&
      row.role==='lead_out'&&row.energySpent>0));
  assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans},helped),true);
  const preview=projectV91ProvisionalMultibandPointPreview(
    trial.recording,helped,{tier:3,divisionIndex:1,divisionCount:1});
  assert.equal(preview.riders.length,32);
  assert.equal(preview.canCommitAwards,false);
  assert.deepEqual(preview.awardRows,[]);
  const ambiguous=structuredClone(helped);
  ambiguous.pre500Audit.status='potential_longitudinal_overlap';
  ambiguous.pre500Audit.firstPotentialOverlap={distanceM:259400};
  assert.throws(()=>projectV91ProvisionalMultibandPointPreview(
    trial.recording,ambiguous,{tier:3,divisionIndex:1,
      divisionCount:1}),/separate paid individual bands/);
});

test('a helper cannot serve a finisher in another separated group',()=>{
  const trial=race();
  const plans=trial.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':null}));
  assert.throws(()=>recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans}),/cannot work beside the finisher/);
});

test('a separated singleton pays a nominated sprint or keeps its road passage',()=>{
  const trial=createV91ConditionalRaceFinal({distanceKm:40,
    terrain:'flat',teamCount:4,gender:'M',seed:'conditional-coverage-1',
    attack:'repeated',chase:'ignore',defaultRivalPlan:'attack',
    managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}]});
  const sprint=recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale);
  assert.equal(sprint.version,'v2-finale-separated-individual-line-lab-3');
  assert.equal(sprint.bandRunners.length,3);
  assert.equal(sprint.conditionalCrossings.length,32);
  assert.equal(sprint.overlapAudit.status,
    'separated_through_conditional_lines');
  const solo=sprint.bandRunners[0].runner;
  assert.equal(solo.finishers[0].riderId,'you-7');
  assert.deepEqual(solo.frames.map(frame=>frame.riders[0].role),
    ['solo_front','solo_front','solo_sprint','solo_sprint','solo_sprint']);
  assert.ok(solo.frames.slice(2).every(frame=>
    frame.riders[0].energySpent>0));
  assert.ok(solo.finishers[0].elapsedSecondsFromLastKmStart<
    trial.paidFinale.line.bands[0].passageSecondsFromBunchMarker);
  assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{},sprint),true);

  const plans=trial.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.id==='you'?'you-4':
      team.orders.captainId,leadOutRiderId:null}));
  const passive=recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans});
  assert.ok(passive.bandRunners[0].runner.frames.every(frame=>
    frame.riders[0].role==='solo_front'));
  assert.equal(passive.bandRunners[0].runner.finishers[0]
    .elapsedSecondsFromLastKmStart,
  trial.paidFinale.line.bands[0].passageSecondsFromBunchMarker);
  assert.equal(passive.bandRunners[0].runner.finishers[0].energyAtLine,
    trial.paidFinale.line.finalRiderEnergy.find(row=>
      row.riderId==='you-7').energy);
  assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans},passive),true);
  const withLeadOut=plans.map(plan=>plan.teamId==='you'?{
    ...plan,leadOutRiderId:'you-5'}:plan);
  const helped=recordFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans:withLeadOut});
  assert.ok(helped.conditionalCrossings.find(row=>row.riderId==='you-4')
    .elapsedSecondsFromLastKmStart<passive.conditionalCrossings.find(row=>
      row.riderId==='you-4').elapsedSecondsFromLastKmStart);
  assert.deepEqual(helped.bandRunners[0],passive.bandRunners[0]);
  assert.ok(helped.bandRunners.at(-1).runner.frames.flatMap(frame=>
    frame.riders).some(row=>row.riderId==='you-5'&&
      row.role==='lead_out'&&row.energySpent>0));
  assert.equal(validateFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{plans:withLeadOut},helped),true);
  const changed=structuredClone(sprint);
  changed.bandRunners[0].runner.frames[3].riders[0].energySpent+=1;
  assert.throws(()=>validateFinaleSeparatedIndividualLine(trial.recording,
    trial.paidFinale,{},changed),/does not replay/);
});
