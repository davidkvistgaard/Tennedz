import { test, expect } from '@playwright/test';
for(const width of [390,1440])test(`atlas reveals real detail and preserves navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 await page.goto('/login');await page.getByLabel('Login-navn').fill('alice');await page.getByLabel('Kodeord').fill('fixture-password');await page.getByRole('button',{name:'Log ind',exact:true}).click();await expect(page).toHaveURL(/\/team$/);
 await page.goto('/team/atlas');
 const map=page.getByRole('group',{name:/Kort over Pelotonia/});
 await expect(page.getByRole('heading',{name:'Pelotonia Atlas',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/atlas-country-${width}.png`,fullPage:true});
 await page.getByLabel('Udforsk et makroområde').selectOption('P12');await page.getByRole('button',{name:'Vis',exact:true}).click();
 await expect(page.getByRole('heading',{name:'P12',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'← Tilbage',exact:true}).click();
 await page.getByRole('button',{name:'Udforsk Aurelia',exact:true}).click();
 await expect(page.getByText('Bydele og lokale steder',{exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/atlas-city-${width}.png`,fullPage:true});
 await page.locator('.atlas-place-list').getByRole('button',{name:'Old Aurelia'}).click();
 await expect(page.getByRole('heading',{name:'Old Aurelia',exact:true})).toBeVisible();
 await page.locator('.atlas-place-list').getByRole('button',{name:'Great Cathedral of Aurelia'}).click();
 await expect(page.getByText('Bygninger, pladser og haver',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Udforsk Katedralbygningen',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Udforsk Havepavillon · forslag',exact:true})).toBeVisible();
 await page.screenshot({path:`test-results/atlas-cathedral-${width}.png`,fullPage:true});
 const mapBox=await map.boundingBox();
 const panBefore=await map.getAttribute('viewBox');
 await page.mouse.move(mapBox.x+mapBox.width*.2,mapBox.y+mapBox.height*.2);await page.mouse.down();await page.mouse.move(mapBox.x+mapBox.width*.3,mapBox.y+mapBox.height*.25,{steps:5});await page.mouse.up();
 expect(await map.getAttribute('viewBox')).not.toBe(panBefore);
 const before=await map.getAttribute('viewBox');
 await page.getByRole('button',{name:'Zoom ind',exact:true}).click();
 expect(await map.getAttribute('viewBox')).not.toBe(before);
 await map.focus();await page.keyboard.press('ArrowRight');
 const shifted=await map.getAttribute('viewBox');expect(shifted).not.toBe(before);
 await page.getByRole('button',{name:'← Tilbage',exact:true}).click();await expect(page.getByRole('heading',{name:'Old Aurelia',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Vis hele øen',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Pelotonia',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Udforsk Katedralbygningen',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Jordkontekst ↗'}).click();await expect(page.getByText(/præcise jordkoordinater er endnu ikke fastlagt/)).toBeVisible();
});

test('touch pinch zooms the atlas without opening a place',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 const page=await context.newPage();
 try{
  await page.goto('http://localhost:3100/login');await page.getByLabel('Login-navn').fill('alice');await page.getByLabel('Kodeord').fill('fixture-password');await page.getByRole('button',{name:'Log ind',exact:true}).click();await expect(page).toHaveURL(/\/team$/);
  await page.goto('http://localhost:3100/team/atlas');
  const map=page.getByRole('group',{name:/Kort over Pelotonia/});await expect(map).toBeVisible();await map.scrollIntoViewIfNeeded();
  const b=await map.boundingBox(),cx=b.x+b.width/2,cy=b.y+b.height/2;
  const before=Number((await map.getAttribute('viewBox')).split(' ')[2]);
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy,id:1},{x:cx+65,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async()=>Number((await map.getAttribute('viewBox')).split(' ')[2])).toBeLessThan(before);
  await expect(page.getByRole('heading',{name:'Pelotonia',exact:true})).toBeVisible();
 }finally{await context.close();}
});
