import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91FinaleTrialWithOneClockLeadOut,
  validateV91FinaleTrialWithOneClockLeadOut} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'trial'};
const request=leadOutRiderId=>({attackTeamId:'you',
  attackRiderId:'you-7',
  plans:['you','rival-1','rival-2','rival-3'].map(teamId=>({
    teamId,finisherId:`${teamId}-7`,
    leadOutRiderId:teamId==='rival-1'?leadOutRiderId:null}))});

test('an optional rival lead-out pays on the solo road and changes its finish',()=>{
  const without=createV91FinaleTrialWithOneClockLeadOut(
    settings,request(null));
  const withLead=createV91FinaleTrialWithOneClockLeadOut(
    settings,request('rival-1-6'));
  assert.deepEqual(without.recording,withLead.recording);
  assert.equal(withLead.version,'v91-finale-trial-10');
  assert.equal(withLead.oneClockSolo.version,
    'v2-finale-one-clock-solo-lead-out-2');
  assert.deepEqual(withLead.oneClockSolo.frames[0].leadOutRiderIds,
    ['rival-1-6']);
  assert.notDeepEqual(withLead.oneClockSolo.frames,
    without.oneClockSolo.frames);
  assert.ok(withLead.oneClockSolo.frames[0].riders.find(row=>
    row.riderId==='rival-1-7').positionM>
    without.oneClockSolo.frames[0].riders.find(row=>
      row.riderId==='rival-1-7').positionM);
  assert.ok(withLead.oneClockSolo.finishers.find(row=>
    row.riderId==='rival-1-7').elapsedSecondsFromLastKmStart<
    without.oneClockSolo.finishers.find(row=>
      row.riderId==='rival-1-7').elapsedSecondsFromLastKmStart);
  const decision=withLead.finalePlans.find(row=>
    row.teamId==='rival-1');
  assert.equal(decision.leadOutRiderId,'rival-1-6');
  for(const [index,frame] of withLead.oneClockSolo.frames.entries()){
    const helper=frame.riders.find(row=>row.riderId==='rival-1-6');
    const finisher=frame.riders.find(row=>row.riderId==='rival-1-7');
    if(frame.startDistanceM<39700&&frame.leadOutRiderIds.includes(
      helper.riderId)){
      assert.equal(helper.role,'lead_out');
      assert.equal(finisher.role,'lead_out_finisher');
      assert.ok(Math.abs(helper.positionM-finisher.positionM)<1e-8);
      assert.ok(helper.energySpent>finisher.energySpent);
      if(index<2)assert.deepEqual(frame.roadGroups.find(group=>
        group.id==='lead-out:rival-1')?.riderIds,
      ['rival-1-6','rival-1-7']);
      assert.notEqual(frame.chaseRiderId,helper.riderId);
    }
    for(const row of frame.riders){
      assert.ok(Math.abs(row.positionM-row.positionBeforeM-
        row.distanceTravelledM)<1e-7);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAfter)<1e-7);
    }
  }
  assert.equal(withLead.pointsStatus,'withheld');
  assert.equal(withLead.classifiedResults,null);
  assert.equal(validateV91FinaleTrialWithOneClockLeadOut(settings,
    request('rival-1-6'),withLead),true);
  assert.throws(()=>validateV91FinaleTrialWithOneClockLeadOut(
    settings,request('rival-1-6'),{...withLead,
      pointsStatus:'awarded'}),/does not replay/);
});

