import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint=`/api/event/v2-tactics?event_id=${eventId}`;

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('entered manager can edit and reload only their own private v2 plan',
  async({browser})=>{
    test.skip(process.env.PELOTONIA_E2E_V2_SAVE!=='true',
      'The isolated v2 tactics fixture must be enabled explicitly.');
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    try{
      const [manager,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
      await signIn(manager,'v2manager');
      await signIn(outsider,'v2outsider');
      await manager.goto(`/team/v2-tactics/${eventId}`);
      await expect(manager.getByRole('heading',{name:'Private v2 tactics fixture'}))
        .toBeVisible();
      await expect(manager.getByText('No private v2 plan saved yet.')).toBeVisible();
      await manager.getByLabel('Race approach').selectOption('protect');
      await manager.getByLabel('Road captain').selectOption('fixture-M-1');
      await manager.getByRole('button',{name:'Add route marker'}).click();
      await expect(manager.getByLabel('Change 1 · at km')).toHaveValue('10');
      await manager.getByRole('button',{name:'Save private v2 plan'}).click();
      await expect(manager.getByText(/Private v2 plan saved/)).toBeVisible();
      const own=await manager.request.get(endpoint);
      expect(own.status(),await own.text()).toBe(200);
      const context=await own.json();
      expect(context).toMatchObject({ok:true,team_id:'team-v2manager',
        division_index:1,editable:true,orders:{version:2,preset:'protect',
          roadCaptainId:'fixture-M-1',phases:[{atKm:10,effort:'hard'}]}});
      expect(JSON.stringify(context)).not.toMatch(/team-v2rival|v2_orders_by_team_id/);
      await manager.reload();
      await expect(manager.getByLabel('Race approach')).toHaveValue('protect');
      await expect(manager.getByLabel('Road captain')).toHaveValue('fixture-M-1');
      await expect(manager.getByLabel('Change 1 · at km')).toHaveValue('10');
      expect((await outsider.request.get(endpoint)).status()).toBe(403);
      expect((await manager.request.get(`${endpoint}&team_id=team-v2outsider`)).status())
        .toBe(403);
      const mobile=await browser.newContext({viewport:{width:390,height:844}});
      contexts.push(mobile);
      const phone=await mobile.newPage();
      await signIn(phone,'v2manager');
      await phone.goto(`/team/v2-tactics/${eventId}`);
      await expect(phone.getByLabel('Race approach')).toHaveValue('protect');
      expect(await phone.evaluate(()=>document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(390);
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
