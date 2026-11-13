// Trigger only the disposable auth-test race through the participant endpoint.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {readTestConfig} from '../tests/support/real-project.mjs';

const eventId=process.argv[2];
if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i
  .test(eventId??''))throw Error('Pass the disposable event UUID.');
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
  await page.goto(`${origin}/login`);
  await page.getByLabel('Email or username')
    .fill(fixtures.alice.email);
  await page.getByLabel('Password',{exact:true})
    .fill(fixtures.alice.password);
  await page.getByRole('button',{name:'Sign in',exact:true})
    .click();
  await page.waitForURL(`${origin}/team`,{timeout:30000});
  const response=await page.request.post(`${origin}/api/event/prepare`,{
    data:{event_id:eventId},headers:{Origin:origin},timeout:300000});
  const body=await response.json();
  assert.equal(response.status(),200,JSON.stringify(body));
  assert.equal(body.viewer_kind,'position');
  const retry=await page.request.post(`${origin}/api/event/prepare`,{
    data:{event_id:eventId},headers:{Origin:origin},timeout:300000});
  const retryBody=await retry.json();
  assert.equal(retry.status(),200,JSON.stringify(retryBody));
  assert.equal(retryBody.already_finished,true);
  console.log(JSON.stringify({eventId,viewerKind:body.viewer_kind,
    retryAlreadyFinished:retryBody.already_finished}));
}finally{await browser.close();}
