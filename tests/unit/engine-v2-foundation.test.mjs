import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {normalizeOrders,orderAt,breakAttackAt} from '../../lib/engine/v2/orders.mjs';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {SPORTING_SKILLS,sportingSkills,riderKilometreEffect} from '../../lib/engine/v2/physiology.mjs';
import {runKilometreLab} from '../../lib/engine/v2/lab.mjs';
import {updateRiderGroups} from '../../lib/engine/v2/groups.mjs';
import {provisionalFinish,provisionalRoadGroupFinish,
  resolveRearRoadGroupFinishingSprint} from '../../lib/engine/v2/finish.mjs';
import {selectShelter} from '../../lib/engine/v2/support.mjs';
import {selectCaptainSupport,applyCaptainSupport} from '../../lib/engine/v2/captain-support.mjs';
import {MAX_ROAD_GROUPS,advanceRoadGroups,assertRoadGroups,relativeRoadGroupPace,
  validateRoadGroupTransition,roadGroupExposureCosts} from '../../lib/engine/v2/road-groups.mjs';
import {automaticBreakAttackRider} from '../../lib/engine/v2/break-attack.mjs';
import {validateRecordedTour,readRecordedKilometre} from '../../lib/engine/v2/recording.mjs';
import {recoveryForKilometre} from '../../lib/engine/v2/recovery.mjs';
import {flatScenario} from '../../lib/race-lab/scenario.mjs';

const stage={distance_km:40,profile_points:[[0,100],[10,100],[20,300],[30,100],[40,100]],
  surface_segments:[{from_km:12,to_km:15,surface:'cobbles'}],exposed_segments:[{from_km:30,to_km:35}],
  keypoints:[{km:15,kind:'CLIMB'}]};
const riders=Array.from({length:8},(_,i)=>`r${i}`);

test('every kilometre has coherent elevation, terrain, surface and locked-weather variation',()=>{
  const options={seed:'fixed-race',weather:{temp_c:16,wind_kph:22,precipitation_mm:3}};
  const a=buildKilometreRoute(stage,options),b=buildKilometreRoute(stage,options);
  assert.deepEqual(a,b);
  assert.deepEqual(a.lockedWeather,{temperatureC:16,windKph:22,rainMm:3});
  assert.equal(a.kilometres.length,40);
  assert.equal(a.kilometres[0].startM,100);
  assert.equal(a.kilometres.at(-1).endM,100);
  assert.equal(a.kilometres[10].terrain,'hill');
  assert.equal(a.kilometres[20].terrain,'descent');
  assert.equal(a.kilometres[12].surface,'cobbles');
  assert.equal(a.kilometres[15].surface,'road');
  assert.equal(a.kilometres[29].exposed,false);
  assert.equal(a.kilometres[30].exposed,true);
  for(let i=0;i<a.kilometres.length;i++){
    const current=a.kilometres[i],previous=a.kilometres[i-1];
    assert.equal(current.km,i+1);
    if(previous){
      assert.equal(previous.endM,current.startM);
      assert.ok(Math.abs(previous.weather.temperatureC-current.weather.temperatureC)<=.31);
      assert.ok(Math.abs(previous.weather.windKph-current.weather.windKph)<=.81);
      assert.ok(Math.abs(previous.weather.rainMm-current.weather.rainMm)<=.19);
    }
  }
});

test('the same geography with another seed changes only local weather',()=>{
  const a=buildKilometreRoute(stage,{seed:'a'}),b=buildKilometreRoute(stage,{seed:'b'});
  assert.notDeepEqual(a.kilometres.map(k=>k.weather),b.kilometres.map(k=>k.weather));
  assert.deepEqual(a.kilometres.map(({weather,...rest})=>rest),b.kilometres.map(({weather,...rest})=>rest));
});

test('invalid elevation or overlapping surfaces fail before simulation',()=>{
  assert.throws(()=>buildKilometreRoute({...stage,profile_points:[[0,0],[20,20],[19,30],[40,0]]}));
  assert.throws(()=>buildKilometreRoute({...stage,surface_segments:[{from_km:12,to_km:15,surface:'cobbles'},{from_km:14,to_km:16,surface:'gravel'}]}));
  assert.throws(()=>buildKilometreRoute({...stage,exposed_segments:[{from_km:10,to_km:20},{from_km:19,to_km:30}]}));
  assert.throws(()=>buildKilometreRoute({...stage,distance_km:40.5}));
});

test('simple presets and expert phases resolve without changing earlier orders',()=>{
  const orders=normalizeOrders({captainId:'r0',roadCaptainId:'r1',backupId:'r2',preset:'protect',
    phases:[{atKm:20,effort:'hard',chase:'all'},{atKm:15,chase:'ignore'}]},
    {riderIds:riders,distanceKm:40,keypoints:stage.keypoints});
  assert.deepEqual(orderAt(orders,0),{effort:'conserve',chase:'selective',attack:'none',breakWork:'cooperate',breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'});
  assert.deepEqual(orderAt(orders,15),{effort:'conserve',chase:'ignore',attack:'none',breakWork:'cooperate',breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'});
  assert.deepEqual(orderAt(orders,20),{effort:'hard',chase:'all',attack:'none',breakWork:'cooperate',breakFinale:'hold_group',helperAttackPolicy:'open',captainSupport:'hold_position'});
  assert.deepEqual(orders.helperIds,['r2','r3','r4','r5','r6','r7']);
  assert.equal(orders.roadCaptainId,'r1');
});

test('a planned attack from the break fires once after its marker',()=>{
  const orders=normalizeOrders({captainId:'r0',phases:[{atKm:20,breakAttackRiderId:'r2'}]},
    {riderIds:riders,distanceKm:40});
  assert.equal(breakAttackAt(orders,20),null);
  assert.equal(breakAttackAt(orders,21),'r2');
  assert.equal(breakAttackAt(orders,22),null);
  assert.equal(orderAt(orders,21).breakAttackRiderId,undefined);
  assert.throws(()=>normalizeOrders({captainId:'r0',phases:[{atKm:20,breakAttackRiderId:'foreign'}]},
    {riderIds:riders,distanceKm:40}),/break attack/);
});

test('orders reject foreign riders, ambiguous markers and unknown values',()=>{
  const context={riderIds:riders,distanceKm:40,keypoints:stage.keypoints};
  assert.throws(()=>normalizeOrders({captainId:'foreign'},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',roadCaptainId:'foreign'},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',phases:[{atKm:13,effort:'hard'}]},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',phases:[{atKm:10,effort:'hard'},{atKm:10,chase:'all'}]},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{chase:'always'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{effort:'steady',effrot:'hard'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',phases:[{atKm:10,attack:'none',attak:'repeated'}]},context));
  assert.throws(()=>normalizeOrders({version:3,captainId:'r0'},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{attackRiderId:'foreign'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',phases:[{atKm:20,attackRiderId:'foreign'}]},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',breakResponse:'improvise'},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',forwardResponse:'chase_always'},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{breakWork:'free_speed'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{breakFinale:'win_anyway'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{helperAttackPolicy:'teleport'}},context));
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{captainSupport:'teleport'}},context));
  assert.equal(normalizeOrders({captainId:'r0',breakResponse:'chase_if_threatened'},context).breakResponse,
    'chase_if_threatened');
  assert.equal(normalizeOrders({captainId:'r0',forwardResponse:'chase_if_fading'},context).forwardResponse,
    'chase_if_fading');
});

test('a precommitted marker changes break cooperation without rewriting earlier orders',()=>{
  const orders=normalizeOrders({captainId:'r0',baseline:{breakWork:'sit_on'},
    phases:[{atKm:20,breakWork:'cooperate'}]},
  {riderIds:riders,distanceKm:40});
  assert.equal(orderAt(orders,19).breakWork,'sit_on');
  assert.equal(orderAt(orders,20).breakWork,'cooperate');
});

test('a support order can be precommitted for a later route marker',()=>{
  const orders=normalizeOrders({captainId:'r0',phases:[{atKm:20,captainSupport:'drop_back_if_dropped'}]},
    {riderIds:riders,distanceKm:40});
  assert.equal(orderAt(orders,19).captainSupport,'hold_position');
  assert.equal(orderAt(orders,20).captainSupport,'drop_back_if_dropped');
});

test('helper freedom may change at a committed route marker',()=>{
  const orders=normalizeOrders({captainId:'r0',baseline:{helperAttackPolicy:'hold_for_captain'},
    phases:[{atKm:20,helperAttackPolicy:'release_if_dropped'}]},
    {riderIds:riders,distanceKm:40});
  assert.equal(orderAt(orders,19).helperAttackPolicy,'hold_for_captain');
  assert.equal(orderAt(orders,20).helperAttackPolicy,'release_if_dropped');
});

test('a planned attacker can be changed or cleared at a valid marker',()=>{
  const orders=normalizeOrders({captainId:'r0',preset:'aggressive',
    baseline:{attackRiderId:'r2'},phases:[{atKm:20,attackRiderId:'r3'},
      {atKm:30,attackRiderId:null}]},
  {riderIds:riders,distanceKm:40});
  assert.equal(orderAt(orders,19).attackRiderId,'r2');
  assert.equal(orderAt(orders,20).attackRiderId,'r3');
  assert.equal(orderAt(orders,30).attackRiderId,null);
});

function tacticalTeam(id,preset,overrides={}){
  const riderIds=Array.from({length:8},(_,i)=>`${id}-${i}`);
  return {id,riders:riderIds.map(riderId=>({id:riderId,gender:'M',flat:50,strength:60,endurance:60,sprint:50,leadership:50})),
    orders:normalizeOrders({captainId:riderIds[0],roadCaptainId:riderIds[1],preset,...overrides},
      {riderIds,distanceKm:40})};
}

test('a precommitted break finale order reacts only at checkpoints to a sprint disadvantage',()=>{
  const attacker=tacticalTeam('a','balanced',{baseline:{breakFinale:'attack_if_outsprinted'}});
  const rival=tacticalTeam('b','balanced');
  attacker.riders[0].sprint=25;
  rival.riders[0].sprint=80;
  const group={id:'road-1',riderIds:['a-0','b-0'],teamIds:['a','b'],gapSeconds:15};
  const segment=buildKilometreRoute(stage,{seed:'break-finale'}).kilometres[29];
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment,distanceKm:40}),'a-0');
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment,distanceKm:40,teamIdsAhead:['a']}),null);
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment:{...segment,km:29},distanceKm:40}),null);
  attacker.energy={'a-0':25};
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment,distanceKm:40}),null);
  attacker.energy={'a-0':100};
  rival.riders[0].sprint=40;
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment,distanceKm:40}),null);
  attacker.orders.baseline.breakFinale='hold_group';
  rival.riders[0].sprint=80;
  assert.equal(automaticBreakAttackRider({team:attacker,group,teams:[attacker,rival],
    segment,distanceKm:40}),null);
  attacker.orders.baseline.breakFinale='attack_if_outsprinted';
  attacker.orders.baseline.helperAttackPolicy='release_if_dropped';
  attacker.riders[2].sprint=20;
  const helperGroup={...group,riderIds:['a-2','b-0']};
  assert.equal(automaticBreakAttackRider({team:attacker,group:helperGroup,
    teams:[attacker,rival],segment,distanceKm:40}),null);
  assert.equal(automaticBreakAttackRider({team:attacker,group:helperGroup,
    teams:[attacker,rival],segment,distanceKm:40,leaderDropped:true}),'a-2');
});

test('helper freedom protects the captain until dropped without overriding a named attack',()=>{
  const team=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'}});
  const rival=tacticalTeam('b','protect',{baseline:{chase:'ignore'}});
  Object.assign(team.riders[2],{flat:95,strength:95,acceleration:95});
  const context={teams:[team,rival],km:20};
  assert.equal(resolveTacticalKilometre(context).attackers.find(a=>a.teamId==='a').riderId,'a-2');
  team.orders.baseline.helperAttackPolicy='hold_for_captain';
  assert.notEqual(resolveTacticalKilometre(context).attackers.find(a=>a.teamId==='a').riderId,'a-2');
  team.orders.baseline.helperAttackPolicy='release_if_dropped';
  assert.notEqual(resolveTacticalKilometre(context).attackers.find(a=>a.teamId==='a').riderId,'a-2');
  const released=resolveTacticalKilometre({...context,droppedRiderIds:['a-0']});
  assert.equal(released.attackers.find(a=>a.teamId==='a').riderId,'a-2');
  assert.deepEqual(released.releasedHelperAttackRiderIds,['a-2']);
  team.orders.baseline.helperAttackPolicy='hold_for_captain';
  team.orders.baseline.attackRiderId='a-2';
  assert.equal(resolveTacticalKilometre(context).attackers.find(a=>a.teamId==='a').riderId,'a-2');
  assert.deepEqual(resolveTacticalKilometre(context).releasedHelperAttackRiderIds,[]);
});

test('a dropped captain can release a helper into a recorded attack',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const make=(id,policy)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:id==='a'&&index===0?5:id==='a'&&index===2?95:60,
      strength:id==='a'&&index===0?5:id==='a'&&index===2?95:60,
      endurance:60,acceleration:id==='a'&&index===2?95:60,
      sprint:50,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
      preset:id==='a'?'balanced':'protect',baseline:{attack:id==='a'?'selective':'none',
        chase:'ignore',helperAttackPolicy:policy}}});
  const release=simulateTacticalTour({stage:flat,seed:'helper-release',
    teams:[make('a','release_if_dropped'),make('b','open')]});
  const hold=simulateTacticalTour({stage:flat,seed:'helper-release',
    teams:[make('a','hold_for_captain'),make('b','open')]});
  assert.equal(release.frames[2].riderGroups.find(rider=>rider.id==='a-0').group,'dropped');
  assert.deepEqual(release.frames[19].releasedHelperAttackRiderIds,['a-2']);
  assert.deepEqual(hold.frames[19].releasedHelperAttackRiderIds,[]);
  assert.notEqual(hold.frames[19].attackers[0],release.frames[19].attackers[0]);
  assert.equal(validateRecordedTour(release),true);
  const tampered=structuredClone(release);
  tampered.frames[19].releasedHelperAttackRiderIds=['b-2'];
  assert.throws(()=>validateRecordedTour(tampered),/helper release/);
});

test('a single team cannot neutralise several coordinated attacks at no cost',()=>{
  const lone=[tacticalTeam('defender','protect',{baseline:{chase:'all'}}),tacticalTeam('a','aggressive'),tacticalTeam('b','aggressive'),tacticalTeam('c','aggressive')];
  const contested=resolveTacticalKilometre({teams:lone,km:20});
  assert.equal(contested.attackers.length,3);
  assert.equal(contested.chasers.length,1);
  assert.ok(contested.gapSeconds>0);
  assert.equal(contested.energyCosts.filter(cost=>cost.reason==='chase').length,2);
  assert.deepEqual(contested,resolveTacticalKilometre({teams:[...lone].reverse(),km:20}));
  const supported=resolveTacticalKilometre({teams:[...lone,tacticalTeam('ally-1','protect',{baseline:{chase:'all'}}),tacticalTeam('ally-2','protect',{baseline:{chase:'all'}})],km:20});
  assert.ok(supported.gapSeconds<contested.gapSeconds);
});

