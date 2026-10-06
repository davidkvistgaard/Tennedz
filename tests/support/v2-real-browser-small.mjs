// Disposable joined browser/database probe for 2, 22 or 45 independent managers.
// Run only with the allowlisted isolated project and a local feature-flagged
// production build. Always clean the printed event with the guarded SQL probe,
// then remove its two accounts with p02-isolated-teams.mjs cleanup.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';
import {loadStoredV2SettlementPreflight}
  from '../../lib/race/v2-settlement-preflight.mjs';

const config=JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||
  !config.serviceKey||!config.anonKey)
  throw new Error('Refusing a project outside the isolated test allowlist.');
const baseURL='http://localhost:3100';
const fixtureTeams=JSON.parse(readFileSync(
  new URL('../../.recovery-local/p02-isolated-teams.json',import.meta.url),'utf8'));
const managerCount=Number(process.argv[2]??2);
assert.ok([2,22,45].includes(managerCount),'Use 2, 22 or 45 managers.');
assert.ok(fixtureTeams.length>=managerCount);
const teams=fixtureTeams.slice(0,managerCount);
assert.equal(new Set(teams.map(team=>team.userId)).size,managerCount);
const db=createClient(config.url,config.serviceKey,
  {auth:{persistSession:false,autoRefreshToken:false}});
const eventId=randomUUID();
const eventName=`Disposable v2 browser probe ${eventId.slice(0,8)}`;
const riders=teams.flatMap((team,teamIndex)=>Array.from({length:8},
  (_,index)=>({id:randomUUID(),teamId:team.teamId,
    name:`V2 browser probe ${eventId.slice(0,8)} ${teamIndex+1}-${index+1}`,
    gender:'M',sprint:60,flat:60,hills:60,mountain:60,cobbles:60,
    timetrial:60,leadership:60,endurance:60,moral:60,luck:60,wind:60,
    form:60,strength:60})));
async function ok(promise){
  const {data,error}=await promise;
  if(error)throw error;
  return data;
}
const browser=await chromium.launch({headless:true,
  channel:process.platform==='win32'?'msedge':undefined});
