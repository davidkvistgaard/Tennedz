import {test, expect} from '@playwright/test';
import {createMotorLabPreviewSource} from
  '../../lib/engine/v2/preview.mjs';
import {createCheckpointBroadcastSessionV2} from
  '../../lib/viewer/checkpoint-broadcast-session-v2.mjs';

const runInput = {plan: 'sprint', routeId: 'ridge', seed: 1};

test('authenticated full Motor Lab race reaches the new WebGL viewer',
  async ({page, context}) => {
    test.setTimeout(120000);
    await page.setViewportSize({width: 1440, height: 960});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const endpoint = '/api/motor-lab/viewer-run';
    expect((await context.request.post(endpoint, {data: runInput,
      headers: {Origin: 'http://localhost:3100'}})).status()).toBe(401);
    expect((await context.request.get(
      '/api/motor-lab/checkpoint-clock?session=invalid')).status())
      .toBe(401);
    expect((await context.request.post(
      '/api/motor-lab/checkpoint-result', {
        data: {sessionToken: 'invalid'},
        headers: {Origin: 'http://localhost:3100'},
      })).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password').fill('fixture-password');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page).toHaveURL(/\/team$/);
    expect((await context.request.post(endpoint, {data: runInput,
      headers: {Origin: 'https://invalid.example'}})).status()).toBe(403);
    await page.goto('/team/motor-lab/live');
    await expect(page.getByRole('heading',
      {name: 'Generated Motor Lab checkpoint replay'})).toBeVisible();
    await page.getByText('Team orders', {exact: true}).click();
    await page.getByRole('combobox', {name: 'Attack posture'})
      .selectOption('repeated');
    await page.getByRole('combobox', {name: 'Captain’s break attack'})
      .selectOption('40');
    const runResponse = page.waitForResponse(response =>
      new URL(response.url()).pathname === endpoint &&
      response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Generate and watch'}).click();
    const response = await runResponse;
    const submittedInput = response.request().postDataJSON();
    expect(response.status()).toBe(200);
    expect(submittedInput.orders.attackPosture).toBe('repeated');
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.feed.frames).toHaveLength(161);
    expect(body.feed.frames.every(frame => frame.positions.length === 32))
      .toBe(true);
    expect(body.feed.results).toBeUndefined();
    expect(body.sessionToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect((await context.request.get(
      '/api/motor-lab/checkpoint-clock?session=invalid')).status())
      .toBe(400);
    expect((await context.request.post(
      '/api/motor-lab/checkpoint-result', {
        data: {sessionToken: 'invalid'},
        headers: {Origin: 'http://localhost:3100'},
      })).status()).toBe(400);
    const invalidPage = await context.newPage();
    await invalidPage.goto('/team/motor-lab/live?session=invalid');
    await expect(invalidPage.getByRole('alert').filter({hasText: 'shared replay link'}))
      .toContainText('shared replay link is invalid or expired');
    await invalidPage.close();
    expect(Math.abs(body.clock.serverEpochMs - body.serverNowMs))
      .toBeLessThan(5000);
    expect(body.coverage.recordedRiderKilometres).toBe(5120);
    expect(body.coverage.recordedElapsedClock).toBe(false);
    const sharedLink = await page.getByRole('link',
      {name: 'Open this shared replay'}).getAttribute('href');
    const secondPage = await context.newPage();
    const secondResponse = secondPage.waitForResponse(reply =>
      new URL(reply.url()).pathname === endpoint &&
      reply.request().method() === 'POST');
    await secondPage.goto(sharedLink);
    const secondBody = await (await secondResponse).json();
    expect(secondBody.sessionToken).toBe(body.sessionToken);
    expect(secondBody.feed.raceId).toBe(body.feed.raceId);
    expect(secondBody.feed.frames).toEqual(body.feed.frames);
    expect(secondBody.clock.duration).toBe(body.clock.duration);
    expect(secondBody.clock.serverEpochMs).toBe(body.clock.serverEpochMs);
    await secondPage.close();
    const resultResponse = await context.request.post(
      '/api/motor-lab/checkpoint-result', {
        data: {sessionToken: body.sessionToken},
        headers: {Origin: 'http://localhost:3100'},
      });
    expect(resultResponse.status()).toBe(425);
    expect((await resultResponse.json()).results).toBeUndefined();
    const source = createMotorLabPreviewSource(submittedInput);
    const finishedSession = createCheckpointBroadcastSessionV2(source,
      source, Date.now() - body.feed.duration * 1000 - 1000,
      'fixture-service-role');
    const released = await context.request.post(
      '/api/motor-lab/checkpoint-result', {
        data: {sessionToken: finishedSession.token},
        headers: {Origin: 'http://localhost:3100'},
      });
    expect(released.status()).toBe(200);
    expect((await released.json()).results).toHaveLength(32);
    const finishedPage = await context.newPage();
    await finishedPage.goto(`/team/motor-lab/live?session=${
      encodeURIComponent(finishedSession.token)}`);
    await expect(finishedPage.locator('.race-theatre'))
      .toBeVisible({timeout: 30000});
    await finishedPage.getByRole('button', {name: 'Race details'}).click();
    await finishedPage.getByRole('button', {name: 'results', exact: true})
      .click();
    await expect(finishedPage.locator('.race-theatre-details li'))
      .toHaveCount(32, {timeout: 15000});
    await finishedPage.close();
    await expect(page.locator('.race-theatre')).toBeVisible({timeout: 30000});
    await expect(page.getByText(/Playback time is presentation time/))
      .toBeVisible();
    const diagnostics = async () => JSON.parse(await page.locator(
      '[data-viewer-diagnostics]').getAttribute('data-viewer-diagnostics'));
    await expect.poll(async () => (await diagnostics())?.visible,
      {timeout: 30000}).toBe(32);
    await page.waitForTimeout(4000);
    const observed = await diagnostics();
    expect(observed.renderer).toBe('WebGL');
    expect(observed.graphicsBackend?.api).toBe('WebGL2');
    expect(observed.errors).toBe(0);
    expect(observed.fps).toBeGreaterThan(0);
    console.log(`Motor Lab generated WebGL: ${JSON.stringify({
      fps: observed.fps, cpuP50Ms: observed.cpuP50Ms,
      drawCalls: observed.drawCalls,
      backend: observed.graphicsBackend?.unmaskedRenderer})}`);
    await page.route('**/api/motor-lab/checkpoint-clock?*', route =>
      route.fulfill({json: {raceId: body.feed.raceId,
        serverNowMs: Date.now(),
        clock: {position: 0,
          serverEpochMs: Date.now() - 42 * 8 * 1000,
          rate: 1, paused: false, duration: body.feed.duration}}}));
    await expect(page.locator('.race-theatre-group-scroll button').first())
      .toContainText('leaders', {timeout: 15000});
    await expect(page.locator('.race-theatre-group-scroll button').first())
      .toContainText('LEAD');
    const actualBreakMove = createMotorLabPreviewSource(submittedInput)
      .race.frames[40].splitAttacks.find(attack =>
        attack.riderId === 'r-0-0');
    expect(actualBreakMove?.status).toBe('split');
    await expect(page.locator('.race-theatre-commentary'))
      .toContainText('Amber Captain got clear from the break');
    await page.getByRole('button', {name: 'Race details'}).click();
    await page.getByRole('button', {name: 'results', exact: true}).click();
    await expect(page.getByText(/Withheld until the shared checkpoint/))
      .toBeVisible();
    const classification = createMotorLabPreviewSource(submittedInput)
      .race.provisionalResults.map(row => ({riderId: row.riderId,
        position: row.position, gapSeconds: row.gapSeconds}));
    await page.route('**/api/motor-lab/checkpoint-result', route =>
      route.fulfill({json: {ok: true, raceId: body.feed.raceId,
        kind: 'provisional-model-classification', results: classification}}));
    await page.route('**/api/motor-lab/checkpoint-clock?*', route =>
      route.fulfill({json: {raceId: body.feed.raceId,
        serverNowMs: Date.now(),
        clock: {position: body.feed.duration, serverEpochMs: Date.now(),
          rate: 1, paused: true, duration: body.feed.duration}}}));
    await expect(page.locator('.race-theatre-details li'))
      .toHaveCount(32, {timeout: 15000});
    await expect(page.getByText(/Provisional model classification/))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('generated Motor Lab viewer fits a phone and survives an asset failure',
  async ({page}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width: 390, height: 844});
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password').fill('fixture-password');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.route('**/viewer-scenery/alpine-spruce-v1.png', route =>
      route.abort());
    await page.goto('/team/motor-lab/live');
    await page.getByRole('combobox', {name: 'Route'}).selectOption('coast');
    await page.getByRole('button', {name: 'Generate and watch'}).click();
    await expect(page.locator('.race-theatre-canvas canvas'))
      .toBeVisible({timeout: 30000});
    await expect(page.getByText(/scene asset failed to load/))
      .toBeVisible({timeout: 30000});
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', {name: 'Race details'}).click();
    await page.locator('.race-theatre-detail-list button').first().click();
    await page.screenshot({path: 'test-results/motor-lab-live-mobile.png',
      fullPage: true});
  });
