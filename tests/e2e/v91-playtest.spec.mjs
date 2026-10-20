import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true',
  'The isolated v91 workbench is disabled.');

test('a rejected race resets the paired comparison before another run',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Scenario seed').fill('comparison-reset');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Conditional finish'}))
      .toBeVisible();
    await expect(page.getByLabel('Paired race comparison')).toHaveCount(0);

    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('20% (m)').fill('2500');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.locator('.v91-error')).toContainText(
      'Choose valid playtest settings.');
    await expect(page.getByRole('heading',{name:'Conditional finish'}))
      .toHaveCount(0);

    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Conditional finish'}))
      .toBeVisible();
    await expect(page.getByLabel('Paired race comparison')).toHaveCount(0);
    await page.getByLabel('Your effort').selectOption('steady');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByLabel('Paired race comparison')).toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('two managers can order paid competing lead-outs in a full race',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2manager');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('0');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Managers with your own tactics').selectOption('1');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Scenario seed').fill('playable-acceptance-1');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    await page.getByLabel('you finisher').selectOption('you-3');
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByLabel('rival-1 finisher').selectOption('rival-1-1');
    await page.getByLabel('rival-1 lead-out helper').selectOption('rival-1-3');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Paid final-kilometre replay'}))
      .toBeVisible();
    await expect(page.getByText('Paid lead-out work: 16 recorded rider intervals.'))
      .toBeVisible();
    await expect(page.getByText(/you-5: 16\.5 energy spent/))
      .toBeVisible();
    await expect(page.getByText(/rival-1-3: 17\.2 energy spent/))
      .toBeVisible();
    const slider=page.getByRole('slider',{name:/Finale interval/});
    await slider.fill(await slider.getAttribute('max'));
    await expect(page.getByText(/you-3: 0\.0 m to go/)).toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

