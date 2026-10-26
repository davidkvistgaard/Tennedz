import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTourWithHandoffStateV3} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {STAGE_COMPLETE_INPUT_VERSION} from
  '../../lib/engine/v2/stage-complete-input-v3.mjs';
import {advanceQuietWholeBunchKilometreV3,replayQuietWholeBunchStageV3,
  replayCommittedQuietWholeBunchStageV3,
  replayCommittedQuietBunchWithRecoveryV3,
  replayCommittedQuietBunchWithCapacityV3,
  replayCommittedQuietBunchWithFrontWorkV3} from
  '../../lib/engine/v2/stage-whole-bunch-kilometre-v3.mjs';

function source(seed='front-work-4',attack='none'){
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',teamCount:4,
    gender:'M',effort:'steady',attack,chase:'ignore',
    defaultRivalPlan:'passive',seed});
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const route=recording.route.kilometres;
  const stageInput={version:STAGE_COMPLETE_INPUT_VERSION,
    overlay:{version:3,distanceKm:40,
      tacticalIntervals:Array.from({length:8},(_,index)=>{
        const segment=route[index===2?10:index*5];
        return {fromKm:index*5,toKm:(index+1)*5,
          conditions:{surface:segment.surface,exposed:segment.exposed,
            source:'simulated',weather:segment.weather}};
      }),features:[]},
    kilometreBaselines:route.map(segment=>({terrain:segment.terrain,
      gradientPct:segment.gradientPct,source:'simulated'}))};
  return {recording,stageInput};
}

test('quiet 32-rider whole field matches paid homogeneous v2 kilometre',()=>{
  for(const seed of ['front-work-4','quiet-field-2','quiet-field-3']){
    const {recording,stageInput}=source(seed);
    const step=advanceQuietWholeBunchKilometreV3({recording,frameIndex:9,
      stageInput});
    const paid=recording.frames[10];
    assert.equal(step.wholeFieldStepCovered,true);
    assert.equal(step.riderStates.length,32);
    for(const row of step.riderStates){
      const old=paid.riderGroups.find(candidate=>candidate.id===row.id);
      assert.deepEqual({energy:row.energy,group:row.group,
        deficitSeconds:row.deficitSeconds},
      {energy:old.energy,group:old.group,deficitSeconds:old.deficitSeconds});
      const work=step.riderWork.find(candidate=>candidate.id===row.id);
      const ledger=paid.energyLedger.find(candidate=>candidate.riderId===row.id);
      assert.ok(Math.abs(work.work-ledger.workDemand)<1e-6);
    }
  }
});

test('a fractional climb changes paid work for all riders in one decision step',()=>{
  const {recording,stageInput}=source();
  const flat=advanceQuietWholeBunchKilometreV3({recording,frameIndex:9,
    stageInput});
  stageInput.overlay.features=[{id:'illustrative-short-climb',kind:'climb',
    fromKm:10.2,toKm:10.6,gradientPct:8,label:'Illustrative climb'}];
  const climb=advanceQuietWholeBunchKilometreV3({recording,frameIndex:9,
    stageInput});
  assert.equal(climb.wholeFieldStepCovered,true);
  assert.equal(climb.riderStates.length,32);
  assert.ok(climb.riderWork.every((row,index)=>row.work>flat.riderWork[index].work));
  assert.ok(climb.riderWork.every(row=>row.slices.length===3));
  assert.ok(climb.riderWork.every(row=>row.slices[1].featureIds
    .includes('illustrative-short-climb')));
});

test('quiet whole-field replay retains all riders across ten paid kilometres',()=>{
  const {recording,stageInput}=source();
  stageInput.overlay.conditionSpans=Array.from({length:10},(_,index)=>{
    const segment=recording.route.kilometres[index+10];
    return {id:`km-${index+11}`,fromKm:index+10,toKm:index+11,
      conditions:{surface:segment.surface,exposed:segment.exposed,
        source:'simulated',weather:segment.weather}};
  });
  const replay=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:20});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,10);
  assert.equal(replay.wholeRaceCovered,false);
  for(const frame of replay.frames){
    assert.equal(frame.wholeFieldStepCovered,true);
    assert.equal(frame.riderStates.length,32);
    const old=recording.frames[frame.km-1];
    for(const row of frame.riderStates){
      const saved=old.riderGroups.find(candidate=>candidate.id===row.id);
      assert.equal(row.energy,saved.energy);
      assert.equal(row.deficitSeconds,saved.deficitSeconds);
      assert.equal(row.group,saved.group);
    }
  }
});

