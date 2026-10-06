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
    await expect(page.getByRole('region',{name:'Road groups'})).toBeVisible();
    if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
      await page.screenshot({path:`.recovery-local/v2-viewer-${viewport.width}.png`,fullPage:true});
    await page.getByRole('button',{name:'Skip 10 km'}).click();
    await expect(page.getByText('Km 11 / 60')).toBeVisible();
    await page.getByRole('button',{name:'Play recording'}).click();
    await expect(page.getByRole('button',{name:'Pause'})).toBeVisible();
    await expect.poll(async()=>Number(await page.getByLabel('Playback position').inputValue()))
      .toBeGreaterThan(10);
    await page.getByRole('button',{name:'Pause'}).click();
    await page.getByLabel('Playback position').fill('59');
    await expect(page.getByRole('region',{name:'Provisional results'}).getByRole('listitem'))
      .toHaveCount(12);
    if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
      await page.screenshot({path:`.recovery-local/v2-viewer-finish-${viewport.width}.png`,fullPage:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>
      document.documentElement.clientWidth),false,'The viewer must fit the viewport.');
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log('Recorded viewer: desktop and 390 px mobile playback passed.');
}finally{await browser.close();}
