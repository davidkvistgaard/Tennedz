import {test,expect} from '@playwright/test';

const eventId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const category=process.env.
  PELOTONIA_E2E_POSITION_VIEWER_CATEGORY??'men';

test('protected viewer replays the persisted local game race',
  async({page})=>{
    test.skip(process.env.
      PELOTONIA_E2E_POSITION_VIEWER_PERSISTED!=='true',
    'Requires the isolated file-backed game recording.');
    test.setTimeout(150000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const anonymous=await page.request.get(
      `/api/admin/position-viewer-preview?event_id=${eventId}`);
    expect(anonymous.status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true})
      .fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true})
      .click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/motor-lab/position-viewer');
    await page.getByLabel('Race ID').fill(eventId);
    const [saveResponse]=await Promise.all([
      page.waitForResponse(response=>response.request().method()===
        'POST'&&response.url().endsWith(
          '/api/admin/position-viewer-preview')),
      page.getByRole('button',
        {name:'Record and open viewer'}).click(),
    ]);
    expect(saveResponse.ok()).toBe(true);
    const receipt=await saveResponse.json();
    expect(receipt).toMatchObject({
      ok:true,event_id:eventId,already_recorded:true});
    await expect(page).toHaveURL(new RegExp(
      `/team/motor-lab/position-viewer/${eventId}$`));
    await expect(page.getByRole('heading',
      {name:'Recorded position race'})).toBeVisible();
    await expect(page.getByText('16 riders',
      {exact:false}).first()).toBeVisible();
    await expect(page.locator(
      '.race-theatre-canvas canvas')).toBeVisible();
    await expect.poll(async()=>{
      const raw=await page.locator(
        '[data-viewer-diagnostics]').getAttribute(
          'data-viewer-diagnostics');
      return raw?JSON.parse(raw)?.renderer:null;
    },{timeout:20000}).toBe('WebGL');
    const data=await page.request.get(
      `/api/admin/position-viewer-preview?event_id=${eventId}`);
    await expect.poll(async()=>{
      const response=await page.request.get(
        `/api/admin/position-viewer-preview?event_id=${eventId}`);
      return response.status();
    },{timeout:100000,intervals:[1000]}).toBe(200);
    const document=await (data.ok()?data:
      await page.request.get(
        `/api/admin/position-viewer-preview?event_id=${eventId}`))
      .json();
    expect(document.sha256).toBe(receipt.sha256);
    expect(document.coverage.paidRiderKilometres).toBe(320);
    expect(document.feed.riderCategory).toBe(category);
    expect(document.feed.riders).toHaveLength(16);
    expect(document.feed.frames[0].positions).toHaveLength(16);
    expect(document.feed.frames.at(-1).positions).toHaveLength(16);
    expect(document.feed.results).toBeUndefined();
    const clock=await page.request.get(
      `/api/admin/position-viewer-clock?event_id=${eventId}`);
    expect(clock.ok()).toBe(true);
    const broadcast=await clock.json();
    expect(broadcast.raceId).toBe(document.raceId);
    const elapsed=Math.min(document.feed.duration,Math.max(0,
      (broadcast.serverNowMs-broadcast.clock.serverEpochMs)*
        broadcast.clock.rate/1000));
    expect(broadcast.events.every(event=>
      event.time<=elapsed)).toBe(true);
    await page.getByRole('button',
      {name:'Orbit camera right'}).click();
    await page.getByRole('button',
      {name:'Race details'}).click();
    await page.getByRole('button',
      {name:'route',exact:true}).click();
    await expect(page.getByRole('heading',
      {name:'Measured finish crossings'})).toBeVisible(
        {timeout:70000});
    const diagnostics=JSON.parse(await page.locator(
      '[data-viewer-diagnostics]').getAttribute(
        'data-viewer-diagnostics'));
    expect(diagnostics.graphicsBackend?.api).toBe('WebGL2');
    expect(diagnostics.errors).toBe(0);
    expect(diagnostics.visible).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await test.info().attach('persisted-v7-viewer-diagnostics',{
      body:JSON.stringify(diagnostics,null,2),
      contentType:'application/json'});
  });
