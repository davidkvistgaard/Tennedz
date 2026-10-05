// Browser probe for the allowlisted, temporary P03 45-team fixture.
// Run after p03-multidivision.mjs seed and with the isolated app on localhost:3100.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
import {chromium,expect} from '@playwright/test';

const configPath=process.env.PELOTONIA_P03_TEST_CONFIG;
const authPath=process.env.PELOTONIA_P03_AUTH_FIXTURE;
if(!configPath||!authPath)throw Error('Set P03 isolated config and auth fixture paths.');
const config=JSON.parse(readFileSync(configPath,'utf8'));
if(config.url!=='https://nxhvaoonnvmvohqaxfdx.supabase.co'||!config.serviceKey||!config.anonKey)
  throw Error('Refusing a project outside the P03 test allowlist.');
const teamPath=new URL('../../.recovery-local/p02-isolated-teams.json',import.meta.url);
const fixturePath=new URL('../../.recovery-local/p03-multidivision.json',import.meta.url);
if(!existsSync(teamPath)||!existsSync(fixturePath))throw Error('Seed the P03 fixture first.');
const teams=JSON.parse(readFileSync(teamPath,'utf8'));
const fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
assert.equal(teams.length,45);
assert.ok(['pending-browser','entered'].includes(fixture.phase));
const db=createClient(config.url,config.serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const browser=await chromium.launch({headless:true,channel:process.platform==='win32'?'msedge':undefined});
const participantCount=fixture.browserEntries||1;
const participantStart=process.argv[2]==='participant';
if(process.argv[2]&&!participantStart)throw Error('Use no argument or participant.');
const browserTeams=(fixture.browserTeamIds||[teams[0].teamId]).map(id=>{
  const team=teams.find(candidate=>candidate.teamId===id);
  if(!team)throw Error('A reserved browser team is missing from the fixture.');
  return team;
});
assert.equal(browserTeams.length,participantCount);
const plans=['breakaway','captain','conserve'];
const pages=[];
const errors=[];
try{
  for(let index=0;index<participantCount;index++){
    const team=browserTeams[index];
    const teamNumber=teams.indexOf(team)+1;
    const account=await db.auth.admin.getUserById(team.userId);
    if(account.error)throw account.error;
    const email=account.data.user.email;
    assert.match(email,/^p02-cron-[a-f0-9-]+@example\.com$/);
    const password=randomBytes(24).toString('base64url');
    const reset=await db.auth.admin.updateUserById(team.userId,{password});
    if(reset.error)throw reset.error;
    const context=await browser.newContext({baseURL:'http://localhost:3100',viewport:{width:1280,height:900}});
    const page=await context.newPage();
    pages.push(page);
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button',{name:/Sign in/}).click();
    await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
    await page.goto('/team/calendar');
    const calendarCard=page.locator('article.agenda-card').filter({
      has:page.getByRole('heading',{name:'P03 isolated 45-team division probe'})});
    await expect(calendarCard).toHaveCount(1);
    await calendarCard.getByRole('link',{name:/Set up/}).click();
    await expect(page).toHaveURL(new RegExp(`/team/run\\?event_id=${fixture.eventId}`));
    await expect(page.getByRole('heading',{name:'Your lineup'})).toBeVisible();
    if(fixture.phase==='pending-browser'){
      await expect(page.getByRole('button',{name:'Enter team'})).toBeDisabled();
      await page.getByRole('button',{name:'Select the first eight'}).click();
      await page.getByRole('button',{name:'Choose captain',exact:true}).first().click();
      await expect(page.getByRole('button',{name:'Enter team'})).toBeEnabled();
    }
    const plan=plans[index%plans.length];
    await expect(page.getByLabel('Team plan')).toHaveValue('balanced');
    await page.getByLabel('Team plan').selectOption(plan);
    await page.getByLabel(`Effort for P03 probe ${teamNumber}-2`).selectOption('aggressive');
    await page.getByRole('button',{name:fixture.phase==='pending-browser'?'Enter team':'Save changes'}).click();
    await expect(page.getByText('Your team is entered. You can change your lineup and orders until the deadline.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Team plan')).toHaveValue(plan);
    await expect(page.getByLabel(`Effort for P03 probe ${teamNumber}-2`)).toHaveValue('aggressive');
    const saved=await db.from('event_teams').select('captain_id,orders').eq('event_id',fixture.eventId).eq('team_id',team.teamId).single();
    if(saved.error)throw saved.error;
    assert.equal(saved.data.orders.plan,plan);
    assert.equal(saved.data.orders.riders[saved.data.captain_id].role,'captain');
    const orderedRiders=fixture.riders.filter(r=>r.teamId===team.teamId);
    assert.equal(saved.data.orders.riders[orderedRiders[1].id].effort,'aggressive');
    await page.getByRole('link',{name:/Back to race calendar/}).click();
    await page.getByRole('button',{name:'My races'}).click();
    const ownCard=page.locator('article.agenda-card').filter({
      has:page.getByRole('heading',{name:'P03 isolated 45-team division probe'})});
    await expect(ownCard).toHaveCount(1);
    await expect(ownCard.locator('.agenda-readiness')).toContainText('8/8');
    await expect(ownCard.locator('.agenda-readiness')).toContainText('Orders Ready');
    await ownCard.getByRole('link',{name:/Set up/}).click();
    await expect(page.getByRole('heading',{name:'Your lineup'})).toBeVisible();
    if(fixture.phase==='pending-browser'){
      const entries=await db.from('event_teams').select('team_id').eq('event_id',fixture.eventId);
      if(entries.error)throw entries.error;
      const receipts=await db.from('recovery_entry_receipts').select('team_id').eq('event_id',fixture.eventId);
      if(receipts.error)throw receipts.error;
      const expected=45-participantCount+index+1;
      assert.equal(entries.data.length,expected);
      assert.equal(receipts.data.length,expected);
      assert.equal(entries.data.filter(entry=>entry.team_id===team.teamId).length,1);
    }
  }
  if(fixture.phase==='pending-browser'){
    fixture.phase='entered';
    writeFileSync(fixturePath,JSON.stringify(fixture,null,2));
  }

  if(participantStart){
    const cutoff=await db.from('events').update({deadline:new Date(Date.now()-5000).toISOString()})
      .eq('id',fixture.eventId);
    if(cutoff.error)throw cutoff.error;
    const firstPage=pages[0];
    await firstPage.reload();
    await expect(firstPage.getByRole('heading',{name:'Your lineup is locked'})).toBeVisible();
    const preparation=firstPage.waitForResponse(response=>
      response.url().includes('/api/event/prepare')&&response.request().method()==='POST');
    await firstPage.getByRole('link',{name:/Watch the race/}).first().click();
    const prepared=await preparation;
    assert.equal(prepared.status(),200,await prepared.text());
    assert.equal((await prepared.json()).already_finished,false);
    await expect(firstPage.getByRole('heading',{name:'Race commentary'})).toBeVisible();
    const commits=await db.from('recovery_race_commits').select('event_id').eq('event_id',fixture.eventId);
    if(commits.error)throw commits.error;
    assert.equal(commits.data.length,1);
    fixture.phase='finished';
    writeFileSync(fixturePath,JSON.stringify(fixture,null,2));
  }

  execFileSync(process.execPath,[fileURLToPath(new URL('./p03-multidivision.mjs',import.meta.url)),'run'],
    {env:process.env,stdio:'pipe',timeout:120000});
  const memberships=await db.from('event_divisions').select('team_id,division_index')
    .eq('event_id',fixture.eventId).in('team_id',browserTeams.map(team=>team.teamId));
  if(memberships.error)throw memberships.error;
  assert.equal(memberships.data.length,participantCount);
  const divisionByTeam=new Map(memberships.data.map(row=>[row.team_id,Number(row.division_index)]));
  if(participantCount===3)assert.equal(new Set(divisionByTeam.values()).size,3);
  for(let index=0;index<pages.length;index++){
    const page=pages[index],team=browserTeams[index];
    const ownDivision=divisionByTeam.get(team.teamId);
    const divisionApi=await page.context().request.get(`/api/event/divisions?event_id=${fixture.eventId}`);
    assert.equal(divisionApi.status(),200,await divisionApi.text());
    const divisionList=await divisionApi.json();
    assert.equal(divisionList.my_division,ownDivision);
    assert.deepEqual(divisionList.divisions.map(row=>row.team_count),[15,15,15]);
    if(index===0){
      const invalid=await page.context().request.get('/api/event/divisions?event_id=invalid');
      assert.equal(invalid.status(),400);
      assert.equal((await invalid.json()).code,'INVALID_ID');
      const otherTeam=browserTeams.find(other=>other.teamId!==team.teamId);
      if(otherTeam){
        const foreign=await page.context().request.get(
          `/api/event/divisions?event_id=${fixture.eventId}&team_id=${otherTeam.teamId}`);
        assert.equal(foreign.status(),403);
        assert.equal((await foreign.json()).code,'ACCESS_DENIED');
      }
    }
    if(participantStart&&index===0)
      await page.goto(`/team/run?event_id=${fixture.eventId}`);
    else await page.reload();
    await expect(page.getByRole('heading',{name:'The race is ready'})).toBeVisible();
    const replayRequest=page.waitForResponse(response=>response.url().includes('/api/event-run?')&&response.status()===200);
    await page.getByRole('link',{name:/Watch the race/}).first().click();
    const replay=(await (await replayRequest).json()).run;
    assert.equal(Number(replay.division_index),ownDivision);
    assert.ok(replay.replay.roster.some(rider=>rider.team_id===team.teamId));
    for(const other of browserTeams.filter(other=>other.teamId!==team.teamId))
      if(divisionByTeam.get(other.teamId)!==ownDivision)
        assert.ok(!replay.replay.roster.some(rider=>rider.team_id===other.teamId));
    await expect(page.getByRole('heading',{name:'Race commentary'})).toBeVisible();
    await page.getByRole('slider',{name:'Playback position'}).focus();
    await page.keyboard.press('End');
    await expect(page.getByText('The race is decided',{exact:true})).toBeVisible();
    const resultsRequest=page.waitForResponse(response=>response.url().includes('/api/event/results?')&&response.status()===200);
    await page.getByRole('link',{name:/View results and rating gains/}).click();
    const results=await (await resultsRequest).json();
    const ownResult=results.teams.find(row=>row.team_id===team.teamId);
    assert.ok(ownResult);
    for(const other of browserTeams.filter(other=>other.teamId!==team.teamId))
      if(divisionByTeam.get(other.teamId)!==ownDivision)
        assert.ok(!results.teams.some(row=>row.team_id===other.teamId));
    await expect(page.getByRole('heading',{name:'Team results'})).toBeVisible();
    await expect(page.getByLabel('Results division')).toContainText('your team');
    await expect(page.getByLabel('Results division')).toHaveValue(String(ownDivision));
    const storedTeamResult=await db.from('event_team_results').select('points')
      .eq('event_id',fixture.eventId).eq('team_id',team.teamId).single();
    if(storedTeamResult.error)throw storedTeamResult.error;
    assert.equal(Number(ownResult.points),Number(storedTeamResult.data.points));
    await expect(page.locator('.result-summary').getByText('Team rating gain')).toBeVisible();
    await expect(page.locator('.result-summary div').filter({hasText:'Team rating gain'}).locator('strong'))
      .toHaveText(`+${ownResult.points}`);
    await expect(page.locator('.results-table').first().locator('tr.own-result td').nth(3))
      .toHaveText(String(ownResult.points));
    const ownRider=results.riders.find(row=>row.team_id===team.teamId);
    assert.ok(ownRider);
    const storedRiderResult=await db.from('event_rider_results').select('points')
      .eq('event_id',fixture.eventId).eq('rider_id',ownRider.rider_id).single();
    if(storedRiderResult.error)throw storedRiderResult.error;
    assert.equal(Number(ownRider.points),Number(storedRiderResult.data.points));
    await expect(page.locator('.results-table').nth(1).locator('tr.own-result').first().locator('td').nth(4))
      .toHaveText(String(ownRider.points));
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS isolated browser: ${participantCount} separate manager sessions, lineups and orders, 45-team ${participantStart?'participant-started':'admin-started'} run, own replays and division results (${new Set(divisionByTeam.values()).size} divisions).`);
}finally{
  await browser.close();
}
