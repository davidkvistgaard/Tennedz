import {test,expect} from '@playwright/test';

test('a manager can reach the race viewer and keep using the classic Motor Lab',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('v2manager');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.getByRole('navigation',{name:'Main navigation'})
    .getByRole('link',{name:'Race viewer'}).click();
  await expect(page).toHaveURL(/\/team\/v91-playtest$/);
  await expect(page.getByRole('heading',{name:'Try a fictional race'})).toBeVisible();

  await page.getByRole('navigation',{name:'Main navigation'})
    .getByRole('link',{name:'Motor Lab',exact:true}).click();
  await expect(page).toHaveURL(/\/team\/motor-lab$/);
  await expect(page.getByRole('heading',{name:'Make a plan. Watch the road answer.'}))
    .toBeVisible();
  await page.getByRole('link',{name:'Open the race viewer'}).click();
  await expect(page).toHaveURL(/\/team\/v91-playtest$/);
});