for(const width of [390,1440])test(`v91 playtest changes conditions at ${width}px`,
  async({page,context})=>{
    await page.setViewportSize({width,height:900});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    expect((await context.request.post('http://localhost:3100/api/v91-playtest',{
      headers:{Origin:'http://localhost:3100'},data:{distanceKm:40}})).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(width===390?'alice':'bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await expect(page.getByRole('heading',{name:'Try a fictional race'})).toBeVisible();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByRole('heading',{name:'Recorded race · 40 km rolling'})).toBeVisible();
    await expect(page.getByText(/Kilometre-level v91 diagnostic only/)).toBeVisible();
    const slider=page.getByRole('slider',{name:/Race kilometre/});
    await slider.fill('40');
    await expect(page.getByText('Race kilometre: 40')).toBeVisible();
    await expect(page.locator('.v91-riders > div')).toHaveCount(8);
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByRole('heading',{name:'Recorded race · 120 km exposed'})).toBeVisible();
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('20% (m)').fill('600');
    await page.getByLabel('Rival 1').selectOption('attack');
    await expect(page.getByRole('img',{name:'Your route elevation profile'})).toBeVisible();
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByRole('heading',{name:'Recorded race · 120 km custom'})).toBeVisible();
    await expect(page.getByLabel('Rival 1')).toHaveValue('attack');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Managers with your own tactics').selectOption('4');
    await page.getByLabel('Rival 4 attack').selectOption('repeated');
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByText('4 custom rival managers')).toBeVisible();
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Managers with your own tactics').selectOption('0');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Scenario seed').fill('early-test');
    await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
      .check();
    await page.getByLabel('you finisher').selectOption('you-7');
    await page.getByRole('checkbox',{name:'Show read-only point illustration'})
      .check();
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Conditional finish'}))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid final-kilometre replay'}))
      .toBeVisible();
    await expect(page.getByRole('slider',{name:/Race kilometre/}))
      .toHaveAttribute('max','39');
    await page.getByRole('slider',{name:/Race kilometre/}).fill('39');
    await expect(page.getByText('Race kilometre: 39')).toBeVisible();
    await expect(page.getByText('All 32 riders continue from the locked 39 km handoff on one clock.'))
      .toBeVisible();
    const finaleSlider=page.getByRole('slider',{name:/Finale interval/});
    await finaleSlider.fill(await finaleSlider.getAttribute('max'));
    await expect(page.getByText(/you-7: 0\.0 m to go/)).toBeVisible();
    await expect(page.getByText('All riders have crossed; see the conditional times below.'))
      .toBeVisible();
    await expect(page.getByText('32 of 32 riders have individual crossing times.'))
      .toBeVisible();
    const resultTable=page.getByRole('table',{
      name:'Individual conditional results'});
    await expect(resultTable.getByRole('row')).toHaveCount(33);
    await expect(resultTable.getByRole('row',{name:/you-7/})
      .getByRole('cell',{name:'75',exact:true})).toBeVisible();
    await page.getByLabel('Results team').selectOption('rival-1');
    await expect(resultTable.getByRole('row')).toHaveCount(9);
    await expect(resultTable.getByRole('row',{name:/you-7/})).toHaveCount(0);
    await page.getByLabel('Results team').selectOption('all');
    await expect(resultTable.getByRole('row')).toHaveCount(33);
    await expect(page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/))
      .toBeVisible();
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    await expect(page.getByText('you-7: provisional place 3, 75 preview points.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    await expect(page.getByText('Paid lead-out work: 0 recorded rider intervals.'))
      .toBeVisible();
    const baselineFinisherTime=await page.getByText(
      /Your nominated finisher: you-7 · [\d.]+ s/).textContent();
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByText('Paid lead-out work: 7 recorded rider intervals.'))
      .toBeVisible();
    await expect(page.getByText(/you-5: 16\.5 energy spent/)).toBeVisible();
    await expect(page.getByText('you-7: provisional place 1, 125 preview points.',
      {exact:true}))
      .toBeVisible();
    await expect(resultTable.getByRole('row',{name:/you-7/})
      .getByRole('cell',{name:'125',exact:true})).toBeVisible();
    await expect(page.getByText(
      'Read-only points: you-7: provisional place 3, 75 preview points → you-7: provisional place 1, 125 preview points. Official points: withheld.'))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
      .textContent()).not.toBe(baselineFinisherTime);
    expect(errors).toEqual([]);
  });

