import {test,expect} from '@playwright/test';
const physicalViewerEventId=
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('saved paid game race renders on the shared viewer clock',
  async({page})=>{
    test.skip(process.env.PELOTONIA_E2E_PHYSICAL_VIEWER!==
      'true','Requires the isolated physical recording fixture.');
    test.setTimeout(90000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true})
      .fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true})
      .click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/motor-lab/recorded-viewer');
    await expect(page.getByRole('heading',
      {name:'Record a game race'})).toBeVisible();
    await page.getByLabel('Race ID').fill(physicalViewerEventId);
    await page.getByRole('button',
      {name:'Record and open viewer'}).click();
    await expect(page).toHaveURL(new RegExp(
      `/team/motor-lab/recorded-viewer/${physicalViewerEventId}$`));
    await expect(page.getByRole('heading',
      {name:'Recorded game race'})).toBeVisible();
    const finished=process.env.
      PELOTONIA_E2E_PHYSICAL_VIEWER_FINISHED==='true';
    const riderCount=8*Number(process.env.
      PELOTONIA_E2E_PHYSICAL_VIEWER_TEAMS??2);
    const category=process.env.
      PELOTONIA_E2E_PHYSICAL_VIEWER_CATEGORY??'men';
    if(finished){
      await expect(page.getByText(
        'Saved Motor Lab race · synthetic scenery · unofficial finish'))
        .toBeVisible();
      await expect(page.getByText(new RegExp(
        `${category==='women'?'Women':'Men'} · ${riderCount} riders`)))
        .toBeVisible();
      await expect(page.getByRole('navigation',
        {name:'Race groups'})).toBeVisible();
      await expect(page.locator('.race-theatre-canvas canvas'))
        .toBeVisible();
      await expect.poll(async()=>{
        const raw=await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics');
        return raw?JSON.parse(raw)?.renderer:null;
      },{timeout:15000}).toBe('WebGL');
      await expect.poll(async()=>{
        const raw=await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics');
        return raw?JSON.parse(raw)?.renderedFrames??0:0;
      },{timeout:15000}).toBeGreaterThan(60);
      await expect.poll(async()=>{
        const raw=await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics');
        return raw?JSON.parse(raw)?.crowdCount??0:0;
      },{timeout:15000}).toBeGreaterThan(0);
      const diagnostics=JSON.parse(await page.locator(
        '[data-viewer-diagnostics]').getAttribute(
          'data-viewer-diagnostics'));
      expect(diagnostics.visible).toBe(riderCount);
      expect(diagnostics.errors).toBe(0);
      expect(diagnostics.graphicsBackend?.api).toBe('WebGL2');
      expect(diagnostics.crowdCount).toBeGreaterThan(0);
      if(process.env.PELOTONIA_REQUIRE_HARDWARE_WEBGL==='true')
        expect(diagnostics.graphicsBackend?.unmaskedRenderer??'')
          .not.toMatch(/SwiftShader|llvmpipe|software/i);
      console.log('Recorded game viewer diagnostics:',
        JSON.stringify({category,riderCount,...diagnostics}));
      await test.info().attach('viewer-diagnostics',{
        body:JSON.stringify({category,riderCount,...diagnostics},null,2),
        contentType:'application/json'});
      await expect(page.getByRole('heading',
        {name:'Measured finish crossings'})).toBeVisible(
          {timeout:65000});
      await expect(page.getByText(`All ${riderCount} crossings`))
        .toBeVisible();
      const measuredFinish=page.getByRole('region',
        {name:'Measured Motor Lab finish crossings'});
      await measuredFinish.getByText(`All ${riderCount} crossings`).click();
      await expect(measuredFinish.locator('details[open] li'))
        .toHaveCount(riderCount);
      await expect(measuredFinish.locator('details[open] time'))
        .toHaveCount(riderCount);
    }else{
      await expect(page.getByText(
        'The race feed and measured finish are not available yet.'))
        .toBeVisible();
      await expect(page.locator('.race-theatre-canvas canvas'))
        .toHaveCount(0);
      await expect(page.getByRole('heading',
        {name:'Measured finish crossings'})).toHaveCount(0);
      const response=await page.request.get(
        `/api/admin/physical-viewer-preview?event_id=${
          physicalViewerEventId}`);
      expect(response.status()).toBe(425);
    }
    expect(errors).toEqual([]);
  });
