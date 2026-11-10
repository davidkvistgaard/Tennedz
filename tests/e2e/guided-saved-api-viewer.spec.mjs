import {test, expect} from '@playwright/test';
const guidedSavedRunIds = {
  men: '11111111-1111-4111-8111-111111111161',
  women: '11111111-1111-4111-8111-111111111162',
  womenFinished: '11111111-1111-4111-8111-111111111163',
};

test.skip(process.env.PELOTONIA_E2E_GUIDED_SAVED_RUN !== 'true',
  'Run with the saved guided race fixture enabled.');

for (const category of ['men', 'women']) {
  test(`protected saved ${category} race API drives the WebGL viewer`,
    async ({page, context}) => {
      test.setTimeout(90000);
      const eventId = guidedSavedRunIds[category];
      const endpoint = `/api/event-run?event_id=${eventId}`;
      expect((await context.request.get(endpoint)).status()).toBe(401);
      await page.goto('/login');
      await page.getByLabel('Email or username').fill('alice');
      await page.getByLabel('Password').fill('fixture-password');
      await page.getByRole('button', {name: 'Sign in', exact: true}).click();
      await expect(page).toHaveURL(/\/team$/);
      const response = await context.request.get(endpoint);
      expect(response.status()).toBe(200);
      const saved = await response.json();
      expect(saved.run.replay.roster).toHaveLength(32);
      expect(saved.run.replay.roster.every(rider =>
        rider.gender === (category === 'women' ? 'F' : 'M'))).toBe(true);
      expect(saved.run.replay.finish).toHaveLength(32);
      expect(saved.viewer_clock.clock.paused).toBe(false);
      await page.goto(`/team/view/${eventId}`);
      await expect(page.locator('.race-theatre'))
        .toBeVisible({timeout: 30000});
      await expect(page.getByText(/saved race drives this schematic viewer/i))
        .toBeVisible();
      const diagnostics = async () => JSON.parse(await page.locator(
        '[data-viewer-diagnostics]').getAttribute('data-viewer-diagnostics'));
      await expect.poll(async () => (await diagnostics())?.visible,
        {timeout: 30000}).toBe(32);
      const rendering = await diagnostics();
      expect(rendering.renderer).toBe('WebGL');
      expect(rendering.graphicsBackend?.api).toBe('WebGL2');
      await page.getByRole('button', {name: 'Race details'}).click();
      await page.getByRole('button', {name: 'results', exact: true}).click();
      await expect(page.getByText('The official result appears at the recorded finish.'))
        .toBeVisible();
    });
}

test('saved women race publishes source results at the shared finish',
  async ({page, context}) => {
    test.setTimeout(90000);
    const eventId = guidedSavedRunIds.womenFinished;
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password').fill('fixture-password');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const response = await context.request.get(
      `/api/event-run?event_id=${eventId}`);
    expect(response.status()).toBe(200);
    const saved = await response.json();
    expect(saved.viewer_clock.clock.paused).toBe(true);
    await page.goto(`/team/view/${eventId}`);
    await expect(page.locator('.race-theatre'))
      .toBeVisible({timeout: 30000});
    await page.getByRole('button', {name: 'Race details'}).click();
    await page.getByRole('button', {name: 'results', exact: true}).click();
    await expect(page.locator('.race-theatre-details li'))
      .toHaveCount(saved.run.replay.finish.length);
    await expect(page.getByRole('link',
      {name: 'View results and points →'})).toBeVisible();
  });
