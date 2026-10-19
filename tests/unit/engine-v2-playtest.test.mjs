import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest,createV91Playtest,
  summarizeV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {recordFinaleConcurrentNamedMultiSelectiveRotationFromTour,
  validateFinaleConcurrentNamedMultiSelectiveRotationFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-launch.mjs';

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

test('passive rival preset gives a visible no-attack no-chase plan at every field size',()=>{
  for(const teamCount of [4,15,20]){
    const prepared=prepareV91Playtest({distanceKm:40,teamCount,
      defaultRivalPlan:'passive'});
    assert.equal(prepared.settings.defaultRivalPlan,'passive');
    assert.equal(prepared.teams.length,teamCount);
    for(const team of prepared.teams.slice(1))
      assert.deepEqual(team.orders.baseline,
        {effort:'steady',attack:'none',chase:'ignore'});
  }
  const mixed=prepareV91Playtest({distanceKm:40,teamCount:4,
    rivalPlans:['passive','chase','neutral']});
  assert.deepEqual(mixed.teams[1].orders.baseline,
    {effort:'steady',attack:'none',chase:'ignore'});
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

test('named rival tactics select a nonconsecutive manager without changing the field',()=>{
  const shared={distanceKm:40,teamCount:4,seed:'sparse-managers',
    defaultRivalPlan:'chase',managerTactics:[
      {effort:'steady',attack:'none',chase:'ignore'}]};
  const baseline=createV91Playtest(shared);
  const tactic={teamId:'rival-3',effort:'conserve',attack:'none',
    chase:'ignore'};
  const changed=createV91Playtest({...shared,
    managerTacticOverrides:[tactic]});
  const teams=playtest=>new Map(playtest.recording.committedInputs.teams
    .map(team=>[team.id,team]));
  const before=teams(baseline),after=teams(changed);
  assert.deepEqual([...before.values()].map(team=>team.riders),
    [...after.values()].map(team=>team.riders));
  for(const id of ['you','rival-1','rival-2'])
    assert.deepEqual(after.get(id).orders,before.get(id).orders);
  assert.equal(after.get('rival-3').orders.baseline.effort,'conserve');
  assert.equal(after.get('rival-3').orders.baseline.chase,'ignore');
  assert.deepEqual(changed.settings.managerTacticOverrides,[tactic]);
  assert.equal(Object.hasOwn(baseline.settings,'managerTacticOverrides'),false);
  assert.deepEqual(changed.recording,createV91Playtest({...shared,
    managerTacticOverrides:[tactic]}).recording);
});

test('named rival tactics reject overlap, unknown managers and invalid orders',()=>{
  const valid={teamId:'rival-3',effort:'hard',attack:'none',chase:'all'};
  for(const managerTacticOverrides of [
    [{...valid,teamId:'rival-1'}],
    [valid,valid],
    [{...valid,teamId:'rival-4'}],
    [{...valid,teamId:'you'}],
    [{...valid,effort:'extreme'}],
    [{teamId:'rival-3',effort:'hard',attack:'none'}],
    [{...valid,extra:true}],
  ])assert.throws(()=>prepareV91Playtest({teamCount:4,
    managerTactics:[{effort:'steady',attack:'none',chase:'ignore'}],
    managerTacticOverrides}),/valid playtest settings/);
});

test('two managers can lock distinct named final-kilometre attacks on one race',()=>{
  const settings={distanceKm:40,teamCount:4,seed:'paired-final-orders',
    attack:'none',chase:'ignore',defaultRivalPlan:'neutral',
    managerFinaleOrders:[
      {teamId:'you',attack:'selective',attackRiderId:'you-5',
        chase:'ignore',frontWork:'sit_in'},
      {teamId:'rival-2',attack:'selective',
        attackRiderId:'rival-2-6',chase:'ignore',frontWork:'sit_in'},
      {teamId:'rival-1',attack:'none',chase:'selective',
        frontWork:'sit_in'},
      {teamId:'rival-3',attack:'none',frontWork:'rotate'}]};
  const prepared=prepareV91Playtest(settings);
  assert.deepEqual(prepared.settings.managerFinaleOrders,
    settings.managerFinaleOrders);
  assert.deepEqual(prepared.teams.map(team=>team.orders.phases.length),
    [1,1,1,1]);
  const played=createV91Playtest(settings);
  assert.deepEqual(played.recording,createV91Playtest(settings).recording);
  const byId=new Map(played.recording.committedInputs.teams.map(team=>
    [team.id,team]));
  assert.equal(orderAt(byId.get('you').orders,39).attackRiderId,'you-5');
  assert.equal(orderAt(byId.get('rival-2').orders,39).attackRiderId,
    'rival-2-6');
  assert.equal(orderAt(byId.get('rival-1').orders,39).chase,'selective');
  assert.equal(orderAt(byId.get('rival-3').orders,39).frontWork,'rotate');
  assert.equal(played.recording.frames.length,40);
});

test('named finale orders reject wrong riders and contradictory attack rules',()=>{
  const valid={teamId:'you',attack:'selective',attackRiderId:'you-5'};
  for(const managerFinaleOrders of [
    [valid,valid],
    [{...valid,teamId:'rival-4'}],
    [{...valid,attackRiderId:'rival-1-5'}],
    [{...valid,attack:'none'}],
    [{...valid,frontWork:'fly'}],
    [{...valid,atKm:39}],
    [{teamId:'you'}],
  ])assert.throws(()=>prepareV91Playtest({teamCount:4,
    managerFinaleOrders}),/valid playtest settings/);
});

test('chosen managers enter the existing two-attack paid launch on one road',()=>{
  const ids=['you',...Array.from({length:14},(_,index)=>
    `rival-${index+1}`)];
  const managerFinaleOrders=ids.map(teamId=>({teamId,attack:'none',
    chase:'ignore',frontWork:'sit_in'}));
  for(const id of ['you','rival-2']){
    const row=managerFinaleOrders.find(order=>order.teamId===id);
    row.attack='selective';
    row.attackRiderId=`${id}-5`;
  }
  for(const id of ['rival-1','rival-3'])
    managerFinaleOrders.find(row=>row.teamId===id).chase='selective';
  managerFinaleOrders.find(row=>row.teamId==='rival-4').frontWork='rotate';
  const {recording}=createV91Playtest({distanceKm:40,teamCount:15,
    seed:'paired-final-orders',attack:'none',chase:'ignore',
    defaultRivalPlan:'neutral',
    teamOverrides:ids.map(teamId=>({teamId,level:80})),
    managerFinaleOrders});
  const paid=recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(
    recording);
  validateFinaleConcurrentNamedMultiSelectiveRotationFromTour(recording,
    JSON.parse(JSON.stringify(paid)));
  assert.deepEqual(new Set(paid.attacks.map(row=>row.riderId)),
    new Set(['you-5','rival-2-5']));
  assert.ok(paid.riderEnergy.filter(row=>row.role==='attack').every(row=>
    row.energySpent>0&&row.energyAfter<row.energyAtDecision));
  assert.ok(paid.chase?.energySpent>0);
  assert.ok(paid.rotation.selected?.work.length>0);
});

test('opt-in team profiles change field strength and fatigue without changing orders',()=>{
  const shared={distanceKm:40,terrain:'flat',teamCount:4,gender:'F',
    seed:'independent-field',attack:'none',chase:'ignore'};
  const baseline=createV91Playtest(shared);
  const input={...shared,teamOverrides:[
    {teamId:'you',level:62,fatigue:30},
    {teamId:'rival-1',level:92,fatigue:0}]};
  const changed=createV91Playtest(input);
  const byId=playtest=>new Map(playtest.recording.committedInputs.teams
    .map(team=>[team.id,team]));
  const before=byId(baseline),after=byId(changed);
  for(const id of ['you','rival-1']){
    assert.deepEqual(after.get(id).orders,before.get(id).orders);
    assert.deepEqual(after.get(id).riders.map(row=>row.id),
      before.get(id).riders.map(row=>row.id));
  }
  assert.deepEqual(after.get('rival-2'),before.get('rival-2'));
  assert.equal(after.get('you').riders[0].flat,56);
  assert.equal(after.get('you').riders[0].fatigue,30);
  assert.equal(after.get('rival-1').riders[0].flat,86);
  assert.equal(after.get('rival-1').riders[0].fatigue,0);
  assert.ok(changed.recording.frames[0].teamEnergy.find(row=>
    row.teamId==='you').mean<baseline.recording.frames[0].teamEnergy
    .find(row=>row.teamId==='you').mean);
  assert.deepEqual(changed.recording,createV91Playtest(input).recording);
  assert.deepEqual(changed.settings.teamOverrides,input.teamOverrides);
  assert.equal(Object.hasOwn(baseline.settings,'teamOverrides'),false);
});

test('team profile overrides reject unknown, duplicate and invalid inputs',()=>{
  for(const teamOverrides of [
    [{teamId:'rival-4',level:70}],
    [{teamId:'you',level:70},{teamId:'you',fatigue:30}],
    [{teamId:'you'}],
    [{teamId:'you',level:-1}],
    [{teamId:'you',level:101}],
    [{teamId:'you',level:72.5}],
    [{teamId:'you',fatigue:101}],
    [{teamId:'you',level:70,extra:true}],
  ])assert.throws(()=>prepareV91Playtest({teamCount:4,teamOverrides}),
    /valid playtest settings/);
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
