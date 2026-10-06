// Retry the final write for an already recorded disposable 45-manager event.
// The guarded cleanup SQL and account cleanup must run even after a failure.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {loadV2SettlementReadiness}
  from '../../lib/race/v2-settlement-readiness.mjs';

const eventId=process.argv[2];
assert.match(eventId??'',/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
const config=JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||
  !config.serviceKey||!config.anonKey)
  throw new Error('Refusing a project outside the isolated test allowlist.');
const teams=JSON.parse(readFileSync(new URL(
  '../../.recovery-local/p02-isolated-teams.json',import.meta.url),'utf8'));
assert.equal(teams.length,45);
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
async function ok(promise){
  const {data,error}=await promise;
  if(error)throw error;
  return data;
}
const event=await ok(db.from('events').select('name,status')
  .eq('id',eventId).single());
assert.equal(event.name,`Disposable v2 browser probe ${eventId.slice(0,8)}`);
assert.equal(event.status,'OPEN');
const entries=await ok(db.from('event_teams').select('team_id')
  .eq('event_id',eventId));
assert.deepEqual(new Set(entries.map(entry=>entry.team_id)),
  new Set(teams.map(team=>team.teamId)));
const reveal=await ok(db.from('recovery_division_reveal_entries')
  .select('team_id,division_index').eq('event_id',eventId));
assert.equal(new Set(reveal.map(row=>row.division_index)).size,3);
const preflight=await loadV2SettlementReadiness(db,eventId);
assert.equal(preflight.ledgerRows.length,60);
const firstDivision=reveal.find(row=>row.team_id===teams[0].teamId)
  .division_index;
const rivalIndex=teams.findIndex(team=>reveal.find(row=>
  row.team_id===team.teamId).division_index!==firstDivision);
assert.ok(rivalIndex>=0);
const browser=await chromium.launch({headless:true,
  channel:process.platform==='win32'?'msedge':undefined});
const contexts=[];
async function manager(index){
  const account=await ok(db.auth.admin.getUserById(teams[index].userId));
  assert.match(account.user.email,/^p02-cron-[a-f0-9-]+@example\.com$/);
  const password=randomBytes(24).toString('base64url');
  await ok(db.auth.admin.updateUserById(teams[index].userId,{password}));
  const context=await browser.newContext({baseURL:'http://localhost:3100'});
  contexts.push(context);
  const page=await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(account.user.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
  return page;
}
try{
  const first=await manager(0);
  const started=performance.now();
  const response=await first.request.post('/api/event/v2-recording/settle',{
    headers:{Origin:'http://localhost:3100'},data:{event_id:eventId},
    timeout:60000});
  console.log(`45-manager settlement returned ${response.status()} in ${
    Math.round(performance.now()-started)} ms.`);
  assert.equal(response.status(),200,await response.text());
  assert.equal((await response.json()).already_settled,false);
  const second=await manager(rivalIndex);
  const retry=await second.request.post('/api/event/v2-recording/settle',{
    headers:{Origin:'http://localhost:3100'},data:{event_id:eventId},
    timeout:60000});
  assert.equal(retry.status(),200,await retry.text());
  assert.equal((await retry.json()).already_settled,true);
  for(const page of [first,second]){
    const viewer=await page.request.get(
      `/api/event/v2-recording/prepare?event_id=${eventId}`);
    assert.equal(viewer.status(),200,await viewer.text());
    assert.equal((await viewer.json()).pointsFinal,true);
    await page.goto(`/team/v2-race/${eventId}`);
    await expect(page.getByText(/PRIVATE V2 FINAL RESULT/))
      .toBeVisible({timeout:30000});
  }
  const awards=await ok(db.from('recovery_ranking_awards')
    .select('award_key,rider_id,team_id,event_id,season_year,gender,calendar_source,event_format,race_tier,result_type,result_place,points,points_policy_version')
    .eq('event_id',eventId));
  const byKey=rows=>rows.sort((a,b)=>a.award_key.localeCompare(b.award_key));
  assert.deepEqual(byKey(awards),byKey(preflight.ledgerRows));
  assert.equal((await ok(db.from('recovery_v2_settlements')
    .select('award_count').eq('event_id',eventId).single())).award_count,60);
  assert.equal((await ok(db.from('events').select('status')
    .eq('id',eventId).single())).status,'FINISHED');
  assert.equal((await ok(db.from('recovery_race_commits')
    .select('event_id').eq('event_id',eventId))).length,0);
  console.log('Three divisions and 60 exact awards settled once; two private final viewers passed.');
}finally{
  await Promise.all(contexts.map(context=>context.close()));
  await browser.close();
  console.log(`Guarded cleanup is required for event ${eventId}.`);
}
