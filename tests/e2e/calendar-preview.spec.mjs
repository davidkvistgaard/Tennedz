import {test,expect} from '@playwright/test';

const raceId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('calendar filter, ranked points and direct setup survive the return trip',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const date=new Date(Date.now()+7*86400000).toISOString();
  await page.route('**/api/events?*',route=>route.fulfill({json:{ok:true,server_time:new Date().toISOString(),events:[
    {id:raceId,name:'Coastal Women',kind:'one_day',gender:'F',status:'OPEN',deadline:date,scheduled_at:date,
      calendar_source:'PELOTONIA',race_tier:3,team_count:0,team_size:8,team_ready:false,winner_points:250},
    {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Coastal Men',kind:'one_day',gender:'M',status:'OPEN',deadline:date,scheduled_at:date,
      calendar_source:'UCI',race_tier:5,team_count:8,team_size:8,team_ready:true,winner_points:650},
  ]}}));
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('alice');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/calendar');
  await expect(page.getByRole('heading',{name:'Coastal Women'})).toBeVisible();
  await page.getByRole('button',{name:'Women',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Coastal Men'})).toHaveCount(0);
  await page.getByText('Points table').click();
  await expect(page.getByText('1. 250 pts')).toBeVisible();
  await page.getByRole('link',{name:/Set up/}).click();
  await expect(page.getByRole('link',{name:/Back to race calendar/})).toHaveAttribute('href','/team/calendar?filter=Women');
  await page.getByRole('link',{name:/Back to race calendar/}).click();
  await expect(page.getByRole('button',{name:'Women',exact:true})).toHaveAttribute('aria-pressed','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
