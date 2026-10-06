import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint='/api/event/v2-tactics/preview';
const headers={Origin:'http://localhost:3100'};
const selected=Array.from({length:8},(_,index)=>`fixture-M-${index}`);
const orders={captainId:selected[0],helperIds:[selected[1]],preset:'protect',
  phases:[{atKm:10,effort:'hard',attackRiderId:selected[2]}]};

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('only the entered manager can preview roster-bound v2 tactics without saving',async({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
  try{
    const [alice,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
    await signIn(alice,'v2manager');
    await signIn(outsider,'v2outsider');
    const request=async(page,data)=>page.request.post(endpoint,{headers,
      data:{event_id:eventId,...data}});
    const accepted=await request(alice,{orders});
    expect(accepted.status(),await accepted.text()).toBe(200);
    const preview=await accepted.json();
    expect(preview).toMatchObject({ok:true,event_id:eventId,team_id:'team-v2manager',
      division_index:1,saved:false,orders:{version:2,captainId:selected[0],
        phases:[{atKm:10,effort:'hard',attackRiderId:selected[2]}]}});
    expect(JSON.stringify(preview)).not.toContain('team-v2outsider');
    expect((await request(alice,{team_id:'team-v2outsider',orders})).status()).toBe(403);
    const foreign=await request(alice,{orders:{...orders,
      phases:[{atKm:10,attackRiderId:'foreign'}]}});
    expect(foreign.status()).toBe(400);
    expect((await foreign.json()).code).toBe('INVALID_V2_ORDERS');
    const wrongCaptain=await request(alice,{orders:{...orders,captainId:selected[1]}});
    expect(wrongCaptain.status()).toBe(400);
    expect((await request(outsider,{orders})).status()).toBe(403);
  }finally{
    await Promise.all(contexts.map(context=>context.close()));
  }
});
