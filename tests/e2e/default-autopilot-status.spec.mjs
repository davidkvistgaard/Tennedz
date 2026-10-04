import {test,expect} from '@playwright/test';

test('saving a default reports an unconfirmed automatic entry without losing the save',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let saves=0;
  await page.route('**/api/team/defaults',async route=>{
    if(route.request().method()==='GET')
      return route.fulfill({json:{ok:true,defaults:[],team_sizes:{ONE_DAY:8,STAGE_RACE:8}}});
    const body=route.request().postDataJSON();
    saves++;
    return route.fulfill({json:{ok:true,default:{...body,updated_at:new Date().toISOString()},
      autopilot:saves===1?{state:'unconfirmed'}:
        {state:'attempted',entered:1,attempted:2,more_eligible:false}}});
  });
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('alice');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/defaults');
  const card=page.locator('.defaults-card').filter({has:page.getByRole('heading',
    {name:'Men · One-day',exact:true})});
  await expect(card.getByRole('checkbox')).toHaveCount(8);
  for(const checkbox of await card.getByRole('checkbox').all())await checkbox.check();
  await card.getByLabel('Captain').selectOption('fixture-M-0');
  await card.getByRole('button',{name:'Save default team'}).click();
  await expect(page.getByRole('status')).toContainText('Automatic entry is not confirmed');
  await expect(card.getByText('Saved',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Save default team'}).click();
  await expect(page.getByRole('status')).toContainText('Entered 1 upcoming race. Other entries are not confirmed.');
  await expect(page.getByText('A saved default is not a confirmed race entry.')).toBeVisible();
  expect(errors).toEqual([]);
});
