import {test,expect} from '@playwright/test';

for(const width of [390,1440])test(`manager opens the recorded Motor Lab viewer at ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:900});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const endpoint='http://localhost:3100/api/motor-lab';
 expect((await context.request.post(endpoint,{headers:{Origin:'http://localhost:3100'},data:{plan:'sprint',seed:1}})).status()).toBe(401);
 await page.goto('/login');
 await page.getByLabel('Email or username').fill('alice');
 await page.getByLabel('Password',{exact:true}).fill('fixture-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page).toHaveURL(/\/team$/);
 await page.getByRole('link',{name:'Motor Lab'}).click();
 await expect(page.getByRole('heading',{name:'Recorded Motor Lab race'})).toBeVisible();
 expect((await context.request.post(endpoint,{headers:{Origin:'https://another.example'},data:{plan:'sprint',seed:1}})).status()).toBe(403);
 await expect(page.getByRole('region',{name:'Pelotonia race theatre'})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Race groups'})).toBeVisible();
 await expect(page.getByRole('link',{name:/Generate and watch a test race/})).toBeVisible();
 await expect(page.getByRole('link',{name:/Watch your saved game race/})).toBeVisible();
 await expect(page.getByText('Data coverage and limitations')).toBeVisible();
 await page.getByRole('button',{name:'Race details'}).click();
 await expect(page.getByText('Motor race data · synthetic scenery')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(errors).toEqual([]);
});
