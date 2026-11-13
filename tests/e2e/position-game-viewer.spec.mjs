import {test,expect} from '@playwright/test';

const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('saved V7 game race reaches the shared WebGL viewer',
  async({page})=>{
    test.skip(process.env.PELOTONIA_E2E_POSITION_VIEWER!==
      'true','Requires the isolated V7 recording fixture.');
    const teamCount=Number(process.env.
      PELOTONIA_E2E_POSITION_VIEWER_TEAMS??2);
    const category=process.env.
      PELOTONIA_E2E_POSITION_VIEWER_CATEGORY??'men';
    test.setTimeout(teamCount>=15?180000:90000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true})
      .fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true})
      .click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/motor-lab/position-viewer');
    await expect(page.getByRole('heading',
      {name:'Record a position race'})).toBeVisible();
    await page.getByLabel('Race ID').fill(eventId);
    const [saveResponse]=await Promise.all([
      page.waitForResponse(response=>response.request().method()===
        'POST'&&response.url().endsWith(
          '/api/admin/position-viewer-preview'),
      {timeout:teamCount>=15?120000:30000}),
      page.getByRole('button',
        {name:'Record and open viewer'}).click(),
    ]);
    if(!saveResponse.ok())
      throw new Error(`Position save ${saveResponse.status()}: `+
        JSON.stringify(await saveResponse.json()));
    const receipt=await saveResponse.json();
    expect(receipt).toMatchObject({ok:true,
      event_id:eventId,already_recorded:false});
    expect(receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(page).toHaveURL(new RegExp(
      `/team/motor-lab/position-viewer/${eventId}$`),
    {timeout:30000});
    await expect(page.getByRole('heading',
      {name:'Recorded position race'})).toBeVisible();
    const live=process.env.PELOTONIA_E2E_POSITION_VIEWER_LIVE===
      'true';
    const finished=live||process.env.
      PELOTONIA_E2E_POSITION_VIEWER_FINISHED==='true';
    if(finished){
      await expect(page.locator(
        '.motor-viewer-intro span').first()).toContainText(
          category==='women'?'Women':'Men');
      await expect(page.getByText(`${teamCount*8} riders`,
        {exact:false}).first()).toBeVisible();
      await expect(page.locator(
        '.race-theatre-canvas canvas')).toBeVisible();
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
      const diagnostics=JSON.parse(await page.locator(
        '[data-viewer-diagnostics]').getAttribute(
          'data-viewer-diagnostics'));
      expect(diagnostics.visible).toBeGreaterThan(0);
      expect(diagnostics.errors).toBe(0);
      expect(diagnostics.graphicsBackend?.api).toBe('WebGL2');
      if(live){
        const response=await page.request.get(
          `/api/admin/position-viewer-preview?event_id=${eventId}`);
        expect(response.ok()).toBe(true);
        const duration=(await response.json()).feed.duration;
        await expect.poll(async()=>{
          const raw=await page.locator('[data-viewer-diagnostics]')
            .getAttribute('data-viewer-diagnostics');
          const sample=raw?JSON.parse(raw):null;
          return sample?.raceTime>duration*.15&&
            sample.raceTime<duration*.8?
            sample.cameraFocusLagM:null;
        },{timeout:30000,intervals:[250]})
          .toBeLessThan(12);
        await test.info().attach('live-camera-mid-race',{
          body:await page.screenshot(),contentType:'image/png'});
        if(process.env.PELOTONIA_CAMERA_SCREENSHOT_PATH)
          await page.screenshot({path:process.env.
            PELOTONIA_CAMERA_SCREENSHOT_PATH});
      }
      if(process.env.PELOTONIA_REQUIRE_HARDWARE_WEBGL==='true')
        expect(diagnostics.graphicsBackend?.unmaskedRenderer??'')
          .not.toMatch(/SwiftShader|llvmpipe|software/i);
      await page.getByRole('button',{name:'Race details'}).click();
      await page.getByRole('button',{name:'results',exact:true}).click();
      await expect(page.getByText(/Recorded line crossings\. Shared clock observations may tie/))
        .toBeVisible();
      await expect(page.locator(
        '.race-theatre-details .race-theatre-event-list li'))
        .toHaveCount(teamCount*8,{timeout:65000});
      // Once released by the server, finish evidence remains public even
      // when the synchronized replay clock starts its next cycle.
      await expect.poll(async()=>{
        const response=await page.request.get(
          `/api/admin/position-viewer-clock?event_id=${eventId}`);
        expect(response.ok()).toBe(true);
        return (await response.json()).finishPublished;
      },{timeout:25000,intervals:[500]}).toBe(false);
      await expect(page.locator(
        '.race-theatre-details .race-theatre-event-list li'))
        .toHaveCount(teamCount*8);
      await test.info().attach('v7-viewer-diagnostics',{
        body:JSON.stringify(diagnostics,null,2),
        contentType:'application/json'});
    }else{
      await expect(page.getByText(
        'The race feed and measured finish are not available yet.'))
        .toBeVisible();
      await expect(page.locator(
        '.race-theatre-canvas canvas')).toHaveCount(0);
      const response=await page.request.get(
        `/api/admin/position-viewer-preview?event_id=${eventId}`);
      expect(response.status()).toBe(425);
    }
    expect(errors).toEqual([]);
  });