test('repeated attacks and constant chasing consume energy; road captain improves threat recognition',()=>{
  const leader=tacticalTeam('leader','balanced',{baseline:{attack:'none',chase:'selective'}});
  const weak=tacticalTeam('weak','balanced',{baseline:{attack:'none',chase:'selective'}});
  leader.riders[1].leadership=90;weak.riders[1].leadership=0;
  const attacker=tacticalTeam('attacker','aggressive');
  attacker.riders.forEach(r=>{r.strength=20;r.flat=20;r.hills=20;r.endurance=20;r.sprint=20;});
  const smart=resolveTacticalKilometre({teams:[leader,attacker],km:5});
  const late=resolveTacticalKilometre({teams:[weak,attacker],km:5});
  assert.ok(smart.chasePower>late.chasePower);
  assert.ok(smart.energyCosts.some(cost=>cost.reason==='attack'));
  assert.ok(smart.energyCosts.some(cost=>cost.reason==='chase'));
  const depleted={...attacker,energy:Object.fromEntries(attacker.riders.map(r=>[r.id,0]))};
  assert.equal(resolveTacticalKilometre({teams:[leader,depleted],km:10}).attackers.length,0);
});

test('repeatability preserves attack pressure after several earlier efforts',()=>{
  const team=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-2',chase:'ignore'}});
  const defender=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'ignore'}});
  const context={teams:[team,defender],km:20};
  team.riders[2].repeatability=100;
  const fresh=resolveTacticalKilometre(context);
  team.attackLoad={'a-2':4};
  const durable=resolveTacticalKilometre(context);
  team.riders[2].repeatability=0;
  const tired=resolveTacticalKilometre(context);
  assert.ok(fresh.attackPower>durable.attackPower);
  assert.ok(durable.attackPower>tired.attackPower);
  assert.equal(tired.attackers[0].repeatLoad,4);
  assert.throws(()=>resolveTacticalKilometre({...context,
    teams:[{...team,attackLoad:{'a-2':-1}},defender]}),/attack load/);
});

test('exhausted or dropped riders cannot provide free chase work or launch attacks',()=>{
  const attacker=tacticalTeam('a','aggressive');
  const defender=tacticalTeam('d','protect',{baseline:{chase:'all'}});
  const rested=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  defender.energy=Object.fromEntries(defender.riders.map(rider=>[rider.id,0]));
  const exhausted=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  assert.equal(exhausted.chasers.length,0);
  assert.ok(exhausted.gapSeconds>rested.gapSeconds);
  defender.energy=Object.fromEntries(defender.riders.map(rider=>[rider.id,80]));
  const dropped=resolveTacticalKilometre({teams:[attacker,defender],km:20,
    droppedRiderIds:defender.orders.helperIds});
  assert.equal(dropped.chasers.length,0);
  attacker.riders[0].acceleration=100;
  attacker.energy=Object.fromEntries(attacker.riders.map(rider=>[rider.id,rider.id==='a-0'?0:80]));
  const alternate=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  assert.equal(alternate.attackers.length,1);
  assert.notEqual(alternate.attackers[0].riderId,'a-0');
  assert.equal(resolveTacticalKilometre({teams:[attacker,defender],km:20,
    droppedRiderIds:attacker.riders.map(rider=>rider.id)}).attackers.length,0);
});

test('a selected attacker is used exactly as planned or the trace explains why not',()=>{
  const attacker=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-3'}});
  const defender=tacticalTeam('d','protect',{baseline:{chase:'ignore'}});
  attacker.riders[0].acceleration=100;
  attacker.riders[3].acceleration=10;
  attacker.riders[3].strength=10;
  const automatic={...attacker,orders:{...attacker.orders,baseline:{...attacker.orders.baseline,
    attackRiderId:null}}};
  const automaticAttack=resolveTacticalKilometre({teams:[automatic,defender],km:20});
  const selected=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  assert.deepEqual(selected.attackers.map(attack=>attack.riderId),['a-3']);
  assert.ok(selected.attackPower<automaticAttack.attackPower);
  assert.ok(selected.gapSeconds<automaticAttack.gapSeconds);
  attacker.energy=Object.fromEntries(attacker.riders.map(rider=>[rider.id,rider.id==='a-3'?0:90]));
  const exhausted=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  assert.equal(exhausted.attackers.length,0);
  assert.deepEqual(exhausted.blockedAttacks,[{teamId:'a',riderId:'a-3',reason:'exhausted'}]);
  attacker.energy['a-3']=90;
  const dropped=resolveTacticalKilometre({teams:[attacker,defender],km:20,
    droppedRiderIds:['a-3']});
  assert.deepEqual(dropped.blockedAttacks,[{teamId:'a',riderId:'a-3',reason:'dropped'}]);
});

test('a committed marker switches the named attacker without live intervention',()=>{
  const attacker=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-2'},
    phases:[{atKm:20,attackRiderId:'a-3'}]});
  const defender=tacticalTeam('d','protect',{baseline:{chase:'ignore'}});
  const recording=simulateTacticalTour({stage,teams:[attacker,defender],seed:'named-switch'});
  assert.deepEqual(recording.frames[4].attackers,['a-2']);
  assert.ok(recording.frames[9].blockedAttacks.some(item=>item.riderId==='a-2'&&
    item.reason==='already_ahead'));
  assert.deepEqual(recording.frames[24].attackers,['a-3']);
});

test('effort changes immediate attack and chase pressure while charging more energy',()=>{
  const attacker=tacticalTeam('attacker','aggressive');
  const defender=tacticalTeam('defender','protect',{baseline:{chase:'all'}});
  const conservative={...attacker,orders:{...attacker.orders,baseline:{...attacker.orders.baseline,effort:'conserve'}}};
  const hard=resolveTacticalKilometre({teams:[attacker,defender],km:20});
  const gentle=resolveTacticalKilometre({teams:[conservative,defender],km:20});
  assert.ok(hard.attackPower>gentle.attackPower);
  const hardDefender={...defender,orders:{...defender.orders,baseline:{...defender.orders.baseline,effort:'hard'}}};
  const hardChase=resolveTacticalKilometre({teams:[attacker,hardDefender],km:20});
  assert.ok(hardChase.chasePower>hard.chasePower);
  const hardTour=simulateTacticalTour({stage,teams:[attacker,defender],seed:'effort-cost'});
  const gentleTour=simulateTacticalTour({stage,teams:[conservative,defender],seed:'effort-cost'});
  assert.ok(hardTour.frames.at(-1).teamEnergy.find(t=>t.teamId==='attacker').mean<
    gentleTour.frames.at(-1).teamEnergy.find(t=>t.teamId==='attacker').mean);
});

test('a team keeps chasing a recognised break as its gap narrows',()=>{
  const attacker=tacticalTeam('a','aggressive');
  const defender=tacticalTeam('d','protect');
  const withoutMemory=resolveTacticalKilometre({teams:[attacker,defender],km:21,gapSeconds:10,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0']});
  const ongoing=resolveTacticalKilometre({teams:[attacker,defender],km:21,gapSeconds:10,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0'],engagedChaseTeamIds:['d']});
  assert.equal(withoutMemory.chasers.length,0);
  assert.equal(ongoing.chasers.length,1);
  assert.ok(ongoing.gapSeconds<withoutMemory.gapSeconds);
  assert.deepEqual(ongoing.engagedChaseTeamIds,['d']);
});

test('a precommitted road-captain break response starts sooner with leadership and stops after a catch',()=>{
  const flatStage={distance_km:40,profile_points:[[0,100],[40,100]]};
  const attackers=[tacticalTeam('a','aggressive'),tacticalTeam('b','aggressive')];
  const defender=leadership=>{
    const team=tacticalTeam('d','protect',{breakResponse:'chase_if_threatened',
      baseline:{chase:'ignore',attack:'none'}});
    team.riders.forEach(rider=>{rider.flat=60;});
    team.riders[1].leadership=leadership;
    return team;
  };
  attackers.forEach(team=>team.riders.forEach(rider=>{rider.flat=60;}));
  const race=leadership=>simulateTacticalTour({stage:flatStage,
    teams:[...attackers,defender(leadership)],seed:'response'});
  const high=race(90),low=race(10);
  const firstDecision=(result,kind)=>result.frames.find(frame=>
    frame.decisions.some(decision=>decision.teamId==='d'&&decision.kind===kind));
  const early=firstDecision(high,'chase_break');
  const late=firstDecision(low,'chase_break');
  assert.ok(early&&late&&early.km<late.km);
  assert.ok(early.chasers.includes('d'));
  assert.deepEqual(early.activeBreakResponseTeamIds,['d']);
  assert.ok(high.frames.slice(0,4).every(frame=>!frame.chasers.includes('d')));
  const resumed=firstDecision(high,'resume_plan');
  assert.ok(resumed&&resumed.km>early.km&&resumed.gapSeconds===0);
  assert.deepEqual(resumed.activeBreakResponseTeamIds,[]);
  assert.ok(high.frames[early.km-1].teamEnergy.find(team=>team.teamId==='d').mean<
    low.frames[early.km-1].teamEnergy.find(team=>team.teamId==='d').mean);
  const holding=defender(90);
  holding.orders.breakResponse='hold_plan';
  const noResponse=simulateTacticalTour({stage:flatStage,teams:[...attackers,holding],seed:'response'});
  assert.ok(noResponse.frames.every(frame=>!frame.decisions.some(decision=>
    decision.teamId==='d'&&decision.kind==='chase_break')));
  assert.ok(noResponse.frames.every(frame=>!frame.chasers.includes('d')));
});

test('a chased-down new attack cannot join a break that is still ahead',()=>{
  const ahead=tacticalTeam('a','balanced',{baseline:{attack:'none'}});
  const attacker=tacticalTeam('b','aggressive');
  const defender=tacticalTeam('d','protect',{baseline:{chase:'all',effort:'hard'}});
  attacker.riders.forEach(rider=>{
    rider.acceleration=10;rider.strength=10;rider.flat=10;
  });
  defender.riders.forEach(rider=>{
    rider.strength=95;rider.endurance=95;rider.flat=95;
  });
  const contest=resolveTacticalKilometre({teams:[ahead,attacker,defender],km:20,
    gapSeconds:80,breakawayTeamIds:['a'],breakawayRiderIds:['a-0']});
  assert.equal(contest.attackers.length,1);
  assert.ok(contest.attackPower<contest.chasePower);
  assert.ok(contest.gapSeconds>0);
  assert.deepEqual(contest.joinedBreakawayRiderIds,[]);
  assert.ok(contest.energyCosts.some(cost=>cost.reason==='attack'));
});

test('a rider cannot teleport into a distant break or power it from the bunch',()=>{
  const ahead=tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const attacker=tacticalTeam('b','aggressive',{baseline:{chase:'ignore'}});
  const context={teams:[ahead,attacker],km:20,gapSeconds:80,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0']};
  const bridge=resolveTacticalKilometre(context);
  const noAttack=resolveTacticalKilometre({...context,teams:[ahead,{...attacker,orders:{...attacker.orders,
    baseline:{...attacker.orders.baseline,attack:'none'}}}]});
  assert.ok(bridge.attackPower>0);
  assert.deepEqual(bridge.failedBridgeRiderIds,bridge.attackers.map(rider=>rider.riderId));
  assert.deepEqual(bridge.joinedBreakawayRiderIds,[]);
  assert.equal(bridge.gapSeconds,noAttack.gapSeconds);
  assert.ok(bridge.energyCosts.some(cost=>cost.reason==='attack'));
  const close=resolveTacticalKilometre({...context,gapSeconds:5});
  assert.deepEqual(close.failedBridgeRiderIds,[]);
  assert.deepEqual(close.joinedBreakawayRiderIds,close.attackers.map(rider=>rider.riderId));
});

test('a fresh attack can pursue a distant break without teleporting into it',()=>{
  const leader=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(leader.riders[0],{flat:95,strength:95,endurance:95,timetrial:95});
  const pursuer=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'}]});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:30,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:flat,teams:[leader,pursuer],seed:'second-break'});
  const formed=race.frames.find(frame=>frame.formedChaseGroupId&&
    frame.roadGroups.at(-1).riderIds.includes('b-0'));
  assert.ok(formed,'the later move should form its own group');
  assert.equal(formed.roadGroups.length,2);
  assert.ok(formed.roadGroups[0].gapSeconds>formed.roadGroups[1].gapSeconds);
  assert.deepEqual(formed.roadGroups[1].riderIds,['b-0']);
  assert.ok(!formed.roadGroups[0].riderIds.includes('b-0'));
  assert.ok(formed.joinedBreakawayRiderIds.includes('b-0'));
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames[formed.km-1].formedChaseGroupId=null;
  assert.throws(()=>validateRecordedTour(tampered),/appeared/);
});

test('successive peloton moves can make three recorded road groups',()=>{
  const leader=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(leader.riders[0],{flat:95,strength:95,endurance:95,timetrial:95});
  const second=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
      {atKm:30,attack:'none',breakAttackRiderId:'b-0'}]});
  Object.assign(second.riders[0],{flat:95,strength:95,endurance:95,timetrial:95});
  const third=tacticalTeam('c','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:30,attack:'selective',attackRiderId:'c-0'}]});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
      {km:30,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:flat,teams:[leader,second,third],
    seed:'third-break'});
  const three=race.frames.find(frame=>frame.roadGroups.length===3);
  assert.ok(three,'three independent road groups should form');
  assert.deepEqual(three.roadGroups.map(group=>group.riderIds),
    [['a-0'],['b-0'],['c-0']]);
  assert.equal(race.frames[30].splitAttack?.status,'solo_break');
  assert.deepEqual(race.frames[30].blockedBreakAttacks,[]);
  assert.equal(race.frames.at(-1).roadGroups.length,3);
  assert.deepEqual(race.provisionalResults.slice(0,3).map(result=>result.roadGroupId),
    race.frames.at(-1).roadGroups.map(group=>group.id));
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames[three.km-1].roadGroups[2].gapSeconds+=1;
  assert.throws(()=>validateRecordedTour(tampered),/road group/);
});

test('successive moves can maintain more than six independent recorded groups',()=>{
  const makeTeam=(id,attackAt)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:index===0?95:50,strength:index===0?95:60,
      endurance:index===0?95:60,timetrial:index===0?95:50,
      sprint:50,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
      baseline:{attack:attackAt===0?'selective':'none',chase:'ignore'},
      phases:attackAt===0?[{atKm:10,attack:'none'}]:
        [{atKm:attackAt,attack:'selective',attackRiderId:`${id}-0`},
          {atKm:attackAt+10,attack:'none'}]}});
  const flat={distance_km:100,profile_points:[[0,100],[100,100]],
    keypoints:[10,20,30,40,50,60,70].map(km=>({km,kind:'SPRINT'}))};
  const race=simulateTacticalTour({stage:flat,
    teams:[makeTeam('a',0),makeTeam('b',20),makeTeam('c',30),
      makeTeam('d',40),makeTeam('e',50),makeTeam('f',60),makeTeam('g',70)],
    seed:'seven-road-groups'});
  const seven=race.frames.find(frame=>frame.roadGroups.length===7);
  assert.ok(seven,'seven separately timed moves should be able to survive together');
  assert.deepEqual(seven.roadGroups.map(group=>group.riderIds),
    [['a-0'],['b-0'],['c-0'],['d-0'],['e-0'],['f-0'],['g-0']]);
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames[seven.km-1].roadGroups[2].riderIds=['a-0'];
  assert.throws(()=>validateRecordedTour(tampered),/road group|continue|riders/);
  const swappedTeams=structuredClone(race);
  swappedTeams.frames[seven.km-1].roadGroups[0].teamIds=['b'];
  swappedTeams.frames[seven.km-1].roadGroups[1].teamIds=['a'];
  assert.throws(()=>validateRecordedTour(swappedTeams),/road-group teams/);
});

