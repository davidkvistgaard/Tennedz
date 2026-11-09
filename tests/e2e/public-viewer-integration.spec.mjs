import {test,expect} from '@playwright/test';

for(const category of ['men','women'])
  for(const fieldSize of [30,150])
    test(`public visual fixture renders ${fieldSize} ${category} riders`,
      async({page})=>{
        test.setTimeout(60000);
        const errors=[];
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(`/viewer?mode=exhibition&field=${fieldSize}&category=${category}`);
        await expect(page.getByRole('heading',
          {name:'Synthetic visual exhibition'})).toBeVisible();
        await expect(page.getByText('Entire race is fictional')).toBeVisible();
        await expect(page.locator('.race-theatre-canvas canvas'))
          .toBeVisible();
        await expect.poll(async()=>{
          const raw=await page.locator('[data-viewer-diagnostics]')
            .getAttribute('data-viewer-diagnostics');
          return raw?JSON.parse(raw)?.renderer:null;
        },{timeout:15000}).toBe('WebGL');
        const diagnostics=JSON.parse(await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics'));
        expect(diagnostics.visible).toBe(fieldSize);
        expect(diagnostics.errors).toBe(0);
        await page.getByRole('button',{name:'Orbit camera right'}).click();
        await page.getByRole('button',{name:'Race details'}).click();
        await expect(page.getByRole('complementary',
          {name:'Race details'})).toBeVisible();
        expect(errors).toEqual([]);
      });

test('public Motor Lab sample uses a shared event clock',async({page})=>{
  await page.goto('/viewer?category=women');
  await expect(page.getByRole('heading',
    {name:'Saved Motor Lab sample race'})).toBeVisible();
  const response=await page.request.get(
    '/api/viewer-sample-clock?category=women');
  expect(response.ok()).toBe(true);
  const broadcast=await response.json();
  const elapsed=Math.min(broadcast.clock.duration,Math.max(0,
    (broadcast.serverNowMs-broadcast.clock.serverEpochMs)*
      broadcast.clock.rate/1000));
  expect(broadcast.events.every(event=>event.time<=elapsed)).toBe(true);
  await expect(page.locator('.race-theatre-canvas canvas'))
    .toBeVisible();
});

for(const category of ['men','women'])
  test(`split-road ${category} sample renders without claiming a result`,
    async({page})=>{
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(`/viewer?mode=split&category=${category}`);
      await expect(page.getByRole('heading',
        {name:'Saved split-road Motor Lab sample'})).toBeVisible();
      await expect(page.getByText(
        'Immutable Motor Lab test recording · synthetic scenery · no game result'))
        .toBeVisible();
      await expect(page.locator('.race-theatre-canvas canvas'))
        .toBeVisible();
      await expect.poll(async()=>{
        const raw=await page.locator('[data-viewer-diagnostics]')
          .getAttribute('data-viewer-diagnostics');
        return raw?JSON.parse(raw)?.renderer:null;
      },{timeout:15000}).toBe('WebGL');
      const diagnostics=JSON.parse(await page.locator(
        '[data-viewer-diagnostics]').getAttribute(
          'data-viewer-diagnostics'));
      expect(diagnostics.errors).toBe(0);
      expect(errors).toEqual([]);
    });

test('missing synthetic texture reports failure and keeps WebGL',
  async({page})=>{
    await page.goto('/viewer?mode=exhibition&field=30&asset=missing');
    await expect(page.getByText(
      'Fictional fixture · missing texture test')).toBeVisible();
    await expect(page.getByRole('alert').filter({hasText:
      /scene asset.*failed to load/i})).toBeVisible({timeout:15000});
    await expect(page.locator('.race-theatre-canvas canvas'))
      .toBeVisible();
  });
