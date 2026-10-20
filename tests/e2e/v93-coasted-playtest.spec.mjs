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
    const ownFinish=page.getByRole('region',{name:'Your v93 finish'});
    const ownLine=coasted.lineTimes.find(row=>row.riderId==='you-4');
    const helperWork=coasted.leadOutWork.filter(row=>
      row.riderId==='you-6').reduce((sum,row)=>sum+row.energySpent,0);
    await expect(ownFinish).toContainText(
      `Nominated finisher: you-4 · ${ownLine.roadBandId}`);
    await expect(ownFinish).toContainText(
      `${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s`);
    await expect(ownFinish).toContainText('Read-only points: unavailable');
    await expect(ownFinish).toContainText(
      `Lead-out helper: you-6 · ${helperWork.toFixed(2)} energy`);
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
    const unassistedPoints=unassisted.pointPreview.riders.find(row=>
      row.riderId==='you-4');
    const unassistedPlace=unassisted.provisionalLineOrder.find(row=>
      row.riderId==='you-4').position;
    await expect(ownFinish).toContainText(
      `Conditional place: ${unassistedPlace} ·`);
    await expect(ownFinish).toContainText(
      `Read-only points: ${unassistedPoints.previewPoints}`);
    await expect(ownFinish).toContainText(
      'Lead-out helper: none · 0.00 energy of recorded work.');
    const comparison=page.getByRole('region',{
      name:'Paired v93 race comparison'});
    await expect(comparison).toContainText(
      'Previous preview on the same conditions');
    await expect(comparison).toContainText(
      `Lead-out: you-6 (${helperWork.toFixed(2)} energy paid) → none (0.00 energy paid)`);
    await expect(comparison).toContainText(
      `Nominated finisher crossing: you-4 ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s → you-4 ${unassisted.lineTimes.find(row=>row.riderId==='you-4').elapsedSecondsFromLastKmStart.toFixed(3)} s`);
    await expect(comparison).toContainText(
      `Read-only points: unavailable (`);
    await expect(comparison).toContainText(
      `${unassistedPoints.previewPoints} (place ${unassistedPlace})`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row',{
      name:new RegExp(`^${unassistedPlace} you-4 `)}))
      .toBeVisible();
    const displayedOrder=await page.getByRole('table',{
      name:'V93 individual conditional results'})
      .locator('tbody tr').evaluateAll(rows=>rows.map(row=>({
        position:Number(row.cells[0].textContent),
        riderId:row.cells[1].textContent})));
    expect(displayedOrder).toEqual(unassisted.provisionalLineOrder
      .map(row=>({position:row.position,riderId:row.riderId})));
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('a changed v93 route does not compare unrelated races',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('v2manager');
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
  await page.getByRole('button',{name:'Run v93 race preview'}).click();
  await expect(page.getByRole('heading',{
    name:'V93 race preview · 40 km flat'})).toBeVisible();
  await page.getByLabel('Distance').selectOption('120');
  await page.getByRole('button',{name:'Run v93 race preview'}).click();
  await expect(page.getByRole('heading',{
    name:'V93 race preview · 120 km flat'})).toBeVisible();
  await expect(page.getByRole('region',{
    name:'Paired v93 race comparison'})).toHaveCount(0);
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

test('a late catch leaves a playable 260 km bunch in the browser',
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
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('0');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('mixed');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('selective');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-2).roadGroups.length)
      .toBeGreaterThan(0);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });

