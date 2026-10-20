import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The isolated v93 workbench is disabled.');

test('exhausted v93 road pays two manager lead-outs and shows conditional line',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('cross-route-1');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByLabel('you lead-out helper').selectOption('you-6');
    await page.getByLabel('rival-2 lead-out helper')
      .selectOption('rival-2-5');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.tuningVersion).toBe('v2-prototype-93-candidate');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.leadOutWork.some(row=>row.riderId==='you-6'))
      .toBe(true);
    expect(coasted.leadOutWork.some(row=>row.riderId==='rival-2-5'))
      .toBe(true);
    expect(coasted.pointsStatus).toBe('withheld');
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km flat'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(/Lead-out work:.*you-6/))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    const road=page.getByRole('slider',{name:/Road boundary/});
    await road.fill(await road.getAttribute('max'));
    await expect(page.getByText(/260\.000 km · bunch passage/))
      .toBeVisible();
    await page.getByLabel('you lead-out helper').selectOption('');
    await page.getByLabel('rival-2 lead-out helper').selectOption('');
    const noHelpers=page.waitForResponse(result=>
      result.url().endsWith('/api/v91-playtest')&&
      result.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const unassisted=(await (await noHelpers).json()).coasted;
    expect(unassisted.pointPreview.riders).toHaveLength(32);
    expect(unassisted.pointPreview.awardRows).toEqual([]);
    expect(unassisted.pointPreview.riders.every(row=>
      Number.isFinite(row.previewPoints))).toBe(true);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('attacking v93 road keeps separated front groups in the browser replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-separated-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups.length)
      .toBeGreaterThanOrEqual(2);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toEqual([]);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointsStatus).toBe('withheld');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    expect(errors).toEqual([]);
  });

test('short v93 road pays one front group into the individual line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-single-group-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(39);
    expect(coasted.lastKmRoad.at(-1).groups).toHaveLength(1);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(40000);
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });

test('default short v93 road pays the full bunch without a front group',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Scenario seed').fill('playtest-1');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(40000);
    expect(coasted.bandReplays).toHaveLength(1);
    expect(coasted.bandReplays[0].id).toBe('peloton');
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });
