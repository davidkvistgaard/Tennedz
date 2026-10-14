import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest,createV91Playtest,
  summarizeV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

test('a synthetic v91 playtest is deterministic and keeps its versioned recording',()=>{
  const input={distanceKm:40,terrain:'rolling',teamCount:4,gender:'F',seed:'repeat'};
  const first=createV91Playtest(input);
  const second=createV91Playtest(input);
  assert.deepEqual(first.recording,second.recording);
  assert.equal(first.recording.tuningVersion,MOTOR_ATTACK_TRACE_VERSION);
  const summary=summarizeV91Playtest(first);
  assert.equal(summary.frames.length,40);
  assert.equal(summary.frames[0].ownRiders.length,8);
  assert.equal(summary.provisional,true);
  assert.equal(summary.provisionalTopTen.length,10);
});

test('changing a manager order changes attacks and paid energy on the same field',()=>{
  const shared={distanceKm:40,terrain:'flat',teamCount:4,seed:'paired'};
  const quiet=createV91Playtest({...shared,effort:'conserve',attack:'none',chase:'ignore'});
  const active=createV91Playtest({...shared,effort:'hard',attack:'repeated',chase:'all'});
  const ownAttacks=playtest=>playtest.recording.frames.flatMap(frame=>frame.attackers)
    .filter(riderId=>riderId.startsWith('you-')).length;
  assert.equal(ownAttacks(quiet),0);
  assert.ok(ownAttacks(active)>0);
  const energy=playtest=>playtest.recording.frames.at(-1).teamEnergy
    .find(team=>team.teamId==='you').mean;
  assert.ok(energy(active)<energy(quiet));
});

