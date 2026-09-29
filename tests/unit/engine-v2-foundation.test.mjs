import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {normalizeOrders,orderAt} from '../../lib/engine/v2/orders.mjs';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {SPORTING_SKILLS,sportingSkills,riderKilometreEffect} from '../../lib/engine/v2/physiology.mjs';
import {runKilometreLab} from '../../lib/engine/v2/lab.mjs';
import {updateRiderGroups} from '../../lib/engine/v2/groups.mjs';
import {provisionalFinish} from '../../lib/engine/v2/finish.mjs';
import {selectShelter} from '../../lib/engine/v2/support.mjs';
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
  assert.deepEqual(orderAt(orders,0),{effort:'conserve',chase:'selective',attack:'none',breakWork:'cooperate'});
  assert.deepEqual(orderAt(orders,15),{effort:'conserve',chase:'ignore',attack:'none',breakWork:'cooperate'});
  assert.deepEqual(orderAt(orders,20),{effort:'hard',chase:'all',attack:'none',breakWork:'cooperate'});
  assert.deepEqual(orders.helperIds,['r2','r3','r4','r5','r6','r7']);
  assert.equal(orders.roadCaptainId,'r1');
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
  assert.throws(()=>normalizeOrders({captainId:'r0',baseline:{breakWork:'free_speed'}},context));
  assert.equal(normalizeOrders({captainId:'r0',breakResponse:'chase_if_threatened'},context).breakResponse,
    'chase_if_threatened');
});

test('a precommitted marker changes break cooperation without rewriting earlier orders',()=>{
  const orders=normalizeOrders({captainId:'r0',baseline:{breakWork:'sit_on'},
    phases:[{atKm:20,breakWork:'cooperate'}]},
  {riderIds:riders,distanceKm:40});
  assert.equal(orderAt(orders,19).breakWork,'sit_on');
  assert.equal(orderAt(orders,20).breakWork,'cooperate');
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

test('selective pursuit waits with a manageable gap but starts as the finish approaches',()=>{
  const ahead=tacticalTeam('a','balanced',{baseline:{attack:'none',chase:'ignore'}});
  const defender=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'selective'}});
  const context={teams:[ahead,defender],gapSeconds:7,breakawayTeamIds:['a'],
    breakawayRiderIds:['a-0'],engagedChaseTeamIds:['b'],distanceKm:160};
  const early=resolveTacticalKilometre({...context,km:20});
  const late=resolveTacticalKilometre({...context,km:120});
  assert.deepEqual(early.heldChaseTeamIds,['b']);
  assert.deepEqual(early.chasers,[]);
  assert.ok(early.energyCosts.every(cost=>cost.reason!=='chase'));
  assert.deepEqual(late.heldChaseTeamIds,[]);
  assert.deepEqual(late.chasers.map(chaser=>chaser.teamId),['b']);
  assert.ok(late.gapSeconds<early.gapSeconds);
  const all=tacticalTeam('b','protect',{baseline:{attack:'none',chase:'all'}});
  assert.deepEqual(resolveTacticalKilometre({...context,teams:[ahead,all],km:20}).heldChaseTeamIds,[]);
  const fresh=tacticalTeam('c','aggressive');
  const reacting=resolveTacticalKilometre({...context,teams:[ahead,defender,fresh],km:20});
  assert.ok(reacting.attackers.length>0);
  assert.ok(!reacting.heldChaseTeamIds.includes('b'));
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
  assert.equal(a.tuningVersion,'v2-prototype-22');
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

test('Race Lab carries precommitted break work into its recorded prototype',()=>{
  const scenario=flatScenario('break');
  scenario.teams[0].breakWork='sit_on';
  const recording=runKilometreLab({scenario,seed:'pelotonia:v2'});
  const amberPulls=recording.frames.filter(frame=>frame.pullRiderIds.some(id=>id.startsWith('team-0-')));
  assert.equal(amberPulls.length,0);
  assert.equal(recording.committedInputs.teams[0].orders.baseline.breakWork,'sit_on');
  assert.equal(validateRecordedTour(recording),true);
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
  const wrongBreak=structuredClone(result);
  wrongBreak.frames[19].breakawayRiderIds.push('foreign');
  assert.throws(()=>validateRecordedTour(wrongBreak),/breakaway|rider state/);
  const wrongRoadGroup=structuredClone(result);
  const firstRoadGroup=wrongRoadGroup.frames.find(frame=>frame.roadGroups.length>0);
  firstRoadGroup.roadGroups[0].id='road-99';
  assert.throws(()=>validateRecordedTour(wrongRoadGroup),/road group/);
  const wrongPull=structuredClone(result);
  wrongPull.frames[19].pullRiderIds=['foreign'];
  assert.throws(()=>validateRecordedTour(wrongPull),/break work/);
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
