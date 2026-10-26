import {test,expect} from '@playwright/test';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The guided v93 Motor Lab is disabled.');

test('guided Motor Lab runs a race from setup to rider replay',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await expect(page.getByRole('heading',{name:'Motor Lab: plan a race'}))
    .toBeVisible();
  const flow=page.getByRole('navigation',{name:'Motor Lab race flow'});
  await expect(flow.getByRole('button',
    {name:'2 · Watch recorded race'})).toBeDisabled();
  await expect(flow.getByRole('button',
    {name:'3 · Inspect conditional result'})).toBeDisabled();
  await page.screenshot({path:'test-results/guided-motor-lab-start.png',
    fullPage:true});
  await expect(page.getByLabel('Distance')).toHaveValue('40');
  await expect(page.getByLabel('Your attack order')).toHaveValue('none');
  await expect(page.getByRole('checkbox',
    {name:'Continue to a conditional finish'})).toHaveCount(0);
  await page.locator('summary').filter({hasText:'Other managers'}).click();
  await expect(page.getByLabel('Default tactics for uncustomized managers'))
    .toBeVisible();
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(coasted.lineTimes).toHaveLength(32);
  expect(coasted.stageTrace.kilometres).toHaveLength(40);
  await flow.getByRole('button',{name:'2 · Watch recorded race'}).click();
  await expect(page.getByRole('region',{name:'Race viewer'})).toBeVisible();
  await flow.getByRole('button',
    {name:'3 · Inspect conditional result'}).click();
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toBeVisible();
  const stageCard=page.getByLabel('Stage and orders at km 1');
  await expect(stageCard).toContainText('Stage input at km 1:');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('short climbs may be hidden');
  await expect(stageCard).toContainText('Your active order:');
  await expect(stageCard).toContainText('Recorded this kilometre:');
  await expect(stageCard.getByLabel('Followed rider actions at this kilometre'))
    .toContainText('you-7:');
  await stageCard.locator('summary').filter({hasText:
    'Actions and energy for all 8 of your riders'}).click();
  await expect(stageCard.locator('.v91-rider-actions li')).toHaveCount(8);
  await stageCard.screenshot({path:'test-results/guided-rider-actions.png'});
  const nextChange=page.getByRole('button',
    {name:/Next recorded change: km/});
  await expect(nextChange).toBeEnabled();
  await nextChange.click();
  await expect(stageCard).toHaveCount(0);
  await page.getByRole('button',
    {name:'Previous recorded change: km 1'}).click();
  await expect(stageCard).toBeVisible();
  const roadGapDiagram=page.getByLabel('Recorded time gaps at km 1');
  await expect(roadGapDiagram).toBeVisible();
  await expect(roadGapDiagram).toContainText('Bunch');
  await expect(roadGapDiagram.locator('.v91-road-gap-track'))
    .toHaveCount(coasted.kilometreFrames[0].roadGroups.length+
      coasted.kilometreFrames[0].droppedRiders.length+1);
  const separatedIndex=coasted.kilometreFrames.findIndex(frame=>
    frame.roadGroups.length>0||frame.droppedRiders.length>0);
  if(separatedIndex>=0){
    await page.getByRole('slider',{name:/Recorded kilometre:/})
      .fill(String(separatedIndex+1));
    await expect(page.getByLabel(`Recorded time gaps at km ${separatedIndex+1}`))
      .toBeVisible();
  }
  await page.locator('.v91-road-gap-diagram').screenshot({
    path:'test-results/guided-road-gap-diagram.png'});
  expect(coasted.pointPreview.awardRows).toEqual([]);
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
  await expect(page.getByRole('table',
    {name:'V93 individual conditional results'}))
    .toBeVisible();
  await page.getByRole('table',
    {name:'V93 individual conditional results'})
    .getByRole('button',{name:'Replay you-7'}).click();
  await expect(page.getByLabel('Selected rider finale replay'))
    .toContainText('you-7:');
});

test('guided race diagram shows paid front-group time gaps',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.getByLabel('Distance').selectOption('260');
  await page.getByLabel('Starting fatigue').selectOption('30');
  await page.getByLabel('Your attack order').selectOption('repeated');
  await page.getByLabel('Your chase order').selectOption('ignore');
  await page.locator('summary').filter({hasText:'Other managers'}).click();
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('attack');
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  const index=coasted.kilometreFrames.findIndex(frame=>
    frame.roadGroups.some(group=>group.gapSeconds>0));
  expect(index).toBeGreaterThanOrEqual(0);
  await page.getByRole('slider',{name:/Recorded kilometre:/})
    .fill(String(index+1));
  const diagram=page.getByLabel(`Recorded time gaps at km ${index+1}`);
  await expect(diagram).toContainText('Group 1');
  await expect(diagram.locator('.v91-road-gap-ahead')).not.toHaveCount(0);
  await expect(diagram).toContainText('Bunch');
  await diagram.screenshot({path:'test-results/guided-road-gap-with-front.png'});
});

