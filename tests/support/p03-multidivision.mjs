// Isolated P03 integration probe. Run after p02-isolated-teams.mjs seed 45.
// Commands: seed, run (with the isolated real-server.mjs --race on :3100), cleanup.
// Always run cleanup here before p02-isolated-teams.mjs cleanup.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {request} from '@playwright/test';
import {defaultOrders} from '../../lib/race/orders.mjs';
import {pointsForDivisionResult,POINT_POLICY_VERSION} from '../../lib/calendar/points.mjs';

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
  const browserEntry=process.argv[3]==='browser';
  if(process.argv[3]&&!browserEntry)throw Error('Use seed or seed browser [count].');
  const browserEntries=browserEntry?Number(process.argv[4]??1):0;
  if((!browserEntry&&process.argv[4])||!Number.isSafeInteger(browserEntries)||
     (browserEntry&&browserEntries<1)||browserEntries>45)
    throw Error('Browser entry count must be an integer from 1 to 45.');
  if(existsSync(fixturePath))throw Error('P03 fixture already exists; clean it before reseeding.');
  if(!existsSync(teamsPath))throw Error('Seed 45 isolated P02 test accounts and teams first.');
  const teams=JSON.parse(readFileSync(teamsPath,'utf8'));
  if(teams.length!==45||teams.some(t=>!t.userId||!t.teamId))
    throw Error('P03 requires exactly 45 separately owned fixture teams.');
  // All probe riders have identical ratings, so seed power ties break by team ID.
  // Spread browser managers across that ordering to exercise separate divisions.
  const rankedTeams=teams.slice().sort((a,b)=>a.teamId.localeCompare(b.teamId));
  const browserTeams=browserEntries>1
    ? Array.from({length:browserEntries},(_,index)=>
      rankedTeams[Math.floor((index+0.5)*teams.length/browserEntries)])
    : teams.slice(0,browserEntries);
  const browserTeamIds=browserTeams.map(team=>team.teamId);
  const fixture={eventId:randomUUID(),riders:[],phase:'initial',browserEntries,browserTeamIds};
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
    status:'OPEN',entry_fee:0,deadline:new Date(Date.now()+8*3600000).toISOString(),
    calendar_source:'PELOTONIA',race_tier:2,scheduled_at:new Date(Date.now()+48*3600000).toISOString()}));
  fixture.phase='event';save(fixture);
  const seededTeams=teams.filter(team=>!browserTeamIds.includes(team.teamId));
  for(let offset=0;offset<seededTeams.length;offset+=4){
    const joined=await Promise.all(seededTeams.slice(offset,offset+4).map(team=>{
      const selected=fixture.riders.filter(r=>r.teamId===team.teamId).map(r=>r.id);
      return db.rpc('recovery_join_event_with_orders',{p_user:team.userId,p_event:fixture.eventId,
        p_riders:selected,p_captain:selected[0],p_orders:defaultOrders(selected,selected[0])});
    }));
    for(const result of joined)if(result.error)throw result.error;
  }
  fixture.phase=browserEntry?'pending-browser':'entered';save(fixture);
  const entries=await ok(db.from('event_teams').select('team_id').eq('event_id',fixture.eventId));
  const receipts=await ok(db.from('recovery_entry_receipts').select('team_id').eq('event_id',fixture.eventId));
  assert.equal(entries.length,seededTeams.length);assert.equal(receipts.length,seededTeams.length);
  console.log(`Seeded ${seededTeams.length} entries for 45 distinct teams and 360 riders in event ${fixture.eventId}.`);
}else if(mode==='failure'){
  if(!existsSync(fixturePath))throw Error('Seed the P03 fixture first.');
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  if(fixture.phase!=='entered')throw Error('The failure probe requires all 45 entries and an unrun event.');
  const team=await ok(db.from('event_teams').select('team_id').eq('event_id',fixture.eventId).limit(1).single());
  const beforeTeam=await ok(db.from('teams').select('rating').eq('id',team.team_id).single());
  const beforeRider=await ok(db.from('riders').select('rating,fatigue,form,injury_until,last_raced_on')
    .eq('id',fixture.riders[0].id).single());
  await ok(db.from('events').update({deadline:new Date(Date.now()-5000).toISOString(),race_tier:null})
    .eq('id',fixture.eventId));
  try{
    const {buildRace}=await import('../../lib/race/cycle.mjs');
    const snapshot=await ok(db.rpc('recovery_race_snapshot',{p_event:fixture.eventId}));
    const output=buildRace(snapshot);
    const rejected=await db.rpc('recovery_finish_race',{p_event:fixture.eventId,
      p_snapshot:snapshot,p_output:output});
    assert.ok(rejected.error,'The award trigger should reject missing scheduled-race metadata.');
    assert.match(rejected.error.message,/Scheduled one-day race lacks valid award metadata/);
    for(const table of ['event_division_runs','event_divisions','event_team_results',
      'event_rider_results','recovery_ranking_awards','recovery_race_commits']){
      const rows=await db.from(table).select('event_id',{count:'exact',head:true}).eq('event_id',fixture.eventId);
      if(rows.error)throw rows.error;
      assert.equal(rows.count,0,`${table} must roll back with the failed award`);
    }
    const event=await ok(db.from('events').select('status').eq('id',fixture.eventId).single());
    const afterTeam=await ok(db.from('teams').select('rating').eq('id',team.team_id).single());
    const afterRider=await ok(db.from('riders').select('rating,fatigue,form,injury_until,last_raced_on')
      .eq('id',fixture.riders[0].id).single());
    assert.equal(event.status,'OPEN');
    assert.deepEqual(afterTeam,beforeTeam);
    assert.deepEqual(afterRider,beforeRider);
    fixture.failureVerified=true;save(fixture);
    console.log('PASS failed award rolled back three divisions, results, rankings and rider/team changes.');
  }finally{
    await ok(db.from('events').update({race_tier:2}).eq('id',fixture.eventId));
  }
}else if(mode==='run'){
  const concurrent=process.argv[3]==='concurrent';
  if(process.argv[3]&&!concurrent)throw Error('Use run or run concurrent.');
  if(!existsSync(fixturePath))throw Error('Seed the P03 fixture first.');
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  if(fixture.phase!=='entered'&&fixture.phase!=='finished')throw Error('P03 entries are incomplete.');
  if(concurrent&&fixture.phase!=='entered')throw Error('The concurrent probe requires an unrun event.');
  const firstRun=fixture.phase==='entered';
  const event=await ok(db.from('events').select('name,status,scheduled_at').eq('id',fixture.eventId).single());
  if(event.name!=='P03 isolated 45-team division probe')throw Error('P03 event identity mismatch.');
  if(event.status==='OPEN')await ok(db.from('events').update({deadline:new Date(Date.now()-5000).toISOString()}).eq('id',fixture.eventId));
  const teamIds=[...new Set(fixture.riders.map(rider=>rider.teamId))];
  const riderIds=fixture.riders.map(rider=>rider.id);
  const teamState=()=>ok(db.from('teams').select('id,rating').in('id',teamIds));
  const riderState=()=>ok(db.from('riders')
    .select('id,rating,fatigue,form,injury_until,last_raced_on').in('id',riderIds));
  const sortState=rows=>rows.slice().sort((a,b)=>a.id.localeCompare(b.id));
  const beforeTeams=await teamState(),beforeRiders=await riderState();
  assert.equal(beforeTeams.length,45);assert.equal(beforeRiders.length,360);
  const authPath=process.env.PELOTONIA_P03_AUTH_FIXTURE;
  if(!authPath)throw Error('Set PELOTONIA_P03_AUTH_FIXTURE for the isolated administrator.');
  const auth=JSON.parse(readFileSync(authPath,'utf8'));
  const client=await request.newContext({baseURL:'http://localhost:3100',
    extraHTTPHeaders:{Origin:'http://localhost:3100'}});
  try{
    const login=await client.post('/api/auth/login',{data:{login_name:auth.alice.email,password:auth.alice.password}});
    assert.equal(login.status(),200,await login.text());
    const requestRace=()=>client.post('/api/admin/run-event',{data:{event_id:fixture.eventId}});
    const attempts=concurrent?await Promise.all([requestRace(),requestRace()]):[await requestRace()];
    const outcomes=[];
    for(const attempt of attempts){
      assert.equal(attempt.status(),200,await attempt.text());
      outcomes.push(await attempt.json());
    }
    assert.ok(outcomes.every(outcome=>outcome.total_divisions===3));
    if(concurrent){
      assert.equal(outcomes.filter(outcome=>outcome.already_finished===false).length,1);
      assert.equal(outcomes.filter(outcome=>outcome.already_finished===true).length,1);
    }
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
    const awards=await ok(db.from('recovery_ranking_awards').select('award_key,rider_id,team_id,event_id,season_year,gender,calendar_source,event_format,race_tier,result_type,result_place,points,points_policy_version').eq('event_id',fixture.eventId));
    const riderResults=await ok(db.from('event_rider_results').select('rider_id,team_id,position,points,multiplier').eq('event_id',fixture.eventId));
    const teamResults=await ok(db.from('event_team_results').select('team_id,points').eq('event_id',fixture.eventId));
    const byRider=new Map(riderResults.map(r=>[r.rider_id,r]));
    const byTeam=new Map(teamResults.map(row=>[row.team_id,row]));
    assert.equal(teamResults.length,45);assert.equal(riderResults.length,360);
    const afterTeams=await teamState(),afterRiders=await riderState();
    const initialTeams=new Map(beforeTeams.map(row=>[row.id,row]));
    const initialRiders=new Map(beforeRiders.map(row=>[row.id,row]));
    for(const row of afterTeams)
      assert.equal(Number(row.rating),Number(initialTeams.get(row.id).rating)+
        (firstRun?Number(byTeam.get(row.id).points):0));
    for(const row of afterRiders)
      assert.equal(Number(row.rating),Number(initialRiders.get(row.id).rating)+
        (firstRun?Number(byRider.get(row.id).points):0));
    assert.equal(awards.length,60);
    assert.equal(new Set(awards.map(a=>a.award_key)).size,60);
    for(const award of awards){
      const result=byRider.get(award.rider_id);
      assert.ok(result);
      assert.equal(award.team_id,result.team_id);
      assert.equal(award.result_place,result.position);
      assert.equal(award.points,pointsForDivisionResult({tier:2,resultType:'ONE_DAY',
        placing:result.position,multiplier:Number(result.multiplier)}));
      assert.equal(award.season_year,Number(event.scheduled_at.slice(0,4)));
      assert.equal(award.gender,'M');assert.equal(award.calendar_source,'PELOTONIA');
      assert.equal(award.event_format,'ONE_DAY');assert.equal(award.race_tier,2);
      assert.equal(award.result_type,'ONE_DAY');assert.equal(award.points_policy_version,POINT_POLICY_VERSION);
    }
    const ranked=await ok(db.rpc('recovery_points_rankings',{p_entity:'team',p_gender:'M',
      p_source:'PELOTONIA',p_format:'ONE_DAY',p_season_year:Number(event.scheduled_at.slice(0,4))}));
    const totals=new Map();
    for(const award of awards)totals.set(award.team_id,(totals.get(award.team_id)??0)+award.points);
    assert.deepEqual(new Map(ranked.map(row=>[row.entity_id,Number(row.points)])),totals);
    const repeat=await client.post('/api/admin/run-event',{data:{event_id:fixture.eventId}});
    assert.equal(repeat.status(),200,await repeat.text());
    assert.equal((await repeat.json()).already_finished,true);
    assert.deepEqual(sortState(await teamState()),sortState(afterTeams));
    assert.deepEqual(sortState(await riderState()),sortState(afterRiders));
    const repeatedAwards=await ok(db.from('recovery_ranking_awards').select('award_key').eq('event_id',fixture.eventId));
    assert.equal(repeatedAwards.length,60);
    const commits=await ok(db.from('recovery_race_commits').select('event_id').eq('event_id',fixture.eventId));
    assert.equal(commits.length,1);
    fixture.phase='finished';save(fixture);
    console.log(`PASS 45 entries, 3 independent divisions, 360 results, 3 replays, 60 ledger awards, 405 checked rating balances and ${concurrent?'concurrent plus sequential':'sequential'} idempotent reruns.`);
  }finally{await client.dispose();}
}else if(mode==='cleanup'){
  if(!existsSync(fixturePath))throw Error('No P03 fixture ledger to clean.');
  const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
  const event=await db.from('events').select('name').eq('id',fixture.eventId).maybeSingle();
  if(event.error)throw event.error;
  if(event.data&&event.data.name!=='P03 isolated 45-team division probe')throw Error('Refusing to remove a different event.');
  for(const table of ['recovery_ranking_awards','event_rider_results','event_team_results','event_divisions',
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
}else throw Error('Use seed, failure, run or cleanup.');
