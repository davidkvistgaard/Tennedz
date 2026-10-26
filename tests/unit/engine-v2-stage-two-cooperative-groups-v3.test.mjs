import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3,stageOverlaySlicesForKilometreV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from
  '../../lib/engine/v2/stage-slice-evaluation-v3.mjs';
import {evaluateTwoCooperativeGroupsKilometreV3} from
  '../../lib/engine/v2/stage-two-cooperative-groups-v3.mjs';
import {TUNING} from '../../lib/engine/v2/tuning.mjs';

function fixture(){
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,
      conditions:{surface:'road',exposed:false,source:'illustrative',
        weather:{temperatureC:16,windKph:0,rainMm:0}}})),
    features:[{id:'climb',kind:'climb',fromKm:10.2,toKm:10.8,
      gradientPct:10,label:'Synthetic short climb'}],
    conditionSpans:[{id:'rough',fromKm:10.4,toKm:10.6,
      conditions:{surface:'gravel',exposed:true,source:'simulated',
        weather:{temperatureC:16,windKph:28,rainMm:0}}}]});
  const member=(id,flat,mountain)=>({id,breakWork:'cooperate',
    effort:'steady',energyBefore:80,rider:{flat,mountain,timetrial:60,
      endurance:70,strength:60,form:50,fatigue:0}});
  const front={id:'road-front',members:[
    member('front-a',80,40),member('front-b',80,40)]};
  const rear={id:'road-rear',members:[
    member('rear-a',40,80),member('rear-b',40,80)]};
  return {overlay,kilometreIndex:10,front,rear,gapSeconds:5,
    baseTerrain:'flat',baseGradientPct:0};
}

test('fixed cooperative groups pay individual energy on exact short slices',()=>{
  const input=fixture();
  const saved=structuredClone(input);
  const step=evaluateTwoCooperativeGroupsKilometreV3(input);
  assert.equal(step.status,'separate');
  assert.equal(step.paidUntilKm,11);
  assert.deepEqual(step.frames.map(frame=>[frame.fromKm,frame.toKm]),
    [[10,10.2],[10.2,10.4],[10.4,10.6],[10.6,10.8],[10.8,11]]);
  assert.equal(step.frames[2].surface,'gravel');
  assert.deepEqual(step.frames[2].featureIds,['climb']);
  assert.deepEqual(step.frames[2].groupClocks.map(group=>group.groupId),
    ['road-front','road-rear']);
  for(const member of [...input.front.members,...input.rear.members]){
    const spent=step.frames.reduce((sum,frame)=>sum+
      frame.groupClocks.flatMap(group=>group.members)
        .find(row=>row.riderId===member.id).work,0);
    assert.ok(Math.abs(member.energyBefore-
      step.energies.find(row=>row.riderId===member.id).energy-
      spent)<3e-6);
  }
  assert.ok(step.frames.every(frame=>frame.gapBeforeSeconds>0&&
    frame.gapAfterSeconds>0));
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(step,'places'),false);
});

test('rotation relief reduces each worker cost against isolated solo work',()=>{
  const input=fixture();
  const step=evaluateTwoCooperativeGroupsKilometreV3(input);
  const first=stageOverlaySlicesForKilometreV3(input.overlay,10)[0];
  const solo=evaluateStageSliceRiderV3({slice:first,
    rider:input.front.members[0].rider,energyBefore:80,
    effort:'steady',baseTerrain:'flat',baseGradientPct:0,phase:'solo',
    extraWorkPerKm:TUNING.breakaway.extraCostPerKm});
  assert.ok(step.frames[0].groupClocks[0].members[0].work<solo.work);
});

test('possible group contact refuses before charging any member for that slice',()=>{
  const input=fixture();
  const step=evaluateTwoCooperativeGroupsKilometreV3({...input,
    gapSeconds:.01});
  assert.equal(step.status,'unresolved_group_contact');
  assert.equal(step.possibleContactSpan.fromKm,step.paidUntilKm);
  assert.ok(step.frames.every(frame=>frame.toKm<=step.paidUntilKm));
  const last=step.frames.at(-1);
  for(const row of step.energies){
    const expected=last?.groupClocks.flatMap(group=>group.members)
      .find(member=>member.riderId===row.riderId).energyAfter??80;
    assert.equal(row.energy,expected);
  }
  assert.equal(step.gapSeconds,last?.gapAfterSeconds??.01);
  assert.ok(step.gapSeconds>0);
});

test('fixed groups refuse shared riders, sit-on work, and missing separation',()=>{
  const input=fixture();
  assert.throws(()=>evaluateTwoCooperativeGroupsKilometreV3({...input,
    rear:{...input.rear,members:[
      {...input.rear.members[0],id:'front-a'},input.rear.members[1]]}}),
  /distinct fixed cooperative/);
  assert.throws(()=>evaluateTwoCooperativeGroupsKilometreV3({...input,
    rear:{...input.rear,members:[
      {...input.rear.members[0],breakWork:'sit_on'},input.rear.members[1]]}}),
  /distinct fixed cooperative/);
  assert.throws(()=>evaluateTwoCooperativeGroupsKilometreV3({...input,
    gapSeconds:0}),/positive/);
});
