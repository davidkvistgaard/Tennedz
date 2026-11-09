import {test,expect} from '@playwright/test';

const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('signed-in non-admin sees a paid race without private inputs',
  async({page})=>{
    test.skip(process.env.PELOTONIA_E2E_PHYSICAL_VIEWER!==
      'true','Requires the isolated physical recording fixture.');
    test.setTimeout(90000);
    const errors=[];
    const increments=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{
      if(response.ok()&&response.url().includes(
          '/api/event/physical-viewer-frames?'))
        response.json().then(payload=>{
          if(payload.frames?.length)increments.push(payload);
        }).catch(error=>errors.push(error.message));
    });
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true})
      .fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true})
      .click();
    await expect(page).toHaveURL(/\/team$/);
    const clock=await page.request.get(
      `/api/event/physical-viewer-clock?event_id=${eventId}`);
    expect(clock.ok()).toBe(true);
    const state=await clock.json();
    expect(state.raceId).toContain(eventId);
    expect(state.events.every(event=>event.time<=
      Math.min(state.clock.duration,Math.max(0,
        (state.serverNowMs-state.clock.serverEpochMs)*
          state.clock.rate/1000)))).toBe(true);
    await page.goto(`/team/race-viewer/${eventId}`);
    await expect(page.getByRole('heading',
      {name:'Recorded game race'})).toBeVisible();
    if(process.env.PELOTONIA_E2E_PHYSICAL_VIEWER_FINISHED===
        'true'){
      await expect(page.locator('.race-theatre-canvas canvas'))
        .toBeVisible({timeout:20000});
      await expect.poll(async()=>{
        const raw=await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics');
        return raw?JSON.parse(raw)?.renderer:null;
      },{timeout:20000}).toBe('WebGL');
      const html=await page.content();
      expect(html).not.toContain('physicalSourceVersion');
      expect(html).not.toContain('seedProvenance');
      expect(html).not.toContain('finishEvidence');
      if(process.env.PELOTONIA_E2E_PHYSICAL_VIEWER_STREAM===
          'true'){
        await page.getByRole('button',
          {name:'Orbit camera left'}).click();
        await expect.poll(async()=>{
          const raw=await page.locator(
            '[data-viewer-diagnostics]').getAttribute(
              'data-viewer-diagnostics');
          return raw?JSON.parse(raw)?.cameraYaw:null;
        }).toBeLessThan(-0.4);
        await expect.poll(()=>increments.length,
          {timeout:20000}).toBeGreaterThan(0);
        const reached=increments.at(-1);
        expect(reached.frames.every(frame=>
          frame.time<=reached.elapsed)).toBe(true);
        expect(JSON.stringify(reached)).not.toContain('source');
        await expect.poll(async()=>{
          const stage=page.locator('.race-theatre');
          const cycle=Number(await stage.getAttribute(
            'data-cycle-epoch'));
          const rendered=Number(await stage.getAttribute(
            'data-rendered-through'));
          return cycle===reached.cycleEpochMs&&
            rendered>=reached.availableThrough;
        },{timeout:10000}).toBe(true);
        const camera=JSON.parse(await page.locator(
          '[data-viewer-diagnostics]').getAttribute(
            'data-viewer-diagnostics'));
        expect(camera.cameraYaw).toBeLessThan(-0.4);
        await expect(page.getByRole('heading',
          {name:'Measured finish crossings'}))
          .toBeVisible({timeout:50000});
        await expect(page.getByText('All 16 crossings'))
          .toBeVisible();
      }
    }else{
      await expect(page.getByText(
        'The race feed and measured finish are not available yet.'))
        .toBeVisible();
      const finish=await page.request.get(
        `/api/event/physical-viewer-finish?event_id=${eventId}`);
      expect(finish.status()).toBe(425);
    }
    expect(errors).toEqual([]);
  });