test('the road-group transition supports the full two-riders-per-team ceiling',()=>{
  assert.equal(MAX_ROAD_GROUPS,40);
  const groups=Array.from({length:MAX_ROAD_GROUPS},(_,index)=>({
    id:`road-${index+1}`,riderIds:[`rider-${index+1}`],
    teamIds:[`team-${Math.floor(index/2)+1}`],gapSeconds:400-index*5,
  }));
  assert.doesNotThrow(()=>assertRoadGroups(groups));
  const changes=Object.fromEntries(groups.map(group=>[group.id,0]));
  assert.equal(advanceRoadGroups(groups,changes).groups.length,MAX_ROAD_GROUPS);
});

test('a precommitted attack from a pursuing group is simulated and replayable',()=>{
  const leader=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(leader.riders[0],{flat:95,strength:95,endurance:95,timetrial:95});
  const second=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
      {atKm:30,attack:'none',breakAttackRiderId:'b-0'}]});
  const third=tacticalTeam('c','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'c-0'},
      {atKm:30,attack:'none'}]});
  for(const team of [second,third])Object.assign(team.riders[0],
    {flat:95,strength:95,endurance:95,timetrial:95});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
      {km:30,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:flat,teams:[leader,second,third],
    seed:'chase-break-attack'});
  const attack=race.frames[30].splitAttack;
  assert.ok(attack);
  assert.equal(attack.riderId,'b-0');
  assert.notEqual(attack.sourceGroupId,race.frames[29].roadGroups[0].id);
  assert.equal(attack.status,'split');
  assert.equal(validateRecordedTour(race),true);
  const missing=structuredClone(race);
  missing.frames[30].splitAttack=null;
  assert.throws(()=>validateRecordedTour(missing),/split|changed groups|appeared|ahead/);
  const wrongSource=structuredClone(race);
  wrongSource.frames[30].splitAttack.sourceGroupId='road-999';
  assert.throws(()=>validateRecordedTour(wrongSource),/break attack route/);
  const freeJump=structuredClone(race);
  freeJump.frames[30].splitAttack.attackSeconds=0;
  assert.throws(()=>validateRecordedTour(freeJump),/break attack route/);
});

test('a strong pursuing attack can bridge into the group ahead',()=>{
  const leader=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(leader.riders[0],{flat:75,strength:75,endurance:75,
    timetrial:75,acceleration:75});
  const second=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
      {atKm:30,attack:'none',breakAttackRiderId:'b-0'}]});
  const third=tacticalTeam('c','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:20,attack:'selective',attackRiderId:'c-0'},
      {atKm:30,attack:'none'}]});
  Object.assign(second.riders[0],{flat:100,strength:100,endurance:100,
    timetrial:100,acceleration:100});
  Object.assign(third.riders[0],{flat:75,strength:75,endurance:75,
    timetrial:75,acceleration:75});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'},
      {km:30,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:flat,teams:[leader,second,third],
    seed:'chase-bridge-probe'});
  const before=race.frames[29].roadGroups;
  assert.ok(before.length>1);
  assert.equal(before[1].id,race.frames[30].splitAttack?.sourceGroupId);
  assert.equal(race.frames[30].splitAttack?.status,'joined_group_ahead');
  assert.ok(race.frames[30].roadGroups[0].riderIds.includes('b-0'));
  assert.equal(validateRecordedTour(race),true);
});

test('varied three-group races remain replayable in both race categories',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[10,20,30].map(km=>({km,kind:'SPRINT'}))};
  const plans={a:[{atKm:10,attack:'none'}],
    b:[{atKm:20,attack:'selective',attackRiderId:'b-0'},
      {atKm:30,attack:'none'}],
    c:[{atKm:30,attack:'selective',attackRiderId:'c-0'}]};
  for(const gender of ['M','F'])for(let sample=0;sample<10;sample++){
    const teams=['a','b','c'].map((id,index)=>({id,
      riders:Array.from({length:8},(_,riderIndex)=>({id:`${id}-${riderIndex}`,gender,
        flat:riderIndex===0?80+(sample+index*3)%21:50,
        strength:riderIndex===0?80+(sample+index*3)%21:60,
        endurance:riderIndex===0?80+(sample+index*3)%21:60,
        timetrial:riderIndex===0?80+(sample+index*3)%21:50,
        sprint:50,leadership:50})),
      orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
        baseline:{attack:id==='a'?'selective':'none',chase:'ignore'},
        phases:plans[id]}}));
    const race=simulateTacticalTour({stage:flat,teams,seed:`three-groups:${gender}:${sample}`});
    assert.ok(race.frames.some(frame=>frame.roadGroups.length===3));
    assert.equal(validateRecordedTour(race),true);
    assert.equal(race.raceCategory,gender);
  }
});

test('a sufficiently strong move can finish its bridge instead of forming a phantom group',()=>{
  const race=runKilometreLab({scenario:flatScenario('break'),seed:'chase-30'});
  const bridged=race.frames.find(frame=>frame.bridgedBreakRiderIds.length>0);
  assert.ok(bridged);
  assert.equal(bridged.formedChaseGroupId,null);
  assert.equal(bridged.roadGroups.length,1);
  assert.ok(bridged.bridgedBreakRiderIds.every(id=>
    bridged.roadGroups[0].riderIds.includes(id)&&bridged.joinedBreakawayRiderIds.includes(id)));
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames[bridged.km-1].bridgedBreakRiderIds=['foreign'];
  assert.throws(()=>validateRecordedTour(tampered),/admission/);
});

test('break and bunch abilities change a gap even without new attacks or chase orders',()=>{
  const breakTeam=tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const bunchTeam=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const context={teams:[breakTeam,bunchTeam],km:21,gapSeconds:30,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0']};
  breakTeam.riders[0].timetrial=10;
  breakTeam.riders[0].flat=20;
  const weak=resolveTacticalKilometre(context);
  assert.equal(weak.attackers.length,0);
  assert.equal(weak.chasers.length,0);
  assert.ok(weak.passiveGapDelta<0&&weak.gapSeconds<30);
  breakTeam.riders[0].timetrial=75;
  breakTeam.riders[0].flat=75;
  breakTeam.riders[0].endurance=75;
  const strong=resolveTacticalKilometre(context);
  assert.ok(strong.passiveGapDelta>weak.passiveGapDelta);
  assert.ok(strong.gapSeconds>weak.gapSeconds);
  breakTeam.energy={'a-0':5};
  const tired=resolveTacticalKilometre(context);
  assert.ok(tired.passiveGapDelta<strong.passiveGapDelta);
  assert.equal(resolveTacticalKilometre({...context,gapSeconds:0,
    breakawayTeamIds:[],breakawayRiderIds:[]}).passiveGapDelta,0);
});

test('front-group work cannot lend passive speed to a separate chase group',()=>{
  const front=tacticalTeam('front','balanced',{baseline:{attack:'none',chase:'ignore',
    breakWork:'cooperate'}});
  const rear=tacticalTeam('rear','balanced',{baseline:{attack:'none',chase:'ignore',
    breakWork:'sit_on'}});
  const bunch=tacticalTeam('bunch','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const context={teams:[front,rear,bunch],km:21,gapSeconds:20,
    breakawayTeamIds:['front','rear'],breakawayRiderIds:['front-0','rear-0'],
    rearRoadGroupRiderIds:['rear-0']};
  const strong=resolveTacticalKilometre(context);
  Object.assign(front.riders[0],{flat:5,timetrial:5,endurance:5,strength:5});
  const weak=resolveTacticalKilometre(context);
  assert.equal(strong.passiveGapDelta,weak.passiveGapDelta);
  assert.deepEqual(strong.pullRiderIds,['front-0']);
  assert.deepEqual(weak.pullRiderIds,['front-0']);
  assert.throws(()=>resolveTacticalKilometre({...context,
    rearRoadGroupRiderIds:['foreign']}),/rear road-group/);
  assert.throws(()=>resolveTacticalKilometre({...context,
    rearRoadGroupRiderIds:[]}),/rear road-group/);
});

test('two willing riders pursue a solo break faster than one, without counting a sitter',()=>{
  const front=tacticalTeam('a','balanced');
  const pursuer=tacticalTeam('b','balanced');
  const sitter=tacticalTeam('c','balanced',{baseline:{breakWork:'sit_on'}});
  for(const team of [front,pursuer,sitter])
    team.energy=Object.fromEntries(team.riders.map(rider=>[rider.id,100]));
  const groups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:20},
    {id:'road-2',riderIds:['b-0','b-1','c-0'],teamIds:['b','c'],gapSeconds:10},
  ];
  const segment=buildKilometreRoute(stage,{seed:'group-work'}).kilometres[20];
  const context=[groups[0],groups[1],[front,pursuer,sitter],segment];
  const one=relativeRoadGroupPace(...context,['a-0','b-0']);
  const two=relativeRoadGroupPace(...context,['a-0','b-0','b-1']);
  const withSitter=relativeRoadGroupPace(...context);
  assert.ok(two<one,'a second working teammate should close the gap faster');
  assert.equal(withSitter,two,'the default worker selection excludes a sit-on rider');
  assert.ok(two<0,'cooperative pursuit should close on an equally skilled solo rider');
});

test('rotating pulls shares exposure within a group without rewarding a sitter',()=>{
  const together=[{id:'road-1',riderIds:['a-0','b-0','c-0'],
    teamIds:['a','b','c'],gapSeconds:10}];
  const solo=roadGroupExposureCosts(together,['a-0']);
  const rotating=roadGroupExposureCosts(together,['a-0','b-0']);
  assert.ok(rotating.get('a-0')<solo.get('a-0'));
  assert.ok(rotating.get('a-0')>rotating.get('c-0'));
  assert.equal(rotating.get('a-0'),rotating.get('b-0'));
  assert.equal(rotating.get('c-0'),solo.get('c-0'));
  const separate=roadGroupExposureCosts([
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:20},
    {id:'road-2',riderIds:['b-0','c-0'],teamIds:['b','c'],gapSeconds:10},
  ],['a-0','b-0']);
  assert.equal(separate.get('a-0'),solo.get('a-0'));
  assert.equal(separate.get('b-0'),solo.get('a-0'));
  const large=[{id:'road-1',riderIds:Array.from({length:20},(_,index)=>`r-${index}`),
    teamIds:['large'],gapSeconds:10}];
  const largeCosts=roadGroupExposureCosts(large,large[0].riderIds);
  assert.ok(largeCosts.get('r-0')>rotating.get('c-0'));
  assert.throws(()=>roadGroupExposureCosts(together,['foreign']),/puller/);
});

test('taking pulls grows the break gap but costs energy compared with sitting on',()=>{
  const worker=tacticalTeam('a','aggressive',{baseline:{chase:'ignore',breakWork:'cooperate'},
    phases:[{atKm:20,attack:'none'}]});
  const sitter=tacticalTeam('a','aggressive',{baseline:{chase:'ignore',breakWork:'sit_on'},
    phases:[{atKm:20,attack:'none'}]});
  const bunch=tacticalTeam('b','protect',{baseline:{chase:'ignore'}});
  const context={teams:[worker,bunch],km:12,gapSeconds:20,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0','a-1']};
  const pulling=resolveTacticalKilometre(context);
  const sitting=resolveTacticalKilometre({...context,teams:[sitter,bunch]});
  assert.deepEqual(pulling.pullRiderIds,['a-0','a-1']);
  assert.deepEqual(sitting.pullRiderIds,[]);
  assert.ok(pulling.gapSeconds>sitting.gapSeconds);
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const active=simulateTacticalTour({stage:flat,teams:[worker,bunch],seed:'break-work'});
  const passive=simulateTacticalTour({stage:flat,teams:[sitter,bunch],seed:'break-work'});
  const workingFrame=active.frames.find(frame=>frame.pullRiderIds.includes('a-0'));
  assert.ok(workingFrame);
  const restingFrame=passive.frames[workingFrame.km-1];
  assert.ok(workingFrame.riderGroups.find(rider=>rider.id==='a-0').energy<
    restingFrame.riderGroups.find(rider=>rider.id==='a-0').energy);
});

test('a mixed break credits only willing riders with work, without gifting the sitter speed',()=>{
  const worker=tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore',breakWork:'cooperate'}});
  const sitter=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore',breakWork:'sit_on'}});
  const bunch=tacticalTeam('c','protect',{baseline:{chase:'ignore'}});
  const context={teams:[worker,sitter,bunch],km:12,gapSeconds:20,
    breakawayTeamIds:['a','b'],breakawayRiderIds:['a-0','b-0']};
  const mixed=resolveTacticalKilometre(context);
  assert.deepEqual(mixed.pullRiderIds,['a-0']);
  const bothWorking=resolveTacticalKilometre({...context,
    teams:[worker,tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore',breakWork:'cooperate'}}),bunch]});
  const neitherWorking=resolveTacticalKilometre({...context,
    teams:[tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore',breakWork:'sit_on'}}),sitter,bunch]});
  assert.ok(bothWorking.gapSeconds>mixed.gapSeconds);
  assert.ok(mixed.gapSeconds>neitherWorking.gapSeconds);
});

test('a team with a rider up the road withholds its helpers from the chase',()=>{
  const represented=tacticalTeam('a','protect',{baseline:{attack:'none',chase:'all'}});
  const opponent=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'all'}});
  const contest=resolveTacticalKilometre({teams:[represented,opponent],km:12,gapSeconds:20,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-0']});
  assert.deepEqual(contest.chasers.map(chaser=>chaser.teamId),['b']);
  assert.ok(contest.energyCosts.filter(cost=>cost.reason==='chase').every(cost=>cost.teamId==='b'));
});

test('a committed fallback chases only when its own fading rider is near the bunch',()=>{
  const team=tacticalTeam('a','protect',{baseline:{attack:'none',chase:'selective'},
    forwardResponse:'chase_if_fading'});
  const rival=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'ignore'}});
  team.energy=Object.fromEntries(team.riders.map(rider=>[rider.id,rider.id==='a-2'?20:90]));
  const context={teams:[team,rival],km:20,distanceKm:40,gapSeconds:8,
    breakawayTeamIds:['a'],breakawayRiderIds:['a-2'],rearRoadGroupRiderIds:['a-2']};
  const released=resolveTacticalKilometre(context);
  assert.deepEqual(released.releasedForwardTeamIds,['a']);
  assert.deepEqual(released.chasers.map(chaser=>chaser.teamId),['a']);
  assert.ok(released.energyCosts.some(cost=>cost.teamId==='a'&&cost.reason==='chase'));
  const held=structuredClone(team);
  held.orders.forwardResponse='protect_forward';
  assert.deepEqual(resolveTacticalKilometre({...context,teams:[held,rival]}).chasers,[]);
  team.energy['a-2']=31;
  assert.deepEqual(resolveTacticalKilometre(context).releasedForwardTeamIds,[]);
  team.energy['a-2']=20;
  assert.deepEqual(resolveTacticalKilometre({...context,gapSeconds:11}).releasedForwardTeamIds,[]);
  assert.deepEqual(resolveTacticalKilometre({...context,breakawayTeamIds:['a','b'],
    breakawayRiderIds:['a-2','b-0'],rearRoadGroupRiderIds:['b-0']})
    .releasedForwardTeamIds,[]);
});

test('fading-rider fallback changes a full recorded race without rewriting the default plan',()=>{
  const makeTeam=(id,stat)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:stat,strength:stat,endurance:stat,sprint:50,acceleration:stat,
      timetrial:stat,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
      baseline:{attack:'none',chase:'all'}}});
  const own=makeTeam('a',50),opponent=makeTeam('b',35);
  Object.assign(own.riders[2],{flat:60,strength:60,endurance:60,timetrial:60,
    acceleration:60,fatigue:100});
  own.orders={captainId:'a-0',roadCaptainId:'a-1',preset:'balanced',
    forwardResponse:'chase_if_fading',
    baseline:{attack:'selective',attackRiderId:'a-2',chase:'all'},
    phases:[{atKm:20,attack:'none'}]};
  const flat={distance_km:160,profile_points:[[0,100],[160,100]]};
  const seed='fallback-60-35-0';
  const released=simulateTacticalTour({stage:flat,teams:[own,opponent],seed});
  const event=released.frames.find(frame=>frame.releasedForwardTeamIds.includes('a'));
  assert.ok(event&&event.km>20);
  assert.ok(event.chasers.includes('a'));
  assert.ok(released.frames[event.km-2].roadGroups.at(-1).riderIds.includes('a-2'));
  assert.equal(validateRecordedTour(released),true);
  const held=structuredClone(own);
  held.orders.forwardResponse='protect_forward';
  const defaultRace=simulateTacticalTour({stage:flat,teams:[held,opponent],seed});
  assert.ok(defaultRace.frames.every(frame=>!frame.releasedForwardTeamIds.includes('a')));
  assert.equal(validateRecordedTour(defaultRace),true);
  const tampered=structuredClone(released);
  tampered.frames[event.km-1].releasedForwardTeamIds=['b'];
  assert.throws(()=>validateRecordedTour(tampered),/forward-rider response/);
  const badOrder=structuredClone(released);
  badOrder.committedInputs.teams.find(team=>team.id==='a').orders.forwardResponse='improvise';
  assert.throws(()=>validateRecordedTour(badOrder),/committed team input/);
});