test('exposed and custom routes reach their paid full-race replays',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('all');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Recorded race · 40 km exposed'})).toBeVisible();
    await expect(page.getByRole('heading',{
      name:'Paid final-kilometre replay'})).toBeVisible();
    const exposedSlider=page.getByRole('slider',{name:/Finale interval/});
    await exposedSlider.fill(await exposedSlider.getAttribute('max'));
    await expect(page.getByText(/you-7: 0\.0 m to go/)).toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('20% (m)').fill('350');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Recorded race · 120 km custom'})).toBeVisible();
    await expect(page.getByRole('heading',{
      name:'Paid group-local finale'})).toBeVisible();
    await expect(page.getByLabel('Finale road band').locator('option'))
      .toHaveCount(2);
    const customSlider=page.getByRole('slider',{name:/Band interval/});
    await customSlider.fill(await customSlider.getAttribute('max'));
    await expect(page.getByText(/you-7: 0\.0 m to go/)).toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByRole('columnheader',{
      name:'Preview points'})).toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('one rival chase changes an exposed attack in the playable comparison',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Managers with your own tactics').selectOption('1');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Scenario seed').fill('integrated-probe');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    await page.getByLabel('Named attack manager').selectOption('you');
    await page.getByLabel('Named attacking rider').selectOption('you-0');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByText(/Named attack: you-0 · launched at 39 km; solo road, 1 group at 39\.5 km/))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid solo-attack approach'}))
      .toBeVisible();
    const soloTime=await page.getByText(
      /Your nominated finisher: you-7 · [\d.]+ s/).textContent();
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 chase').selectOption('all');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByText(/Named attack: you-0 · launched at 39 km; caught road, 0 group at 39\.5 km/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Attack boundary/}).fill('1');
    await expect(page.getByText(/you-0 was caught at 39\.462 km/))
      .toBeVisible();
    await expect(page.getByText(
      'Named final attack: you-0 (solo road) → you-0 (caught road)'))
      .toBeVisible();
    await expect(page.getByText(/Same finisher time change: -?[\d.]+ s · Energy at line:/))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
      .textContent()).not.toBe(soloTime);
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('a named final-kilometre attack changes the paid road',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('v2manager');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/v91-playtest');
  await page.getByLabel('Distance').selectOption('40');
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('neutral');
  await page.getByLabel('Managers with your own tactics').selectOption('3');
  for(const rival of [1,2,3])await page.getByLabel(`Rival ${rival} chase`)
    .selectOption('ignore');
  await page.getByLabel('Your attack order').selectOption('none');
  await page.getByLabel('Your chase order').selectOption('ignore');
  await page.getByLabel('Scenario seed').fill('integrated-probe');
  await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
    .check();
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByRole('heading',{name:'Conditional finish'}))
    .toBeVisible();
  const baseline=await page.getByText(
    /Your nominated finisher: you-7 · [\d.]+ s/).textContent();
  await page.getByLabel('Named attack manager').selectOption('you');
  await page.getByLabel('Named attacking rider').selectOption('you-0');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByRole('heading',{name:'Conditional finish'}))
    .toBeVisible();
  await expect(page.getByText(/Named attack: you-0 · launched at 39 km; solo road, 1 group at 39\.5 km/))
    .toBeVisible();
  await expect(page.getByRole('heading',{name:'Paid solo-attack approach'}))
    .toBeVisible();
  await expect(page.getByText(/39\.25 km · [\d.]+ s on the bunch clock · 31 in the bunch/))
    .toBeVisible();
  await expect(page.getByText(/you-0: attack · [\d.]+ energy · [\d.]+ spent this segment/))
    .toBeVisible();
  await page.getByRole('slider',{name:/Attack boundary/}).fill('1');
  await expect(page.getByText(/39\.5 km · [\d.]+ s on the bunch clock · 31 in the bunch/))
    .toBeVisible();
  await expect(page.getByText(/you-0: front · [\d.]+ energy · [\d.]+ spent this segment/))
    .toBeVisible();
  await expect(page.getByRole('heading',{
    name:'Previous run on the same conditions'})).toBeVisible();
  await expect(page.getByText('Named final attack: none → you-0 (solo road)'))
    .toBeVisible();
  await expect(page.getByText(/Same finisher time change: -?[\d.]+ s · Energy at line:/))
    .toBeVisible();
  expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
    .textContent()).not.toBe(baseline);
  await expect(page.getByText('32 of 32 riders have individual crossing times.'))
    .toBeVisible();
  await expect(page.getByRole('heading',{
    name:'Paid finale through contact'})).toBeVisible();
  await expect(page.getByText(/Points: withheld/)).toBeVisible();
  await expect(page.getByRole('slider',{name:/Race kilometre/}))
    .toHaveAttribute('max','39');
  await page.getByLabel('Route profile').selectOption('rolling');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByRole('heading',{name:'Recorded race · 40 km rolling'}))
    .toBeVisible();
  await expect(page.getByRole('heading',{
    name:'Previous run on the same conditions'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('passive defaults make a larger-field attack playable without editing every rival',
  async({page})=>{
    await page.setViewportSize({width:390,height:900});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await expect(page.getByLabel('Managers with your own tactics'))
      .toHaveValue('0');
    await page.getByLabel('Scenario seed').fill('integrated-probe');
    await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
      .check();
    await page.getByRole('checkbox',{name:'Show read-only point illustration'})
      .check();
    await page.getByLabel('Named attack manager').selectOption('you');
    await page.getByLabel('Named attacking rider').selectOption('you-0');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Recorded race · 120 km rolling'})).toBeVisible();
    await expect(page.getByText('120 of 120 riders have individual crossing times.'))
      .toBeVisible();
    const largeResults=page.getByRole('table',{
      name:'Individual conditional results'});
    await expect(largeResults.getByRole('row')).toHaveCount(121);
    await expect(largeResults.getByRole('columnheader',{
      name:'Preview points'})).toHaveCount(0);
    await page.getByLabel('Results team').selectOption('you');
    await expect(largeResults.getByRole('row')).toHaveCount(9);
    await page.getByLabel('Results team').selectOption('all');
    await expect(page.getByText(/Named attack: you-0 · launched at 119 km; solo road, 1 group at 119\.5 km/))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid solo-attack approach'}))
      .toBeVisible();
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    const soloCrossing=await page.getByText(
      /Your nominated finisher: you-7 · [\d.]+ s/).textContent();
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByText(/Named attack: you-0 · launched at 119 km; caught road, 0 group at 119\.5 km/))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid named-attack approach'}))
      .toBeVisible();
    await page.getByRole('slider',{name:/Attack boundary/}).fill('1');
    await expect(page.getByText(/you-0 was caught at 119\.438 km/))
      .toBeVisible();
    await expect(page.getByText(/119\.5 km · [\d.]+ s on the bunch clock · 120 in the bunch/))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid final 500 m'}))
      .toBeVisible();
    await expect(page.getByText(/Opening 500 m: groups and energy only/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Finale interval/}).fill('4');
    await expect(page.getByText('All riders have crossed; see the conditional times below.'))
      .toBeVisible();
    await expect(page.getByText('120 of 120 riders have individual crossing times.'))
      .toBeVisible();
    await expect(largeResults.getByRole('row')).toHaveCount(121);
    await expect(page.getByText('No unambiguous individual line.',
      {exact:true}))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    await expect(page.getByText(
      'Named final attack: you-0 (solo road) → you-0 (caught road)'))
      .toBeVisible();
    await expect(page.getByText(
      'Read-only points: unavailable (No unambiguous individual line.) → unavailable (No unambiguous individual line.). Official points: withheld.'))
      .toBeVisible();
    await expect(page.getByText(/Same finisher time change: -?[\d.]+ s · Energy at line:/))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
      .textContent()).not.toBe(soloCrossing);
    const caughtCrossing=await page.getByText(
      /Your nominated finisher: you-7 · [\d.]+ s/).textContent();
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByText('Paid lead-out work: 4 recorded rider intervals.'))
      .toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid final 500 m'}))
      .toBeVisible();
    await expect(page.getByText(
      'Lead-out: none (0.0 energy paid) → you-5 (4.7 energy paid)'))
      .toBeVisible();
    await expect(page.getByText(/Named attack: you-0 · launched at 119 km; caught road/))
      .toBeVisible();
    await expect(page.getByText('120 of 120 riders have individual crossing times.'))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
      .textContent()).not.toBe(caughtCrossing);
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    expect(errors).toEqual([]);
  });

