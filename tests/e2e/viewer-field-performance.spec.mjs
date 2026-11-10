import {test, expect} from '@playwright/test';

test('saved race entry keeps the selected field category', async ({page}) => {
  for (const [category, gender] of [['men', 'M'], ['women', 'F']]) {
    await page.goto(`/viewer?category=${category}`);
    await expect(page.getByRole('link',
      {name: /Watch your saved game race/})).toHaveAttribute('href',
      `/team/run?bucket=finished&gender=${gender}`);
  }
});

for (const category of ['men', 'women'])
  for (const fieldSize of [30, 150])
    test(`${fieldSize} ${category} visual fixture renders on WebGL2`,
      async ({page}) => {
        test.setTimeout(90000);
        await page.setViewportSize({width: 1440, height: 960});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/viewer?mode=exhibition&category=${category}&field=${fieldSize}`);
        await expect(page.getByText('SYNTHETIC EXHIBITION', {exact: true}))
          .toBeVisible({timeout: 30000});
        const read = async () => JSON.parse(await page.locator(
          '[data-viewer-diagnostics]').getAttribute('data-viewer-diagnostics'));
        await expect.poll(async () => (await read())?.visible,
          {timeout: 30000}).toBe(fieldSize);
        await page.waitForTimeout(4000);
        const result = await read();
        expect(result.renderer).toBe('WebGL');
        expect(result.graphicsBackend?.api).toBe('WebGL2');
        expect(result.errors).toBe(0);
        expect(result.fps).toBeGreaterThan(20);
        console.log(`${fieldSize} ${category} visual WebGL: ${JSON.stringify({
          fps: result.fps, cpuP50Ms: result.cpuP50Ms,
          drawCalls: result.drawCalls,
          backend: result.graphicsBackend?.unmaskedRenderer})}`);
        expect(errors).toEqual([]);
      });