test('selective pursuit waits with a manageable gap but starts as the finish approaches',()=>{
  const ahead=tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const defender=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'selective'}});
  const context={teams:[ahead,defender],gapSeconds:7,breakawayTeamIds:['a'],
    breakawayRiderIds:['a-0'],engagedChaseTeamIds:['b'],distanceKm:160};
  const early=resolveTacticalKilometre({...context,km:20});
  const mid=resolveTacticalKilometre({...context,km:45,gapSeconds:3});
  const guard=resolveTacticalKilometre({...context,km:60,gapSeconds:3});
  const late=resolveTacticalKilometre({...context,km:120});
  assert.deepEqual(early.heldChaseTeamIds,['b']);
  assert.deepEqual(early.chasers,[]);
  assert.deepEqual(mid.heldChaseTeamIds,['b']);
  assert.deepEqual(mid.chasers,[]);
  assert.deepEqual(guard.heldChaseTeamIds,['b']);
  assert.deepEqual(guard.chasers,[]);
  const watching=[...guard.engagedChaseTeamIds,...guard.heldChaseTeamIds];
  const nextKm=resolveTacticalKilometre({...context,km:61,gapSeconds:3,
    engagedChaseTeamIds:watching});
  assert.deepEqual(nextKm.heldChaseTeamIds,['b']);
  const watchUntilUrgent=resolveTacticalKilometre({...context,km:120,gapSeconds:3,
    engagedChaseTeamIds:[...nextKm.heldChaseTeamIds]});
  assert.deepEqual(watchUntilUrgent.chasers.map(chaser=>chaser.teamId),['b']);
  assert.ok(early.energyCosts.every(cost=>cost.reason!=='chase'));
  assert.deepEqual(late.heldChaseTeamIds,[]);
  assert.deepEqual(late.chasers.map(chaser=>chaser.teamId),['b']);
  assert.ok(late.gapSeconds<early.gapSeconds);
  const stillSafe=resolveTacticalKilometre({...context,km:120,gapSeconds:1});
  const nowUrgent=resolveTacticalKilometre({...context,km:150,gapSeconds:1});
  assert.deepEqual(stillSafe.heldChaseTeamIds,['b']);
  assert.deepEqual(nowUrgent.chasers.map(chaser=>chaser.teamId),['b']);
  const frontEscaping=resolveTacticalKilometre({...context,km:120,gapSeconds:1,
    leadingGapSeconds:8});
  assert.deepEqual(frontEscaping.heldChaseTeamIds,[]);
  assert.deepEqual(frontEscaping.chasers.map(chaser=>chaser.teamId),['b']);
  assert.throws(()=>resolveTacticalKilometre({...context,km:120,gapSeconds:8,
    leadingGapSeconds:1}),/Invalid tactical kilometre/);
  const all=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'all'}});
  assert.deepEqual(resolveTacticalKilometre({...context,teams:[ahead,all],km:20}).heldChaseTeamIds,[]);
  const fresh=tacticalTeam('c','aggressive');
  const reacting=resolveTacticalKilometre({...context,teams:[ahead,defender,fresh],km:20});
  assert.ok(reacting.attackers.length>0);
  assert.ok(!reacting.heldChaseTeamIds.includes('b'));
});

test('a waiting chase team stays alert and later works in a recorded race',()=>{
  const flat={distance_km:160,profile_points:[[0,100],[160,100]],
    keypoints:[{km:20,kind:'SPRINT'},{km:21,kind:'SPRINT'}]};
  const teams=['a','b'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',strength:id==='a'&&index===0?30:70,
    flat:id==='a'&&index===0?90:70,endurance:70,timetrial:75,sprint:70,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
    baseline:{attack:'none',chase:id==='a'?'ignore':'selective'},
    phases:id==='a'?[{atKm:20,attack:'selective',attackRiderId:'a-0'},
      {atKm:21,attack:'none'}]:[]}}));
  const race=simulateTacticalTour({stage:flat,teams,seed:'watch:30:0'});
  const waiting=race.frames.findIndex(frame=>frame.heldChaseTeamIds.includes('b'));
  assert.ok(waiting>0);
  assert.ok(race.frames.slice(waiting,waiting+3).every(frame=>
    frame.heldChaseTeamIds.includes('b')&&!frame.chasers.includes('b')));
  const later=race.frames.slice(waiting+3).find(frame=>
    frame.chasers.includes('b')&&frame.attackers.length===0);
  assert.ok(later,'the waiting team should eventually begin the chase');
  assert.equal(validateRecordedTour(race),true);
  const falsifiedPlan=structuredClone(race);
  falsifiedPlan.committedInputs.teams.find(team=>team.id==='b').orders.baseline.chase='ignore';
  assert.throws(()=>validateRecordedTour(falsifiedPlan),/held chase/);
});

test('a solo rider needs sustained ability to keep an early break to the finish',()=>{
  const attacker=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-2'},
    phases:[{atKm:10,attack:'none'}]});
  const bunch=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const race=timetrial=>{
    const team=structuredClone(attacker);
    team.riders.find(rider=>rider.id==='a-2').timetrial=timetrial;
    return simulateTacticalTour({stage,teams:[team,bunch],seed:'solo-survival'});
  };
  const weak=race(0),strong=race(100);
  assert.deepEqual(weak.frames[4].joinedBreakawayRiderIds,['a-2']);
  assert.deepEqual(strong.frames[4].joinedBreakawayRiderIds,['a-2']);
  assert.ok(weak.frames.at(-1).gapSeconds<strong.frames.at(-1).gapSeconds);
  assert.ok(weak.frames.some(frame=>frame.caughtBreakawayRiderIds.includes('a-2')));
  assert.ok(strong.frames.at(-1).breakawayRiderIds.includes('a-2'));
});

test('a protected sprinter gets a costly chase surge near the finish',()=>{
  const attacker=tacticalTeam('a','aggressive');
  const defender=tacticalTeam('d','protect',{baseline:{chase:'all'}});
  const context={teams:[attacker,defender],gapSeconds:5,breakawayTeamIds:['a'],
    breakawayRiderIds:['a-0'],distanceKm:160};
  const early=resolveTacticalKilometre({...context,km:100});
  const late=resolveTacticalKilometre({...context,km:160});
  assert.ok(late.chasePower>early.chasePower);
  assert.ok(late.energyCosts.find(c=>c.reason==='chase').cost>
    early.energyCosts.find(c=>c.reason==='chase').cost);
});

test('road surface and weather change the balance of specialised attackers and chasers',()=>{
  const attacker=tacticalTeam('a','aggressive');
  const defender=tacticalTeam('d','protect',{baseline:{chase:'all'}});
  attacker.riders.forEach(rider=>{rider.cobbles=95;rider.handling=95;rider.wind=95;});
  defender.riders.forEach(rider=>{rider.cobbles=10;rider.handling=10;rider.wind=10;});
  const road={terrain:'flat',surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const difficult={...road,surface:'cobbles',exposed:true,
    weather:{temperatureC:16,windKph:35,rainMm:4}};
  const context={teams:[attacker,defender],km:20};
  const calm=resolveTacticalKilometre({...context,segment:road});
  const storm=resolveTacticalKilometre({...context,segment:difficult});
  const hot=resolveTacticalKilometre({...context,segment:{...road,
    weather:{...road.weather,temperatureC:39}}});
  assert.ok(storm.attackPower>calm.attackPower);
  assert.ok(storm.chasePower<calm.chasePower);
  assert.ok(storm.gapSeconds>calm.gapSeconds);
  assert.ok(hot.attackPower<calm.attackPower);
});

test('the full tactical trace is deterministic, bounded and makes aggressive orders costly',()=>{
  const input={stage,seed:'tour-1',weather:{temp_c:14,wind_kph:25,precipitation_mm:2},
    teams:[tacticalTeam('attacker','aggressive'),tacticalTeam('defender','protect',{baseline:{chase:'all'}}),tacticalTeam('other','balanced')]};
  const a=simulateTacticalTour(input);
  assert.deepEqual(a,simulateTacticalTour(input));
  assert.equal(a.frames.length,40);
  assert.equal(a.tuningVersion,'v2-prototype-66');
  assert.equal(a.frames.at(-1).km,40);
  assert.ok(a.frames.some(frame=>frame.attackers.length>0));
  assert.ok(a.frames.some(frame=>frame.chasers.length>0));
  assert.ok(a.frames.every(frame=>new Set(frame.breakawayRiderIds).size===frame.breakawayRiderIds.length));
  assert.ok(a.frames.every(frame=>frame.breakawayTeamIds.length===new Set(frame.breakawayTeamIds).size));
  assert.ok(a.frames.every(frame=>frame.breakawayTeamIds.every(id=>frame.breakawayRiderIds.some(riderId=>riderId.startsWith(`${id}-`)))));
  assert.ok(a.frames.every(frame=>frame.gapSeconds>=0&&frame.teamEnergy.every(team=>team.mean>=0&&team.mean<=100)));
  assert.ok(a.frames.every(frame=>frame.teamPace.every(team=>Number.isFinite(team.meanAbility))));
  assert.ok(a.frames.at(-1).teamEnergy[0].mean<a.frames.at(-1).teamEnergy[2].mean);
  assert.equal(a.provisionalResults.length,24);
  assert.deepEqual(a.provisionalResults.map(r=>r.position),Array.from({length:24},(_,i)=>i+1));
  assert.ok(a.provisionalResults.every(r=>Number.isFinite(r.timeSeconds)&&r.gapSeconds>=0&&r.energy>=0));
  assert.ok(a.provisionalResults.every(r=>r.group===a.frames.at(-1).riderGroups.find(s=>s.id===r.riderId).group));
  assert.deepEqual(input.teams[0].riders[0].id,'attacker-0');
  assert.equal(input.teams[0].energy,undefined);
});

test('the tactical trace rejects mixed race categories and duplicate riders',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced')];
  teams[0].riders[0].gender='M';teams[1].riders[0].gender='F';
  assert.throws(()=>simulateTacticalTour({stage,teams,seed:'mixed'}));
  teams[1].riders[0].gender='M';teams[1].riders[0].id=teams[0].riders[0].id;
  assert.throws(()=>simulateTacticalTour({stage,teams,seed:'duplicate'}));
  teams[1].riders[0].id='b-0';teams[1].riders[0].fatigue=Number.NaN;
  assert.throws(()=>simulateTacticalTour({stage,teams,seed:'invalid-fatigue'}));
  teams[1].riders[0].fatigue=0;teams[1].riders[0].strength=Number.NaN;
  assert.throws(()=>simulateTacticalTour({stage,teams,seed:'invalid-skill'}));
});

test('male and female recordings retain separate categories and their locked inputs',()=>{
  const maleTeams=[tacticalTeam('a','aggressive'),tacticalTeam('b','protect')];
  const femaleTeams=maleTeams.map(team=>({...team,riders:team.riders.map(rider=>({...rider,gender:'F'}))}));
  const input={stage,seed:'category-recording',weather:{temp_c:19,wind_kph:14,precipitation_mm:2}};
  const men=simulateTacticalTour({...input,teams:maleTeams});
  const women=simulateTacticalTour({...input,teams:femaleTeams});
  assert.equal(men.raceCategory,'M');
  assert.equal(women.raceCategory,'F');
  for(const recording of [men,women]){
    assert.equal(recording.raceSeed,input.seed);
    assert.deepEqual(recording.route.lockedWeather,{temperatureC:19,windKph:14,rainMm:2});
    assert.equal(validateRecordedTour(recording),true);
  }
  assert.deepEqual(women.frames,men.frames);
  assert.deepEqual(women.provisionalResults,men.provisionalResults);
});

test('each of the fourteen sporting skills has a clear primary racing situation',()=>{
  const rider=Object.fromEntries(SPORTING_SKILLS.map(skill=>[skill,50]));
  const segment={terrain:'flat',surface:'road',weather:{windKph:8,rainMm:0}};
  const scenarios={
    sprint:{phase:'finale'},flat:{phase:'cruise'},hills:{phase:'cruise',terrain:'hill'},
    mountain:{phase:'cruise',terrain:'climb'},cobbles:{phase:'cruise',surface:'cobbles'},
    timetrial:{phase:'solo'},endurance:{phase:'cruise'},strength:{phase:'chase'},
    wind:{phase:'cruise',exposed:true,windKph:30},acceleration:{phase:'attack'},
    repeatability:{phase:'attack'},descending:{phase:'cruise',terrain:'descent'},
    handling:{phase:'cruise',surface:'gravel',rainMm:4},positioning:{phase:'finale'},
  };
  assert.equal(SPORTING_SKILLS.length,14);
  for(const skill of SPORTING_SKILLS){
    const {terrain='flat',surface='road',windKph=8,rainMm=0,phase='cruise',exposed=false}=scenarios[skill];
    const environment={...segment,terrain,surface,weather:{windKph,rainMm}};
    const normal=riderKilometreEffect(rider,environment,{phase,exposed});
    const improved=riderKilometreEffect({...rider,[skill]:90},environment,{phase,exposed});
    assert.ok(improved.ability>normal.ability,`${skill} should matter in ${phase}`);
  }
  assert.equal(Object.keys(sportingSkills({})).length,14);
});

