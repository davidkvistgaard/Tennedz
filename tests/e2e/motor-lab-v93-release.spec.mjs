import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The guided v93 Motor Lab is disabled.');

test('guided Motor Lab runs a race from setup to rider replay',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await expect(page.getByRole('heading',{name:'Motor Lab: plan a race'}))
    .toBeVisible();
  await page.screenshot({path:'test-results/guided-motor-lab-start.png',
    fullPage:true});
  await expect(page.getByLabel('Distance')).toHaveValue('40');
  await expect(page.getByLabel('Your attack order')).toHaveValue('none');
  await expect(page.getByRole('checkbox',
    {name:'Continue to a conditional finish'})).toHaveCount(0);
  await page.locator('summary').filter({hasText:'Other managers'}).click();
  await expect(page.getByLabel('Default tactics for uncustomized managers'))
    .toBeVisible();
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(coasted.lineTimes).toHaveLength(32);
  expect(coasted.pointPreview.awardRows).toEqual([]);
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
  await expect(page.getByRole('table',
    {name:'V93 individual conditional results'}))
    .toBeVisible();
  await page.getByRole('table',
    {name:'V93 individual conditional results'})
    .getByRole('button',{name:'Replay you-7'}).click();
  await expect(page.getByLabel('Selected rider finale replay'))
    .toContainText('you-7:');
});
