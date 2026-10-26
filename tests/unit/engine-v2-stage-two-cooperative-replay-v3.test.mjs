import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from
  '../../lib/engine/v2/stage-overlay-v3.mjs';
import {replayTwoCooperativeGroupsStageV3} from
  '../../lib/engine/v2/stage-two-cooperative-replay-v3.mjs';

function fixture(){
  const overlay=normalizeStageOverlayV3({version:3,distanceKm:20,
    tacticalIntervals:Array.from({length:4},(_,index)=>({
      fromKm:index*5,toKm:(index+1)*5,
      conditions:{surface:'road',exposed:false,source:'illustrative',
        weather:{temperatureC:16,windKph:0,rainMm:0}}})),
    features:[{id:'short-climb',kind:'climb',fromKm:10.2,
      toKm:10.8,gradientPct:10,label:'Synthetic short climb'}],
    conditionSpans:[{id:'rough',fromKm:10.4,toKm:10.6,
      conditions:{surface:'gravel',exposed:true,source:'simulated',
        weather:{temperatureC:16,windKph:28,rainMm:0}}}]});
  const member=(id,flat,mountain)=>({id,breakWork:'cooperate',
    effort:'steady',energyBefore:80,rider:{flat,mountain,timetrial:60,
      endurance:70,strength:60,form:50,fatigue:0}});
  const front={id:'front',members:[member('a',80,40),
    member('b',80,40)]};
  const rear={id:'rear',members:[member('c',40,80),
    member('d',40,80)]};
  const kilometreBaselines=Array.from({length:20},()=>({
    terrain:'flat',gradientPct:0}));
  return {overlay,front,rear,gapSeconds:30,kilometreBaselines};
}

test('fixed two-group replay pays energy through every exact short slice',()=>{
  const input=fixture(),saved=structuredClone(input);
  const race=replayTwoCooperativeGroupsStageV3(input);
  assert.equal(race.status,'separate');
  assert.equal(race.paidUntilKm,20);
  assert.equal(race.kilometres.length,20);
  assert.deepEqual(race.kilometres[10].frames.map(frame=>
    [frame.fromKm,frame.toKm]),
  [[10,10.2],[10.2,10.4],[10.4,10.6],[10.6,10.8],[10.8,11]]);
  assert.equal(race.kilometres[10].frames[2].surface,'gravel');
  assert.deepEqual(race.kilometres[10].frames[2].featureIds,
    ['short-climb']);
  assert.ok(race.kilometres.flatMap(km=>km.frames)
    .every(frame=>frame.gapAfterSeconds>0));
  for(const member of [...input.front.members,...input.rear.members]){
    const spent=race.kilometres.flatMap(km=>km.frames)
      .reduce((total,frame)=>total+frame.groupClocks
        .flatMap(group=>group.members).find(row=>
          row.riderId===member.id).work,0);
    const remaining=race.energies.find(row=>
      row.riderId===member.id).energy;
    assert.ok(Math.abs(member.energyBefore-remaining-spent)<3e-5);
  }
  assert.deepEqual(input,saved);
  assert.equal(Object.hasOwn(race,'places'),false);
});

test('group-wide effort orders activate only after their 5 km markers',()=>{
  const input=fixture();
  const baseline=replayTwoCooperativeGroupsStageV3(input);
  const changed=replayTwoCooperativeGroupsStageV3({...input,
    effortOrders:[{groupId:'front',markerKm:5,effort:'hard'},
      {groupId:'rear',markerKm:10,effort:'conserve'}]});
  assert.deepEqual(changed.kilometres[4].groupEfforts,
    [{groupId:'front',effort:'steady'},{groupId:'rear',effort:'steady'}]);
  assert.deepEqual(changed.kilometres[5].ordersActivated,
    [{groupId:'front',markerKm:5,effort:'hard'}]);
  assert.deepEqual(changed.kilometres[10].ordersActivated,
    [{groupId:'rear',markerKm:10,effort:'conserve'}]);
  assert.ok(changed.energies.find(row=>row.riderId==='a').energy<
    baseline.energies.find(row=>row.riderId==='a').energy);
  assert.ok(changed.energies.find(row=>row.riderId==='c').energy>
    baseline.energies.find(row=>row.riderId==='c').energy);
});

test('stage stops at first possible group contact without an official result',()=>{
  const input=fixture();
  const weakFront={...input.front,members:input.front.members.map(member=>({
    ...member,rider:{...member.rider,flat:20,mountain:20}}))};
  const strongRear={...input.rear,members:input.rear.members.map(member=>({
    ...member,rider:{...member.rider,flat:95,mountain:95}}))};
  const race=replayTwoCooperativeGroupsStageV3({...input,
    front:weakFront,rear:strongRear,gapSeconds:.05});
  assert.equal(race.status,'unresolved_group_contact');
  assert.ok(race.paidUntilKm<20);
  assert.equal(race.possibleContactSpan.fromKm,race.paidUntilKm);
  assert.ok(race.kilometres.at(-1).frames.every(frame=>
    frame.toKm<=race.paidUntilKm));
  assert.ok(race.gapSeconds>0);
  assert.equal(Object.hasOwn(race,'places'),false);
  assert.equal(Object.hasOwn(race,'points'),false);
});

test('group replay refuses off-grid, duplicate and conflicting orders',()=>{
  const input=fixture();
  assert.throws(()=>replayTwoCooperativeGroupsStageV3({...input,
    effortOrders:[{groupId:'front',markerKm:6,effort:'hard'}]}),
  /5 km/);
  assert.throws(()=>replayTwoCooperativeGroupsStageV3({...input,
    effortOrders:[{groupId:'front',markerKm:5,effort:'hard'},
      {groupId:'front',markerKm:5,effort:'steady'}]}),/Duplicate/);
  assert.throws(()=>replayTwoCooperativeGroupsStageV3({...input,
    front:{...input.front,members:[input.front.members[0],
      {...input.front.members[1],effort:'hard'}]}}),/one shared effort/);
});