test('fatigue and low energy reduce ability without changing permanent skills',()=>{
  const rider={flat:70,endurance:70,form:60,fatigue:0};
  const segment={terrain:'flat',surface:'road',weather:{windKph:0,rainMm:0}};
  const fresh=riderKilometreEffect(rider,segment,{energy:100});
  const tired=riderKilometreEffect({...rider,fatigue:60},segment,{energy:30});
  assert.ok(fresh.ability>tired.ability);
  const threshold=riderKilometreEffect(rider,segment,{energy:12});
  const depleted=riderKilometreEffect(rider,segment,{energy:0});
  assert.ok(depleted.ability<threshold.ability*.8,
    'near-empty energy should sharply reduce sustainable pace');
  assert.ok(depleted.ability>0);
  assert.deepEqual(sportingSkills(rider),sportingSkills({...rider,fatigue:60}));
});

test('extreme temperature lowers ability, with endurance mitigating the loss',()=>{
  const base={flat:60,endurance:20,form:50,fatigue:0};
  const segment={terrain:'flat',surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const hot={...segment,weather:{...segment.weather,temperatureC:39}};
  const lowNormal=riderKilometreEffect(base,segment);
  const lowHot=riderKilometreEffect(base,hot);
  const highNormal=riderKilometreEffect({...base,endurance:90},segment);
  const highHot=riderKilometreEffect({...base,endurance:90},hot);
  assert.ok(lowHot.ability<lowNormal.ability);
  assert.ok(lowHot.energyCostMultiplier>lowNormal.energyCostMultiplier);
  assert.ok(highHot.ability/highNormal.ability>lowHot.ability/lowNormal.ability);
  assert.throws(()=>riderKilometreEffect(base,{...segment,weather:{temperatureC:NaN}}));
});

test('a precommitted backup plan is executed by a stronger road captain sooner',()=>{
  const high=tacticalTeam('high','balanced'),low=tacticalTeam('low','balanced');
  for(const team of [high,low]){
    team.orders={...team.orders,backupId:`${team.id}-2`,contingency:'backup_if_captain_exhausted',
      baseline:{effort:'hard',chase:'ignore',attack:'none'}};
    team.riders[0].fatigue=100;
  }
  high.riders[1].leadership=90;low.riders[1].leadership=0;
  const longStage={distance_km:140,profile_points:[[0,100],[140,100]]};
  const frames=simulateTacticalTour({stage:longStage,teams:[high,low],seed:'leadership'}).frames;
  const highSwitch=frames.find(frame=>frame.decisions.some(d=>d.teamId==='high'))?.km;
  const lowSwitch=frames.find(frame=>frame.decisions.some(d=>d.teamId==='low'))?.km;
  assert.ok(Number.isInteger(highSwitch)&&Number.isInteger(lowSwitch));
  assert.ok(highSwitch<lowSwitch);
  assert.equal(frames.at(-1).activeLeaders.find(t=>t.teamId==='high').riderId,'high-2');
  assert.throws(()=>normalizeOrders({captainId:'r0',contingency:'backup_if_captain_exhausted'},
    {riderIds:riders,distanceKm:40}));
});

test('the tactical model stays bounded across a full-length twenty-team race',()=>{
  const longStage={distance_km:400,profile_points:[[0,100],[120,400],[240,80],[400,100]],
    surface_segments:[{from_km:50,to_km:60,surface:'cobbles'}],exposed_segments:[{from_km:200,to_km:230}]};
  const teams=Array.from({length:20},(_,i)=>tacticalTeam(`t${i}`,
    i%3===0?'aggressive':i%3===1?'protect':'balanced'));
  const result=simulateTacticalTour({stage:longStage,teams,seed:'stress',
    weather:{temp_c:22,wind_kph:35,precipitation_mm:3}});
  assert.equal(result.frames.length,400);
  assert.equal(result.frames.at(-1).teamEnergy.length,20);
  assert.ok(result.frames.every(frame=>Number.isFinite(frame.gapSeconds)&&frame.gapSeconds>=0));
  assert.ok(result.frames.every(frame=>frame.teamEnergy.every(team=>Number.isFinite(team.mean)&&team.mean>=0&&team.mean<=100)));
  assert.ok(result.frames.every(frame=>frame.teamPace.every(team=>Number.isFinite(team.meanAbility))));
  assert.ok(result.frames.every(frame=>teams.every(team=>frame.breakawayRiderIds.filter(id=>id.startsWith(`${team.id}-`)).length<=2)));
  assert.equal(result.provisionalResults.length,160);
  assert.equal(validateRecordedTour(result),true);
  for(const invalid of [
    recording=>{recording.raceCategory='mixed';},
    recording=>{delete recording.raceSeed;},
    recording=>{delete recording.route.lockedWeather;},
  ]){
    const incomplete=structuredClone(result);
    invalid(incomplete);
    assert.throws(()=>validateRecordedTour(incomplete),/Incomplete race recording/);
  }
  assert.ok(result.provisionalResults.every((r,i,all)=>i===0||r.timeSeconds>=all[i-1].timeSeconds));
});

test('sustained weakness forms a dropped group while stronger kilometres can close its deficit',()=>{
  let states=[{id:'weak',ability:25,energy:65,deficitSeconds:0,lowKilometres:0},
    {id:'steady',ability:60,energy:65,deficitSeconds:0,lowKilometres:0},
    {id:'strong',ability:75,energy:65,deficitSeconds:0,lowKilometres:0}];
  for(let i=0;i<12;i++)states=updateRiderGroups(states,[]);
  const deficit=states[0].deficitSeconds;
  assert.equal(states[0].group,'dropped');
  assert.ok(deficit>3);
  states=updateRiderGroups(states.map(s=>({...s,ability:s.id==='weak'?90:60})),[]);
  assert.ok(states[0].deficitSeconds<deficit);
  assert.ok(states.every(s=>s.deficitSeconds>=0));
});

test('distanced riders do not lower the reference pace of the remaining bunch',()=>{
  const states=[...Array.from({length:3},(_,index)=>({id:`front-${index}`,ability:70,
    deficitSeconds:0,lowKilometres:0,group:'peloton'})),
  ...Array.from({length:5},(_,index)=>({id:`back-${index}`,ability:20,
    deficitSeconds:4,lowKilometres:2,group:'dropped'}))];
  const next=updateRiderGroups(states,[]);
  assert.ok(next.filter(rider=>rider.group==='dropped').every(rider=>rider.deficitSeconds>4));
  assert.ok(next.filter(rider=>rider.group==='peloton').every(rider=>rider.deficitSeconds===0));
  assert.deepEqual(states.map(rider=>rider.deficitSeconds),[0,0,0,4,4,4,4,4]);
});

test('helpers shelter a protected leader but cannot simultaneously chase',()=>{
  const team=tacticalTeam('p','protect');
  team.energy=Object.fromEntries(team.riders.map(rider=>[rider.id,90]));
  const previousGroups=new Map(team.riders.map(rider=>[rider.id,'peloton']));
  const segment=buildKilometreRoute(stage,{seed:'shelter'}).kilometres[0];
  const context={team,leaderId:'p-0',segment,previousGroups,workingRiderIds:new Set()};
  const sheltered=selectShelter(context);
  assert.equal(sheltered.helperIds.length,2);
  assert.ok(sheltered.reduction>0);
  const working=selectShelter({...context,workingRiderIds:new Set(sheltered.helperIds)});
  assert.ok(working.helperIds.every(id=>!sheltered.helperIds.includes(id)));
  assert.deepEqual(selectShelter({...context,previousGroups:new Map([['p-0','breakaway']])}).helperIds,[]);
});

test('protecting a captain saves the captain energy and costs helpers energy',()=>{
  const protectedTeam=tacticalTeam('p','protect',{baseline:{attack:'none',chase:'ignore'}});
  const plainTeam=tacticalTeam('p','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const rival=tacticalTeam('r','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const sheltered=simulateTacticalTour({stage,teams:[protectedTeam,rival],seed:'shelter-cost'});
  const unsheltered=simulateTacticalTour({stage,teams:[plainTeam,rival],seed:'shelter-cost'});
  const finalEnergy=(result,id)=>result.frames.at(-1).riderGroups.find(r=>r.id===id).energy;
  assert.ok(sheltered.frames.some(frame=>frame.shelterEvents.some(event=>event.teamId==='p')));
  assert.ok(finalEnergy(sheltered,'p-0')>finalEnergy(unsheltered,'p-0'));
  assert.ok(finalEnergy(sheltered,'p-2')<finalEnergy(unsheltered,'p-2'));
});

test('a precommitted helper can drop back to a distanced captain at a real cost',()=>{
  const makeTeam=support=>{
    const team=tacticalTeam('a','protect',{baseline:{attack:'none',chase:'ignore',
      captainSupport:support}});
    team.riders[0].flat=5;
    return team;
  };
  const opponent=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'ignore'}});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const hold=simulateTacticalTour({stage:flat,teams:[makeTeam('hold_position'),opponent],seed:'support'});
  const help=simulateTacticalTour({stage:flat,teams:[makeTeam('drop_back_if_dropped'),opponent],seed:'support'});
  const eventFrame=help.frames.find(frame=>frame.supportEvents.length>0);
  assert.ok(eventFrame&&eventFrame.km>1);
  const event=eventFrame.supportEvents[0];
  assert.equal(event.teamId,'a');
  assert.equal(event.leaderId,'a-0');
  assert.ok(event.recoveredSeconds>0);
  assert.ok(!eventFrame.attackers.includes(event.helperId));
  const last=recording=>new Map(recording.frames.at(-1).riderGroups.map(rider=>[rider.id,rider]));
  assert.ok(last(help).get('a-0').deficitSeconds<last(hold).get('a-0').deficitSeconds);
  assert.ok(last(help).get(event.helperId).energy<last(hold).get(event.helperId).energy);
  assert.equal(last(help).get(event.helperId).group,'dropped');
  assert.equal(validateRecordedTour(help),true);
  const tampered=structuredClone(help);
  tampered.frames[eventFrame.km-1].supportEvents[0].helperId='foreign';
  assert.throws(()=>validateRecordedTour(tampered),/captain support/);
});

test('a fresh captain helper cannot jump across an unreachable road gap',()=>{
  const team=tacticalTeam('a','protect',{baseline:{attack:'none',chase:'ignore',
    captainSupport:'drop_back_if_dropped'}});
  team.activeLeaderId=team.orders.captainId;
  team.energy=Object.fromEntries(team.riders.map(rider=>[rider.id,100]));
  const states=team.riders.map(rider=>({id:rider.id,teamId:'a',group:'peloton',deficitSeconds:0}));
  states[0]={...states[0],group:'dropped',deficitSeconds:60};
  assert.equal(selectCaptainSupport(team,states,10),null);
  const candidate=team.orders.helperIds[0];
  assert.equal(applyCaptainSupport(states,{team,leaderId:'a-0',helperId:candidate}).event,null);
  team.supportingHelperId=candidate;
  states[2]={...states[2],group:'dropped',deficitSeconds:5};
  assert.equal(selectCaptainSupport(team,states,11),null);
  assert.equal(applyCaptainSupport(states,{team,leaderId:'a-0',helperId:candidate}).event,null);
  team.supportingHelperId=null;
  states[2]={...states[2],group:'peloton',deficitSeconds:0};
  states[0]={...states[0],deficitSeconds:12};
  assert.equal(selectCaptainSupport(team,states,10),candidate);
  assert.ok(applyCaptainSupport(states,{team,leaderId:'a-0',helperId:candidate}).event);
});

test('an assigned captain helper cannot also chase or launch the planned attack',()=>{
  const team=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-2',chase:'all'}});
  const opponent=tacticalTeam('b','aggressive');
  const contest=resolveTacticalKilometre({teams:[team,opponent],km:20,
    supportingRiderIds:['a-2']});
  assert.ok(contest.blockedAttacks.some(item=>item.riderId==='a-2'&&
    item.reason==='rider_unavailable'));
  assert.ok(contest.chasers.every(chaser=>!chaser.riderIds.includes('a-2')));
  assert.ok(contest.energyCosts.every(cost=>cost.riderId!=='a-2'));
});

test('recovery requires consecutive quiet flat kilometres and rewards endurance',()=>{
  const segment={terrain:'flat',surface:'road',gradientPct:0,exposed:false,
    weather:{windKph:12,rainMm:0}};
  const context={segment,effort:'conserve',group:'peloton',working:false};
  assert.deepEqual(recoveryForKilometre({...context,rider:{endurance:70},quietKm:0}),
    {quietKm:1,recovery:0});
  assert.deepEqual(recoveryForKilometre({...context,rider:{endurance:70},quietKm:1}),
    {quietKm:2,recovery:0});
  const rested=recoveryForKilometre({...context,rider:{endurance:70},quietKm:2});
  assert.ok(rested.recovery>0);
  assert.ok(recoveryForKilometre({...context,rider:{endurance:90},quietKm:2}).recovery>rested.recovery);
  for(const exception of [{working:true},{group:'breakaway'},{effort:'hard'},
    {segment:{...segment,terrain:'climb'}},{segment:{...segment,exposed:true}}])
    assert.deepEqual(recoveryForKilometre({...context,rider:{endurance:70},quietKm:4,...exception}),
      {quietKm:0,recovery:0});
});

test('resting can restore spent energy but never exceed the starting fatigue cap',()=>{
  const quiet=tacticalTeam('q','balanced',{baseline:{effort:'conserve',attack:'none',chase:'ignore'}});
  const steady=tacticalTeam('q','balanced',{baseline:{effort:'steady',attack:'none',chase:'ignore'}});
  const rival=tacticalTeam('r','balanced',{baseline:{attack:'none',chase:'ignore'}});
  for(const team of [quiet,steady])team.riders.forEach(rider=>{rider.fatigue=80;});
  const rested=simulateTacticalTour({stage,teams:[quiet,rival],seed:'rested'});
  const spent=simulateTacticalTour({stage,teams:[steady,rival],seed:'rested'});
  const energy=(result,id)=>result.frames.at(-1).riderGroups.find(r=>r.id===id).energy;
  assert.ok(rested.frames.some(frame=>frame.recoveredRiderIds.includes('q-0')));
  assert.ok(energy(rested,'q-0')>energy(spent,'q-0'));
  assert.ok(rested.frames.every(frame=>frame.riderGroups.filter(r=>r.teamId==='q').every(r=>r.energy<=68)));
});

