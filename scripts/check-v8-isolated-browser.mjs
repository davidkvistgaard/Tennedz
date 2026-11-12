// End-to-end browser check on the disposable auth-test project only.
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
const origin='http://localhost:3100';
const browser=await chromium.launch({
  channel:process.platform==='win32'?'msedge':'chromium',
  headless:true});
try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const anonymous=await page.request.get(
    `${origin}/api/event/position-race-clock?event_id=${eventId}`);
  assert.equal(anonymous.status(),401);
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email or username')
    .fill(fixtures.alice.email);
  await page.getByLabel('Password',{exact:true})
    .fill(fixtures.alice.password);
  await page.getByRole('button',{name:'Sign in',exact:true})
    .click();
  await page.waitForURL(`${origin}/team`,{timeout:30000});
  await page.goto(`${origin}/team/view/${eventId}`);
  await page.waitForURL(
    `${origin}/team/motor-lab/position-viewer/${eventId}`,
    {timeout:30000});
  const until=Date.now()+7*60*1000;
  while(Date.now()<until){
    const heading=await page.getByRole('heading',
      {name:'Recorded position race'}).count();
    if(heading)break;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
  try{await page.locator('.race-theatre-canvas canvas')
    .waitFor({timeout:30000});}
  catch(error){
    console.error(JSON.stringify({url:page.url(),
      viewerText:(await page.locator('main').allTextContents())
        .join(' ').slice(0,1000),pageErrors:errors}));
    throw error;
  }
  await page.waitForFunction(()=>{
    const raw=document.querySelector('[data-viewer-diagnostics]')
      ?.getAttribute('data-viewer-diagnostics');
    return raw&&JSON.parse(raw).renderer==='WebGL';
  },null,{timeout:30000});
  const clockResponse=await page.request.get(
    `${origin}/api/event/position-race-clock?event_id=${eventId}`);
  assert.equal(clockResponse.status(),200);
  const clock=await clockResponse.json();
  const elapsed=Math.min(clock.clock.duration,Math.max(0,
    (clock.serverNowMs-clock.clock.serverEpochMs)*
      clock.clock.rate/1000));
  assert.ok(clock.events.every(event=>event.time<=elapsed));
  await page.getByRole('button',
    {name:'Orbit camera right'}).click();
  await page.getByRole('button',{name:'Race details'}).click();
  await page.getByRole('button',{name:'route',exact:true})
    .click();
  await page.getByRole('button',{name:'results',exact:true})
    .click();
  const finishDeadline=Date.now()+6*60*1000;
  while(Date.now()<finishDeadline){
    if(await page.getByText('Recorded line crossings.',
      {exact:false}).count()&&
      await page.locator('.race-theatre-event-list li').count()>=16)
      break;
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  assert.equal(await page.locator(
    '.race-theatre-event-list li').count(),16);
  const diagnostics=JSON.parse(await page.locator(
    '[data-viewer-diagnostics]').getAttribute(
      'data-viewer-diagnostics'));
  assert.equal(diagnostics.graphicsBackend?.api,'WebGL2');
  assert.equal(diagnostics.errors,0);
  assert.ok(diagnostics.visible>0);
  assert.deepEqual(errors,[]);
  await page.goto(`${origin}/team/results/${eventId}`);
  await page.getByRole('heading',{name:'Watch the recorded finish'})
    .waitFor({timeout:30000});
  assert.equal(await page.getByText(
    'Official placings and points are not available for this',
    {exact:false}).count(),1);
  assert.equal(await page.getByRole('button',
    {name:'Reveal the result now'}).count(),0);
  console.log(JSON.stringify({eventId,
    source:'disposable_auth_test_position_race',
    webgl:diagnostics.renderer,
    graphicsApi:diagnostics.graphicsBackend.api,
    graphicsRenderer:
      diagnostics.graphicsBackend.unmaskedRenderer??
      diagnostics.graphicsBackend.renderer,
    visibleRiders:diagnostics.visible,
    fps:diagnostics.fps,
    finishCrossings:16,
    pageErrors:errors.length}));
}finally{await browser.close();}
