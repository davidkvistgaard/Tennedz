import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateTwoDeclaredWorkGroupsKilometreV3,
  STAGE_TWO_DECLARED_WORK_GROUPS_VERSION} from
  '../../lib/engine/v2/stage-two-declared-work-groups-v3.mjs';
import {relativeRoadGroupPace,roadGroupExposureCosts} from
  '../../lib/engine/v2/road-groups.mjs';

function fixture(){
  const conditions={surface:'road',exposed:false,source:'illustrative',
    weather:{temperatureC:16,windKph:8,rainMm:0}};
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,conditions})),
    features:[{id:'short-climb',kind:'climb',fromKm:.2,toKm:.8,
      gradientPct:8,label:'Synthetic short climb'}]});
  const member=(id,flat,breakWork)=>({id,breakWork,effort:'steady',
    energyBefore:80,rider:{id,flat,mountain:60,timetrial:60,
      endurance:70,strength:60,form:50,fatigue:0}});
  const front={id:'road-1',members:[member('front-a',50,'drive'),
    member('front-b',50,'sit_on')]};
  const rear={id:'road-2',members:[member('rear-a',80,'cooperate'),
    member('rear-b',80,'cooperate')]};
  return {overlay,kilometreIndex:0,front,rear,gapSeconds:5,
    baseTerrain:'flat',baseGradientPct:0,
    pullRiderIds:['front-a','rear-a','rear-b'],
    driveRiderIds:['front-a']};
}

test('declared pull and drive roster pays each short slice and rider once',()=>{
  const input=fixture(),original=structuredClone(input);
  const result=evaluateTwoDeclaredWorkGroupsKilometreV3(input);
  assert.equal(result.version,STAGE_TWO_DECLARED_WORK_GROUPS_VERSION);
  assert.equal(result.status,'separate');
  assert.deepEqual(result.frames.map(frame=>[frame.fromKm,frame.toKm]),
    [[0,.2],[.2,.8],[.8,1]]);
  assert.deepEqual(result.frames[1].featureIds,['short-climb']);
  assert.deepEqual(result.frames[0].groupClocks[0].pullRiderIds,['front-a']);
  assert.deepEqual(result.frames[0].groupClocks[0].driveRiderIds,['front-a']);
  const work=id=>result.frames.reduce((sum,frame)=>sum+
    frame.groupClocks.flatMap(group=>group.members)
      .find(member=>member.riderId===id).work,0);
  assert.ok(work('front-a')>work('front-b'));
  for(const member of [...input.front.members,...input.rear.members]){
    const end=result.energies.find(row=>row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-end-work(member.id))<3e-6);
  }
  assert.deepEqual(input,original);
  assert.equal(Object.hasOwn(result,'places'),false);
});

test('homogeneous declared work matches the existing v2 pull and drive clock',()=>{
  const input=fixture();
  input.overlay={...input.overlay,features:[]};
  const group=(source,gapSeconds)=>({id:source.id,
    riderIds:source.members.map(member=>member.id),
    teamIds:source.members.map(member=>member.id),gapSeconds});
  const front=group(input.front,10),rear=group(input.rear,5);
  const teams=[...input.front.members,...input.rear.members].map(member=>({
    id:member.id,riders:[member.rider],
    energy:{[member.id]:member.energyBefore},
    orders:{baseline:{breakWork:member.breakWork},phases:[]}}));
  const segment={km:1,terrain:'flat',gradientPct:0,surface:'road',
    exposed:false,weather:input.overlay.tacticalIntervals[0].conditions.weather};
  const drift=relativeRoadGroupPace(front,rear,teams,segment,
    input.pullRiderIds);
  const exposure=roadGroupExposureCosts([front,rear],input.pullRiderIds,
    {driveRiderIds:input.driveRiderIds});
  const result=evaluateTwoDeclaredWorkGroupsKilometreV3(input);
  assert.equal(result.frames.length,1);
  assert.ok(Math.abs(result.gapSeconds-input.gapSeconds-drift)<=.005001);
  const work=result.frames[0].groupClocks.flatMap(group=>group.members);
  assert.ok(work.find(row=>row.riderId==='front-a').work>
    work.find(row=>row.riderId==='front-b').work);
  assert.ok(exposure.get('front-a')>exposure.get('front-b'));
  assert.ok(Math.abs(exposure.get('rear-a')-
    exposure.get('rear-b'))<1e-9);
});

test('possible declared-work contact rolls back the unpaid slice',()=>{
  const input=fixture();
  const result=evaluateTwoDeclaredWorkGroupsKilometreV3({...input,
    gapSeconds:.01});
  assert.equal(result.status,'unresolved_group_contact');
  assert.equal(result.paidUntilKm,result.possibleContactSpan.fromKm);
  assert.ok(result.frames.every(frame=>frame.toKm<=result.paidUntilKm));
  const last=result.frames.at(-1);
  for(const row of result.energies){
    const paid=last?.groupClocks.flatMap(group=>group.members)
      .find(member=>member.riderId===row.riderId);
    assert.equal(row.energy,paid?.energyAfter??80);
  }
  assert.ok(result.gapSeconds>0);
});

test('declared work refuses unknown pullers, duplicate workers and unearned drives',()=>{
  const input=fixture();
  for(const invalid of [
    {...input,pullRiderIds:['front-a','front-a']},
    {...input,pullRiderIds:['unknown']},
    {...input,driveRiderIds:['front-b']},
    {...input,driveRiderIds:['front-a','front-a']},
    {...input,gapSeconds:0},
  ])assert.throws(()=>evaluateTwoDeclaredWorkGroupsKilometreV3(invalid));
});
