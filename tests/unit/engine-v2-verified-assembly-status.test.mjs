import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91EarlyBunchTrial,validateV91EarlyBunchTrial} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {createV91ConditionalRaceFinal,
  createV91LegacyConditionalRaceFinal,
  validateV91ConditionalRaceFinal} from
  '../../lib/engine/v2/playtest-race-final.mjs';

function plans(teamCount,helperTeam,helperId){
  return ['you',...Array.from({length:teamCount-1},
    (_,index)=>`rival-${index+1}`)].map(teamId=>({teamId,
    finisherId:`${teamId}-7`,
    leadOutRiderId:teamId===helperTeam?helperId:null}));
}

test('a wheel reached at sprint onset is not promised a lead-out pull',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:20,gender:'F',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase',
    seed:'position-audit:40:F:20'};
  const request={plans:plans(20,'rival-8','rival-8-5')};
  const old=createV91EarlyBunchTrial(settings,request);
  const oldRace=createV91LegacyConditionalRaceFinal(settings,request);
  const next=createV91ConditionalRaceFinal(settings,request);
  assert.equal(oldRace.version,'v91-conditional-race-final-1');
  assert.deepEqual(oldRace.paidFinale,old.paidFinale);
  const oldAttempts=old.paidFinale.frames.flatMap(frame=>
    frame.assemblyAttempts??[]);
  const newAttempts=next.paidFinale.frames.flatMap(frame=>
    frame.assemblyAttempts??[]);
  assert.ok(oldAttempts.some(row=>row.helperId==='rival-8-5'&&
    row.status==='ready_next_boundary'));
  assert.ok(newAttempts.some(row=>row.helperId==='rival-8-5'&&
    row.status==='ready_without_following_pull'));
  assert.ok(!next.paidFinale.frames.some(frame=>frame.riders.some(row=>
    row.riderId==='rival-8-5'&&row.role==='lead_out')));
  assert.deepEqual(next.recording,old.recording);
  assert.deepEqual(next.paidFinale.finishers,old.paidFinale.finishers);
  const movement=frames=>frames.map(({assemblyAttempts,...frame})=>frame);
  assert.deepEqual(movement(next.paidFinale.frames),
    movement(old.paidFinale.frames));
  assert.equal(next.paidFinale.sourceRunnerVersion,old.paidFinale.version);
  assert.equal(next.classifiedResults,null);
  assert.equal(next.pointsStatus,'withheld');
  assert.equal(validateV91EarlyBunchTrial(settings,request,old),true);
  assert.equal(validateV91ConditionalRaceFinal(settings,request,oldRace),true);
  assert.equal(validateV91ConditionalRaceFinal(settings,request,next),true);
});

test('a formed pair is labelled paid only when both riders pull next',()=>{
  const settings={distanceKm:40,terrain:'flat',teamCount:4,gender:'M',
    attack:'none',chase:'ignore',defaultRivalPlan:'chase',seed:'trial'};
  const request={plans:plans(4,'rival-3','rival-3-5')};
  const trial=createV91ConditionalRaceFinal(settings,request);
  const frames=trial.paidFinale.frames;
  const paid=frames.flatMap((frame,index)=>(frame.assemblyAttempts??[])
    .filter(row=>row.status==='paid_pull_next_boundary')
    .map(row=>({row,index})));
  assert.ok(paid.length>0);
  for(const {row,index} of paid){
    assert.equal(frames[index+1].riders.find(rider=>
      rider.riderId===row.helperId).role,'lead_out');
    assert.equal(frames[index+1].riders.find(rider=>
      rider.riderId===row.finisherId).role,'lead_out_finisher');
  }
  assert.equal(trial.pointsStatus,'withheld');
});

test('old inactive-intent race final still replays beside its verified successor',()=>{
  const settings={distanceKm:120,terrain:'rolling',teamCount:4,
    gender:'F',seed:'trial'};
  const before=createV91LegacyConditionalRaceFinal(settings);
  const after=createV91ConditionalRaceFinal(settings);
  assert.equal(before.version,'v91-conditional-race-final-2');
  assert.equal(after.version,'v91-conditional-race-final-11');
  assert.deepEqual(after.recording,before.recording);
  assert.deepEqual(after.paidFinale.finishers,before.paidFinale.finishers);
  assert.equal(validateV91ConditionalRaceFinal(settings,{},before),true);
  assert.equal(validateV91ConditionalRaceFinal(settings,{},after),true);
});