test('a precommitted late conserve phase allows recovery after earlier hard effort',()=>{
  const hard=tacticalTeam('h','balanced',{baseline:{effort:'hard',attack:'none',chase:'ignore'}});
  const planned=tacticalTeam('h','balanced',{baseline:{effort:'hard',attack:'none',chase:'ignore'},
    phases:[{atKm:30,effort:'conserve'}]});
  const rival=tacticalTeam('r','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const input={stage,seed:'planned-rest'};
  const allHard=simulateTacticalTour({...input,teams:[hard,rival]});
  const eased=simulateTacticalTour({...input,teams:[planned,rival]});
  assert.deepEqual(eased.frames.slice(0,30),allHard.frames.slice(0,30));
  assert.ok(eased.frames.slice(30).some(frame=>frame.recoveredRiderIds.includes('h-0')));
  assert.ok(eased.frames.at(-1).riderGroups.find(r=>r.id==='h-0').energy>
    allHard.frames.at(-1).riderGroups.find(r=>r.id==='h-0').energy);
});

test('a rider still in the break finishes ahead of the bunch when its gap survives',()=>{
  const a=tacticalTeam('a','aggressive'),b=tacticalTeam('b','protect',{baseline:{chase:'ignore'}});
  const result=simulateTacticalTour({stage,teams:[a,b],seed:'break-finish'});
  assert.ok(result.frames.at(-1).gapSeconds>0);
  const ahead=new Set(result.frames.at(-1).breakawayRiderIds);
  assert.ok(ahead.size>0);
  assert.ok(result.provisionalResults.find(r=>ahead.has(r.riderId)).position<
    result.provisionalResults.find(r=>!ahead.has(r.riderId)).position);
  assert.equal(validateRecordedTour(result),true);
  const fabricated=structuredClone(result);
  fabricated.frames.at(-1).gapSeconds=100;
  fabricated.frames.at(-1).pelotonGapSeconds=100;
  fabricated.frames.at(-1).roadGroups[0].gapSeconds=100;
  assert.throws(()=>validateRecordedTour(fabricated),/final breakaway gap/);
});

test('the final sprint cannot reverse uncaught and dropped group order',()=>{
  const breakTeam=tacticalTeam('a','balanced');
  const bunchTeam=tacticalTeam('b','balanced');
  breakTeam.riders[0].sprint=0;
  bunchTeam.riders[0].sprint=100;
  const route=buildKilometreRoute(stage,{seed:'finish-bands'});
  const states=[...breakTeam.riders,...bunchTeam.riders].map(rider=>({
    id:rider.id,energy:80,deficitSeconds:0,
    group:rider.id==='a-0'?'breakaway':rider.id==='b-0'?'dropped':'peloton',
  }));
  states.find(rider=>rider.id==='b-0').deficitSeconds=3.01;
  const results=provisionalFinish({route,teams:[breakTeam,bunchTeam],states,
    breakawayRiderIds:['a-0'],gapSeconds:.1,seed:'finish-bands'});
  const ahead=results.filter(rider=>rider.group==='breakaway');
  const peloton=results.filter(rider=>rider.group==='peloton');
  const dropped=results.filter(rider=>rider.group==='dropped');
  assert.equal(results[0].riderId,'a-0');
  assert.ok(peloton[0].timeSeconds-ahead.at(-1).timeSeconds>=.09);
  assert.ok(dropped[0].position>peloton.at(-1).position);
});

test('two surviving breaks finish in road order with their separate recorded gaps',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced')];
  const route=buildKilometreRoute(stage,{seed:'two-break-finish'});
  const roadGroups=[
    {id:'road-2',riderIds:['a-0'],teamIds:['a'],gapSeconds:24},
    {id:'road-1',riderIds:['a-1','b-0'],teamIds:['a','b'],gapSeconds:20},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const result=provisionalRoadGroupFinish({route,teams,states,roadGroups,seed:'two-break-finish'});
  const front=result.filter(rider=>rider.roadGroupId==='road-2');
  const chase=result.filter(rider=>rider.roadGroupId==='road-1');
  const bunch=result.filter(rider=>rider.group==='peloton');
  assert.equal(front[0].position,1);
  assert.ok(chase[0].position>front.at(-1).position);
  assert.ok(bunch[0].position>chase.at(-1).position);
  assert.ok(chase[0].timeSeconds-front.at(-1).timeSeconds>=3.98);
  assert.ok(bunch[0].timeSeconds-chase.at(-1).timeSeconds>=19.98);
  assert.throws(()=>provisionalRoadGroupFinish({route,teams,states,
    roadGroups:[{...roadGroups[0],riderIds:['foreign']},roadGroups[1]],seed:'two-break-finish'}),
  /outside the finish roster/);
});

test('the bunch may catch the rear break at the line while the front break survives',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced')];
  teams[0].riders[1].sprint=0;
  teams[1].riders.forEach(rider=>{rider.sprint=100;rider.acceleration=90;});
  const route=buildKilometreRoute(stage,{seed:'rear-break-finish'});
  const roadGroups=[
    {id:'road-2',riderIds:['a-0'],teamIds:['a'],gapSeconds:24},
    {id:'road-1',riderIds:['a-1'],teamIds:['a'],gapSeconds:.1},
  ];
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:roadGroups.some(group=>group.riderIds.includes(rider.id))?
      'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'rear-break-finish'});
  assert.deepEqual(finish.caughtRiderIds,['a-1']);
  assert.deepEqual(finish.roadGroups.map(group=>group.riderIds),[['a-0']]);
  assert.ok(finish.roadGroups[0].gapSeconds>0);
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,
    {caughtRiderIds:finish.caughtRiderIds}),true);
  assert.equal(finish.results[0].riderId,'a-0');
  assert.equal(finish.results.find(result=>result.riderId==='a-1').group,'peloton');
  assert.ok(finish.results.find(result=>result.riderId==='a-1').position>1);
});

test('a final sprint can catch two rear road groups without erasing the leading break',()=>{
  const teams=['a','b','c'].map(id=>tacticalTeam(id,'balanced'));
  teams[0].riders[1].sprint=0;
  teams[1].riders[0].sprint=0;
  teams[2].riders.forEach(rider=>{rider.sprint=100;rider.acceleration=90;});
  const route=buildKilometreRoute(stage,{seed:'two-rear-finish-catches'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:25},
    {id:'road-2',riderIds:['a-1'],teamIds:['a'],gapSeconds:.2},
    {id:'road-3',riderIds:['b-0'],teamIds:['b'],gapSeconds:.1},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'two-rear-finish-catches'});
  assert.deepEqual(new Set(finish.caughtRiderIds),new Set(['a-1','b-0']));
  assert.deepEqual(finish.roadGroups.map(group=>group.riderIds),[['a-0']]);
  assert.ok(finish.roadGroups[0].gapSeconds>0);
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,
    {caughtRiderIds:finish.caughtRiderIds,finishLineCatch:true}),true);
  assert.equal(finish.results[0].riderId,'a-0');
});

test('the bunch can catch a slow front-group rider while the rear group survives',()=>{
  const teams=['a','b','c'].map(id=>tacticalTeam(id,'balanced'));
  teams.flatMap(team=>team.riders).forEach(rider=>{rider.sprint=100;});
  teams[0].riders[1].sprint=0;
  const route=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[40,100]]},{seed:'front-bunch-catch'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0','a-1'],teamIds:['a'],gapSeconds:1.2},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:.8},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'front-bunch-catch'});
  assert.ok(finish.caughtRiderIds.includes('a-1'));
  assert.ok(finish.roadGroups.some(group=>group.riderIds.includes('b-0')));
  assert.ok(!finish.roadGroups.some(group=>group.riderIds.includes('a-1')));
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,{
    caughtRiderIds:finish.caughtRiderIds,
    finaleCatchMoves:finish.finaleRoadGroupCatches,
    mergedGroupIds:finish.mergedRoadGroupIds,
    finishLineCatch:true,
  }),true);
  assert.equal(finish.results.find(result=>result.riderId==='a-1').group,'peloton');
});

test('a whole front group can be caught while the rear road identity survives',()=>{
  const teams=['a','b','c'].map(id=>tacticalTeam(id,'balanced'));
  teams.flatMap(team=>team.riders).forEach(rider=>{rider.sprint=100;});
  teams[0].riders[0].sprint=0;
  const route=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[40,100]]},{seed:'whole-front-bunch-catch'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:1.2},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:.8},
  ];
  const ahead=new Set(['a-0','b-0']);
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'whole-front-bunch-catch'});
  assert.deepEqual(finish.caughtRiderIds,['a-0']);
  assert.deepEqual(finish.roadGroups.map(group=>group.id),['road-2']);
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,{
    caughtRiderIds:finish.caughtRiderIds,finishLineCatch:true,
  }),true);
  assert.equal(finish.results[0].riderId,'b-0');
});

test('a stronger rear-break rider can survive when their companion is caught at the line',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced'),
    tacticalTeam('c','balanced')];
  teams[0].riders[1].sprint=0;
  teams[1].riders[0].sprint=100;
  teams[2].riders.forEach(rider=>{rider.sprint=100;});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const route=buildKilometreRoute(flat,{seed:'partial-rear'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:24},
    {id:'road-2',riderIds:['a-1','b-0'],teamIds:['a','b'],gapSeconds:.5},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'partial-rear'});
  assert.deepEqual(finish.caughtRiderIds,['a-1']);
  assert.deepEqual(finish.roadGroups[1].riderIds,['b-0']);
  assert.deepEqual(finish.roadGroups[1].teamIds,['b']);
  assert.ok(finish.roadGroups[1].gapSeconds>0);
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,
    {caughtRiderIds:finish.caughtRiderIds}),true);
  assert.equal(finish.results.find(result=>result.riderId==='b-0').group,'breakaway');
  assert.equal(finish.results.find(result=>result.riderId==='a-1').group,'peloton');
});

test('a faster rear break can absorb a whole leading road group at the line',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced')];
  teams.flatMap(team=>team.riders).forEach(rider=>{rider.sprint=0;});
  teams[1].riders[0].sprint=100;
  const route=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[40,100]]},{seed:'road-finale-merge'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:3},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:2.6},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'road-finale-merge'});
  assert.deepEqual(finish.caughtRiderIds,[]);
  assert.deepEqual(finish.mergedRoadGroupIds,['road-1']);
  assert.deepEqual(finish.roadGroups[0].riderIds,['a-0','b-0']);
  assert.equal(finish.results[0].riderId,'b-0');
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,
    {mergedGroupIds:finish.mergedRoadGroupIds}),true);
});

test('a rear break can catch one rider while a faster front rider survives',()=>{
  const teams=[tacticalTeam('a','balanced'),tacticalTeam('b','balanced')];
  teams.flatMap(team=>team.riders).forEach(rider=>{rider.sprint=0;});
  teams[0].riders[0].sprint=100;
  teams[1].riders[0].sprint=60;
  const route=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[40,100]]},{seed:'partial-road-finale'});
  const roadGroups=[
    {id:'road-1',riderIds:['a-0','a-1'],teamIds:['a'],gapSeconds:3},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:2.5},
  ];
  const ahead=new Set(roadGroups.flatMap(group=>group.riderIds));
  const states=teams.flatMap(team=>team.riders.map(rider=>({id:rider.id,energy:80,
    deficitSeconds:0,group:ahead.has(rider.id)?'breakaway':'peloton'})));
  const finish=resolveRearRoadGroupFinishingSprint({route,teams,states,roadGroups,
    seed:'partial-road-finale'});
  assert.deepEqual(finish.mergedRoadGroupIds,[]);
  assert.deepEqual(finish.finaleRoadGroupCatches,[{
    riderId:'a-1',fromGroupId:'road-1',toGroupId:'road-2',
  }]);
  assert.deepEqual(finish.roadGroups.map(group=>group.riderIds),
    [['a-0'],['a-1','b-0']]);
  assert.equal(validateRoadGroupTransition(roadGroups,finish.roadGroups,{
    finaleCatchMoves:finish.finaleRoadGroupCatches,
  }),true);
  assert.throws(()=>validateRoadGroupTransition(roadGroups,finish.roadGroups),
    /changed groups without a merge/);
  assert.equal(finish.results[0].riderId,'a-0');
});

test('a whole-group finale catch is stored in the tactical replay',()=>{
  const longFlat={distance_km:80,profile_points:[[0,100],[80,100]],
    keypoints:Array.from({length:71},(_,index)=>({km:10+index,kind:'SPRINT'}))};
  const teams=['a','b','c'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',
    strength:id==='b'&&index===0?100:70,
    endurance:id==='b'&&index===0?100:70,
    sprint:id==='b'&&index===0?100:0,
    timetrial:id==='b'&&index===0?100:id==='a'&&index===0?90:70,
    flat:id==='b'&&index===0?100:id==='a'&&index===0?85:70,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
    baseline:{attack:'none',chase:'ignore'},
    phases:id==='a'?[{atKm:10,attack:'selective',attackRiderId:'a-0'},
      {atKm:11,attack:'none'}]:id==='b'?
      [{atKm:60,attack:'selective',attackRiderId:'b-0'},
        {atKm:61,attack:'none'}]:[]}}));
  const recording=simulateTacticalTour({stage:longFlat,teams,
    seed:'finale-merge:10:60:21'});
  assert.equal(recording.frames.at(-2).roadGroups.length,2);
  assert.deepEqual(recording.frames.at(-1).mergedRoadGroupIds,['road-1']);
  assert.equal(recording.frames.at(-1).roadGroups.length,1);
  assert.equal(recording.provisionalResults[0].riderId,'b-0');
  assert.equal(validateRecordedTour(recording),true);
  const inventedPartialCatch=structuredClone(recording);
  inventedPartialCatch.frames.at(-1).finaleRoadGroupCatches=[{
    riderId:'a-0',fromGroupId:'road-1',toGroupId:'road-2',
  }];
  assert.throws(()=>validateRecordedTour(inventedPartialCatch),
    /Invalid recorded finale road-group catches/);
});

test('a partial road-group finale catch survives full race replay validation',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:Array.from({length:31},(_,index)=>({km:10+index,kind:'SPRINT'}))};
  const teams=['a','b','c'].map(id=>({id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',strength:index===0?(id==='b'?76:68):70,
    endurance:index===0?(id==='b'?76:68):70,
    sprint:index===0?(id==='c'?0:100):0,
    timetrial:index===0?(id==='b'?76:68):70,
    flat:index===0?(id==='b'?76:68):70,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
    baseline:{attack:'none',chase:'ignore'},
    phases:id==='a'||id==='c'?[{atKm:10,attack:'selective',attackRiderId:`${id}-0`},
      {atKm:11,attack:'none'}]:
      [{atKm:31,attack:'selective',attackRiderId:'b-0'},
        {atKm:32,attack:'none'}]}}));
  const race=simulateTacticalTour({stage:flat,teams,
    seed:'front-search:68:76:31:0'});
  assert.deepEqual(race.frames.at(-2).roadGroups.map(group=>group.riderIds),
    [['a-0','c-0'],['b-0']]);
  assert.deepEqual(race.frames.at(-1).finaleRoadGroupCatches,[{
    riderId:'c-0',fromGroupId:'road-1',toGroupId:'road-2',
  }]);
  assert.deepEqual(race.frames.at(-1).roadGroups.map(group=>group.riderIds),
    [['a-0'],['c-0','b-0']]);
  assert.equal(validateRecordedTour(race),true);
  const missingCatch=structuredClone(race);
  missingCatch.frames.at(-1).finaleRoadGroupCatches=[];
  assert.throws(()=>validateRecordedTour(missingCatch),/changed groups without a merge/);
});

test('a late chase group is caught at the line while the first break remains replayable',()=>{
  const front=tacticalTeam('a','balanced',{baseline:{attack:'selective',chase:'ignore'},
    phases:[{atKm:10,attack:'none'}]});
  Object.assign(front.riders[0],{flat:95,strength:95,endurance:95,timetrial:95,sprint:75});
  const rear=tacticalTeam('b','balanced',{baseline:{attack:'none',chase:'ignore'},
    phases:[{atKm:30,attack:'selective',attackRiderId:'b-0'}]});
  Object.assign(rear.riders[0],{flat:34,strength:10,endurance:95,sprint:0,acceleration:10});
  const bunch=tacticalTeam('c','protect',{baseline:{attack:'none',chase:'ignore'}});
  bunch.riders.forEach(rider=>{rider.sprint=100;rider.acceleration=100;rider.flat=100;});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},{km:40,kind:'SPRINT'}]};
  const race=simulateTacticalTour({stage:flat,teams:[front,rear,bunch],seed:'rear-probe-0'});
  const final=race.frames.at(-1);
  assert.equal(final.finishLineCatch,true);
  assert.ok(final.caughtBreakawayRiderIds.includes('b-0'));
  assert.ok(final.roadGroups[0].riderIds.includes('a-0'));
  assert.ok(final.roadGroups.every(group=>!group.riderIds.includes('b-0')));
  assert.equal(race.provisionalResults.find(result=>result.riderId==='b-0').group,'peloton');
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames.at(-1).formedChaseGroupId='road-99';
  assert.throws(()=>validateRecordedTour(tampered),/identity/);
});

