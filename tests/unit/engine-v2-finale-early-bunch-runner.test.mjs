import test from 'node:test';
import assert from 'node:assert/strict';
import {createV91EarlyBunchTrial,validateV91EarlyBunchTrial} from
  '../../lib/engine/v2/playtest-finale-trial.mjs';
import {validateFinaleEarlyBunchRunnerFromTour} from
  '../../lib/engine/v2/finale-paid-bunch-runner.mjs';
import {validateFinaleEarlyBunchSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,
  gender:'M',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'early-test'};

test('a nominated helper earns position and a pull across the paid kilometre',()=>{
  const before=createV91EarlyBunchTrial(settings);
  const plans=before.finalePlans.map(row=>({...row,
    leadOutRiderId:row.teamId==='rival-3'?'rival-3-5':null}));
  const after=createV91EarlyBunchTrial(settings,{plans});
  assert.equal(after.version,'v91-early-bunch-trial-1');
  assert.equal(after.paidFinale.version,
    'v2-finale-early-bunch-runner-lab-5');
  assert.equal(after.paidFinale.positionedSource.version,
    'v2-finale-independent-early-source-lab-3');
  assert.deepEqual(after.recording,before.recording);
  assert.deepEqual(after.paidFinale.positionedSource.slots,
    before.paidFinale.positionedSource.slots);
  const frames=after.paidFinale.frames;
  assert.deepEqual(frames.slice(0,7).map(row=>
    row.endDistanceM-row.startDistanceM),
  [250,250,100,100,100,100,100]);
  assert.equal(frames[0].riders.find(row=>
    row.riderId==='rival-3-5').role,'lead_out_assembly');
  assert.ok(frames.some(frame=>frame.riders.some(row=>
    row.riderId==='rival-3-5'&&row.role==='lead_out')));
  const baselineLine=before.paidFinale.lineOrder.find(row=>
    row.riderId==='rival-3-7');
  const changedLine=after.paidFinale.lineOrder.find(row=>
    row.riderId==='rival-3-7');
  assert.ok(changedLine.elapsedSecondsFromLastKmStart<
    baselineLine.elapsedSecondsFromLastKmStart);
  assert.equal(after.paidFinale.finishers.length,32);
  assert.equal(after.paidFinale.lineOrder.length,32);
  assert.equal(after.classifiedResults,null);
  assert.equal(after.pointsStatus,'withheld');
  for(const frame of frames)for(const row of frame.riders){
    assert.ok(Math.abs(row.positionM-row.positionBeforeM-
      row.distanceTravelledM)<1e-7);
    assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
      row.energyAfter)<1e-7);
  }
  assert.equal(validateV91EarlyBunchTrial(settings,{plans},after),true);
  assert.throws(()=>validateV91EarlyBunchTrial(settings,{plans},
    {...after,pointsStatus:'awarded'}),/does not replay/);
  assert.equal(validateFinaleEarlyBunchRunnerFromTour(after.recording,
    {plans},after.paidFinale),true);
  assert.throws(()=>validateFinaleEarlyBunchSprintPlanFromTour(
    after.recording,{plans},{version:'tampered'}),
  /does not replay/);
});

test('complete fields finish or refuse explicitly across routes and genders',()=>{
  for(const distanceKm of [40,120,260])for(const gender of ['M','F'])
    for(const teamCount of [4,15,20]){
      const input={...settings,distanceKm,gender,teamCount,
        terrain:distanceKm===40?'flat':distanceKm===120?
          'rolling':'mountain',
        fatigue:distanceKm===40?0:distanceKm===120?15:30,
        seed:'early-matrix'};
      if(distanceKm===260&&teamCount===4){
        assert.throws(()=>createV91EarlyBunchTrial(input),
          /one inactive-attack bunch/);
        continue;
      }
      const trial=createV91EarlyBunchTrial(input);
      assert.equal(trial.paidFinale.finishers.length,teamCount*8);
      assert.equal(new Set(trial.paidFinale.lineOrder.map(row=>
        row.riderId)).size,teamCount*8);
      assert.equal(trial.paidFinale.startDistanceM,
        distanceKm*1000-1000);
      assert.equal(trial.classifiedResults,null);
      assert.equal(trial.pointsStatus,'withheld');
    }
});

test('paid helper orders affect locked 15- and 20-team fields in both categories',()=>{
  for(const gender of ['M','F'])for(const [teamCount,teamId,helperId]
    of [[15,'rival-1','rival-1-6'],
      [20,'rival-10','rival-10-6']]){
    const input={...settings,gender,teamCount};
    const baseline=createV91EarlyBunchTrial(input);
    const plans=baseline.finalePlans.map(row=>({...row,
      leadOutRiderId:row.teamId===teamId?helperId:null}));
    const withLead=createV91EarlyBunchTrial(input,{plans});
    assert.deepEqual(withLead.recording,baseline.recording);
    assert.deepEqual(withLead.paidFinale.positionedSource.slots,
      baseline.paidFinale.positionedSource.slots);
    assert.ok(withLead.paidFinale.frames.some(frame=>
      frame.riders.some(row=>row.riderId===helperId&&
        row.role==='lead_out')));
    const finisherId=`${teamId}-7`;
    assert.ok(withLead.paidFinale.lineOrder.find(row=>
      row.riderId===finisherId).elapsedSecondsFromLastKmStart<
        baseline.paidFinale.lineOrder.find(row=>
          row.riderId===finisherId).elapsedSecondsFromLastKmStart);
    assert.equal(withLead.pointsStatus,'withheld');
  }
});