test('a tired no-front road keeps its isolated rider through the browser line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(1);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(1);
    expect(coasted.bandReplays.map(row=>row.id))
      .toEqual(['peloton','isolated:rival-2-0']);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('three isolated riders finish while uncertain points stay withheld',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
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
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('steady');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toHaveLength(3);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(3);
    expect(coasted.bandReplays).toHaveLength(4);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(
      'Point illustration unavailable: Potential road-band contact leaves no defensible point order.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('custom 260 km road carries 15 teams and an isolated nominee to the line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coasted-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toHaveLength(1);
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toHaveLength(6);
    expect(coasted.bandReplays).toHaveLength(8);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.managerDecisions.find(row=>row.teamId==='you'))
      .toMatchObject({finisherId:'you-4',
        roadGroupId:'isolated:you-4'});
    expect(coasted.lineTimes.find(row=>row.riderId==='you-4'))
      .toMatchObject({energyAtLine:0,roadBandId:'isolated:you-4'});
    expect(coasted.pointPreview.riders).toHaveLength(120);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km custom'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('tired 20-team women field finishes an exposed 260 km road',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toEqual([]);
    expect(coasted.bandReplays).toHaveLength(1);
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.pointPreview.riders).toHaveLength(160);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km exposed'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('newly exhausted rider has a solo road replay and withheld points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
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
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(3);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(4);
    expect(coasted.bandReplays).toHaveLength(5);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(
      'Point illustration unavailable: Newly isolated riders have unresolved pre-500 m road contact.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('front leavers pass the bunch while a nominated helper works',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByLabel('rival-1 finisher').selectOption('rival-1-7');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups[0].riderIds)
      .toHaveLength(4);
    expect(coasted.lastKmRoad[0].groups[0].riderIds).toHaveLength(2);
    expect(coasted.lastKmRoad[0].droppedPassages.filter(row=>
      row.contactDistanceM!==null)).toHaveLength(2);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(3);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.leadOutWork.some(row=>row.riderId==='you-5'))
      .toBe(true);
    expect(coasted.lineTimes.find(row=>row.riderId==='rival-1-7'))
      .toMatchObject({roadBandId:'isolated:rival-1-7',energyAtLine:0});
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByText(
      /bunch passed at 259\.032 km/)).toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('15-team custom road replays newly isolated bunch riders beneath two fronts',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-seed-audit-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-active-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups)
      .toHaveLength(2);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(12);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(22);
    expect(coasted.bandReplays).toHaveLength(25);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText(
      'Point illustration unavailable: Newly isolated bunch riders have unresolved pre-500 m road contact.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('one paid front retains a conditional range above new bunch drops',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-active-playtest-1');
    expect(coasted.roadPlaceBounds.bands.map(row=>[
      row.firstPossiblePlace,row.lastPossiblePlace]))
      .toEqual([[1,2],[3,120]]);
    expect(coasted.pointPreview.status).toBe('unavailable');
    const frontId=coasted.roadPlaceBounds.bands[0].riderIds[0];
    const table=page.getByRole('table',{
      name:'V93 individual conditional results'});
    await expect(table.getByRole('row',{
      name:new RegExp(`^1–2 ${frontId} `)})).toBeVisible();
    await expect(page.getByText(
      /The paid front stays separate through the finale/)).toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('flat 15-team road keeps two nominated singleton fronts on the line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
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
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-seed-audit-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-singleton-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups)
      .toHaveLength(2);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(14);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(14);
    expect(coasted.bandReplays).toHaveLength(17);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.managerDecisions.find(row=>row.teamId==='you')
      .finisherId).toBe('you-4');
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText(
      'Point illustration unavailable: Singleton fronts and isolated riders have unresolved road contact.'))
      .toBeVisible();
  });

test('20-team rolling front drops finish ahead as separate solo passages',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('you finisher').selectOption('you-6');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-single-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups[0].riderIds)
      .toHaveLength(40);
    expect(coasted.lastKmRoad[0].groups[0].riderIds)
      .toHaveLength(38);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(2);
    expect(coasted.bandReplays).toHaveLength(4);
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.lineTimes.find(row=>row.riderId==='you-6'))
      .toMatchObject({roadBandId:'isolated:you-6',energyAtLine:0});
    expect(coasted.managerDecisions.find(row=>row.teamId==='you')
      .finisherId).toBe('you-6');
    expect(coasted.pointPreview.status).toBe('unavailable');
    expect(coasted.roadPlaceBounds.bands.map(band=>[
      band.firstPossiblePlace,band.lastPossiblePlace]))
      .toEqual([[1,38],[39,40],[41,160]]);
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('Conditional place: 39–40 · Read-only points: unavailable');
    await expect(page.getByText(/Isolated passages:.*you-6.*ahead of bunch/))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row')
      .filter({hasText:'you-6'}).getByRole('cell').first())
      .toHaveText('39–40');
    const ownLine=coasted.lineTimes.find(row=>row.riderId==='you-6');
    await page.getByRole('button',{name:'Replay you-6'}).click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue('you-6');
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${ownLine.energyAtLine.toFixed(1)} energy.`);
    const bunchRider=coasted.lineTimes.find(row=>
      row.roadBandId==='peloton');
    await page.getByRole('button',{
      name:`Replay ${bunchRider.riderId}`}).click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue(bunchRider.riderId);
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(bunchRider.riderId);
    await expect(page.getByText(
      'Point illustration unavailable: New front drops remain ahead without a resolved road contact order.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('possible isolated-rider contact links both paid replays',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('mixed');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('all');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.pointPreview).toBeNull();
    expect(coasted.potentialRoadContact.riderIds)
      .toEqual(['rival-1-3','rival-1-4']);
    const note=page.getByRole('note',{name:'Potential road contact'});
    await expect(note).toContainText('Potential contact at 259.020 km');
    await expect(note).toContainText('contact and passing remain unresolved');
    for(const id of coasted.potentialRoadContact.riderIds){
      await note.getByRole('button',{
        name:`Inspect contact rider ${id}`}).click();
      await expect(page.getByRole('combobox',{name:'Rider'}))
        .toHaveValue(id);
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(id);
    }
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });
