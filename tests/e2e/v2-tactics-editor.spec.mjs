import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint=`/api/event/v2-tactics?event_id=${eventId}`;

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('entered manager can edit and reload only their own private v2 plan',
  async({browser})=>{
    test.skip(process.env.PELOTONIA_E2E_V2_SAVE!=='true',
      'The isolated v2 tactics fixture must be enabled explicitly.');
    const contexts=await Promise.all([browser.newContext(),browser.newContext()]);
    try{
      const [manager,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
      await signIn(manager,'v2manager');
      await signIn(outsider,'v2outsider');
      await manager.goto('/team/calendar');
      await expect(manager.getByRole('link',{name:'Private v2 plan'})).toBeVisible();
      await outsider.goto('/team/calendar');
      await expect(outsider.getByRole('link',{name:'Private v2 plan'})).toHaveCount(0);
      await manager.getByRole('link',{name:'Private v2 plan'}).click();
      await expect(manager.getByRole('heading',{name:'Private v2 tactics fixture'}))
        .toBeVisible();
      await expect(manager.getByText('No private v2 plan saved yet.')).toBeVisible();
      await manager.getByLabel('Race approach').selectOption('protect');
      await manager.getByLabel('Road captain').selectOption('fixture-M-1');
      await manager.getByLabel('If a rival break threatens').selectOption('chase_if_threatened');
      await manager.getByLabel('If our forward rider fades').selectOption('chase_if_fading');
      await manager.getByLabel('Work in a break').selectOption('sit_on');
      await manager.getByLabel('Breakaway finale').selectOption('attack_if_outsprinted');
      await manager.getByLabel('Helper attacks').selectOption('hold_for_captain');
      await manager.getByLabel('Captain support').selectOption('drop_back_if_dropped');
      await manager.getByRole('button',{name:'Add route marker'}).click();
      await expect(manager.getByLabel('Change 1 · at km')).toHaveValue('10');
      await expect(manager.getByLabel('Change 1 · at km').locator('option[value="15"]'))
        .toHaveText('15 km · 5 km to go');
      await manager.getByLabel('Change 1 · at km').selectOption('15');
      await manager.getByLabel('Change 1 · break move').selectOption('fixture-M-2');
      await manager.getByLabel('Change 1 · break work').selectOption('drive');
      await manager.getByRole('button',{name:'Save private v2 plan'}).click();
      await expect(manager.getByText(/Private v2 plan saved/)).toBeVisible();
      const own=await manager.request.get(endpoint);
      expect(own.status(),await own.text()).toBe(200);
      const context=await own.json();
      expect(context).toMatchObject({ok:true,team_id:'team-v2manager',
        division_index:1,editable:true,orders:{version:2,preset:'protect',
          roadCaptainId:'fixture-M-1',breakResponse:'chase_if_threatened',
          forwardResponse:'chase_if_fading',baseline:{breakWork:'sit_on',
            breakFinale:'attack_if_outsprinted',helperAttackPolicy:'hold_for_captain',
            captainSupport:'drop_back_if_dropped'},
          phases:[{atKm:15,effort:'hard',breakAttackRiderId:'fixture-M-2',
            breakWork:'drive'}]}});
      expect(JSON.stringify(context)).not.toMatch(/team-v2rival|v2_orders_by_team_id/);
      await manager.reload();
      await expect(manager.getByLabel('Race approach')).toHaveValue('protect');
      await expect(manager.getByLabel('Road captain')).toHaveValue('fixture-M-1');
      await expect(manager.getByLabel('Change 1 · at km')).toHaveValue('15');
      await expect(manager.getByLabel('Change 1 · break move')).toHaveValue('fixture-M-2');
      await expect(manager.getByLabel('Work in a break')).toHaveValue('sit_on');
      expect((await outsider.request.get(endpoint)).status()).toBe(403);
      expect((await manager.request.get(`${endpoint}&team_id=team-v2outsider`)).status())
        .toBe(403);
      const mobile=await browser.newContext({viewport:{width:390,height:844}});
      contexts.push(mobile);
      const phone=await mobile.newPage();
      await signIn(phone,'v2manager');
      await phone.goto(`/team/v2-tactics/${eventId}`);
      await expect(phone.getByLabel('Race approach')).toHaveValue('protect');
      expect(await phone.evaluate(()=>document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(390);
      await manager.getByLabel('Attack rider').selectOption('fixture-M-2');
      await manager.getByLabel('Attack rider').selectOption('__automatic');
      await manager.getByLabel('Race approach').selectOption('aggressive');
      await expect(manager.getByLabel('Effort').first()).toHaveValue('');
      await manager.getByRole('button',{name:'Save private v2 plan'}).click();
      await expect(manager.getByText(/Private v2 plan saved/)).toBeVisible();
      const switched=await (await manager.request.get(endpoint)).json();
      expect(switched.orders).toMatchObject({preset:'aggressive',
        baseline:{effort:'hard',chase:'all',attack:'repeated'},
        phases:[{atKm:15,attackRiderId:null}]});
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