const browserStates=[];
const pageErrors=[];
async function newManagerPage(index){
  const context=await browser.newContext({baseURL,viewport:{width:1280,height:900},
    ...(browserStates[index]?{storageState:browserStates[index]}:{})});
  const page=await context.newPage();
  page.on('pageerror',error=>pageErrors.push(error.message));
  return page;
}
async function closeManagerPage(index,page){
  browserStates[index]=await page.context().storageState();
  await page.context().close();
}
try{
  const stage=await ok(db.from('stage_profiles').select('id')
    .eq('name','Recovery Flat 130').limit(1).single());
  await ok(db.from('riders').insert(riders.map(({teamId,...rider})=>rider)));
  await ok(db.from('team_riders').insert(riders.map(rider=>({
    team_id:rider.teamId,rider_id:rider.id}))));
  const registration=new Date(Date.now()+3600000).toISOString();
  await ok(db.from('events').insert({id:eventId,name:eventName,kind:'one_day',
    gender:'M',country_code:'FR',stage_profile_id:stage.id,status:'OPEN',
    entry_fee:0,deadline:registration,registration_deadline:registration,
    tactics_deadline:new Date(Date.now()+7200000).toISOString(),
    scheduled_at:new Date(Date.now()+10800000).toISOString(),
    calendar_source:'PELOTONIA',race_tier:2}));
  console.log(`Disposable v2 event: ${eventId}`);
  for(const [index,team] of teams.entries()){
    const account=await ok(db.auth.admin.getUserById(team.userId));
    assert.match(account.user.email,/^p02-cron-[a-f0-9-]+@example\.com$/);
    const password=randomBytes(24).toString('base64url');
    await ok(db.auth.admin.updateUserById(team.userId,{password}));
    const page=await newManagerPage(index);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(account.user.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
    await page.goto('/team/calendar');
    const card=page.locator('article.agenda-card').filter({hasText:eventName});
    await expect(card).toHaveCount(1);
    await card.getByRole('link',{name:/Set up/}).click();
    await page.getByRole('button',{name:'Select the first eight'}).click();
    await page.getByRole('button',{name:'Choose captain',exact:true}).first().click();
    await page.getByRole('button',{name:'Enter team'}).click();
    await expect(page.locator('.form-message[role=status]')).toContainText(
      'Your team is registered.');
    const entry=await ok(db.from('event_teams')
      .select('team_id,captain_id,selected_riders')
      .eq('event_id',eventId).eq('team_id',team.teamId).single());
    assert.equal(entry.team_id,team.teamId);
    assert.equal(entry.selected_riders.length,8);
    await closeManagerPage(index,page);
  }
  const closed=new Date(Date.now()-60000).toISOString();
  await ok(db.from('events').update({deadline:closed,registration_deadline:closed})
    .eq('id',eventId));
  await ok(db.from('recovery_autopilot_jobs')
    .insert({event_id:eventId,status:'COMPLETE'}));
  const reveal=await ok(db.rpc('recovery_commit_division_reveal',
    {p_event:eventId}));
  assert.equal(reveal.assignments.length,managerCount);
  const divisionCounts=Object.values(Object.groupBy(reveal.assignments,
    row=>row.divisionIndex)).map(rows=>rows.length).sort((a,b)=>a-b);
  assert.deepEqual(divisionCounts,managerCount===45?[15,15,15]:
    managerCount===22?[11,11]:[2]);
  for(const [index,team] of teams.entries()){
    const page=await newManagerPage(index);
    await page.goto('/team/calendar');
    const card=page.locator('article.agenda-card').filter({hasText:eventName});
    await expect(card.getByRole('link',{name:/v2 plan/i})).toBeVisible();
    await card.getByRole('link',{name:/v2 plan/i}).click();
    await expect(page.getByRole('heading',{name:'Team roles'})).toBeVisible();
    await page.getByLabel('Race approach').selectOption(index===0?'protect':'aggressive');
    if(index===0)await page.getByLabel('Effort').first().selectOption('hard');
    await page.getByRole('button',{name:'Save private v2 plan'}).click();
    await expect(page.getByText('Private v2 plan saved.',{exact:false})).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Race approach'))
      .toHaveValue(index===0?'protect':'aggressive');
    await closeManagerPage(index,page);
  }
  const drafts=await ok(db.from('recovery_v2_tactics_drafts')
    .select('team_id,orders').eq('event_id',eventId));
  assert.equal(drafts.length,managerCount);
  assert.equal(drafts.find(row=>row.team_id===teams[0].teamId)
    .orders.baseline.effort,'hard');
  await ok(db.from('events').update({
    tactics_deadline:new Date(Date.now()-30000).toISOString()}).eq('id',eventId));
  const starter=await newManagerPage(0);
  const lock=await starter.request.post('/api/event/v2-tactics/prepare',{
    headers:{Origin:baseURL},data:{event_id:eventId}});
  assert.equal(lock.status(),200,await lock.text());
  assert.equal((await lock.json()).already_locked,false);
  await ok(db.from('events').update({
    scheduled_at:new Date(Date.now()-10000).toISOString()}).eq('id',eventId));
  const recordingStarted=performance.now();
  const first=await starter.request.post('/api/event/v2-recording/prepare',{
    headers:{Origin:baseURL},data:{event_id:eventId},timeout:60000});
  console.log(`First v2 recording response: ${first.status()} in ${Math.round(performance.now()-recordingStarted)} ms.`);
  assert.equal(first.status(),200,await first.text());
  assert.equal((await first.json()).already_recorded,false);
  await closeManagerPage(0,starter);
  const repeater=await newManagerPage(1);
  const repeat=await repeater.request.post('/api/event/v2-recording/prepare',{
    headers:{Origin:baseURL},data:{event_id:eventId}});
  assert.equal(repeat.status(),200,await repeat.text());
  assert.equal((await repeat.json()).already_recorded,true);
  await closeManagerPage(1,repeater);
  for(const [index,team] of teams.entries()){
    const page=await newManagerPage(index);
    const response=await page.request.get(
      `/api/event/v2-recording/prepare?event_id=${eventId}`);
    assert.equal(response.status(),200,await response.text());
    const projection=await response.json();
    const ownDivision=reveal.assignments.find(row=>row.teamId===team.teamId)
      .divisionIndex;
    const divisionTeamIds=reveal.assignments.filter(row=>
      row.divisionIndex===ownDivision).map(row=>row.teamId);
    assert.equal(projection.focusTeamId,team.teamId);
    assert.equal(projection.divisionIndex,ownDivision);
    assert.deepEqual(new Set(projection.recording.committedInputs.teams
      .map(row=>row.id)),new Set(divisionTeamIds));
    assert.equal(projection.settled,false);
    const other=projection.recording.committedInputs.teams
      .find(row=>row.id!==team.teamId);
    assert.deepEqual(Object.keys(other.orders),['captainId']);
    await page.goto(`/team/v2-race/${eventId}`);
    await expect(page.getByText(/PRIVATE V2 RECORDING CANDIDATE/))
      .toBeVisible();
    await closeManagerPage(index,page);
  }
  const parent=await ok(db.from('recovery_v2_recorded_candidates')
    .select('result_contract,contract_header').eq('event_id',eventId).single());
  assert.equal(parent.result_contract,null);
  assert.ok(parent.contract_header);
  assert.equal((await ok(db.from('recovery_v2_recorded_divisions')
    .select('division_index').eq('event_id',eventId))).length,divisionCounts.length);
  const savedLock=await ok(db.from('recovery_v2_tactics_commits')
    .select('input_snapshot').eq('event_id',eventId).single());
  const preflight=await loadStoredV2SettlementPreflight(db,savedLock.input_snapshot);
  assert.equal(preflight.eventId,eventId);
  assert.equal(preflight.contract.divisions.length,divisionCounts.length);
  assert.equal(preflight.ledgerRows.length,
    Math.min(managerCount*8,divisionCounts.length*20));
  assert.equal((await ok(db.from('recovery_race_commits').select('event_id')
    .eq('event_id',eventId))).length,0);
  assert.equal((await ok(db.from('recovery_ranking_awards').select('award_key')
    .eq('event_id',eventId))).length,0);
  assert.deepEqual(pageErrors,[]);
  console.log(`${managerCount} real managers completed v2 registration, draft, lock, split recording, private viewer and read-only ${preflight.ledgerRows.length}-row settlement preflight without a final award.`);
}finally{
  await browser.close();
  console.log(`Clean disposable v2 event ${eventId} and its ${8*managerCount} riders with guarded management SQL.`);
}