test('a finishing sprint records a last-metre catch before the result is shown',()=>{
  const attacker=tacticalTeam('a','aggressive',{baseline:{chase:'ignore'},
    phases:[{atKm:30,attack:'none'}]});
  const sprinter=tacticalTeam('b','protect',{baseline:{chase:'ignore'}});
  attacker.riders.forEach(rider=>{rider.sprint=0;rider.acceleration=15;});
  sprinter.riders.forEach(rider=>{rider.sprint=100;rider.acceleration=50;});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const recording=simulateTacticalTour({stage:flat,teams:[attacker,sprinter],seed:'probe-0'});
  const before=recording.frames.at(-2),finish=recording.frames.at(-1);
  assert.ok(before.gapSeconds>0);
  assert.ok(before.breakawayRiderIds.length>0);
  assert.equal(finish.finishLineCatch,true);
  assert.deepEqual(new Set(finish.caughtBreakawayRiderIds),new Set(before.breakawayRiderIds));
  assert.equal(finish.gapSeconds,0);
  assert.deepEqual(finish.breakawayRiderIds,[]);
  assert.equal(recording.provisionalResults[0].group,'peloton');
  assert.equal(validateRecordedTour(recording),true);
  const tampered=structuredClone(recording);
  tampered.frames.at(-1).finishLineCatch=false;
  tampered.frames[0].finishLineCatch=true;
  assert.throws(()=>validateRecordedTour(tampered),/kilometre/);
});

test('a new attack on the final kilometre can be caught before the line',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const team=(id,sprint,phases)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:5,strength:5,endurance:5,sprint,acceleration:5,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
      baseline:{attack:'none',chase:'ignore'},phases}});
  const race=simulateTacticalTour({stage:flat,seed:'last-join-0',teams:[
    team('b',100,[]),team('c',0,[{atKm:39,attack:'selective'}]),
  ]});
  const final=race.frames.at(-1);
  assert.deepEqual(final.joinedBreakawayRiderIds,['c-0']);
  assert.deepEqual(final.caughtBreakawayRiderIds,['c-0']);
  assert.equal(final.finishLineCatch,true);
  assert.equal(final.gapSeconds,0);
  assert.deepEqual(final.roadGroups,[]);
  assert.equal(race.provisionalResults.find(rider=>rider.riderId==='c-0').group,'peloton');
  assert.equal(validateRecordedTour(race),true);
});

test('the finishing sprint can catch one break rider while another stays ahead',()=>{
  const attacker=tacticalTeam('a','aggressive',{baseline:{chase:'ignore'},
    phases:[{atKm:30,attack:'none'}]});
  const sprinter=tacticalTeam('b','protect',{baseline:{chase:'ignore'}});
  attacker.riders.forEach((rider,index)=>{rider.sprint=index===0?75:0;rider.acceleration=15;});
  sprinter.riders.forEach(rider=>{rider.sprint=100;rider.acceleration=50;});
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const recording=simulateTacticalTour({stage:flat,teams:[attacker,sprinter],seed:'probe-0'});
  const before=recording.frames.at(-2),finish=recording.frames.at(-1);
  assert.deepEqual(before.breakawayRiderIds,['a-0','a-1']);
  assert.equal(finish.finishLineCatch,true);
  assert.deepEqual(finish.caughtBreakawayRiderIds,['a-1']);
  assert.deepEqual(finish.breakawayRiderIds,['a-0']);
  assert.ok(finish.gapSeconds>0&&finish.gapSeconds<before.gapSeconds);
  assert.equal(recording.provisionalResults[0].riderId,'a-0');
  assert.equal(recording.provisionalResults.find(rider=>rider.riderId==='a-1').group,'peloton');
  assert.equal(validateRecordedTour(recording),true);
  const tampered=structuredClone(recording);
  tampered.frames.at(-1).caughtBreakawayRiderIds=['a-0','a-1'];
  assert.throws(()=>validateRecordedTour(tampered),/breakaway|catch/);
});

test('a rider already in the break cannot launch another new attack',()=>{
  const attacker=tacticalTeam('a','aggressive'),defender=tacticalTeam('d','protect',{baseline:{chase:'ignore'}});
  const result=simulateTacticalTour({stage,teams:[attacker,defender],seed:'one-break'});
  const first=result.frames.find(frame=>frame.attackers.length>0);
  assert.ok(first);
  const later=result.frames.filter(frame=>frame.km>first.km);
  assert.ok(later.every(frame=>!frame.attackers.includes(first.attackers[0])||!frame.breakawayRiderIds.includes(first.attackers[0])));
  assert.ok(Math.max(...result.frames.map(frame=>frame.breakawayRiderIds.length))<=2);
});

test('a rider cannot join a break and launch a second attack in the same kilometre',()=>{
  const route={distance_km:40,profile_points:[[0,100],[40,100]],
    keypoints:[{km:11,kind:'SPRINT'}]};
  const make=id=>({id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:75,strength:75,endurance:75,
    acceleration:75,sprint:60,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'balanced',
    baseline:{attack:'none',chase:'ignore',attackRiderId:`${id}-0`},
    phases:[{atKm:10,attack:'repeated',
      ...(id==='a'?{breakAttackRiderId:'a-0'}:{})}]}});
  const race=simulateTacticalTour({stage:route,teams:[make('a'),make('b')],
    seed:'no-double-attack'});
  const first=race.frames[10];
  assert.ok(first.attackers.includes('a-0'));
  assert.ok(first.joinedBreakawayRiderIds.includes('a-0'));
  assert.equal(first.splitAttack,null);
  assert.deepEqual(first.blockedBreakAttacks,[{teamId:'a',riderId:'a-0',
    reason:'group_formed_this_km'}]);
  assert.equal(validateRecordedTour(race),true);
});

test('a sprint-disadvantaged break rider can make an automatic, recorded finale split',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const make=(id,sprint,breakFinale)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:60,strength:60,endurance:60,sprint,acceleration:60,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'aggressive',
      baseline:{chase:'ignore',breakFinale}}});
  const teams=[make('a',20,'attack_if_outsprinted'),make('b',90,'hold_group')];
  const race=simulateTacticalTour({stage:flat,teams,seed:'split-probe'});
  const control=simulateTacticalTour({stage:flat,
    teams:[make('a',20,'hold_group'),make('b',90,'hold_group')],seed:'split-probe'});
  assert.equal(race.frames[29].splitAttack?.source,'automatic');
  assert.equal(race.frames[29].splitAttack?.status,'split');
  assert.equal(race.frames[29].splitAttack?.riderId,'a-0');
  assert.ok(race.frames[37].mergedRoadGroupIds.includes('road-2'),
    'the working pursuit should catch the first solo attacker before the finish');
  assert.equal(control.frames[29].splitAttack,null);
  assert.equal(control.provisionalResults[0].teamId,'b');
  assert.equal(race.provisionalResults[0].teamId,'a');
  assert.equal(validateRecordedTour(race),true);
  const tampered=structuredClone(race);
  tampered.frames[29].splitAttack.source='unplanned';
  assert.throws(()=>validateRecordedTour(tampered),/break attack/);
  const disguised=structuredClone(race);
  disguised.frames[29].splitAttack.source='committed';
  assert.throws(()=>validateRecordedTour(disguised),/committed orders/);
  const removedOrder=structuredClone(race);
  removedOrder.committedInputs.teams.find(team=>team.id==='a').orders.baseline.breakFinale='hold_group';
  assert.throws(()=>validateRecordedTour(removedOrder),/committed orders/);
});

test('a committed break attack splits the live road group and survives replay validation',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const makeTeam=(id,preset,phases=[])=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:60,strength:60,endurance:60,sprint:50,acceleration:60,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset,
      baseline:{chase:'ignore'},phases}});
  const teams=[makeTeam('a','aggressive',[{atKm:20,breakAttackRiderId:'a-0'}]),
    makeTeam('b','protect')];
  const race=simulateTacticalTour({stage:flat,teams,seed:'split-probe'});
  const control=simulateTacticalTour({stage:flat,
    teams:[makeTeam('a','aggressive'),makeTeam('b','protect')],seed:'split-probe'});
  const split=race.frames[20];
  assert.equal(split.splitAttack.status,'split');
  assert.equal(split.splitAttack.source,'committed');
  const disguised=structuredClone(race);
  disguised.frames[20].splitAttack.source='automatic';
  assert.throws(()=>validateRecordedTour(disguised),/committed orders/);
  assert.deepEqual(split.roadGroups.map(group=>group.id),['road-2','road-1']);
  assert.deepEqual(split.roadGroups[0].riderIds,['a-0']);
  assert.ok(split.roadGroups[0].gapSeconds>split.roadGroups[1].gapSeconds);
  const energy=recording=>recording.frames[20].riderGroups.find(rider=>rider.id==='a-0').energy;
  assert.ok(energy(race)<energy(control));
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(race.provisionalResults.slice(0,2).map(rider=>rider.roadGroupId),
    race.frames.at(-1).roadGroups.map(group=>group.id));
  const missingEvent=structuredClone(race);
  missingEvent.frames[20].splitAttack=null;
  assert.throws(()=>validateRecordedTour(missingEvent),/split|appeared/);
  const wrongRearGap=structuredClone(race);
  wrongRearGap.frames[20].pelotonGapSeconds+=1;
  assert.throws(()=>validateRecordedTour(wrongRearGap),/road group/);
});

test('the stronger of two simultaneous break attacks wins the recorded move',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const makeTeam=(id,skill)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:index===0?skill:60,strength:index===0?skill:60,
      endurance:index===0?skill:60,acceleration:index===0?skill:60,
      sprint:50,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'aggressive',
      baseline:{chase:'ignore'},
      phases:[{atKm:20,breakAttackRiderId:`${id}-0`}]}});
  const a=makeTeam('a',60),b=makeTeam('b',95);
  const race=simulateTacticalTour({stage:flat,teams:[a,b],seed:'simultaneous-break'});
  const attack=race.frames[20].splitAttack;
  assert.equal(attack?.riderId,'b-0');
  assert.equal(attack?.status,'split');
  assert.deepEqual(race.frames[20].blockedBreakAttacks,[{
    teamId:'a',riderId:'a-0',reason:'another_break_attack'}]);
  assert.equal(validateRecordedTour(race),true);
  const reordered=simulateTacticalTour({stage:flat,teams:[b,a],seed:'simultaneous-break'});
  assert.deepEqual(reordered.frames,race.frames);
});

test('the original break can catch a tiring attacker and retain its road identity',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const makeTeam=(id,preset,phases=[])=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,gender:'M',
      flat:60,strength:60,endurance:60,sprint:50,acceleration:60,
      leadership:50,timetrial:60})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset,
      baseline:{chase:'ignore'},phases}});
  const a=makeTeam('a','aggressive',[{atKm:20,breakAttackRiderId:'a-0'}]);
  a.riders[0].acceleration=100;
  a.riders[0].timetrial=0;
  a.riders[0].endurance=10;
  a.riders[1].timetrial=100;
  a.riders[1].endurance=100;
  const race=simulateTacticalTour({stage:flat,teams:[a,makeTeam('b','protect')],
    seed:'split-merge-0'});
  const split=race.frames.findIndex(frame=>frame.splitAttack?.status==='split');
  const merged=race.frames.findIndex((frame,index)=>index>split&&frame.mergedRoadGroupIds.length);
  assert.ok(split>=0&&merged>split);
  assert.deepEqual(race.frames[merged].mergedRoadGroupIds,['road-2']);
  assert.equal(race.frames[merged].roadGroups[0].id,'road-1');
  assert.equal(race.frames[merged].roadGroups.length,1);
  assert.equal(validateRecordedTour(race),true);
});

test('a teammate in the chasing break does not pull against their own leader',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].breakAttackAtKm=40;
  const race=runKilometreLab({scenario,seed:'break-split:0'});
  const splitIndex=race.frames.findIndex(frame=>frame.splitAttack?.status==='split');
  assert.ok(splitIndex>=0&&splitIndex<race.frames.length-1);
  const leaderId=race.frames[splitIndex].splitAttack.riderId;
  const following=race.frames[splitIndex].roadGroups.at(-1).riderIds.filter(id=>
    race.committedInputs.teams.find(team=>team.id==='team-0').riders.some(rider=>rider.id===id));
  assert.ok(following.length>0);
  const next=race.frames[splitIndex+1];
  assert.ok(next.pullRiderIds.includes(leaderId));
  assert.ok(following.every(id=>!next.pullRiderIds.includes(id)));
  assert.ok(next.pullRiderIds.some(id=>!id.startsWith('r-0-')));
  assert.equal(validateRecordedTour(race),true);
});

test('Race Lab can record a precommitted attack from an existing break',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].breakAttackAtKm=40;
  const race=runKilometreLab({scenario,seed:'lab-split-probe'});
  assert.equal(race.frames[40].splitAttack?.status,'split');
  assert.equal(race.frames[40].roadGroups.length,2);
  assert.equal(validateRecordedTour(race),true);
});

test('a planned split records why it cannot run when its rider is not ahead',()=>{
  const flat={distance_km:40,profile_points:[[0,100],[40,100]]};
  const team=id=>({id,riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,
    gender:'M',flat:60,strength:60,endurance:60,sprint:50,leadership:50})),
    orders:{captainId:`${id}-0`,preset:'protect',baseline:{attack:'none',chase:'ignore'},
      ...(id==='a'?{phases:[{atKm:20,breakAttackRiderId:'a-0'}]}:{})}});
  const race=simulateTacticalTour({stage:flat,teams:[team('a'),team('b')],seed:'no-break-split'});
  assert.deepEqual(race.frames[20].blockedBreakAttacks,[{
    teamId:'a',riderId:'a-0',reason:'not_in_break',
  }]);
  assert.equal(validateRecordedTour(race),true);
});

test('a recently caught rider cannot reattack immediately while a fresh teammate can',()=>{
  const named=tacticalTeam('a','aggressive',{baseline:{attackRiderId:'a-0'}});
  const open=tacticalTeam('a','aggressive');
  const defender=tacticalTeam('d','protect',{baseline:{chase:'ignore'}});
  const context={km:10,recentlyCaughtRiderIds:['a-0'],teams:[named,defender]};
  const blocked=resolveTacticalKilometre(context);
  assert.deepEqual(blocked.attackers,[]);
  assert.deepEqual(blocked.blockedAttacks,[{teamId:'a',riderId:'a-0',reason:'recently_caught'}]);
  const replacement=resolveTacticalKilometre({...context,teams:[open,defender]});
  assert.equal(replacement.attackers.length,1);
  assert.notEqual(replacement.attackers[0].riderId,'a-0');
});

