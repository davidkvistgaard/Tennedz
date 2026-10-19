import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true',
  'The isolated v91 workbench is disabled.');

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
    await expect(page.getByText('you-7: provisional place 1, 125 preview points.'))
      .toBeVisible();
    expect(await page.getByText(/Your nominated finisher: you-7 · [\d.]+ s/)
      .textContent()).not.toBe(baselineFinisherTime);
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
  await page.getByLabel('Named attack manager').selectOption('you');
  await page.getByLabel('Named attacking rider').selectOption('you-0');
  await page.getByRole('button',{name:'Run full race preview'}).click();
  await expect(page.getByRole('heading',{name:'Conditional finish'}))
    .toBeVisible();
  await expect(page.getByText(/Named attack: you-0 · launched at 39 km; solo road, 1 group at 39\.5 km/))
    .toBeVisible();
  await expect(page.getByText('32 of 32 riders have individual crossing times.'))
    .toBeVisible();
  await expect(page.getByText(/A complete rider-by-rider final-kilometre replay is not available/))
    .toBeVisible();
  await expect(page.getByText(/Points: withheld/)).toBeVisible();
  await expect(page.getByRole('slider',{name:/Race kilometre/}))
    .toHaveAttribute('max','39');
  expect(errors).toEqual([]);
});
