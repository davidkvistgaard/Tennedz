import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTourWithHandoffStateV3} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {STAGE_COMPLETE_INPUT_VERSION} from
  '../../lib/engine/v2/stage-complete-input-v3.mjs';
import {advanceQuietWholeBunchKilometreV3} from
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