test('playtest settings stay bounded to documented synthetic options',()=>{
  assert.throws(()=>createV91Playtest({distanceKm:401}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({teamCount:21}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({terrain:'custom',distanceKm:40,
    profileHeightsM:[0,1000,0,0,0,0]}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({terrain:'custom',
    profileHeightsM:[0,100,200]}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({seed:''}),/valid playtest settings/);
  assert.throws(()=>createV91Playtest({rivalPlans:['chase','unknown','neutral']}),
    /valid playtest settings/);
  assert.throws(()=>createV91Playtest({defaultRivalPlan:'unknown'}),
    /valid playtest settings/);
  assert.throws(()=>createV91Playtest({teamCount:4,managerTactics:
    Array.from({length:4},()=>({effort:'steady',attack:'none',chase:'ignore'}))}),
  /valid playtest settings/);
  assert.throws(()=>createV91Playtest({managerTactics:[
    {effort:'hard',attack:'unknown',chase:'all'}]}),/valid playtest settings/);
});

test('a custom profile changes recorded gradients without changing roster or seed',()=>{
  const shared={terrain:'custom',distanceKm:40,teamCount:4,seed:'same-field'};
  const flat=createV91Playtest({...shared,profileHeightsM:[100,100,100,100,100,100]});
  const hill=createV91Playtest({...shared,profileHeightsM:[100,500,100,500,100,100]});
  assert.deepEqual(flat.recording.committedInputs.teams,hill.recording.committedInputs.teams);
  assert.ok(flat.recording.route.kilometres.every(km=>km.terrain==='flat'));
  assert.ok(hill.recording.route.kilometres.some(km=>km.terrain==='climb'));
  assert.notDeepEqual(flat.recording.frames.map(frame=>frame.teamEnergy),
    hill.recording.frames.map(frame=>frame.teamEnergy));
  assert.deepEqual(hill.settings.profileHeightsM,[100,500,100,500,100,100]);
});

test('one rival may change tactics without replacing the fictional field',()=>{
  const shared={distanceKm:120,teamCount:4,seed:'paired-rivals'};
  const chase=createV91Playtest({...shared,rivalPlans:['chase','attack','neutral']});
  const attack=createV91Playtest({...shared,rivalPlans:['attack','attack','neutral']});
  const roster=playtest=>playtest.recording.committedInputs.teams.map(team=>team.riders);
  assert.deepEqual(roster(chase),roster(attack));
  const ordersFor=(playtest,id)=>playtest.recording.committedInputs.teams
    .find(team=>team.id===id).orders;
  for(const id of ['you','rival-2','rival-3'])
    assert.deepEqual(ordersFor(chase,id),ordersFor(attack,id));
  const attempts=playtest=>playtest.recording.frames.flatMap(frame=>frame.attackers)
    .filter(riderId=>riderId.startsWith('rival-1-')).length;
  assert.equal(attempts(chase),0);
  assert.ok(attempts(attack)>0);
});

test('any number of rival managers may override the chosen default tactics',()=>{
  const shared={distanceKm:40,teamCount:15,seed:'manager-count',
    defaultRivalPlan:'chase'};
  const defaults=createV91Playtest(shared);
  const overrides=[{effort:'conserve',attack:'repeated',chase:'ignore'},
    {effort:'steady',attack:'selective',chase:'selective'}];
  const changed=createV91Playtest({...shared,managerTactics:overrides});
  const teams=playtest=>playtest.recording.committedInputs.teams;
  assert.deepEqual(teams(defaults).map(team=>team.riders),
    teams(changed).map(team=>team.riders));
  const baseline=(playtest,id)=>{
    const {effort,attack,chase}=teams(playtest).find(team=>team.id===id)
      .orders.baseline;
    return {effort,attack,chase};
  };
  assert.deepEqual(baseline(changed,'rival-1'),overrides[0]);
  assert.deepEqual(baseline(changed,'rival-2'),overrides[1]);
  for(let index=3;index<15;index++)
    assert.deepEqual(baseline(changed,`rival-${index}`),
      {effort:'hard',attack:'none',chase:'all'});
  assert.deepEqual(changed.settings.managerTactics,overrides);
  assert.deepEqual(changed.recording,createV91Playtest({...shared,
    managerTactics:overrides}).recording);
});

test('all 19 rivals may have individual tactics within the request limit',()=>{
  const managerTactics=Array.from({length:19},(_,index)=>({
    effort:index%2?'hard':'conserve',
    attack:index%3?'none':'selective',
    chase:index%2?'all':'ignore'}));
  const input={distanceKm:40,teamCount:20,managerTactics};
  assert.ok(Buffer.byteLength(JSON.stringify(input))<2048);
  const playtest=createV91Playtest(input);
  assert.equal(playtest.settings.managerTactics.length,19);
  for(let index=1;index<20;index++){
    const {effort,attack,chase}=playtest.recording.committedInputs.teams
      .find(team=>team.id===`rival-${index}`).orders.baseline;
    assert.deepEqual({effort,attack,chase},managerTactics[index-1]);
  }
});

test('prepared playtest inputs match execution without an eager race',()=>{
  const input={distanceKm:40,terrain:'custom',teamCount:4,
    gender:'F',seed:'prepared',attack:'none',
    profileHeightsM:[100,130,160,135,120,100]};
  const prepared=prepareV91Playtest(input);
  const executed=createV91Playtest(input);
  assert.equal(Object.hasOwn(prepared,'recording'),false);
  assert.deepEqual(prepared.settings,executed.settings);
  const byId=new Map(executed.recording.committedInputs.teams.map(team=>
    [team.id,team]));
  assert.equal(byId.size,prepared.teams.length);
  for(const team of prepared.teams){
    const locked=byId.get(team.id);
    assert.ok(locked);
    assert.deepEqual(locked.riders.map(row=>row.id),
      team.riders.map(row=>row.id));
    assert.deepEqual(locked.riders.map(row=>row.sprint),
      team.riders.map(row=>row.sprint));
    assert.equal(locked.orders.baseline.attack,
      team.orders.baseline.attack);
  }
  assert.equal(prepared.stage.distance_km,40);
  assert.equal(prepared.weather.wind_kph,10);
  assert.throws(()=>prepareV91Playtest({...input,teamCount:21}),
    /valid playtest settings/);
});