test('a caught break is recorded and a later planned attack can establish a new one',()=>{
  const race=runKilometreLab({scenario:flatScenario('sprint'),seed:'cycle-0'});
  const first=race.frames.findIndex(frame=>frame.breakawayRiderIds.length>0);
  const caught=race.frames.findIndex((frame,index)=>index>first&&frame.caughtBreakawayRiderIds.length>0);
  const next=race.frames.findIndex((frame,index)=>index>caught&&frame.joinedBreakawayRiderIds.length>0);
  assert.ok(first>=0&&caught>first&&next>caught);
  assert.deepEqual(race.frames[caught].caughtBreakawayRiderIds,
    race.frames[caught-1].breakawayRiderIds);
  assert.equal(race.frames[caught].gapSeconds,0);
  assert.deepEqual(race.frames[caught].breakawayRiderIds,[]);
  assert.ok(race.frames[next].gapSeconds>0);
  const caughtRider=race.frames[caught].caughtBreakawayRiderIds[0];
  const energyAt=index=>race.frames[index].riderGroups.find(rider=>rider.id===caughtRider).energy;
  assert.ok(energyAt(caught)<energyAt(caught-1));
  const recovering=new Set(race.frames[caught].caughtBreakawayRiderIds);
  for(const frame of race.frames.slice(caught+1,caught+6))
    assert.ok(frame.attackers.every(id=>!recovering.has(id)));
  assert.ok(race.frames.some((frame,index)=>index>caught+5&&
    frame.attackers.some(id=>recovering.has(id))));
  assert.equal(validateRecordedTour(race),true);
});

test('road group identity persists until a catch and restarts for the next break',()=>{
  const race=runKilometreLab({scenario:flatScenario('sprint'),seed:'cycle-0'});
  const first=race.frames.findIndex(frame=>frame.roadGroups.length>0);
  const caught=race.frames.findIndex((frame,index)=>index>first&&frame.caughtBreakawayRiderIds.length>0);
  const next=race.frames.findIndex((frame,index)=>index>caught&&frame.roadGroups.length>0);
  assert.ok(first>=0&&caught>first&&next>caught);
  assert.equal(race.frames[first].roadGroups[0].id,'road-1');
  assert.ok(race.frames.slice(first,caught).every(frame=>frame.roadGroups[0]?.id==='road-1'));
  assert.deepEqual(race.frames[caught].roadGroups,[]);
  assert.equal(race.frames[next].roadGroups[0].id,'road-2');
  for(const frame of race.frames){
    const group=frame.roadGroups[0];
    assert.deepEqual(group?.riderIds??[],frame.breakawayRiderIds);
    assert.deepEqual(group?.teamIds??[],frame.breakawayTeamIds);
    assert.equal(group?.gapSeconds??0,frame.gapSeconds);
  }
  assert.equal(validateRecordedTour(race),true);
});

test('the new kilometre model reuses the existing laboratory cast without changing it',()=>{
  const scenario=flatScenario('break'),before=structuredClone(scenario);
  const a=runKilometreLab({scenario,seed:'paired'});
  assert.deepEqual(scenario,before);
  assert.deepEqual(a,runKilometreLab({scenario,seed:'paired'}));
  assert.equal(a.frames.length,160);
  assert.equal(a.scenario.teams.length,4);
  assert.ok(a.frames.some(frame=>frame.exposed));
  assert.ok(a.frames.some(frame=>frame.attackers.length>0));
  assert.ok(a.frames.some(frame=>frame.fatiguedAttackRiderIds.length>0));
});

test('Race Lab carries a selected pre-race break response into the recorded prototype',()=>{
  const scenario=flatScenario('conserve');
  const original=runKilometreLab({scenario,seed:'pelotonia:v2'});
  scenario.teams[0].breakResponse='chase_if_threatened';
  const responsive=runKilometreLab({scenario,seed:'pelotonia:v2'});
  assert.ok(original.frames.every(frame=>!frame.decisions.some(decision=>
    decision.teamId==='team-0'&&decision.kind==='chase_break')));
  const trigger=responsive.frames.find(frame=>frame.decisions.some(decision=>
    decision.teamId==='team-0'&&decision.kind==='chase_break'));
  assert.ok(trigger&&trigger.chasers.includes('team-0'));
  assert.ok(trigger.activeBreakResponseTeamIds.includes('team-0'));
  assert.equal(responsive.scenario.teams[0].breakResponse,'chase_if_threatened');
  assert.equal(validateRecordedTour(responsive),true);
});

test('Race Lab commits the optional fading-rider fallback before calculation',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].forwardResponse='chase_if_fading';
  const race=runKilometreLab({scenario,seed:'forward-fallback'});
  assert.equal(race.committedInputs.teams.find(team=>team.id===scenario.teams[0].id)
    .orders.forwardResponse,'chase_if_fading');
  assert.equal(validateRecordedTour(race),true);
});

test('Race Lab carries precommitted break work into its recorded prototype',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].breakWork='sit_on';
  const recording=runKilometreLab({scenario,seed:'pelotonia:v2'});
  const amberPulls=recording.frames.filter(frame=>frame.pullRiderIds.some(id=>id.startsWith('team-0-')));
  assert.equal(amberPulls.length,0);
  assert.equal(recording.committedInputs.teams[0].orders.baseline.breakWork,'sit_on');
  assert.equal(validateRecordedTour(recording),true);
});

test('Race Lab records the optional break-finale rule before calculation',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].breakFinale='attack_if_outsprinted';
  const race=runKilometreLab({scenario,seed:'break-finale'});
  assert.equal(race.committedInputs.teams[0].orders.baseline.breakFinale,
    'attack_if_outsprinted');
  assert.equal(validateRecordedTour(race),true);
});

test('Race Lab records the selected helper attack policy before calculation',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].helperAttackPolicy='release_if_dropped';
  const race=runKilometreLab({scenario,seed:'helper-freedom'});
  assert.equal(race.committedInputs.teams[0].orders.baseline.helperAttackPolicy,
    'release_if_dropped');
  assert.equal(validateRecordedTour(race),true);
});

test('recorded playback does not recalculate and rejects a result that differs from its frames',()=>{
  const result=runKilometreLab({scenario:flatScenario('sprint'),seed:'recorded'});
  assert.equal(validateRecordedTour(result),true);
  const before=structuredClone(result);
  assert.equal(result.committedInputs.teams.length,4);
  assert.equal(result.committedInputs.teams[0].riders.length,8);
  assert.deepEqual(Object.keys(result.committedInputs.teams[0].riders[0]).filter(key=>SPORTING_SKILLS.includes(key)).sort(),
    [...SPORTING_SKILLS].sort());
  const last=readRecordedKilometre(result,result.frames.length-1);
  assert.deepEqual(last,result.frames.at(-1));
  last.riderGroups[0].energy=0;
  assert.deepEqual(result,before);
  assert.throws(()=>readRecordedKilometre(result,result.frames.length));
  const wrongFinish=structuredClone(result);
  wrongFinish.provisionalResults[0].energy=0;
  assert.throws(()=>validateRecordedTour(wrongFinish),/finish/);
  const missingRider=structuredClone(result);
  missingRider.frames[5].riderGroups.pop();
  assert.throws(()=>validateRecordedTour(missingRider),/kilometre/);
  const wrongInput=structuredClone(result);
  wrongInput.committedInputs.teams[0].riders[0].gender='F';
  assert.throws(()=>validateRecordedTour(wrongInput),/committed rider/);
  const missingInput=structuredClone(result);
  missingInput.committedInputs.teams[0].riders.pop();
  assert.throws(()=>validateRecordedTour(missingInput),/committed team/);
  const impossiblePhase=structuredClone(result);
  impossiblePhase.committedInputs.teams[0].orders.phases=[{atKm:13,attack:'none'}];
  assert.throws(()=>validateRecordedTour(impossiblePhase),/committed team orders/);
  const invalidChase=structuredClone(result);
  invalidChase.committedInputs.teams[0].orders.baseline.chase='teleport';
  assert.throws(()=>validateRecordedTour(invalidChase),/committed team orders/);
  const wrongBreak=structuredClone(result);
  wrongBreak.frames[19].breakawayRiderIds.push('foreign');
  assert.throws(()=>validateRecordedTour(wrongBreak),/breakaway|rider state/);
  const wrongAttackFatigue=structuredClone(result);
  wrongAttackFatigue.frames[19].fatiguedAttackRiderIds=['foreign'];
  assert.throws(()=>validateRecordedTour(wrongAttackFatigue),/attack event/);
  const wrongRoadGroup=structuredClone(result);
  const firstRoadGroup=wrongRoadGroup.frames.find(frame=>frame.roadGroups.length>0);
  firstRoadGroup.roadGroups[0].id='road-99';
  assert.throws(()=>validateRecordedTour(wrongRoadGroup),/road group/);
  const wrongPull=structuredClone(result);
  wrongPull.frames[19].pullRiderIds=['foreign'];
  assert.throws(()=>validateRecordedTour(wrongPull),/break work/);
  const workingKm=result.frames.findIndex(frame=>frame.pullRiderIds.length>0);
  assert.ok(workingKm>=0);
  const hiddenPull=structuredClone(result);
  hiddenPull.frames[workingKm].pullRiderIds=[];
  assert.throws(()=>validateRecordedTour(hiddenPull),/break work differs/);
  const wrongHeldChase=structuredClone(result);
  wrongHeldChase.frames[19].heldChaseTeamIds=['foreign'];
  assert.throws(()=>validateRecordedTour(wrongHeldChase),/held chase/);
  const firstBreak=result.frames.findIndex(frame=>frame.breakawayRiderIds.length>0);
  assert.ok(firstBreak>=0);
  const wrongBreakTeam=structuredClone(result);
  wrongBreakTeam.frames[firstBreak].breakawayTeamIds=[];
  assert.throws(()=>validateRecordedTour(wrongBreakTeam),/breakaway/);
  const missingAttack=structuredClone(result);
  missingAttack.frames[firstBreak].attackers=[];
  assert.throws(()=>validateRecordedTour(missingAttack),/breakaway/);
  const missingJoin=structuredClone(result);
  missingJoin.frames[firstBreak].joinedBreakawayRiderIds=[];
  assert.throws(()=>validateRecordedTour(missingJoin),/breakaway/);
  const impossibleBridge=structuredClone(result);
  impossibleBridge.frames[firstBreak].failedBridgeRiderIds=[...impossibleBridge.frames[firstBreak].attackers];
  assert.throws(()=>validateRecordedTour(impossibleBridge),/breakaway admission/);
  const firstCatch=result.frames.findIndex(frame=>frame.caughtBreakawayRiderIds.length>0);
  assert.ok(firstCatch>=0);
  const missingCatch=structuredClone(result);
  missingCatch.frames[firstCatch].caughtBreakawayRiderIds=[];
  assert.throws(()=>validateRecordedTour(missingCatch),/catch event/);
  const impossibleJoin=structuredClone(result);
  impossibleJoin.frames[firstBreak].chasePower=impossibleJoin.frames[firstBreak].attackPower+1;
  assert.throws(()=>validateRecordedTour(impossibleJoin),/breakaway/);
  const firstChase=result.frames.findIndex(frame=>frame.chasers.length>0);
  assert.ok(firstChase>=0);
  const foreignChase=structuredClone(result);
  foreignChase.frames[firstChase].chasers.push('foreign');
  assert.throws(()=>validateRecordedTour(foreignChase),/chase event/);
  const foreignDecision=structuredClone(result);
  foreignDecision.frames[firstChase].decisions.push({teamId:'foreign',kind:'chase_break',riderId:'foreign'});
  assert.throws(()=>validateRecordedTour(foreignDecision),/tactical decision/);
  const falseResponse=structuredClone(result);
  falseResponse.frames[firstChase].activeBreakResponseTeamIds=['team-0'];
  assert.throws(()=>validateRecordedTour(falseResponse),/break response/);
  const wrongTerrain=structuredClone(result);
  wrongTerrain.frames[19].terrain='climb';
  assert.throws(()=>validateRecordedTour(wrongTerrain),/kilometre/);
  const wrongBlocked=structuredClone(result);
  wrongBlocked.frames[19].blockedAttacks.push({teamId:'foreign',riderId:'foreign',reason:'exhausted'});
  assert.throws(()=>validateRecordedTour(wrongBlocked),/attack event/);
});

test('several attackers can outlast one defender while two sprint teams can organise a catch',()=>{
  for(let i=0;i<5;i++){
    const seed=`tactical-balance-${i}`;
    const protectedRace=runKilometreLab({scenario:flatScenario('sprint'),seed});
    const chaoticRace=runKilometreLab({scenario:flatScenario('break'),seed});
    assert.equal(protectedRace.frames.at(-1).gapSeconds,0);
    assert.equal(protectedRace.provisionalResults[0].group,'peloton');
    assert.ok(chaoticRace.frames.at(-1).gapSeconds>0);
    assert.equal(chaoticRace.provisionalResults[0].group,'breakaway');
  }
});

test('team and rider input order cannot change the recorded tactical trace',()=>{
  const teams=[tacticalTeam('a','aggressive'),tacticalTeam('b','protect'),tacticalTeam('c','balanced')];
  const input={stage,teams,seed:'same-race',weather:{temp_c:20,wind_kph:16,precipitation_mm:1}};
  const original=simulateTacticalTour(input);
  const permuted=simulateTacticalTour({...input,teams:[...teams].reverse().map(team=>({...team,riders:[...team.riders].reverse()}))});
  assert.deepEqual(permuted,original);
  assert.throws(()=>simulateTacticalTour({...input,seed:''}));
});

test('a precommitted phase change affects only kilometres after its marker',()=>{
  const amber=tacticalTeam('amber','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const birch=tacticalTeam('birch','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const baseline=simulateTacticalTour({stage,teams:[amber,birch],seed:'phase'});
  const altered=simulateTacticalTour({stage,teams:[{...amber,orders:{...amber.orders,
    phases:[{atKm:20,effort:'hard'}]}},birch],seed:'phase'});
  assert.deepEqual(altered.frames.slice(0,20),baseline.frames.slice(0,20));
  assert.ok(altered.frames.at(-1).teamEnergy.find(t=>t.teamId==='amber').mean<
    baseline.frames.at(-1).teamEnergy.find(t=>t.teamId==='amber').mean);
  assert.deepEqual(altered.frames.at(-1).teamEnergy.find(t=>t.teamId==='birch'),
    baseline.frames.at(-1).teamEnergy.find(t=>t.teamId==='birch'));
});

test('Race Lab combines a scheduled order change and break attack at one marker',()=>{
  const scenario=flatScenario('conserve');
  const baseline=runKilometreLab({scenario,seed:'lab-phase'});
  scenario.teams[0].phaseAtKm=40;
  scenario.teams[0].phaseEffort='hard';
  scenario.teams[0].phaseChase='all';
  scenario.teams[0].breakAttackAtKm=40;
  const altered=runKilometreLab({scenario,seed:'lab-phase'});
  const amber=altered.committedInputs.teams.find(team=>team.id==='team-0');
  assert.equal(amber.orders.phases.length,1);
  assert.equal(amber.orders.phases[0].breakAttackRiderId,amber.orders.captainId);
  assert.equal(orderAt(amber.orders,39).effort,'conserve');
  assert.equal(orderAt(amber.orders,40).effort,'hard');
  assert.equal(orderAt(amber.orders,40).chase,'all');
  assert.deepEqual(altered.frames.slice(0,40),baseline.frames.slice(0,40));
  assert.equal(validateRecordedTour(altered),true);
});
