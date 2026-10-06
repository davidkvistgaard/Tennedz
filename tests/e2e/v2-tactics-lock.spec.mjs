import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint='/api/event/v2-tactics/prepare';
const headers={Origin:'http://localhost:3100'};

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('an entrant can trigger a private, repeatable v2 lock without seeing rival orders',
  async({browser})=>{
    test.skip(process.env.PELOTONIA_E2E_V2_LOCK!=='true',
      'The isolated v2 lock fixture must be enabled explicitly.');
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    try{
      const [manager,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
      await signIn(manager,'v2manager');
      await signIn(outsider,'v2outsider');
      const request=(page,data)=>page.request.post(endpoint,{
        headers,data:{event_id:eventId,...data}});
      const first=await request(manager,{});
      expect(first.status(),await first.text()).toBe(200);
      const locked=await first.json();
      expect(locked).toMatchObject({ok:true,event_id:eventId,
        division_index:1,already_locked:false});
      expect(locked.locked_at).toBeTruthy();
      expect(JSON.stringify(locked)).not.toMatch(/inputSnapshot|orders|weather/);
      const again=await request(manager,{});
      expect(again.status(),await again.text()).toBe(200);
      expect(await again.json()).toMatchObject({already_locked:true,
        locked_at:locked.locked_at});
      expect((await request(manager,{team_id:'team-v2outsider'})).status()).toBe(403);
      expect((await request(outsider,{})).status()).toBe(403);
      expect((await manager.request.post(endpoint,{
        headers:{Origin:'https://foreign.invalid'},
        data:{event_id:eventId}})).status()).toBe(403);
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