test('a paid lead-out remains visible through an exact late contact',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2manager');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Scenario seed').fill('trial');
    await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
      .check();
    await page.getByLabel('Named attack manager').selectOption('you');
    await page.getByLabel('Named attacking rider').selectOption('you-4');
    await page.getByLabel('you finisher').selectOption('you-6');
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Paid finale through contact'})).toBeVisible();
    await expect(page.getByText(/through the exact catch to the line/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Finale interval/}).fill('5');
    await expect(page.getByText(
      'All riders have crossed; see the conditional times below.'))
      .toBeVisible();
    await expect(page.getByText('32 of 32 riders have individual crossing times.'))
      .toBeVisible();
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    expect(errors).toEqual([]);
  });

test('a surviving group and bunch each replay paid riders to the conditional line',
  async({page})=>{
    test.setTimeout(90_000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
      .check();
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Paid group-local finale'}))
      .toBeVisible();
    await expect(page.getByText(/not one simultaneous road view/))
      .toBeVisible();
    await expect(page.getByLabel('Finale road band')).toHaveValue('road-2');
    await expect(page.getByText(/30 riders pass the 500 m boundary/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Band interval/}).fill('5');
    await expect(page.getByText(/you-7: 0\.0 m to go/)).toBeVisible();
    await expect(page.getByText(
      'Every rider in this group has crossed. The full conditional result is below.'))
      .toBeVisible();
    await page.getByLabel('Finale road band').selectOption('peloton');
    await expect(page.getByText(/90 riders pass the 500 m boundary/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Band interval/}).fill('5');
    await expect(page.getByText(
      'Every rider in this group has crossed. The full conditional result is below.'))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    const before=await page.getByText(
      /Your nominated finisher: you-7 · -?[\d.]+ s/).textContent();
    await page.getByLabel('you lead-out helper').selectOption('you-6');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Paid group-local finale'}))
      .toBeVisible();
    await expect(page.getByText('Paid lead-out work: 4 recorded rider intervals.'))
      .toBeVisible();
    await expect(page.getByText(/you-6: [\d.]+ energy spent/))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · -?[\d.]+ s/)
      .textContent()).not.toBe(before);
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await page.getByLabel('you lead-out helper').selectOption('');
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Recorded race · 260 km mountain'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Paid group-local finale'}))
      .toBeVisible();
    await expect(page.getByLabel('Finale road band').locator('option'))
      .toHaveCount(3);
    await page.getByLabel('Finale road band').selectOption('road-2');
    await expect(page.getByText(/5 riders pass the 500 m boundary/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Band interval/}).fill('5');
    await expect(page.getByText(
      'Every rider in this group has crossed. The full conditional result is below.'))
      .toBeVisible();
    await page.getByLabel('Finale road band').selectOption('road-3');
    await expect(page.getByText(/3 riders pass the 500 m boundary/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Band interval/}).fill('5');
    await expect(page.getByText(
      'Every rider in this group has crossed. The full conditional result is below.'))
      .toBeVisible();
    await page.getByLabel('Finale road band').selectOption('peloton');
    await expect(page.getByText(/24 riders pass the 500 m boundary/))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(
      /A negative time means a front rider crossed before the bunch reached that marker/))
      .toBeVisible();
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    expect(errors).toEqual([]);
  });