test('short climb changes later paid energy without changing earlier frames',()=>{
  const {recording,stageInput}=source();
  const flat=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:16});
  stageInput.overlay.features=[{id:'illustrative-late-climb',kind:'climb',
    fromKm:14.2,toKm:14.6,gradientPct:8,label:'Illustrative climb'}];
  const climbed=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:16});
  assert.equal(climbed.refusal,null);
  assert.deepEqual(climbed.frames.slice(0,4),flat.frames.slice(0,4));
  assert.ok(climbed.frames[4].riderWork.every((row,index)=>
    row.work>flat.frames[4].riderWork[index].work));
  assert.ok(climbed.frames[5].riderStates.every((row,index)=>
    row.energy<flat.frames[5].riderStates[index].energy));
});

test('versioned 5 km effort orders change paid work after each marker',()=>{
  const {recording,stageInput}=source();
  const baseline=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:20});
  const ordered=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:20,effortOrders:[
      {teamId:'you',atKm:10,effort:'hard'},
      {teamId:'you',atKm:15,effort:'steady'},
    ]});
  assert.match(ordered.version,/effort-replay-2/);
  assert.equal(ordered.refusal,null);
  assert.equal(ordered.frames[0].activeEfforts.find(row=>
    row.teamId==='you').effort,'hard');
  assert.equal(ordered.frames[4].activeEfforts.find(row=>
    row.teamId==='you').effort,'hard');
  assert.equal(ordered.frames[5].activeEfforts.find(row=>
    row.teamId==='you').effort,'steady');
  const own=ordered.frames[0].riderWork.find(row=>row.id==='you-0');
  const old=baseline.frames[0].riderWork.find(row=>row.id==='you-0');
  assert.ok(own.work>old.work);
  assert.ok(ordered.frames.at(-1).riderStates.find(row=>row.id==='you-0').energy<
    baseline.frames.at(-1).riderStates.find(row=>row.id==='you-0').energy);
  assert.equal(ordered.frames[0].riderWork.find(row=>row.id==='rival-1-0').work,
    baseline.frames[0].riderWork.find(row=>row.id==='rival-1-0').work);
  assert.equal(baseline.frames[0].activeEfforts,undefined);
});

test('late 5 km effort change matches a separately paid v2 order',()=>{
  const {recording,stageInput}=source();
  const orderedInput=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4',
    managerFinaleOrders:[{teamId:'you',atKm:35,effort:'hard'}]});
  const orderedV2=simulateTacticalTourWithHandoffStateV3({...orderedInput,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION}).recording;
  assert.deepEqual(recording.frames[29].riderGroups,
    orderedV2.frames[29].riderGroups);
  stageInput.overlay.conditionSpans=Array.from({length:9},(_,index)=>{
    const segment=recording.route.kilometres[index+30];
    return {id:`late-km-${index+31}`,fromKm:index+30,toKm:index+31,
      conditions:{surface:segment.surface,exposed:segment.exposed,
        source:'simulated',weather:segment.weather}};
  });
  const replay=replayQuietWholeBunchStageV3({recording,frameIndex:29,
    stageInput,endKm:39,
    effortOrders:[{teamId:'you',atKm:35,effort:'hard'}]});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,9);
  for(const frame of replay.frames){
    const paid=orderedV2.frames[frame.km-1];
    for(const row of frame.riderStates){
      const actual=paid.riderGroups.find(candidate=>candidate.id===row.id);
      assert.equal(row.energy,actual.energy);
      assert.equal(row.group,actual.group);
      assert.equal(row.deficitSeconds,actual.deficitSeconds);
    }
  }
});

