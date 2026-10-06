// Recheck a saved disposable v2 result with both isolated manager accounts.
// Requires the local feature-flagged production server on port 3100.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const eventId=process.argv[2];
assert.match(eventId??'',/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
const config=JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||
  !config.serviceKey||!config.anonKey)
  throw new Error('Refusing a project outside the isolated test allowlist.');
const baseURL='http://localhost:3100';
const fixtureTeams=JSON.parse(readFileSync(
  new URL('../../.recovery-local/p02-isolated-teams.json',import.meta.url),'utf8'));
assert.equal(fixtureTeams.length,2);
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
async function ok(promise){
  const {data,error}=await promise;
  if(error)throw error;
  return data;
}
const event=await ok(db.from('events').select('name,id').eq('id',eventId).single());
assert.ok(['Disposable v2 browser probe',
  `Disposable v2 browser probe ${eventId.slice(0,8)}`].includes(event.name));
const entrants=await ok(db.from('event_teams').select('team_id').eq('event_id',eventId));
assert.deepEqual(new Set(entrants.map(row=>row.team_id)),
  new Set(fixtureTeams.map(team=>team.teamId)));
const browser=await chromium.launch({headless:true,
  channel:process.platform==='win32'?'msedge':undefined});
const contexts=[];
const pageErrors=[];
try{
  for(const team of fixtureTeams){
    const account=await ok(db.auth.admin.getUserById(team.userId));
    assert.match(account.user.email,/^p02-cron-[a-f0-9-]+@example\.com$/);
    const password=randomBytes(24).toString('base64url');
    await ok(db.auth.admin.updateUserById(team.userId,{password}));
    const context=await browser.newContext({baseURL,viewport:{width:1280,height:900}});
    contexts.push(context);
    const page=await context.newPage();
    page.on('pageerror',error=>pageErrors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(account.user.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
    const response=await page.request.get(
      `/api/event/v2-recording/prepare?event_id=${eventId}`);
    assert.equal(response.status(),200,await response.text());
    const projection=await response.json();
    assert.equal(projection.focusTeamId,team.teamId);
    assert.equal(projection.divisionIndex,1);
    assert.equal(projection.recording.committedInputs.teams.length,2);
    assert.equal(projection.settled,false);
    const other=projection.recording.committedInputs.teams
      .find(row=>row.id!==team.teamId);
    assert.deepEqual(Object.keys(other.orders),['captainId']);
    await page.goto(`/team/v2-race/${eventId}`);
    await expect(page.getByText(/PRIVATE V2 RECORDING CANDIDATE/))
      .toBeVisible();
  }
  const parent=await ok(db.from('recovery_v2_recorded_candidates')
    .select('result_contract,contract_header').eq('event_id',eventId).single());
  assert.equal(parent.result_contract,null);
  assert.ok(parent.contract_header);
  assert.equal((await ok(db.from('recovery_v2_recorded_divisions')
    .select('division_index').eq('event_id',eventId))).length,1);
  assert.equal((await ok(db.from('recovery_race_commits').select('event_id')
    .eq('event_id',eventId))).length,0);
  assert.equal((await ok(db.from('recovery_ranking_awards').select('award_key')
    .eq('event_id',eventId))).length,0);
  assert.deepEqual(pageErrors,[]);
  console.log(`Two independent managers read and viewed isolated v2 event ${eventId}; no award was settled.`);
}finally{
  await Promise.all(contexts.map(context=>context.close()));
  await browser.close();
}
