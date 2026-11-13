// Authenticated local browser check against the allowlisted Supabase
// auth-test project. The local Next server must already be running on 3100.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {readTestConfig} from '../tests/support/real-project.mjs';

const eventId=process.argv[2];
if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
  .test(eventId??''))
  throw new Error('Pass the isolated test race UUID.');
readTestConfig();
const fixtures=JSON.parse(readFileSync(new URL(
  '../.recovery-local/real-test-fixtures.json',import.meta.url),
'utf8'));
const browser=await chromium.launch({
  channel:process.platform==='win32'?'msedge':'chromium',
  headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const origin='http://localhost:3100';
  const anonymous=await page.request.get(`${origin}/api/admin/position-viewer-preview?event_id=${eventId}`);
  assert.equal(anonymous.status(),401);
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email or username')
    .fill(fixtures.alice.email);
  await page.getByLabel('Password',{exact:true})
    .fill(fixtures.alice.password);
  await page.getByRole('button',{name:'Sign in',exact:true})
    .click();
  await page.waitForURL(`${origin}/team`,{timeout:30000});
  await page.goto(`${origin}/team/motor-lab/position-viewer/${eventId}`);
  await page.getByRole('heading',
    {name:'Recorded position race'}).waitFor();
  const until=Date.now()+8*60*1000;
  let response;
  while(Date.now()<until){
    response=await page.request.get(
      `${origin}/api/admin/position-viewer-preview?event_id=${eventId}`);
    if(response.status()===200)break;
    assert.equal(response.status(),425);
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.equal(response?.status(),200,
    'The shared race was not published.');
  const document=await response.json();
  assert.equal(document.input.eventId,eventId);
  assert.equal(document.input.officialResults,false);
  assert.equal(document.feed.results,undefined);
  assert.equal(document.feed.riders.length,16);
  assert.equal(document.coverage.paidRiderKilometres,2080);
  await page.reload();
  await page.locator('.race-theatre-canvas canvas')
    .waitFor({timeout:30000});
  await page.waitForFunction(()=>{
    const raw=document.querySelector('[data-viewer-diagnostics]')
      ?.getAttribute('data-viewer-diagnostics');
    return raw&&JSON.parse(raw).renderer==='WebGL';
  },null,{timeout:30000});
  const clockResponse=await page.request.get(
    `${origin}/api/admin/position-viewer-clock?event_id=${eventId}`);
  assert.equal(clockResponse.status(),200);
  const clock=await clockResponse.json();
  assert.equal(clock.raceId,document.raceId);
  assert.equal(clock.recordingPublished,true);
  const elapsed=Math.min(document.feed.duration,Math.max(0,
    (clock.serverNowMs-clock.clock.serverEpochMs)*
      clock.clock.rate/1000));
  assert.ok(clock.events.every(event=>event.time<=elapsed),
    'The broadcast exposed a future event.');
  await page.getByRole('button',
    {name:'Orbit camera right'}).click();
  await page.getByRole('button',{name:'Race details'}).click();
  await page.getByRole('button',{name:'route',exact:true})
    .click();
  await page.getByRole('heading',
    {name:'Measured finish crossings'})
    .waitFor({timeout:240000});
  const diagnostics=JSON.parse(await page.locator(
    '[data-viewer-diagnostics]').getAttribute(
      'data-viewer-diagnostics'));
  assert.equal(diagnostics.graphicsBackend?.api,'WebGL2');
  assert.equal(diagnostics.errors,0);
  assert.ok(diagnostics.visible>0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({eventId,
    source:'real_test_auth_and_hosted_game_recording',
    riderCount:document.feed.riders.length,
    paidRiderKilometres:
      document.coverage.paidRiderKilometres,
    sha256:document.sha256,webgl:diagnostics.renderer,
    graphicsApi:diagnostics.graphicsBackend.api,
    measuredFinishVisible:true,officialResults:false,
    pageErrors:errors.length}));
}finally{await browser.close();}