test('same-run committed manager order drives the quiet replay',()=>{
  const {stageInput}=source();
  const orderedInput=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4',
    managerFinaleOrders:[{teamId:'you',atKm:35,effort:'hard'}]});
  const {recording}=simulateTacticalTourWithHandoffStateV3({...orderedInput,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:9},(_,index)=>{
    const segment=recording.route.kilometres[index+30];
    return {id:`committed-km-${index+31}`,fromKm:index+30,
      toKm:index+31,conditions:{surface:segment.surface,
        exposed:segment.exposed,source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietWholeBunchStageV3({recording,
    frameIndex:29,stageInput,endKm:39});
  assert.match(replay.version,/committed-effort-replay-3/);
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames[4].activeEfforts.find(row=>
    row.teamId==='you').effort,'steady');
  assert.equal(replay.frames[5].activeEfforts.find(row=>
    row.teamId==='you').effort,'hard');
  for(const frame of replay.frames){
    const paid=recording.frames[frame.km-1];
    for(const row of frame.riderStates){
      const actual=paid.riderGroups.find(candidate=>candidate.id===row.id);
      assert.equal(row.energy,actual.energy);
      assert.equal(row.group,actual.group);
      assert.equal(row.deficitSeconds,actual.deficitSeconds);
    }
  }
  assert.throws(()=>replayCommittedQuietWholeBunchStageV3({
    recording:structuredClone(recording),frameIndex:29,stageInput,endKm:39}),
  /same-run issued/);
});

test('effort replay refuses off-grid or duplicate orders',()=>{
  const {recording,stageInput}=source();
  const input={recording,frameIndex:9,stageInput,endKm:20};
  assert.throws(()=>replayQuietWholeBunchStageV3({...input,
    effortOrders:[{teamId:'you',atKm:11,effort:'hard'}]}),/5 km markers/);
  assert.throws(()=>replayQuietWholeBunchStageV3({...input,
    effortOrders:[{teamId:'you',atKm:10,effort:'hard'},
      {teamId:'you',atKm:10,effort:'steady'}]}),/5 km markers/);
});

test('committed attack phases stay outside the quiet replay',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4',
    managerFinaleOrders:[{teamId:'you',atKm:35,
      effort:'hard',attack:'selective'}]});
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.throws(()=>replayCommittedQuietWholeBunchStageV3({recording,
    frameIndex:29,stageInput,endKm:39}),/dynamic team orders/);
});