test('a dropped rider keeps a separate paid mountain finale',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('settings');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/v91-playtest');
  await page.getByLabel('Distance').selectOption('260');
  await page.getByLabel('Route profile').selectOption('mountain');
  await page.getByLabel('Field size').selectOption('4');
  await page.getByLabel('Starting fatigue').selectOption('30');
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('chase');
  await page.getByLabel('Your attack order').selectOption('none');
  await page.getByLabel('Your chase order').selectOption('all');
  await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
  await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
    .check();
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByRole('heading',{name:'Paid group-local finale'}))
    .toBeVisible();
  await expect(page.getByLabel('Finale road band').locator('option'))
    .toHaveCount(2);
  await page.getByLabel('Finale road band').selectOption('peloton');
  await expect(page.getByText(/31 riders pass the 500 m boundary/))
    .toBeVisible();
  await page.getByLabel('Finale road band')
    .selectOption('isolated:rival-2-0');
  await expect(page.getByText(/1 rider passes the 500 m boundary/))
    .toBeVisible();
  await expect(page.getByRole('slider',{name:/Band interval/}))
    .toHaveAttribute('max','4');
  await page.getByRole('slider',{name:/Band interval/}).fill('4');
  await expect(page.getByText(/rival-2-0: 0\.0 m to go/)).toBeVisible();
  await expect(page.getByText(
    'This isolated rider has crossed. The full conditional result is below.'))
    .toBeVisible();
  await expect(page.getByRole('table',{
    name:'Individual conditional results'}).getByRole('row'))
    .toHaveCount(33);
  await expect(page.getByText(/Points: withheld/)).toBeVisible();
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('mixed');
  await page.getByLabel('Your attack order').selectOption('selective');
  await page.getByLabel('Your chase order').selectOption('selective');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByText(/0\.621 energy demand remains/))
    .toBeVisible();
  await expect(page.getByText(/Isolated riders: rival-1-0, rival-1-2/))
    .toBeVisible();
  await expect(page.getByRole('table',{
    name:'Individual conditional results'})).toHaveCount(0);
  await expect(page.getByText(/Points: withheld/)).toBeVisible();
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('attack');
  await page.getByLabel('Your attack order').selectOption('repeated');
  await page.getByLabel('Your chase order').selectOption('ignore');
  await page.getByLabel('you lead-out helper').selectOption('you-6');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByText(
    'you-6 had too little energy at 500 m; no helper work was charged.'))
    .toBeVisible();
  await expect(page.getByText('Paid lead-out work: 0 recorded rider intervals.'))
    .toBeVisible();
  await expect(page.getByLabel('Finale road band').locator('option'))
    .toHaveCount(3);
  await expect(page.getByRole('table',{
    name:'Individual conditional results'}).getByRole('row'))
    .toHaveCount(33);
  await expect(page.getByText(/Points: withheld/)).toBeVisible();
  await page.getByLabel('Distance').selectOption('40');
  await page.getByLabel('Route profile').selectOption('custom');
  await page.getByLabel('20% (m)').fill('2500');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.locator('.v91-error')).toContainText(
    'Choose valid playtest settings.');
  await expect(page.getByRole('heading',{name:'Conditional finish'}))
    .toHaveCount(0);
  await expect(page.getByRole('table',{
    name:'Individual conditional results'})).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('two managers can attack and inspect their paid double catch',
  async({page})=>{
    test.setTimeout(90_000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2manager');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Managers with your own tactics').selectOption('4');
    await page.getByLabel('Your attack order').selectOption('none');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Rival 1 chase').selectOption('selective');
    await page.getByLabel('Rival 4 chase').selectOption('selective');
    await page.getByRole('checkbox',{name:'Continue to a conditional finish'})
      .check();
    await page.getByLabel('Named attack manager').selectOption('you');
    await page.getByLabel('Named attacking rider').selectOption('you-2');
    await page.getByLabel('Second attack manager').selectOption('rival-2');
    await page.getByLabel('Second attacking rider')
      .selectOption('rival-2-2');
    await page.getByLabel('rival-3 last-kilometre front work')
      .selectOption('rotate');
    await page.getByLabel('Scenario seed').fill('paired-final-orders');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{name:'Paid double-catch finale'}))
      .toBeVisible({timeout:60_000});
    await expect(page.getByText(/2 exact contacts/)).toBeVisible();
    await expect(page.getByText(/rival-2-2: rear attack bunch contact/))
      .toBeVisible();
    await expect(page.getByText(/you-2: front bunch contact/))
      .toBeVisible();
    await expect(page.getByText(/120 of 120 riders have individual crossing times/))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'Individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await page.getByRole('slider',{name:/Paid road boundary/}).fill('4');
    await expect(page.getByText(/bunch: 120 riders at 39\.800 km/))
      .toBeVisible();
    await page.getByRole('slider',{name:/Finale interval/})
      .fill('2');
    await expect(page.getByText('All riders have crossed; see the conditional times below.'))
      .toBeVisible();
    await expect(page.getByText(/Points: withheld/)).toBeVisible();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByRole('button',{name:'Run full race preview'}).click();
    await expect(page.getByRole('heading',{
      name:'Recorded race · 260 km mountain'}))
      .toBeVisible({timeout:60_000});
    await expect(page.getByRole('heading',{name:'Paid double-catch finale'}))
      .toBeVisible({timeout:60_000});
    await expect(page.getByText(/paid until 259\.5 km/)).toBeVisible();
    await expect(page.getByText(/contact observation/)).toBeVisible();
    await expect(page.getByText(/120 of 120 riders have individual crossing times/))
      .toBeVisible();
    expect(errors).toEqual([]);
  });
