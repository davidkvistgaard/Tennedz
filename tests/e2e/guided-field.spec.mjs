import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { guidedReplayClockV1 } from '../../lib/viewer/guided-replay-clock-v1.mjs';

const eventId = '11111111-1111-4111-8111-111111111160';
const stage = { name: 'Recorded hills', distance_km: 136,
  tags: ['HILLS'], profile_points: [[0, 20], [62, 180], [136, 30]] };

function actualFieldReplay(category) {
  const engine = new URL('../../lib/engine/simulateStage.js', import.meta.url).href;
  const appearance = new URL('../../lib/viewer/recorded-appearance-v1.mjs',
    import.meta.url).href;
  const code = `import {simulateStage} from ${JSON.stringify(engine)};
    import {withRecordedAppearanceV1} from ${JSON.stringify(appearance)};
    import {readFileSync} from 'node:fs';
    const {stage,category}=JSON.parse(readFileSync(0,'utf8'));
    const gender=category==='women'?'F':'M';
    const teams=Array.from({length:20},(_,team)=>({
      id:'team-'+team,name:'Team '+team,
      riders:Array.from({length:8},(_,index)=>({
        id:'rider-'+team+'-'+index,name:'Rider '+team+'-'+index,gender,
        sprint:45+index,flat:50,hills:50,mountain:50,cobbles:50,
        endurance:55,strength:50,wind:50,form:60,fatigue:0}))}));
    const race=simulateStage({stage,teamsWithRiders:teams,
      seed:'guided-browser-'+category});
    const output=withRecordedAppearanceV1({divisions:[{replay:race.replay}]});
    process.stdout.write(JSON.stringify(output.divisions[0].replay));`;
  return JSON.parse(execFileSync(process.execPath,
    ['--input-type=module', '-e', code], { input: JSON.stringify({stage, category}),
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
}

for (const category of ['men', 'women']) {
  test(`recorded ${category} 160-rider field renders through finish in WebGL`,
    async ({ page }) => {
      test.setTimeout(120000);
      await page.setViewportSize({ width: 1440, height: 960 });
      const replay = actualFieldReplay(category);
      let finished = false;
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        const send = json => route.fulfill({ json });
        if (path === '/api/auth/me') return send({ ok: true,
          user: { id: 'field-user' },
          team: { id: 'team-0', name: 'Team 0' }, riders: [] });
        if (path === '/api/game-date') return send({ ok: true,
          game_date: '2026-09-24' });
        if (path === '/api/event-run') {
          const duration = replay.frames.at(-1).elapsed_sec;
          const createdAt = new Date(Date.now() - (finished ?
            Math.ceil(duration * 1000 / 60) + 3000 : 4000)).toISOString();
          return send({ ok: true, team_id: 'team-0',
            run: { event_id: eventId, division_index: 1,
              stage_snapshot: stage, replay, created_at: createdAt },
            viewer_clock: guidedReplayClockV1(duration, createdAt, Date.now()) });
        }
        return send({ ok: true });
      });
      await page.goto(`/team/view/${eventId}`);
      await expect(page.locator('.race-theatre')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.race-theatre-detail-list')).toHaveCount(0);
      const read = async () => JSON.parse(await page.locator(
        '[data-viewer-diagnostics]').getAttribute('data-viewer-diagnostics'));
      await expect.poll(async () => (await read())?.visible,
        { timeout: 20000 }).toBe(160);
      await page.waitForTimeout(4500);
      const observed = await read();
      expect(observed.renderer).toBe('WebGL');
      expect(observed.graphicsBackend?.api).toBe('WebGL2');
      expect(observed.targetAvailable).toBe(true);
      expect(observed.errors).toBe(0);
      expect(observed.fps).toBeGreaterThan(0);
      console.log(`${category} 160-rider WebGL: ${JSON.stringify({
        fps: observed.fps, cpuP50Ms: observed.cpuP50Ms,
        drawCalls: observed.drawCalls, triangles: observed.triangles,
        backend: observed.graphicsBackend?.unmaskedRenderer })}`);
      await page.getByRole('button', { name: 'Race details' }).click();
      await page.locator('.race-theatre-detail-list button').first().click();
      await expect.poll(async () => (await read())?.targetAvailable).toBe(true);
      await page.screenshot({ path: `test-results/guided-${category}-160.png` });
      finished = true;
      await page.reload();
      await expect(page.getByRole('link',
        { name: 'View results and points →' })).toBeVisible({ timeout: 20000 });
      await page.getByRole('button', { name: 'Race details' }).click();
      await page.getByRole('button', { name: 'results', exact: true }).click();
      await expect(page.locator('.race-theatre-details li')).toHaveCount(160);
      if (category === 'women') {
        await page.route('**/viewer-scenery/alpine-spruce-v1.png',
          route => route.abort());
        await page.reload();
        await expect(page.getByText(/scene asset failed to load/))
          .toBeVisible({ timeout: 20000 });
        await expect(page.locator('.race-theatre-canvas canvas'))
          .toBeVisible();
      }
      expect(errors).toEqual([]);
    });
}