test('committed conserve order pays quiet recovery once per km like v2',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4'});
  input.teams.find(team=>team.id==='you').orders.phases=[
    {atKm:30,effort:'conserve'}];
  const {recording,handoffStateTrace}=simulateTacticalTourWithHandoffStateV3({
    ...input,motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:9},(_,index)=>{
    const segment=recording.route.kilometres[index+30];
    return {id:`recovery-km-${index+31}`,fromKm:index+30,
      toKm:index+31,conditions:{surface:segment.surface,
        exposed:segment.exposed,source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietBunchWithRecoveryV3({recording,
    frameIndex:29,stageInput,endKm:39});
  assert.match(replay.version,/committed-recovery-replay-4/);
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,9);
  assert.equal(replay.frames[0].activeEfforts.find(row=>
    row.teamId==='you').effort,'conserve');
  assert.equal(replay.frames[0].riderWork.find(row=>row.id==='you-0')
    .recoveryAward,0);
  assert.ok(replay.frames[2].riderWork.find(row=>row.id==='you-0')
    .recoveryAward>0);
  for(const frame of replay.frames){
    const paid=recording.frames[frame.km-1];
    const hidden=handoffStateTrace.frames[frame.km-1];
    for(const row of frame.riderStates){
      const actual=paid.riderGroups.find(candidate=>candidate.id===row.id);
      const state=hidden.riders.find(candidate=>candidate.riderId===row.id);
      assert.equal(row.energy,actual.energy);
      assert.equal(row.group,actual.group);
      assert.equal(row.deficitSeconds,actual.deficitSeconds);
      assert.equal(row.quietKm,state.quietKm);
    }
  }
});

test('a short climb cancels the full quiet-kilometre recovery award',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4'});
  input.teams.find(team=>team.id==='you').orders.phases=[
    {atKm:30,effort:'conserve'}];
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const common={recording,frameIndex:29,stageInput,endKm:36};
  const flat=replayCommittedQuietBunchWithRecoveryV3(common);
  stageInput.overlay.features=[{id:'short-climb-for-recovery',
    kind:'climb',fromKm:32.2,toKm:32.6,gradientPct:8}];
  const climbed=replayCommittedQuietBunchWithRecoveryV3(common);
  assert.equal(flat.refusal,null);
  assert.equal(climbed.refusal,null);
  assert.deepEqual(climbed.frames.slice(0,2),flat.frames.slice(0,2));
  assert.ok(flat.frames[2].riderWork.find(row=>row.id==='you-0')
    .recoveryAward>0);
  assert.equal(climbed.frames[2].riderWork.find(row=>row.id==='you-0')
    .recoveryAward,0);
  assert.equal(climbed.frames[2].riderStates.find(row=>row.id==='you-0')
    .quietKm,0);
});

test('committed conserve replay respects the 100 reserve ceiling',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4'});
  input.teams.find(team=>team.id==='you').orders.phases=[
    {atKm:5,effort:'conserve'}];
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:20},(_,index)=>{
    const segment=recording.route.kilometres[index+5];
    return {id:`cap-km-${index+6}`,fromKm:index+5,toKm:index+6,
      conditions:{surface:segment.surface,exposed:segment.exposed,
        source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietBunchWithRecoveryV3({recording,
    frameIndex:4,stageInput,endKm:25});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,20);
  assert.ok(recording.frames.slice(5,25).some(frame=>frame.energyLedger
    .some(row=>row.riderId.startsWith('you-')&&row.capAdjustment>0)));
  assert.ok(replay.frames.some(frame=>frame.riderWork.some(row=>
    row.id.startsWith('you-')&&row.capAdjustment>0)));
  for(const frame of replay.frames)for(const row of frame.riderStates){
    const paid=recording.frames[frame.km-1].riderGroups.find(candidate=>
      candidate.id===row.id);
    assert.equal(row.energy,paid.energy);
    assert.equal(row.group,paid.group);
    assert.equal(row.deficitSeconds,paid.deficitSeconds);
  }
});

test('same-run long-day capacity and work match v2 for every rider',()=>{
  const input=prepareV91Playtest({distanceKm:260,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'long-quiet-4'});
  const {recording,handoffStateTrace}=simulateTacticalTourWithHandoffStateV3({
    ...input,motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const route=recording.route.kilometres;
  const stageInput={version:STAGE_COMPLETE_INPUT_VERSION,
    overlay:{version:3,distanceKm:260,
      tacticalIntervals:Array.from({length:52},(_,index)=>{
        const segment=route[index*5];
        return {fromKm:index*5,toKm:(index+1)*5,
          conditions:{surface:segment.surface,exposed:segment.exposed,
            source:'simulated',weather:segment.weather}};
      }),
      conditionSpans:Array.from({length:99},(_,index)=>{
        const segment=route[index+160];
        return {id:`long-km-${index+161}`,fromKm:index+160,
          toKm:index+161,conditions:{surface:segment.surface,
            exposed:segment.exposed,source:'simulated',
            weather:segment.weather}};
      }),features:[]},
    kilometreBaselines:route.map(segment=>({terrain:segment.terrain,
      gradientPct:segment.gradientPct,source:'simulated'}))};
  const replay=replayCommittedQuietBunchWithCapacityV3({recording,
    frameIndex:159,stageInput,endKm:259});
  assert.equal(replay.refusal,null);
  assert.equal(replay.wholeRaceCovered,false);
  assert.equal(replay.frames.length,99);
  assert.ok(replay.frames[0].riderWork.every(row=>row.capacityDecay>0));
  for(const frame of replay.frames){
    const paid=recording.frames[frame.km-1];
    const hidden=handoffStateTrace.frames[frame.km-1];
    for(const row of frame.riderStates){
      const actual=paid.riderGroups.find(candidate=>candidate.id===row.id);
      const state=hidden.riders.find(candidate=>candidate.riderId===row.id);
      assert.equal(row.energy,actual.energy);
      assert.equal(row.group,actual.group);
      assert.equal(row.deficitSeconds,actual.deficitSeconds);
      assert.equal(row.quietKm,state.quietKm);
      assert.equal(row.energyCap,state.energyCap);
    }
  }
  stageInput.overlay.features=[{id:'illustrative-long-day-climb',
    kind:'climb',fromKm:164.25,toKm:164.65,gradientPct:8}];
  const climbed=replayCommittedQuietBunchWithCapacityV3({recording,
    frameIndex:159,stageInput,endKm:259});
  assert.equal(climbed.refusal,null);
  assert.deepEqual(climbed.frames.slice(0,4),replay.frames.slice(0,4));
  assert.ok(climbed.frames[4].riderWork.every((row,index)=>
    row.capacityDecay>replay.frames[4].riderWork[index].capacityDecay));
});

test('committed conserve settles recovery beneath a decaying long-day cap',()=>{
  const input=prepareV91Playtest({distanceKm:260,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'long-quiet-4'});
  input.teams.find(team=>team.id==='you').orders.phases=[
    {atKm:165,effort:'conserve'}];
  const {recording,handoffStateTrace}=simulateTacticalTourWithHandoffStateV3({
    ...input,motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const route=recording.route.kilometres;
  const stageInput={version:STAGE_COMPLETE_INPUT_VERSION,
    overlay:{version:3,distanceKm:260,
      tacticalIntervals:Array.from({length:52},(_,index)=>{
        const segment=route[index*5];
        return {fromKm:index*5,toKm:(index+1)*5,
          conditions:{surface:segment.surface,exposed:segment.exposed,
            source:'simulated',weather:segment.weather}};
      }),
      conditionSpans:Array.from({length:20},(_,index)=>{
        const segment=route[index+160];
        return {id:`cap-recovery-km-${index+161}`,
          fromKm:index+160,toKm:index+161,
          conditions:{surface:segment.surface,exposed:segment.exposed,
            source:'simulated',weather:segment.weather}};
      }),features:[]},
    kilometreBaselines:route.map(segment=>({terrain:segment.terrain,
      gradientPct:segment.gradientPct,source:'simulated'}))};
  const replay=replayCommittedQuietBunchWithCapacityV3({recording,
    frameIndex:159,stageInput,endKm:180});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,20);
  assert.equal(replay.frames[4].activeEfforts.find(row=>
    row.teamId==='you').effort,'steady');
  assert.equal(replay.frames[5].activeEfforts.find(row=>
    row.teamId==='you').effort,'conserve');
  assert.ok(replay.frames[7].riderWork.find(row=>row.id==='you-0')
    .recoveryAward>0);
  for(const frame of replay.frames)for(const row of frame.riderStates){
    const paid=recording.frames[frame.km-1].riderGroups.find(candidate=>
      candidate.id===row.id);
    const issued=handoffStateTrace.frames[frame.km-1].riders.find(candidate=>
      candidate.riderId===row.id);
    assert.equal(row.energy,paid.energy);
    assert.equal(row.quietKm,issued.quietKm);
    assert.equal(row.energyCap,issued.energyCap);
    assert.equal(row.group,paid.group);
  }
});

test('committed front rotation selects and pays the same v2 workers',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4',
    managerFinaleOrders:[{teamId:'you',atKm:35,
      frontWork:'rotate'}]});
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:4},(_,index)=>{
    const segment=recording.route.kilometres[index+35];
    return {id:`front-km-${index+36}`,fromKm:index+35,
      toKm:index+36,conditions:{surface:segment.surface,
        exposed:segment.exposed,source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietBunchWithFrontWorkV3({recording,
    frameIndex:34,stageInput,endKm:39});
  assert.match(replay.version,/committed-front-replay-6/);
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,4);
  for(const frame of replay.frames){
    const paid=recording.frames[frame.km-1];
    assert.deepEqual(frame.paidFrontWork.riderIds,
      paid.paidBunchPace.riderIds);
    assert.equal(frame.paidFrontWork.teamId,paid.paidBunchPace.teamId);
    for(const row of frame.riderStates){
      const actual=paid.riderGroups.find(candidate=>candidate.id===row.id);
      assert.equal(row.energy,actual.energy);
      assert.equal(row.group,actual.group);
      assert.equal(row.deficitSeconds,actual.deficitSeconds);
    }
  }
  assert.throws(()=>replayCommittedQuietBunchWithFrontWorkV3({
    recording:structuredClone(recording),frameIndex:34,stageInput,endKm:39}),
  /same-run issued/);
  stageInput.overlay.features=[{id:'illustrative-front-climb',kind:'climb',
    fromKm:35.2,toKm:35.6,gradientPct:8}];
  const altered=replayCommittedQuietBunchWithFrontWorkV3({recording,
    frameIndex:34,stageInput,endKm:36});
  assert.equal(altered.refusal,null);
  assert.deepEqual(altered.frames[0].paidFrontWork.riderIds,
    replay.frames[0].paidFrontWork.riderIds);
  assert.ok(altered.frames[0].riderWork.every((row,index)=>
    row.work>replay.frames[0].riderWork[index].work));
});

test('committed front work stops on the following kilometre',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4'});
  const teams=input.teams.map(team=>team.id==='you'?{...team,
    orders:{...team.orders,phases:[
      {atKm:10,frontWork:'rotate'},
      {atKm:20,frontWork:'sit_in'}]}}:team);
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,teams,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:20},(_,index)=>{
    const segment=recording.route.kilometres[index+10];
    return {id:`front-switch-${index+11}`,fromKm:index+10,
      toKm:index+11,conditions:{surface:segment.surface,
        exposed:segment.exposed,source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietBunchWithFrontWorkV3({recording,
    frameIndex:9,stageInput,endKm:30});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,20);
  assert.ok(replay.frames.slice(0,10).every(frame=>
    frame.paidFrontWork?.teamId==='you'));
  assert.ok(replay.frames.slice(10).every(frame=>
    frame.paidFrontWork===null));
  for(const frame of replay.frames)for(const row of frame.riderStates){
    const paid=recording.frames[frame.km-1].riderGroups.find(candidate=>
      candidate.id===row.id);
    assert.equal(row.energy,paid.energy);
    assert.equal(row.group,paid.group);
  }
});

test('competing front orders account for a passive 20-team field',()=>{
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:20,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-20',
    managerFinaleOrders:[
      {teamId:'you',atKm:35,frontWork:'rotate'},
      {teamId:'rival-1',atKm:35,frontWork:'rotate'}]});
  const {recording}=simulateTacticalTourWithHandoffStateV3({...input,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const route=recording.route.kilometres;
  const stageInput={version:STAGE_COMPLETE_INPUT_VERSION,
    overlay:{version:3,distanceKm:40,
      tacticalIntervals:Array.from({length:8},(_,index)=>{
        const segment=route[index*5];
        return {fromKm:index*5,toKm:(index+1)*5,
          conditions:{surface:segment.surface,exposed:segment.exposed,
            source:'simulated',weather:segment.weather}};
      }),conditionSpans:Array.from({length:2},(_,index)=>{
        const segment=route[index+35];
        return {id:`front-20-${index+36}`,fromKm:index+35,
          toKm:index+36,conditions:{surface:segment.surface,
            exposed:segment.exposed,source:'simulated',
            weather:segment.weather}};
      }),features:[]},
    kilometreBaselines:route.map(segment=>({terrain:segment.terrain,
      gradientPct:segment.gradientPct,source:'simulated'}))};
  const replay=replayCommittedQuietBunchWithFrontWorkV3({recording,
    frameIndex:34,stageInput,endKm:37});
  assert.equal(replay.refusal,null);
  assert.equal(replay.frames.length,2);
  for(const frame of replay.frames){
    assert.equal(frame.riderStates.length,160);
    assert.deepEqual(frame.paidFrontWork.riderIds,
      recording.frames[frame.km-1].paidBunchPace.riderIds);
    assert.equal(frame.paidFrontWork.teamId,
      recording.frames[frame.km-1].paidBunchPace.teamId);
    for(const row of frame.riderStates){
      const paid=recording.frames[frame.km-1].riderGroups.find(candidate=>
        candidate.id===row.id);
      assert.equal(row.energy,paid.energy);
      assert.equal(row.group,paid.group);
    }
  }
});

test('committed conserve front work prevents recovery for paid helpers',()=>{
  const {stageInput}=source();
  const input=prepareV91Playtest({distanceKm:40,terrain:'flat',
    teamCount:4,gender:'M',effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',seed:'front-work-4',
    managerFinaleOrders:[{teamId:'you',atKm:35,
      effort:'conserve',frontWork:'rotate'}]});
  const {recording,handoffStateTrace}=
    simulateTacticalTourWithHandoffStateV3({...input,
      motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  stageInput.overlay.conditionSpans=Array.from({length:2},(_,index)=>{
    const segment=recording.route.kilometres[index+35];
    return {id:`conserve-front-${index+36}`,fromKm:index+35,
      toKm:index+36,conditions:{surface:segment.surface,
        exposed:segment.exposed,source:'simulated',weather:segment.weather}};
  });
  const replay=replayCommittedQuietBunchWithFrontWorkV3({recording,
    frameIndex:34,stageInput,endKm:37});
  assert.equal(replay.refusal,null);
  for(const frame of replay.frames){
    assert.equal(frame.activeEfforts.find(row=>row.teamId==='you')
      .effort,'conserve');
    for(const row of frame.riderStates){
      const paid=recording.frames[frame.km-1].riderGroups.find(candidate=>
        candidate.id===row.id);
      const issued=handoffStateTrace.frames[frame.km-1].riders.find(candidate=>
        candidate.riderId===row.id);
      assert.equal(row.energy,paid.energy);
      assert.equal(row.quietKm,issued.quietKm);
    }
    for(const id of frame.paidFrontWork.riderIds)
      assert.equal(frame.riderWork.find(row=>row.id===id).recoveryAward,0);
  }
});

test('ambiguous kilometre preserves prior fully paid whole-field frames',()=>{
  const {recording,stageInput}=source();
  stageInput.overlay.features=[
    {id:'climb-a',kind:'climb',fromKm:14.2,toKm:14.6,gradientPct:8},
    {id:'climb-b',kind:'climb',fromKm:14.3,toKm:14.5,gradientPct:9},
  ];
  const replay=replayQuietWholeBunchStageV3({recording,frameIndex:9,
    stageInput,endKm:16});
  assert.equal(replay.refusedAtKm,15);
  assert.equal(replay.lastPaidKm,14);
  assert.equal(replay.frames.length,4);
  assert.match(replay.refusal,/Overlapping topographic/);
  assert.equal(replay.frames.at(-1).riderStates.length,32);
});

test('saved copies, dynamic orders and the finish refuse the bounded step',()=>{
  const {recording,stageInput}=source();
  assert.throws(()=>advanceQuietWholeBunchKilometreV3({
    recording:structuredClone(recording),frameIndex:9,stageInput}),
  /same-run issued/);
  assert.throws(()=>advanceQuietWholeBunchKilometreV3({
    recording,frameIndex:39,stageInput}),/quiet whole-bunch|attached field/i);
  const dynamic=source('dynamic-orders-4','selective');
  assert.throws(()=>advanceQuietWholeBunchKilometreV3({
    ...dynamic,frameIndex:9}),/quiet whole-bunch|dynamic team orders/i);
});
