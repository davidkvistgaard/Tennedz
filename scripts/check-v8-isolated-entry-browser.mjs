// Submit actual physical entries only to the disposable auth-test project.
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
  for(const name of ['alice','bob']){
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/login`);
    await page.getByLabel('Email or username')
      .fill(fixtures[name].email);
    await page.getByLabel('Password',{exact:true})
      .fill(fixtures[name].password);
    await page.getByRole('button',{name:'Sign in',exact:true})
      .click();
    await page.waitForURL(`${origin}/team`,{timeout:30000});
    await page.goto(`${origin}/team/run?gender=M&event_id=${eventId}`);
    const form=page.getByRole('form',
      {name:'Physical race tactics'});
    await form.waitFor({timeout:30000});
    await page.getByRole('button',
      {name:'Select the first eight'}).click();
    await page.getByRole('button',
      {name:'Choose captain',exact:true}).first().click();
    const options=await form.getByLabel('Road captain')
      .locator('option').evaluateAll(nodes=>nodes.slice(1)
        .map(node=>node.value));
    assert.equal(options.length,8);
    await form.getByLabel('Road captain')
      .selectOption(options[1]);
    await form.getByLabel('Effort').selectOption('conserve');
    await form.getByLabel('Chase').selectOption('selective');
    await form.getByRole('combobox',{name:'Attack',exact:true})
      .selectOption('none');
    await form.getByLabel('Front work').selectOption('rotate');
    await form.locator('fieldset input[type="checkbox"]')
      .first().check();
    await form.getByRole('combobox',
      {name:'Sporting goal',exact:true})
      .selectOption('sprint_finish');
    await form.getByRole('combobox',
      {name:'Rider for sporting goal',exact:true})
      .selectOption(options[0]);
    await form.getByRole('button',
      {name:'Save lineup and race tactics'}).click();
    await form.getByText(
      'Your lineup and physical race orders are saved.')
      .waitFor({timeout:30000});
    const response=await page.request.get(
      `${origin}/api/event/join-physical?event_id=${eventId}`);
    assert.equal(response.status(),200);
    const saved=(await response.json()).entry;
    assert.equal(saved.selected_riders.length,8);
    assert.equal(saved.orders.baseline.effort,'conserve');
    assert.equal(saved.orders.baseline.frontWork,'rotate');
    assert.equal(saved.stake.sportingGoal,'sprint_finish');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({eventId,manager:name,
      selectedRiders:saved.selected_riders.length,
      physicalOrderVersion:saved.orders.version,
      browserErrors:errors.length}));
    await page.close();
  }
}finally{await browser.close();}
