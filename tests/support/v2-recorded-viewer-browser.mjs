// Focused local production-build check for the isolated recorded-tour viewer.
// Run after `pnpm exec next start -p 3100`.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';

const origin=new URL(process.env.PELOTONIA_LOCAL_BASE_URL??'http://localhost:3100');
if(!['localhost','127.0.0.1'].includes(origin.hostname))
  throw new Error('The recorded viewer probe only runs against a local build.');
const browser=await chromium.launch({headless:true,
  channel:process.platform==='win32'?'msedge':undefined});
const errors=[];
try{
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(new URL('/race-lab/recorded',origin).href);
    await expect(page.getByRole('heading',{name:'Follow the race, kilometre by kilometre'}))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Amber riders'})).toBeVisible();
    await expect(page.getByRole('list',{name:'Teams by captain finish'})).toHaveCount(0);
    await expect(page.getByText(/Projected ranking points for Amber:/)).toHaveCount(0);
    await expect(page.getByText('sample-amber')).toHaveCount(0);
    await expect(page.getByRole('region',{name:'Road groups'})).toBeVisible();
    const orders=page.getByRole('region',{name:'Team orders'});
    await expect(orders.getByRole('heading',{name:'Amber orders'})).toBeVisible();
    await expect(orders.getByText('Active from the start')).toBeVisible();
    await expect(orders.getByText('Amber Captain')).toHaveCount(1);
    await expect(orders.getByText('Amber Rider 2')).toBeVisible();
    await expect(orders.getByText('Conserve')).toBeVisible();
    await page.getByLabel('Watch team').selectOption({label:'Cedar'});
    await expect(page.getByRole('region',{name:'Road groups'})
      .getByText(/Cedar's helpers are working hard at the front/)).toBeVisible();
    await page.getByLabel('Watch team').selectOption({label:'Amber'});
    if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
      await page.screenshot({path:`.recovery-local/v2-viewer-${viewport.width}.png`,fullPage:true});
    await page.getByLabel('Watch team').selectOption({label:'Birch'});
    await expect(page.getByRole('heading',{name:'Birch riders'})).toBeVisible();
    await expect(orders.getByRole('heading',{name:'Birch orders'})).toBeVisible();
    await page.getByLabel('Watch team').selectOption({label:'Amber'});
    await expect(page.getByRole('button',{name:'Previous moment'})).toBeDisabled();
    await page.getByRole('button',{name:'Next moment'}).click();
    assert.ok(Number(await page.getByLabel('Playback position').inputValue())>0);
    const frontNames=await page.getByRole('region',{name:'Road groups'})
      .locator('.tactical-road-group').first().locator('small').innerText();
    const frontTeam=frontNames.split(' ')[0];
    assert.ok(['Amber','Birch','Cedar'].includes(frontTeam));
    await page.getByLabel('Watch team').selectOption({label:frontTeam});
    await expect(page.getByRole('region',{name:'Your riders'}).getByText('Front group'))
      .toBeVisible();
    await page.getByLabel('Watch team').selectOption({label:'Amber'});
    await page.getByLabel('Playback position').fill('0');
    await page.getByRole('button',{name:'Skip 10 km'}).click();
    await expect(page.getByText('Km 11 / 60')).toBeVisible();
    await expect(orders.getByText('Active from the start')).toBeVisible();
    await page.getByLabel('Playback position').fill('20');
    await expect(orders.getByText('Active since km 21')).toBeVisible();
    await expect(orders.getByText('Hard')).toBeVisible();
    await expect(orders.getByText('All')).toBeVisible();
    await expect(orders.getByText('Selective · Amber Rider 5')).toBeVisible();
    await page.getByLabel('Playback position').fill('50');
    await expect(orders.getByText('Active since km 51')).toBeVisible();
    await expect(orders.getByText('Steady')).toBeVisible();
    await page.getByLabel('Playback position').fill('10');
    await page.getByRole('button',{name:'Play recording'}).click();
    await expect(page.getByRole('button',{name:'Pause'})).toBeVisible();
    await expect.poll(async()=>Number(await page.getByLabel('Playback position').inputValue()))
      .toBeGreaterThan(10);
    await page.getByRole('button',{name:'Pause'}).click();
    await page.getByLabel('Playback position').fill('59');
    const finish=page.getByRole('region',{name:'Provisional results'});
    await expect(finish.getByText(/Projected ranking points for Amber:/)).toBeVisible();
    const teamFinish=finish.getByRole('list',{name:'Teams by captain finish'});
    await expect(teamFinish.getByRole('listitem')).toHaveCount(3);
    await expect(teamFinish.getByRole('listitem').first().getByText('+0.0 s'))
      .toBeVisible();
    await expect(finish.getByRole('list',{name:'Amber finish'}).getByRole('listitem'))
      .toHaveCount(8);
    await expect(finish.getByRole('list',{name:'Amber finish'})
      .getByRole('listitem').first().locator('small')).toBeVisible();
    await expect(finish.getByRole('list',{name:'First 12 across the division'})
      .getByRole('listitem')).toHaveCount(12);
    await page.getByLabel('Watch team').selectOption({label:'Birch'});
    await expect(finish.getByRole('list',{name:'Birch finish'}).getByRole('listitem'))
      .toHaveCount(8);
    await expect(finish.getByText('sample-birch')).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Next moment'})).toBeDisabled();
    await page.getByRole('button',{name:'Previous moment'}).click();
    await expect(finish.getByRole('list',{name:'Birch finish'})).toHaveCount(0);
    await page.getByLabel('Playback position').fill('59');
    if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
      await page.screenshot({path:`.recovery-local/v2-viewer-finish-${viewport.width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>
      document.documentElement.clientWidth),false,'The viewer must fit the viewport.');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Recorded viewer: desktop and 390 px mobile playback passed.');
}finally{await browser.close();}