test('two managers can pay simultaneous lead-outs on one race clock',()=>{
  const input={...settings,teamCount:15};
  const baseline=createV91EarlyBunchTrial(input);
  const helpers=new Map([['rival-1','rival-1-6'],
    ['rival-11','rival-11-5']]);
  const plans=baseline.finalePlans.map(row=>({...row,
    leadOutRiderId:helpers.get(row.teamId)??null}));
  const trial=createV91EarlyBunchTrial(input,{plans});
  assert.deepEqual(trial.recording,baseline.recording);
  assert.deepEqual(trial.paidFinale.positionedSource.slots,
    baseline.paidFinale.positionedSource.slots);
  for(const [teamId,helperId] of helpers){
    const finisherId=`${teamId}-7`;
    assert.ok(trial.paidFinale.frames.some(frame=>
      frame.riders.find(row=>row.riderId===helperId)?.role===
        'lead_out'));
    assert.ok(trial.paidFinale.lineOrder.find(row=>
      row.riderId===finisherId).elapsedSecondsFromLastKmStart<
      baseline.paidFinale.lineOrder.find(row=>
        row.riderId===finisherId).elapsedSecondsFromLastKmStart);
  }
  const energyById=new Map(trial.paidFinale.positionedSource.slots
    .map(slot=>[slot.riderId,trial.paidFinale.frames[0].riders
      .find(row=>row.riderId===slot.riderId).energyAtDecision]));
  for(const frame of trial.paidFinale.frames)
    for(const row of frame.riders){
      assert.ok(Math.abs(energyById.get(row.riderId)-
        row.energyAtDecision)<1e-7);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAfter)<1e-7);
      energyById.set(row.riderId,row.energyAfter);
    }
  assert.equal(new Set(trial.paidFinale.lineOrder.map(row=>
    row.riderId)).size,120);
  assert.equal(validateV91EarlyBunchTrial(input,{plans},trial),true);
  assert.equal(trial.pointsStatus,'withheld');
});

test('a rival manager effort choice reaches the paid finale on the same roster',()=>{
  const input={...settings,distanceKm:120,terrain:'rolling',
    teamCount:15,fatigue:15,seed:'paired-effort',
    defaultRivalPlan:'neutral'};
  const neutral=createV91EarlyBunchTrial(input);
  const hard=createV91EarlyBunchTrial({...input,
    managerTactics:[{effort:'hard',attack:'none',
      chase:'selective'}]});
  assert.deepEqual(neutral.recording.committedInputs.stage,
    hard.recording.committedInputs.stage);
  assert.deepEqual(neutral.recording.committedInputs.teams.map(row=>
    row.riders),hard.recording.committedInputs.teams.map(row=>
    row.riders));
  const sourceEnergy=(trial,riderId)=>trial.paidFinale.frames[0]
    .riders.find(row=>row.riderId===riderId).energyAtDecision;
  const lineTime=(trial,riderId)=>trial.paidFinale.lineOrder.find(row=>
    row.riderId===riderId).elapsedSecondsFromLastKmStart;
  assert.ok(sourceEnergy(hard,'rival-1-7')<
    sourceEnergy(neutral,'rival-1-7'));
  assert.ok(lineTime(hard,'rival-1-7')>
    lineTime(neutral,'rival-1-7'));
  assert.equal(sourceEnergy(hard,'you-7'),
    sourceEnergy(neutral,'you-7'));
  assert.equal(lineTime(hard,'you-7'),lineTime(neutral,'you-7'));
  assert.equal(validateV91EarlyBunchTrial(input,{},neutral),true);
  assert.equal(validateV91EarlyBunchTrial({...input,
    managerTactics:[{effort:'hard',attack:'none',
      chase:'selective'}]}, {},hard),true);
  assert.equal(hard.pointsStatus,'withheld');
});

test('an undued attack order retains its intent in the paid bunch path',()=>{
  const trial=createV91EarlyBunchTrial(
    {...settings,attack:'selective'});
  assert.equal(trial.version,'v91-inactive-intents-bunch-trial-2');
  assert.equal(trial.paidFinale.finishers.length,32);
  assert.ok(trial.paidFinale.sourceIntentLedger.named
    .every(row=>!row.canEnterRoadContest));
  assert.equal(trial.pointsStatus,'withheld');
});
