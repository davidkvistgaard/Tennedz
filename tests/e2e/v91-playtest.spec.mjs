import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true',
  'The isolated v91 workbench is disabled.');

for(const width of [390,1440])test(`v91 playtest changes conditions at ${width}px`,
  async({page,context})=>{
    await page.setViewportSize({width,height:900});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    expect((await context.request.post('http://localhost:3100/api/v91-playtest',{
      headers:{Origin:'http://localhost:3100'},data:{distanceKm:40}})).status()).toBe(401);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill(width===390?'alice':'bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await expect(page.getByRole('heading',{name:'Try a fictional race'})).toBeVisible();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByRole('heading',{name:'Recorded race · 40 km rolling'})).toBeVisible();
    await expect(page.getByText(/Kilometre-level v91 diagnostic only/)).toBeVisible();
    const slider=page.getByRole('slider',{name:/Race kilometre/});
    await slider.fill('40');
    await expect(page.getByText('Race kilometre: 40')).toBeVisible();
    await expect(page.locator('.v91-riders > div')).toHaveCount(8);
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByRole('button',{name:'Run race'}).click();
    await expect(page.getByRole('heading',{name:'Recorded race · 120 km exposed'})).toBeVisible();
    expect(errors).toEqual([]);
  });