test('guided Motor Lab applies an effort order after a selected 5 km marker', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.getByLabel('Route profile').selectOption('rolling');
  const stageResponsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest/stage-plan')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Load stage inputs'}).click();
  const stageResponse=await stageResponsePromise;
  expect(stageResponse.status()).toBe(200);
  const {stagePlan}=await stageResponse.json();
  expect(stagePlan.intervals).toHaveLength(8);
  await expect(page.getByRole('img',{name:'Stage profile before tactics'}))
    .toBeVisible();
  await page.getByLabel('Stage inputs before tactics').screenshot({
    path:'test-results/guided-stage-before-tactics.png'});
  await page.getByRole('button',{name:'Use 15 km as first effort marker'}).click();
  await page.locator('summary').filter({hasText:'Timed effort'}).click();
  await expect(page.getByLabel('Start changing effort after')).toHaveValue('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(stagePlan.stageTrace).toEqual(coasted.stageTrace);
  expect(coasted.settings.managerTacticalOrdersV2)
    .toEqual([{teamId:'you',atKm:15,effort:'hard'}]);
  const startingEffort=coasted.managerOrders.find(row=>
    row.teamId==='you').effort;
  await page.getByRole('button',{name:'First km after effort marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('effort markers at km 15 · solid line: viewing km 16');
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-stage-profile.png'});
  await page.getByRole('slider',{name:/Recorded kilometre/}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Stage and orders at km 15'))
    .toContainText(`Your active order: ${startingEffort} effort`);
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
});

test('guided refusal opens paid road and keeps result unavailable',async({page})=>{
  test.setTimeout(120000);
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('alice');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  const teamCount=20,gender='M',terrain='mountain',fatigue=30;
  const settings={distanceKm:260,teamCount,gender,terrain,fatigue,
    seed:'v93-heterogeneous-20-M-mountain-30-alternate-11',
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','steady','conserve'][index%3],
      attack:index%3===0?'repeated':'selective',
      chase:index%3===1?'all':'selective'})),
    teamOverrides:[{teamId:'you',level:45},
      ...Array.from({length:teamCount-1},(_,index)=>({
        teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'steady',chase:'all'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
  const response=await page.request.post('/api/v91-playtest',{
    headers:{origin:'http://localhost:3100'},data:{mode:'v93-coasted',settings,
      plans:['you',...Array.from({length:teamCount-1},(_,index)=>
        `rival-${index+1}`)].map(teamId=>({teamId,
        finisherId:`${teamId}-7`,leadOutRiderId:null}))}});
  expect(response.status()).toBe(422);
  const body=await response.json();
  expect(body.roadPreview?.lineTimes).toBeNull();
  await page.goto('/team/motor-lab');
  const flow=page.getByRole('navigation',{name:'Motor Lab race flow'});
  await page.route('**/api/v91-playtest',route=>route.fulfill({
    status:422,contentType:'application/json',body:JSON.stringify(body)}));
  await page.getByRole('button',{name:'Run the race'}).click();
  await flow.getByRole('button',{name:'2 · Inspect paid road'}).click();
  await expect(page.getByRole('region',{
    name:'Recorded road without individual finish'})).toBeVisible();
  await expect(flow.getByRole('button',{
    name:'3 · Inspect conditional result'})).toBeDisabled();
});

test('guided Motor Lab replays two precommitted 5 km effort changes', async({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.getByRole('button',{name:'Load stage inputs'}).click();
  await expect(page.getByRole('img',{name:'Stage profile before tactics'}))
    .toBeVisible();
  await page.getByRole('button',{name:'Use 15 km as first effort marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as second effort marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as first effort marker'}).click();
  await expect(page.getByLabel('Stage inputs before tactics'))
    .toContainText('Selected markers: 25 km.');
  await page.getByRole('button',{name:'Use 15 km as first effort marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as second effort marker'}).click();
  await expect(page.getByLabel('Stage inputs before tactics'))
    .toContainText('Selected markers: 15 km, 25 km');
  await page.getByLabel('Stage inputs before tactics').screenshot({
    path:'test-results/guided-two-stage-markers.png'});
  await page.locator('summary').filter({hasText:'Timed effort'}).click();
  await expect(page.getByLabel('Start changing effort after')).toHaveValue('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  await expect(page.getByLabel('Optional second effort change after'))
    .toHaveValue('25');
  await page.getByLabel('Effort after 25 km for you').selectOption('conserve');
  await expect(page.getByLabel('Race plan before running'))
    .toContainText('Hard effort after 15 km');
  await expect(page.getByLabel('Race plan before running'))
    .toContainText('Conserve effort after 25 km');
  await page.getByLabel('Race plan before running').screenshot({
    path:'test-results/guided-two-marker-plan.png'});
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  expect(coasted.settings.managerTacticalOrdersV3).toEqual([
    {teamId:'you',atKm:15,effort:'hard'},
    {teamId:'you',atKm:25,effort:'conserve'},
  ]);
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('effort markers at km 15, 25');
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-two-marker-profile.png'});
  await page.getByRole('button',{name:'First km after effort marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await page.getByRole('button',{name:'First km after effort marker 25'}).click();
  await expect(page.getByLabel('Stage and orders at km 26'))
    .toContainText('Your active order: conserve effort');
  await page.getByRole('slider',{name:/Recorded kilometre/}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Stage and orders at km 25'))
    .toContainText('Your active order: hard effort');
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
});
