import {test,expect} from '@playwright/test';

const rival={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Nora Voss',
  display_name:'Nora Voss',gender:'F',nationality:'DEN',age:26,
  sprint:44,flat:61,hills:57,mountain:72,cobbles:39,timetrial:51,
  endurance:70,strength:56,wind:47};

test('signed-in manager can search, list, cancel and buy in the marketplace UI',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const initialStart=new Date();
  const listings=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rider_id:rival.id,
    seller_team_id:'team-bob',seller_name:'BOB Cycling',price:4200,
    created_at:initialStart.toISOString(),
    expires_at:new Date(initialStart.getTime()+345600000).toISOString(),rider:rival}];
  page.on('dialog',dialog=>dialog.accept());
  await page.route('**/api/marketplace**',async route=>{
    const req=route.request();
    if(req.method()==='POST'){
      const body=req.postDataJSON();
      if(body.action==='list'){
        const started=new Date();
        listings.push({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        rider_id:body.riderId,seller_team_id:'team-alice',seller_name:'ALICE Cycling',
        price:body.price,created_at:started.toISOString(),
        expires_at:new Date(started.getTime()+345600000).toISOString(),
        rider:{id:body.riderId,name:'Emil Berg',gender:'M',nationality:'DEN',age:22,
          sprint:48,flat:52,hills:45,mountain:65,cobbles:40,timetrial:43,
          endurance:60,strength:45,wind:47}});
      }
      else if(body.action==='cancel')listings.splice(listings.findIndex(item=>item.id===body.listingId),1);
      else if(body.action==='buy')listings.splice(listings.findIndex(item=>item.id===body.listingId),1);
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({ok:true,id:body.listingId||body.riderId})});
      return;
    }
    const params=new URL(req.url()).searchParams;
    const visible=listings.filter(item=>(!params.get('gender')||item.rider.gender===params.get('gender'))&&
      (!params.get('minPrice')||item.price>=Number(params.get('minPrice')))&&
      (!params.get('minSkill')||item.rider[params.get('skill')]>=Number(params.get('minSkill'))));
    await route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify({ok:true,items:visible,my_listings:listings.filter(item=>item.seller_team_id==='team-alice'),
        has_more:false,coins:100000,server_time:new Date().toISOString()})});
  });
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('alice');
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.getByRole('button',{name:'Open profile of Emil Berg from portrait'}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Rider profile'})).toBeVisible();
  await page.getByRole('dialog').getByRole('link',{name:'Sell Emil Berg'}).click();
  await expect(page.getByRole('combobox',{name:'Your rider'})).toHaveValue('fixture-M-0');
  await expect(page.getByRole('spinbutton',{name:'Price in coins'})).toHaveValue('');
  await page.getByRole('link',{name:'Riders'}).click();
  await page.getByRole('group',{name:'Rider category'}).getByRole('button',{name:'Women'}).click();
  await page.getByRole('button',{name:'Open profile of Freja Møller from portrait'}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Rider profile'})).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Freja Møller'})).toBeVisible();
  await page.getByRole('dialog').getByRole('button',{name:'Close'}).click();
  await page.getByRole('group',{name:'Rider category'}).getByRole('button',{name:'Men',exact:true}).click();
  await page.getByRole('link',{name:'Sell Emil Berg'}).click();
  await expect(page.getByRole('combobox',{name:'Your rider'})).toHaveValue('fixture-M-0');
  await expect(page.getByRole('heading',{name:'Rider marketplace'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Nora Voss'})).toBeVisible();
  await expect(page.getByText(/Ends .* left/).first()).toBeVisible();
  await page.screenshot({path:'test-results/marketplace-desktop.png',fullPage:true});
  await page.getByRole('spinbutton',{name:'Minimum price'}).fill('5000');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByText('No riders match these filters.')).toBeVisible();
  await page.getByRole('spinbutton',{name:'Minimum price'}).fill('');
  await page.getByRole('combobox',{name:'Skill',exact:true}).selectOption('mountain');
  await page.getByRole('spinbutton',{name:'Minimum skill'}).fill('70');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nora Voss'})).toBeVisible();
  await page.getByRole('combobox',{name:'Your rider'}).selectOption('fixture-M-0');
  await page.getByRole('spinbutton',{name:'Price in coins'}).fill('3200');
  await page.getByRole('button',{name:'List rider'}).click();
  await expect(page.getByText('Rider listed for 96 hours.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Emil Berg'}).first()).toBeVisible();
  await page.getByRole('button',{name:'Cancel listing'}).first().click();
  await expect(page.getByText('Listing cancelled.')).toBeVisible();
  await page.getByRole('button',{name:'Buy rider'}).click();
  await expect(page.getByText('Rider bought and added to your team.')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/marketplace-mobile.png',fullPage:true});
  const expiringAt=Date.now()+5000;
  listings.push({id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',rider_id:'fixture-M-0',
    seller_team_id:'team-alice',seller_name:'ALICE Cycling',price:25,
    created_at:new Date(expiringAt-345600000).toISOString(),
    expires_at:new Date(expiringAt).toISOString(),
    rider:{...rival,id:'fixture-M-0',name:'Emil Berg',display_name:'Emil Berg',gender:'M'}});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Emil Berg'}).first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Emil Berg'})).toHaveCount(0,{timeout:8000});
  await expect(page.getByRole('combobox',{name:'Your rider'}).locator('option[value="fixture-M-0"]')).toHaveCount(1);
  await page.getByRole('link',{name:'Riders'}).click();
  await page.getByRole('button',{name:'Open profile of Emil Berg from portrait'}).click();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Rider profile'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
