import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {normalizeOrders,orderAt} from '../../lib/engine/v2/orders.mjs';
import {resolveTacticalKilometre} from '../../lib/engine/v2/tactics.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {SPORTING_SKILLS,sportingSkills,riderKilometreEffect} from '../../lib/engine/v2/physiology.mjs';
import {runKilometreLab} from '../../lib/engine/v2/lab.mjs';
import {flatScenario} from '../../lib/race-lab/scenario.mjs';

const stage={distance_km:40,profile_points:[[0,100],[10,100],[20,300],[30,100],[40,100]],
  surface_segments:[{from_km:12,to_km:15,surface:'cobbles'}],exposed_segments:[{from_km:30,to_km:35}],
  keypoints:[{km:15,kind:'CLIMB'}]};
const riders=Array.from({length:8},(_,i)=>`r${i}`);

test('every kilometre has coherent elevation, terrain, surface and locked-weather variation',()=>{
  const options={seed:'fixed-race',weather:{temp_c:16,wind_kph:22,precipitation_mm:3}};
  const a=buildKilometreRoute(stage,options),b=buildKilometreRoute(stage,options);
  assert.deepEqual(a,b);
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
  assert.deepEqual(orderAt(orders,0),{effort:'conserve',chase:'selective',attack:'none'});
  assert.deepEqual(orderAt(orders,15),{effort:'conserve',chase:'ignore',attack:'none'});
  assert.deepEqual(orderAt(orders,20),{effort:'hard',chase:'all',attack:'none'});
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
  attacker.riders.forEach(r=>{r.strength=20;r.flat=20;r.sprint=20;});
  const smart=resolveTacticalKilometre({teams:[leader,attacker],km:5});
  const late=resolveTacticalKilometre({teams:[weak,attacker],km:5});
  assert.ok(smart.chasePower>late.chasePower);
  assert.ok(smart.energyCosts.some(cost=>cost.reason==='attack'));
  assert.ok(smart.energyCosts.some(cost=>cost.reason==='chase'));
  const depleted={...attacker,energy:Object.fromEntries(attacker.riders.map(r=>[r.id,0]))};
  assert.equal(resolveTacticalKilometre({teams:[leader,depleted],km:10}).attackers.length,0);
});

test('the full tactical trace is deterministic, bounded and makes aggressive orders costly',()=>{
  const input={stage,seed:'tour-1',weather:{temp_c:14,wind_kph:25,precipitation_mm:2},
    teams:[tacticalTeam('attacker','aggressive'),tacticalTeam('defender','protect',{baseline:{chase:'all'}}),tacticalTeam('other','balanced')]};
  const a=simulateTacticalTour(input);
  assert.deepEqual(a,simulateTacticalTour(input));
  assert.equal(a.frames.length,40);
  assert.equal(a.tuningVersion,'v2-prototype-1');
  assert.equal(a.frames.at(-1).km,40);
  assert.ok(a.frames.some(frame=>frame.attackers.length>0));
  assert.ok(a.frames.some(frame=>frame.chasers.length>0));
  assert.ok(a.frames.every(frame=>frame.gapSeconds>=0&&frame.teamEnergy.every(team=>team.mean>=0&&team.mean<=100)));
  assert.ok(a.frames.every(frame=>frame.teamPace.every(team=>Number.isFinite(team.meanAbility))));
  assert.ok(a.frames.at(-1).teamEnergy[0].mean<a.frames.at(-1).teamEnergy[2].mean);
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
