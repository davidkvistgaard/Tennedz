import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';
import {recordFinaleMultibandIndividualLine,
  validateFinaleMultibandIndividualLine} from
  '../../lib/engine/v2/finale-multiband-individual-line.mjs';

function race({distanceKm=40,gender='M',teamCount=4}={}){
  return createV91ConditionalRaceFinal({distanceKm,
    terrain:distanceKm===40?'flat':'rolling',
    fatigue:distanceKm===40?0:15,
    gender,teamCount,seed:'test-drive-acceptance-1',
    defaultRivalPlan:'attack',attack:'repeated',chase:'ignore'});
}

test('one paid group and bunch continue to every conditional individual line',()=>{
  for(const settings of [
    {distanceKm:40,gender:'M',teamCount:4},
    {distanceKm:40,gender:'F',teamCount:15},
    {distanceKm:40,gender:'M',teamCount:20},
    {distanceKm:120,gender:'F',teamCount:4},
    {distanceKm:120,gender:'M',teamCount:15},
    {distanceKm:120,gender:'F',teamCount:20}]){
    const trial=race(settings);
    assert.equal(trial.roadStatus,'paid_group_bands');
    const line=recordFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale);
    assert.equal(line.bandRunners.length,2);
    assert.equal(line.conditionalCrossings.length,settings.teamCount*8);
    assert.equal(new Set(line.conditionalCrossings.map(row=>row.riderId))
      .size,settings.teamCount*8);
    assert.equal(line.classifiedResults,null);
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(line.canCommitAwards,false);
    assert.equal(line.overlapAudit.status,
      'separated_through_conditional_lines');
    assert.equal(line.overlapAudit.firstPotentialOverlap,null);
    assert.equal(line.provisionalLineOrder.length,settings.teamCount*8);
    assert.deepEqual(line.provisionalLineOrder.map(row=>row.position),
      Array.from({length:settings.teamCount*8},(_,index)=>index+1));
    assert.equal(line.overlapAudit.canCommitAwards,false);
    if(line.overlapAudit.firstPotentialOverlap)
      assert.ok(line.overlapAudit.firstPotentialOverlap.distanceM<=
        settings.distanceKm*1000);
    for(const band of line.bandRunners){
      const runner=band.runner;
      const sourceEnergy=new Map(runner.positionedSource.slots.map(
        row=>[row.riderId,row.energy]));
      const totalSpent=new Map(runner.finishers.map(row=>
        [row.riderId,runner.frames.reduce((sum,frame)=>sum+
          frame.riders.find(rider=>rider.riderId===row.riderId)
            .energySpent,0)]));
      for(const row of runner.finishers){
        assert.ok(Number.isFinite(row.elapsedSecondsFromLastKmStart));
        assert.ok(Math.abs(sourceEnergy.get(row.riderId)-
          totalSpent.get(row.riderId)-row.energyAtLine)<1e-7);
      }
    }
    assert.equal(validateFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale,{},line),true);
    const {overlapAudit,provisionalLineOrder,...legacyRest}=line;
    const legacy={...legacyRest,
      version:'v2-finale-multiband-individual-line-lab-1'};
    assert.equal(validateFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale,{},legacy),true);
    assert.equal(validateFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale,{},
      {...legacy,overlapAudit}),true);
    const altered=structuredClone(line);
    altered.conditionalCrossings[0].energyAtLine+=1;
    assert.throws(()=>validateFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale,{},altered),/does not replay/);
  }
});

test('a same-band helper pays for an observable nominated finisher effect',()=>{
  const trial=race();
  const plans=trial.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-6':null}));
  const without=recordFinaleMultibandIndividualLine(
    trial.recording,trial.paidFinale);
  const withHelper=recordFinaleMultibandIndividualLine(
    trial.recording,trial.paidFinale,{plans});
  assert.deepEqual(without.positionedSource,withHelper.positionedSource);
  const selected=withHelper.sprintPlan.decisions.find(row=>
    row.teamId==='you');
  assert.equal(selected.roadGroupId,withHelper.bandRunners[0].roadBandId);
  const helperRows=withHelper.bandRunners[0].runner.frames.flatMap(frame=>
    frame.riders.filter(row=>row.riderId==='you-6'));
  assert.ok(helperRows.some(row=>row.role==='lead_out'&&
    row.energySpent>0));
  const crossing=line=>line.conditionalCrossings.find(row=>
    row.riderId==='you-7');
  assert.ok(crossing(withHelper).elapsedSecondsFromLastKmStart<
    crossing(without).elapsedSecondsFromLastKmStart);
  assert.equal(validateFinaleMultibandIndividualLine(
    trial.recording,trial.paidFinale,{plans},withHelper),true);
});

test('a helper in another road band cannot be granted a lead-out',()=>{
  const trial=race();
  const plans=trial.recording.committedInputs.teams.map(team=>({
    teamId:team.id,finisherId:team.orders.captainId,
    leadOutRiderId:team.id==='you'?'you-5':null}));
  assert.throws(()=>recordFinaleMultibandIndividualLine(
    trial.recording,trial.paidFinale,{plans}),
  /cannot work beside the finisher/);
});

test('one and two committed chase teams retain their paid 500 m handoff',()=>{
  for(const settings of [
    {distanceKm:40,terrain:'flat',fatigue:0,gender:'M',teamCount:4,
      seed:'conditional-coverage-1',managerTactics:[
        {effort:'steady',attack:'none',chase:'all'}]},
    {distanceKm:120,terrain:'rolling',fatigue:15,gender:'F',
      teamCount:15,seed:'two-chase-source-1',managerTactics:[
        {effort:'conserve',attack:'none',chase:'all'},
        {effort:'conserve',attack:'none',chase:'all'}]}]){
    const trial=createV91ConditionalRaceFinal({...settings,
      attack:'repeated',chase:'ignore',defaultRivalPlan:'attack'});
    assert.equal(trial.roadStatus,'paid_group_bands');
    const line=recordFinaleMultibandIndividualLine(
      trial.recording,trial.paidFinale);
    const source=trial.paidFinale.line.approachFrames.find(frame=>
      frame.endDistanceM===settings.distanceKm*1000-500);
    const paidEnergy=new Map(source.riders.map(row=>
      [row.riderId,row.energy]));
    for(const band of line.bandRunners)
      for(const slot of band.runner.positionedSource.slots)
        assert.equal(slot.energy,paidEnergy.get(slot.riderId));
    assert.equal(line.conditionalCrossings.length,settings.teamCount*8);
    assert.equal(line.pointsStatus,'withheld');
  }
});
