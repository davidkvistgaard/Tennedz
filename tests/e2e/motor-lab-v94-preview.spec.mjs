import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The guided Motor Lab is disabled.');

test('experimental v94 race shows committed plans and measured road only',
  async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/motor-lab');
    await page.getByRole('link',
      {name:/experimental whole-race dynamics preview/}).click();
    await expect(page.getByRole('heading',
      {name:'Follow the recorded road'})).toBeVisible();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Field').selectOption('4');
    await page.getByLabel('Race format').selectOption('stage');
    await page.getByLabel('Fictional rival 1 goal').selectOption('break');
    await page.getByText('Set more rival goals').click();
    await page.getByLabel('Fictional rival 2 goal').selectOption('control');
    await expect(page.getByLabel('Breakaway front work')).toHaveCount(0);
    await expect(page.getByLabel('Control-team pursuit')).toHaveCount(0);
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().postDataJSON()?.mode==='v94-race-dynamics');
    await page.getByRole('button',
      {name:'Run experimental race'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {raceDynamics}=await response.json();
    expect(raceDynamics.frames).toHaveLength(40);
    expect(raceDynamics.frames.every(frame=>
      frame.paidChase.map(row=>row.teamId).sort().join(',')===
      [...frame.chasers].sort().join(','))).toBe(true);
    expect(raceDynamics.teamPlans).toHaveLength(4);
    expect(raceDynamics.resultStatus).toBe('provisional_road_groups_only');
    expect(raceDynamics.policy.rivalIntentVersion).toBe(4);
    expect(raceDynamics.policy.controlWithdrawalVersion).toBeUndefined();
    expect(raceDynamics.policy.frontRotationVersion).toBe(1);
    await expect(page.getByText('active paid rotation',
      {exact:true})).toBeVisible();
    await expect(page.getByText('current selective pursuit',
      {exact:true})).toBeVisible();
    expect(raceDynamics.provisionalResults).toBeUndefined();
    expect(raceDynamics.teamPlans.find(plan=>plan.teamId==='rival-1'))
      .toMatchObject({source:'manager_goal',role:'break',
        baseline:{attack:'repeated',chase:'ignore'}});
    expect(raceDynamics.teamPlans.find(plan=>plan.teamId==='rival-2'))
      .toMatchObject({source:'manager_goal',role:'control',
        baseline:{attack:'none',chase:'selective'}});
    await expect(page.getByRole('heading',
      {name:'What the recording shows'})).toBeVisible();
    await expect(page.locator('.v94-evidence'))
      .toContainText('Paid chase this km:');
    const firstChase=raceDynamics.frames.find(row=>row.paidChase.length>0);
    if(firstChase){
      await page.getByRole('slider',{name:'Race kilometre'})
        .evaluate((element,value)=>{
        const setter=Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,'value').set;
        setter.call(element,String(value));
        element.dispatchEvent(new Event('input',{bubbles:true}));
        },firstChase.km);
      await expect(page.locator('.v94-evidence'))
        .toContainText('Chase changes:');
      await expect(page.locator('.v94-evidence'))
        .toContainText('into the recorded chase');
    }
    await expect(page.locator('.v94-evidence'))
      .toContainText('individual turn in the wind');
    await expect(page.locator('.v94-evidence'))
      .toContainText('Selective chase held this km:');
    await expect(page.getByRole('heading',
      {name:'Finish line · km 40'})).toBeVisible();
    expect(raceDynamics.finish.km).toBe(40);
    expect(raceDynamics.finish.positions).toBeUndefined();
    await expect(page.getByRole('img',{
      name:/Recorded leading-group gap from km 1 to km 40/})).toBeVisible();
    expect((await page.locator('.v94-lead-line').getAttribute('points'))
      .split(' ')).toHaveLength(40);
    await page.getByRole('button',{name:'Start',exact:true}).click();
    await expect(page.locator('.v94-lead-current'))
      .toHaveAttribute('cx','26');
    await page.getByRole('button',{name:'Last km'}).click();
    await expect(page.locator('.v94-lead-current'))
      .toHaveAttribute('cx','694');
    await expect(page.getByRole('heading',
      {name:'Road clock at km 40'})).toBeVisible();
    await expect(page.locator('.v94-riders p')).toHaveCount(8);
    await page.getByText('Paid team work through km 40').click();
    await expect(page.locator('.v94-work-list p')).toHaveCount(4);
    const paidControlKm=raceDynamics.frames.filter(frame=>
      frame.chasers.includes('rival-2')).length;
    await expect(page.locator('.v94-work-list p').filter({hasText:'Rival 2'}))
      .toContainText(`chase ${paidControlKm} km`);
    await page.getByText('Inspect every team\'s committed opening goal and orders')
      .click();
    await expect(page.locator('.v94-plan-list article')).toHaveCount(4);
    await page.screenshot({path:'test-results/v94-race-preview-mobile.png',
      fullPage:true});
    await page.getByLabel('Fictional rival 2 goal').selectOption('auto');
    await page.getByText('Set more rival goals').click();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Field').selectOption('20');
    await page.getByLabel('Race format').selectOption('one_day');
    await page.getByLabel('Fictional rival 1 goal').selectOption('auto');
    await page.getByLabel('Your chase order').selectOption('ignore');
    await page.getByLabel('Your bunch-front work').selectOption('rotate');
    await page.getByLabel('Race seed').fill('race-dynamics-1');
    const longResponsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().postDataJSON()?.mode==='v94-race-dynamics');
    await page.getByRole('button',{name:'Run experimental race'}).click();
    const longResponse=await longResponsePromise;
    expect(longResponse.status()).toBe(200);
    const longRace=(await longResponse.json()).raceDynamics;
    expect(longRace.frames).toHaveLength(260);
    await expect(page.getByRole('heading',
      {name:'Finish line · km 260'})).toBeVisible();
    expect(longRace.teamPlans).toHaveLength(20);
    expect(longRace.teamPlans.find(plan=>plan.teamId==='you')
      .baseline.frontWork).toBe('rotate');
    expect(longRace.frames.filter(frame=>
      frame.paidBunchPace?.teamId==='you').length).toBeGreaterThan(0);
    expect(longRace.story.widestRecordedLead.gapSeconds).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Widest lead'}).click();
    await expect(page.getByRole('heading',
      {name:`Road clock at km ${longRace.story.widestRecordedLead.km}`}))
      .toBeVisible();
    await expect(page.locator('.v94-group').first()).toBeVisible();
    await page.screenshot({path:'test-results/v94-long-race-mobile.png',
      fullPage:true});
    await page.getByLabel('Race format').selectOption('stage');
    await page.getByLabel('Route').selectOption('flat');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByLabel('Your chase order').selectOption('all');
    await page.getByLabel('Your bunch-front work').selectOption('none');
    await page.getByLabel('Race seed').fill('preview-orders-stage-flat-30');
    const coastResponsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().postDataJSON()?.mode==='v94-race-dynamics');
    await page.getByRole('button',{name:'Run experimental race'}).click();
    const coastResponse=await coastResponsePromise;
    expect(coastResponse.status()).toBe(200);
    const coastRace=(await coastResponse.json()).raceDynamics;
    expect(coastRace.policy.frontExhaustionVersion).toBe(4);
    expect(coastRace.frames[221].frontCoast[0]).toMatchObject({
      riderId:'you-7',joinedGroupId:'road-2'});
    await page.getByRole('button',{name:'Paid slowdown km 222'}).click();
    await expect(page.getByRole('heading',
      {name:'Road clock at km 222'})).toBeVisible();
    await expect(page.getByText(/joined road-2/)).toBeVisible();
    await page.screenshot({path:'test-results/v94-paid-contact-mobile.png',
      fullPage:true});
  });
