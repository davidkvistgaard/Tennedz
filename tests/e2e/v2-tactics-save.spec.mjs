import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const selected=Array.from({length:8},(_,index)=>`fixture-M-${index}`);
const orders={captainId:selected[0],helperIds:[selected[1]],preset:'protect',
  phases:[{atKm:10,effort:'hard',attackRiderId:selected[2]}]};
const headers={Origin:'http://localhost:3100'};

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('only the entered manager can repeatedly save a private v2 draft',async({browser})=>{
  test.skip(process.env.PELOTONIA_E2E_V2_SAVE!=='true',
    'The isolated write fixture must be enabled explicitly.');
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try{
    const [manager,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
    await signIn(manager,'v2manager');
    await signIn(outsider,'v2outsider');
    const request=(page,data)=>page.request.post('/api/event/v2-tactics',{
      headers,data:{event_id:eventId,...data}});
    const first=await request(manager,{orders});
    expect(first.status(),await first.text()).toBe(200);
    expect(await first.json()).toMatchObject({ok:true,saved:true,
      event_id:eventId,team_id:'team-v2manager',division_index:1,
      orders_version:2,draft_count:1,
      orders:{version:2,captainId:selected[0]}});
    const repeat=await request(manager,{orders});
    expect(repeat.status(),await repeat.text()).toBe(200);
    expect((await repeat.json()).draft_count).toBe(1);
    expect((await request(manager,{team_id:'team-v2outsider',orders})).status()).toBe(403);
    expect((await request(outsider,{orders})).status()).toBe(403);
    expect((await request(manager,{orders:{...orders,captainId:selected[1]}})).status()).toBe(400);
    expect((await manager.request.post('/api/event/v2-tactics',{
      headers:{Origin:'https://foreign.invalid'},
      data:{event_id:eventId,orders}})).status()).toBe(403);
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
  }
});
