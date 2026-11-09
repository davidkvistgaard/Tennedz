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
    await page.goto(`/team/motor-lab/recorded-viewer/${
      physicalViewerEventId}`);
    await expect(page.getByRole('heading',
      {name:'Recorded game race'})).toBeVisible();
    const finished=process.env.
      PELOTONIA_E2E_PHYSICAL_VIEWER_FINISHED==='true';
    if(finished){
      await expect(page.getByText(
        'Saved Motor Lab race · synthetic scenery · unofficial finish'))
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
      await expect(page.getByRole('heading',
        {name:'Measured finish crossings'})).toBeVisible(
          {timeout:65000});
      await expect(page.getByText('All 16 crossings'))
        .toBeVisible();
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
