import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint='/api/event/v2-recording/prepare';
const headers={Origin:'http://localhost:3100'};

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('two entrants share one private recorded v2 candidate without exposing results',
  async({browser})=>{
    test.skip(process.env.PELOTONIA_E2E_V2_RECORDING!=='true',
      'The isolated v2 recording fixture must be enabled explicitly.');
    const contexts=await Promise.all(Array.from({length:3},()=>browser.newContext()));
    try{
      const [manager,rival,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
      await Promise.all([signIn(manager,'v2manager'),signIn(rival,'v2rival'),
        signIn(outsider,'v2outsider')]);
      const request=(page,data)=>page.request.post(endpoint,{
        headers,data:{event_id:eventId,...data}});
      const first=await request(manager,{});
      expect(first.status(),await first.text()).toBe(200);
      const saved=await first.json();
      expect(saved).toMatchObject({ok:true,event_id:eventId,
        division_index:1,already_recorded:false});
      expect(saved.recorded_at).toBeTruthy();
      expect(JSON.stringify(saved)).not.toMatch(/recording|resultContract|awards|riderResults/);
      const second=await request(rival,{});
      expect(second.status(),await second.text()).toBe(200);
      expect(await second.json()).toMatchObject({already_recorded:true,
        recorded_at:saved.recorded_at});
      expect((await request(outsider,{})).status()).toBe(403);
      expect((await request(manager,{team_id:'team-v2rival'})).status()).toBe(403);
      expect((await manager.request.post(endpoint,{
        headers:{Origin:'https://foreign.invalid'},
        data:{event_id:eventId}})).status()).toBe(403);
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