test('paid lead-out can change exact solo contact without awarding places',()=>{
  const without=createV91FinaleTrialWithOneClockLeadOut(settings,{
    ...request(null),attackRiderId:'you-2'});
  const withLead=createV91FinaleTrialWithOneClockLeadOut(settings,{
    ...request('rival-1-6'),attackRiderId:'you-2'});
  assert.deepEqual(without.recording,withLead.recording);
  assert.equal(without.oneClockSolo.outcome,'contact_uncontinued');
  assert.equal(withLead.oneClockSolo.outcome,'contact_uncontinued');
  assert.ok(withLead.oneClockSolo.contact.distanceM<
    without.oneClockSolo.contact.distanceM);
  const frame=withLead.oneClockSolo.frames.at(-1);
  const solo=frame.riders.find(row=>row.riderId==='you-2');
  for(const riderId of withLead.oneClockSolo.contact.riderIds){
    const rider=frame.riders.find(row=>row.riderId===riderId);
    assert.ok(Math.abs(rider.positionM-solo.positionM)<1e-7);
  }
  assert.ok(withLead.oneClockSolo.contact.riderIds.includes(
    'rival-1-6'));
  assert.ok(withLead.oneClockSolo.contact.riderIds.includes(
    'rival-1-7'));
  assert.equal(withLead.oneClockSolo.finishers,null);
  assert.equal(withLead.classifiedResults,null);
  assert.equal(withLead.pointsStatus,'withheld');
});

test('lead-out replay covers varied category, route and field fatigue',()=>{
  for(const variation of [
    {distanceKm:40,terrain:'flat',teamCount:4,gender:'F'},
    {distanceKm:120,terrain:'rolling',teamCount:15,
      gender:'M',fatigue:30},
    {distanceKm:120,terrain:'mountain',teamCount:20,gender:'F'}]){
    const names=['you',...Array.from({length:variation.teamCount-1},
      (_,index)=>`rival-${index+1}`)];
    const plans=names.map(teamId=>({teamId,
      finisherId:`${teamId}-7`,leadOutRiderId:teamId==='rival-1'?
        'rival-1-6':null}));
    const input={...settings,...variation};
    const order={attackTeamId:'you',attackRiderId:'you-7',plans};
    const trial=createV91FinaleTrialWithOneClockLeadOut(input,order);
    assert.equal(trial.oneClockSolo.outcome,'separated_line');
    assert.equal(trial.oneClockSolo.finishers.length,
      variation.teamCount*8);
    assert.ok(trial.oneClockSolo.frames[0].leadOutRiderIds.includes(
      'rival-1-6'));
    assert.equal(validateV91FinaleTrialWithOneClockLeadOut(
      input,order,trial),true);
    assert.equal(trial.pointsStatus,'withheld');
  }
});

test('competing lead-outs cannot also work chase or front rotation',()=>{
  const plans=['you','rival-1','rival-2','rival-3'].map(teamId=>({
    teamId,finisherId:`${teamId}-7`,
    leadOutRiderId:['rival-1','rival-2'].includes(teamId)?
      `${teamId}-6`:null}));
  const trial=createV91FinaleTrialWithOneClockLeadOut(settings,{
    attackTeamId:'you',attackRiderId:'you-7',plans});
  assert.equal(trial.oneClockSolo.outcome,'separated_line');
  for(const frame of trial.oneClockSolo.frames.slice(0,2)){
    assert.deepEqual(frame.leadOutRiderIds,
      ['rival-1-6','rival-2-6']);
    const rotationIds=frame.rotation.selected?.work.map(row=>
      row.riderId)??[];
    for(const helperId of frame.leadOutRiderIds){
      assert.notEqual(helperId,frame.chaseRiderId);
      assert.ok(!rotationIds.includes(helperId));
      const helper=frame.riders.find(row=>row.riderId===helperId);
      const finisher=frame.riders.find(row=>
        row.riderId===helperId.replace('-6','-7'));
      assert.equal(helper.role,'lead_out');
      assert.equal(finisher.role,'lead_out_finisher');
      assert.ok(Math.abs(helper.positionM-finisher.positionM)<1e-8);
      assert.ok(helper.energySpent>finisher.energySpent);
    }
    const roadIds=[...frame.roadGroups.flatMap(group=>group.riderIds),
      ...frame.pelotonRiderIds];
    assert.equal(roadIds.length,32);
    assert.equal(new Set(roadIds).size,32);
  }
  assert.equal(trial.oneClockSolo.finishers.length,32);
  assert.equal(trial.pointsStatus,'withheld');
});
