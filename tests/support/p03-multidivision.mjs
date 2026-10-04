// Isolated P03 integration probe. Run after p02-isolated-teams.mjs seed 45.
// Commands: seed, run (with the isolated real-server.mjs --race on :3100), cleanup.
// Always run cleanup here before p02-isolated-teams.mjs cleanup.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {request} from '@playwright/test';
import {defaultOrders} from '../../lib/race/orders.mjs';

const configPath=process.env.PELOTONIA_P03_TEST_CONFIG;
if(!configPath)throw Error('Set PELOTONIA_P03_TEST_CONFIG to the isolated project config.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey||!config.anonKey)
  throw Error('Refusing a project outside the P03 test allowlist.');
const db=createClient(config.url,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const teamsPath=new URL('../../.recovery-local/p02-isolated-teams.json',import.meta.url);
const fixturePath=new URL('../../.recovery-local/p03-multidivision.json',import.meta.url);
const mode=process.argv[2];
const save=fixture=>writeFileSync(fixturePath,JSON.stringify(fixture,null,2));
async function ok(query){const result=await query;if(result.error)throw result.error;return result.data;}

if(mode==='seed'){
  if(existsSync(fixturePath))throw Error('P03 fixture already exists; clean it before reseeding.');
  if(!existsSync(teamsPath))throw Error('Seed 45 isolated P02 test accounts and teams first.');
  const teams=JSON.parse(readFileSync(teamsPath,'utf8'));
  if(teams.length!==45||teams.some(t=>!t.userId||!t.teamId))
    throw Error('P03 requires exactly 45 separately owned fixture teams.');
  const fixture={eventId:randomUUID(),riders:[],phase:'initial'};
  save(fixture);
  const riders=teams.flatMap((team,index)=>Array.from({length:8},(_,riderIndex)=>{
    const id=randomUUID();
    fixture.riders.push({id,teamId:team.teamId});
    return {id,name:`P03 probe ${index+1}-${riderIndex+1}`,gender:'M',
      sprint:40,flat:40,hills:40,mountain:40,cobbles:40,timetrial:40,
      leadership:40,endurance:40,moral:40,luck:40,wind:40,form:50,strength:40};
  }));
  save(fixture);
  await ok(db.from('riders').insert(riders));
  fixture.phase='riders';save(fixture);
  await ok(db.from('team_riders').insert(fixture.riders.map(r=>({team_id:r.teamId,rider_id:r.id}))));
  fixture.phase='rosters';save(fixture);
  const stage=await ok(db.from('stage_profiles').select('id').eq('name','Recovery Flat 130').limit(1).single());
  await ok(db.from('events').insert({id:fixture.eventId,name:'P03 isolated 45-team division probe',
    kind:'one_day',gender:'M',country_code:'FR',stage_profile_id:stage.id,
    status:'OPEN',entry_fee:0,deadline:new Date(Date.now()+8*3600000).toISOString()}));
  fixture.phase='event';save(fixture);
  for(let offset=0;offset<teams.length;offset+=4){
    const joined=await Promise.all(teams.slice(offset,offset+4).map(team=>{
      const selected=fixture.riders.filter(r=>r.teamId===team.teamId).map(r=>r.id);
      return db.rpc('recovery_join_event_with_orders',{p_user:team.userId,p_event:fixture.eventId,
        p_riders:selected,p_captain:selected[0],p_orders:defaultOrders(selected,selected[0])});
    }));
    for(const result of joined)if(result.error)throw result.error;
  }
  fixture.phase='entered';save(fixture);
  const entries=await ok(db.from('event_teams').select('team_id').eq('event_id',fixture.eventId));
  const receipts=await ok(db.from('recovery_entry_receipts').select('team_id').eq('event_id',fixture.eventId));
  assert.equal(entries.length,45);assert.equal(receipts.length,45);
  console.log(`Seeded 45 distinct teams and 360 riders for event ${fixture.eventId}.`);
}else if(mode==='run'){
  if(!existsSync(fixturePath))throw Error('Seed the P03 fixture first.');
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  if(fixture.phase!=='entered'&&fixture.phase!=='finished')throw Error('P03 entries are incomplete.');
  const event=await ok(db.from('events').select('name,status').eq('id',fixture.eventId).single());
  if(event.name!=='P03 isolated 45-team division probe')throw Error('P03 event identity mismatch.');
  if(event.status==='OPEN')await ok(db.from('events').update({deadline:new Date(Date.now()-5000).toISOString()}).eq('id',fixture.eventId));
  const authPath=process.env.PELOTONIA_P03_AUTH_FIXTURE;
  if(!authPath)throw Error('Set PELOTONIA_P03_AUTH_FIXTURE for the isolated administrator.');
  const auth=JSON.parse(readFileSync(authPath,'utf8'));
  const client=await request.newContext({baseURL:'http://localhost:3100',
    extraHTTPHeaders:{Origin:'http://localhost:3100'}});
  try{
    const login=await client.post('/api/auth/login',{data:{login_name:auth.alice.email,password:auth.alice.password}});
    assert.equal(login.status(),200,await login.text());
    const first=await client.post('/api/admin/run-event',{data:{event_id:fixture.eventId}});
    assert.equal(first.status(),200,await first.text());
    assert.equal((await first.json()).total_divisions,3);
    const divisionResponse=await client.get(`/api/event/divisions?event_id=${fixture.eventId}`);
    assert.equal(divisionResponse.status(),200);
    const divisions=await divisionResponse.json();
    assert.deepEqual(divisions.divisions.map(d=>d.team_count),[15,15,15]);
    const allTeams=new Set(),allRiders=new Set(),replayTeams=new Set();
    for(const division of [1,2,3]){
      const resultResponse=await client.get(`/api/event/results?event_id=${fixture.eventId}&division_index=${division}`);
      assert.equal(resultResponse.status(),200);
      const result=await resultResponse.json();
      assert.equal(result.teams.length,15);assert.equal(result.riders.length,120);
      const replayResponse=await client.get(`/api/event-run?event_id=${fixture.eventId}&division_index=${division}`);
      assert.equal(replayResponse.status(),200);
      const replay=(await replayResponse.json()).run.replay;
      assert.equal(replay.version,1);assert.equal(replay.roster.length,120);
      assert.deepEqual(new Set(replay.roster.map(r=>r.id)),new Set(result.riders.map(r=>r.rider_id)));
      for(const team of result.teams){assert.ok(!allTeams.has(team.team_id));allTeams.add(team.team_id);}
      for(const rider of result.riders){assert.ok(!allRiders.has(rider.rider_id));allRiders.add(rider.rider_id);}
      for(const rider of replay.roster)replayTeams.add(rider.team_id);
    }
    assert.equal(allTeams.size,45);assert.equal(allRiders.size,360);assert.equal(replayTeams.size,45);
    const repeat=await client.post('/api/admin/run-event',{data:{event_id:fixture.eventId}});
    assert.equal(repeat.status(),200,await repeat.text());
    assert.equal((await repeat.json()).already_finished,true);
    const commits=await ok(db.from('recovery_race_commits').select('event_id').eq('event_id',fixture.eventId));
    assert.equal(commits.length,1);
    fixture.phase='finished';save(fixture);
    console.log('PASS 45 entries, 3 independent 15-team divisions, 360 results, 3 persisted replays and idempotent API rerun.');
  }finally{await client.dispose();}
}else if(mode==='cleanup'){
  if(!existsSync(fixturePath))throw Error('No P03 fixture ledger to clean.');
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  const event=await db.from('events').select('name').eq('id',fixture.eventId).maybeSingle();
  if(event.error)throw event.error;
  if(event.data&&event.data.name!=='P03 isolated 45-team division probe')throw Error('Refusing to remove a different event.');
  for(const table of ['event_rider_results','event_team_results','event_divisions',
    'event_division_runs','recovery_race_commits','recovery_entry_receipts','event_teams'])
    await ok(db.from(table).delete().eq('event_id',fixture.eventId));
  if(event.data)await ok(db.from('events').delete().eq('id',fixture.eventId));
  const ids=fixture.riders.map(r=>r.id);
  if(ids.length){
    await ok(db.from('team_riders').delete().in('rider_id',ids));
    await ok(db.from('riders').delete().in('id',ids));
  }
  unlinkSync(fixturePath);
  console.log('Removed P03 event, results, receipts and 360 riders. Clean the 45 accounts with p02-isolated-teams.mjs cleanup.');
}else throw Error('Use seed, run or cleanup.');
