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
  expect(coasted.stageTrace.kilometres).toHaveLength(40);
  const stageCard=page.getByLabel('Stage and orders at km 1');
  await expect(stageCard).toContainText('Stage input at km 1:');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('short climbs may be hidden');
  await expect(stageCard).toContainText('Your active order:');
  await expect(stageCard).toContainText('Recorded this kilometre:');
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

test('guided Motor Lab applies an effort order after a selected 5 km marker', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.getByLabel('Route profile').selectOption('rolling');
  await page.locator('summary').filter({hasText:'Timed effort'}).click();
  await page.getByLabel('Start changing effort after').selectOption('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(coasted.settings.managerTacticalOrdersV2)
    .toEqual([{teamId:'you',atKm:15,effort:'hard'}]);
  await page.getByRole('button',{name:'First km after effort marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('effort markers at km 15 · solid line: viewing km 16');
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-stage-profile.png'});
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
});

test('guided Motor Lab replays two precommitted 5 km effort changes', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.locator('summary').filter({hasText:'Timed effort'}).click();
  await page.getByLabel('Start changing effort after').selectOption('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  await page.getByLabel('Optional second effort change after').selectOption('25');
  await page.getByLabel('Effort after 25 km for you').selectOption('conserve');
  await expect(page.getByLabel('Race plan before running'))
    .toContainText('Hard effort after 15 km');
  await expect(page.getByLabel('Race plan before running'))
    .toContainText('Conserve effort after 25 km');
  await page.getByLabel('Race plan before running').screenshot({
    path:'test-results/guided-two-marker-plan.png'});
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(coasted.settings.managerTacticalOrdersV3).toEqual([
    {teamId:'you',atKm:15,effort:'hard'},
    {teamId:'you',atKm:25,effort:'conserve'},
  ]);
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('effort markers at km 15, 25');
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-two-marker-profile.png'});
  await page.getByRole('button',{name:'First km after effort marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await page.getByRole('button',{name:'First km after effort marker 25'}).click();
  await expect(page.getByLabel('Stage and orders at km 26'))
    .toContainText('Your active order: conserve effort');
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
});
