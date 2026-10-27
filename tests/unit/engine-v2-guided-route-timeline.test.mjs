import test from 'node:test';
import assert from 'node:assert/strict';
import {guidedTimelinePhases} from
  '../../lib/engine/v2/playtest-timeline-v1.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {createV93CoastedPlaytest,validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';

const base={distanceKm:40,terrain:'flat',teamCount:4,gender:'M',
  effort:'steady',attack:'none',chase:'selective',
  defaultRivalPlan:'passive',seed:'route-timeline-1'};

test('guided route changes and a bounded break form one committed order timeline',()=>{
  const phases=guidedTimelinePhases([
    {atKm:5,effort:'conserve'},
    {atKm:10,chase:'ignore',frontWork:'sit_in'},
    {atKm:25,effort:'hard',chase:'all'},
  ],{fromKm:10,toKm:20},40);
  assert.deepEqual(phases,[
    {teamId:'you',atKm:5,effort:'conserve'},
    {teamId:'you',atKm:10,chase:'ignore',frontWork:'sit_in',attack:'selective'},
    {teamId:'you',atKm:20,attack:'none'},
    {teamId:'you',atKm:25,effort:'hard',chase:'all'},
  ]);
  const input={...base,managerTacticalOrdersV5:phases};
  const prepared=prepareV91Playtest(input);
  const own=prepared.teams.find(team=>team.id==='you');
  assert.equal(orderAt(own.orders,9).attack,'none');
  assert.equal(orderAt(own.orders,10).attack,'selective');
  assert.equal(orderAt(own.orders,20).attack,'none');
  assert.equal(orderAt(own.orders,25).chase,'all');
  const race=createV93CoastedPlaytest(input);
  assert.equal(validateV93CoastedPlaytest(input,{},race),true);
});

test('a named rider can receive one bounded route attack order with replay',()=>{
  const phases=guidedTimelinePhases([],{fromKm:10,toKm:30,
    riderId:'you-2'},40);
  assert.deepEqual(phases,[
    {teamId:'you',atKm:10,attack:'selective',attackRiderId:'you-2'},
    {teamId:'you',atKm:30,attack:'none'},
  ]);
  const input={...base,managerTacticalOrdersV6:phases};
  const prepared=prepareV91Playtest(input);
  const own=prepared.teams.find(team=>team.id==='you');
  assert.equal(orderAt(own.orders,10).attackRiderId,'you-2');
  assert.equal(orderAt(own.orders,30).attack,'none');
  const race=createV93CoastedPlaytest(input);
  assert.equal(validateV93CoastedPlaytest(input,{},race),true);
  assert.ok(race.recording.frames.find(frame=>frame.km===11)
    .attackers.includes('you-2'));
  assert.deepEqual(race.settings.managerTacticalOrdersV6,phases);
  assert.equal(prepareV91Playtest(base).settings.managerTacticalOrdersV6,
    undefined);
});

test('named route attacks reject foreign riders and older order versions',()=>{
  for(const attackRiderId of ['rival-1-2','you-8',''])
    assert.throws(()=>prepareV91Playtest({...base,
      managerTacticalOrdersV6:[
        {teamId:'you',atKm:10,attack:'selective',attackRiderId},
        {teamId:'you',atKm:30,attack:'none'}]}),
    /valid playtest settings/);
  assert.throws(()=>prepareV91Playtest({...base,
    managerTacticalOrdersV5:[{teamId:'you',atKm:5,effort:'hard'}],
    managerTacticalOrdersV6:[
      {teamId:'you',atKm:10,attack:'selective',attackRiderId:'you-2'},
      {teamId:'you',atKm:30,attack:'none'}]}),
  /valid playtest settings/);
});

test('timeline rejects invalid markers, duplicate changes and mixed versions',()=>{
  for(const invalid of [
    [{teamId:'you',atKm:7,attack:'selective'}],
    [{teamId:'you',atKm:10,attack:'always'}],
    [{teamId:'you',atKm:10,attack:'repeated'}],
    [{teamId:'you',atKm:10,attack:'selective'}],
    [{teamId:'you',atKm:10,attack:'none'}],
    [{teamId:'you',atKm:10}],
    [{teamId:'you',atKm:10,chase:'all'},
      {teamId:'you',atKm:10,attack:'none'}],
  ])assert.throws(()=>prepareV91Playtest({...base,
    managerTacticalOrdersV5:invalid}),/valid playtest settings/);
  assert.throws(()=>prepareV91Playtest({...base,
    managerTacticalOrdersV4:[{teamId:'you',atKm:5,effort:'hard'}],
    managerTacticalOrdersV5:[{teamId:'you',atKm:10,attack:'none'}]}),
  /valid playtest settings/);
  assert.equal(prepareV91Playtest(base).settings.managerTacticalOrdersV5,
    undefined);
});
