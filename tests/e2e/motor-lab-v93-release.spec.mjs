import {test,expect} from '@playwright/test';
import {raceViewerCommentaryV1} from
  '../../lib/engine/v2/playtest-commentary-v1.mjs';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The guided v93 Motor Lab is disabled.');

async function closeDefaultRaceScreen(page){
  const screen=page.getByRole('dialog',{name:'Race screen'});
  await expect(screen).toBeVisible();
  await screen.getByRole('button',{name:'Close race screen'}).click();
}

test('guided Motor Lab runs a race from setup to rider replay',async({page,context})=>{
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
  await expect(page.getByLabel('Default tactics for uncustomized managers'))
    .toHaveValue('random');
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
  expect(coasted.settings.managerTactics).toHaveLength(3);
  expect(coasted.settings.managerTactics.some(tactic=>
    tactic.attack==='repeated')).toBe(true);
  expect(coasted.kilometreFrames.some(frame=>
    frame.roadGroups.length>0)).toBe(true);
  expect(coasted.lineTimes).toHaveLength(32);
  expect(coasted.stageTrace.kilometres).toHaveLength(40);
  const raceScreen=page.getByRole('dialog',{name:'Race screen'});
  await expect(raceScreen).toBeVisible();
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await raceScreen.getByRole('button',{name:'Copy race log'}).click();
  await expect(raceScreen.getByRole('status')).toContainText('Copied');
  const copiedLog=await page.evaluate(()=>navigator.clipboard.readText());
  const fullCommentary=raceViewerCommentaryV1(coasted);
  const copiedLines=copiedLog.split('\n').filter(line=>/^Km \d+: /.test(line));
  expect(copiedLog).toContain('Pelotonia Motor Lab race log');
  expect(copiedLines).toHaveLength(fullCommentary.length);
  expect(copiedLines.at(-1)).toContain(`Km ${fullCommentary.at(-1).km}:`);
  await expect(raceScreen.locator('header h2')).toContainText('Km 1');
  await expect(raceScreen.getByRole('img',{
    name:/Stage profile with the field at km 1/})).toBeVisible();
  await expect(raceScreen.getByLabel('Your riders on the road')
    .locator('button')).toHaveCount(8);
  await raceScreen.getByLabel('Your riders on the road')
    .getByRole('button',{name:/Rider 1/}).click();
  await expect(raceScreen.getByLabel('Followed rider position'))
    .toContainText('Rider 1');
  await expect(raceScreen.locator('.v91-race-screen-route svg text'))
    .toHaveText('Rider 1');
  await raceScreen.getByLabel('Your riders on the road')
    .getByRole('button',{name:/Rider 8/}).click();
  await raceScreen.getByRole('button',{name:'Play',exact:true}).click();
  await expect(raceScreen.locator('header h2')).toContainText('Km 2');
  await expect(raceScreen.locator('header h2')).toContainText('Km 3');
  await expect(raceScreen.getByRole('list',{
    name:'Recent commentary history'})).toContainText('Km 1');
  await raceScreen.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForTimeout(1500);
  await expect(raceScreen.locator('header h2')).toContainText('Km 3');
  await raceScreen.getByLabel('Choose recorded kilometre').fill(
    String(coasted.kilometreFrames.length));
  await raceScreen.getByRole('button',{name:'Replay'}).click();
  await expect(raceScreen.locator('header h2')).toContainText('Km 1');
  await raceScreen.getByRole('button',{name:'Pause'}).click();
  await raceScreen.getByLabel('Choose recorded kilometre').fill('10');
  await expect(raceScreen.locator('header h2')).toContainText('Km 10');
  await expect(raceScreen.getByRole('list',{
    name:'Recent commentary history'})).toContainText('Km 1');
  await page.screenshot({path:'test-results/guided-race-screen-mobile.png'});
  await page.setViewportSize({width:1440,height:900});
  await expect(raceScreen.getByLabel('Your riders on the road')
    .getByRole('button',{name:/Rider 8/})).toBeInViewport();
  await page.screenshot({path:'test-results/guided-race-screen-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await raceScreen.getByLabel('Choose recorded kilometre').fill('1');
  await raceScreen.getByRole('button',{name:'Close race screen'}).click();
  await flow.getByRole('button',{name:'2 · Watch recorded race'}).click();
  await expect(page.getByRole('region',{name:'Race viewer'})).toBeVisible();
  await flow.getByRole('button',
    {name:'3 · Inspect conditional result'}).click();
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toBeVisible();
  await expect(page.getByLabel('What happened in your race'))
    .toContainText(/widest recorded gap|No front road group was recorded/);
  const stageCard=page.getByLabel('Stage and orders at km 1');
  await expect(stageCard).toContainText('Stage input at km 1:');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('short climbs may be hidden');
  await expect(stageCard).toContainText('Your active order:');
  await expect(stageCard).toContainText('Recorded this kilometre:');
  await expect(stageCard.getByLabel('Followed rider actions at this kilometre'))
    .toContainText('you-7:');
  const viewer=page.getByRole('region',{name:'Race viewer'});
  const situation=viewer.getByLabel('Race situation at km 1');
  await expect(situation).toContainText('Km 1 / 40');
  await expect(situation).toContainText('39 km to go');
  await expect(situation.getByRole('progressbar',
    {name:'Race distance completed'})).toHaveAttribute('value','1');
  const ownRiders=situation.getByLabel('Your riders at km 1');
  await expect(ownRiders.locator('button')).toHaveCount(8);
  await expect(ownRiders).toContainText('Energy left');
  await expect(ownRiders).toContainText('Starting fatigue: 0');
  await ownRiders.getByRole('button',{
    name:/Rider 1/}).click();
  await expect(page.getByLabel('Rider to follow')).toHaveValue('you-0');
  await page.getByLabel('Rider to follow').selectOption('you-7');
  await ownRiders.getByRole('button',{name:/Rider 8/}).focus();
  await situation.screenshot({path:'test-results/guided-race-situation.png'});
  const commentary=viewer.getByLabel('Race commentary');
  await expect(situation).toContainText('At km 1');
  await expect(commentary.locator('ol').first().locator('li').first())
    .toContainText('Km 1');
  await expect(commentary).toContainText('Replaying this race keeps');
  await commentary.getByRole('button',{name:/Km 1/}).first().click();
  await expect(page.getByRole('slider',{name:/Recorded kilometre:/}))
    .toHaveValue('1');
  await commentary.screenshot({path:'test-results/guided-race-commentary.png'});
  await viewer.getByRole('button',{name:'Play checkpoints'}).click();
  await expect(viewer).toContainText('Viewing km 11 of 40',
    {timeout:5000});
  await viewer.locator('.v91-viewer-navigation').screenshot({
    path:'test-results/guided-checkpoint-playback.png'});
  expect(await viewer.locator('.v91-viewer-navigation').evaluate(element=>
    element.scrollWidth<=element.clientWidth+1)).toBe(true);
  await viewer.getByRole('button',{name:'Pause checkpoints'}).click();
  await page.waitForTimeout(2000);
  await expect(page.getByRole('slider',{name:/Recorded kilometre:/}))
    .toHaveValue('11');
  await viewer.getByRole('button',{name:'Previous checkpoint'}).click();
  await expect(page.getByRole('slider',{name:/Recorded kilometre:/}))
    .toHaveValue('1');
  await expect(viewer.getByRole('button',{name:'Play checkpoints'}))
    .toHaveAttribute('aria-pressed','false');
  await stageCard.locator('summary').filter({hasText:
    'Actions and energy for all 8 of your riders'}).click();
  await expect(stageCard.locator('.v91-rider-actions li')).toHaveCount(8);
  await stageCard.getByRole('button',{name:'Follow you-0'}).click();
  await expect(page.getByLabel('Rider to follow')).toHaveValue('you-0');
  await expect(stageCard.getByRole('button',{name:'Follow you-0'}))
    .toHaveAttribute('aria-pressed','true');
  await expect(page.getByLabel('Recorded time gaps at km 1')
    .locator('.v91-road-gap-followed'))
    .toHaveAttribute('aria-label',/^Following you-0 in /);
  await page.getByLabel('Rider to follow').selectOption('you-7');
  await stageCard.screenshot({path:'test-results/guided-rider-actions.png'});
  await page.getByRole('slider',{name:/Recorded kilometre:/}).fill('2');
  await expect(viewer.getByLabel('Race situation at km 2'))
    .toContainText('38 km to go');
  const comparison=page.getByLabel('Recorded change from km 1 to 2');
  await expect(comparison).toContainText(
    `Front groups: ${coasted.kilometreFrames[0].roadGroups.length} → ${
      coasted.kilometreFrames[1].roadGroups.length}`);
  await expect(comparison).toContainText('These are two recorded checkpoints');
  await comparison.screenshot({path:
    'test-results/guided-checkpoint-comparison.png'});
  await page.getByRole('slider',{name:/Recorded kilometre:/}).fill('1');
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
  await expect(roadGapDiagram.locator('.v91-road-gap-followed'))
    .toHaveAttribute('aria-label',/^Following you-7 in /);
  await expect(roadGapDiagram.getByRole('group',
    {name:/Following you-7 in /})).toBeVisible();
  await page.getByLabel('Rider to follow').selectOption('you-0');
  await expect(roadGapDiagram.locator('.v91-road-gap-followed'))
    .toHaveAttribute('aria-label',/^Following you-0 in /);
  await page.getByLabel('Rider to follow').selectOption('you-7');
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
  const raceScreen=page.getByRole('dialog',{name:'Race screen'});
  await expect(raceScreen).toBeVisible();
  await raceScreen.getByLabel('Choose recorded kilometre').fill(
    String(coasted.kilometreFrames.length));
  const recentEvents=raceScreen.getByRole('list',{
    name:'Recent commentary history'});
  expect(await recentEvents.locator('li').count()).toBeGreaterThan(1);
  await raceScreen.getByLabel('Choose recorded kilometre').fill('1');
  await expect(recentEvents.locator('li')).toHaveCount(1);
  const followedFrame=coasted.kilometreFrames.find(frame=>
    frame.ownRiders.some(row=>frame.roadGroups.some(group=>
      group.riderIds.includes(row.riderId))||frame.droppedRiders.some(
      drop=>drop.riderId===row.riderId)));
  expect(followedFrame).toBeDefined();
  const followedId=followedFrame.ownRiders.find(row=>
    followedFrame.roadGroups.some(group=>group.riderIds.includes(row.riderId))||
    followedFrame.droppedRiders.some(drop=>drop.riderId===row.riderId))
    .riderId;
  const followedNumber=Number(followedId.slice(4))+1;
  await raceScreen.getByLabel('Choose recorded kilometre')
    .fill(String(followedFrame.km));
  await raceScreen.getByLabel('Your riders on the road')
    .getByRole('button',{name:new RegExp(`Rider ${followedNumber}\\b`)})
    .click();
  await expect(raceScreen.getByLabel('Followed rider position'))
    .toContainText(`Rider ${followedNumber}`);
  await expect(raceScreen.locator('.v91-race-screen-route svg text'))
    .toHaveText(`Rider ${followedNumber}`);
  const followedBand=raceScreen.getByLabel('Road groups at selected kilometre')
    .locator('.v91-race-screen-band-followed');
  await expect(followedBand).toContainText(`Rider ${followedNumber}`);
  await expect(followedBand).toContainText(/Front group|riding alone/);
  await closeDefaultRaceScreen(page);
  const ownEventIndices=coasted.kilometreFrames.flatMap((frame,index)=>
    [...frame.attackAttempts,...frame.joinedRiderIds,...frame.caughtRiderIds]
      .some(id=>id.startsWith('you-'))?[index]:[]);
  const checkpointIndices=await page.locator('[data-checkpoint-index]')
    .evaluateAll(cards=>cards.map(card=>Number(card.dataset.checkpointIndex)));
  for(const index of ownEventIndices)
    expect(checkpointIndices).toContain(index);
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
  const comparedIndex=Math.max(index,1);
  await page.getByRole('slider',{name:/Recorded kilometre:/})
    .fill(String(comparedIndex+1));
  const comparison=page.getByLabel(
    `Recorded change from km ${comparedIndex} to ${comparedIndex+1}`);
  await expect(comparison).toContainText(
    `Front groups: ${coasted.kilometreFrames[comparedIndex-1]
      .roadGroups.length} → ${coasted.kilometreFrames[comparedIndex]
      .roadGroups.length}`);
  await comparison.screenshot({path:
    'test-results/guided-front-checkpoint-comparison.png'});
  const band=(frame,id)=>frame.roadGroups.some(group=>
    group.riderIds.includes(id))?'front group':
    frame.droppedRiders.some(row=>row.riderId===id)?'isolated':'bunch';
  const transition=coasted.kilometreFrames.flatMap((frame,frameIndex)=>{
    if(frameIndex===0)return [];
    const previous=coasted.kilometreFrames[frameIndex-1];
    return frame.ownRiders.flatMap(row=>{
      const before=band(previous,row.riderId),after=band(frame,row.riderId);
      return before===after?[]:[{km:frame.km,id:row.riderId,
        before,after}];
    });
  })[0];
  expect(transition).toBeDefined();
  await page.getByRole('slider',{name:/Recorded kilometre:/})
    .fill(String(transition.km));
  const changed=page.getByLabel(
    `Recorded change from km ${transition.km-1} to ${transition.km}`);
  await changed.locator('summary').filter({hasText:'changed road band'}).click();
  await expect(changed).toContainText(
    `${transition.id}: ${transition.before} → ${transition.after}`);
});

test('guided front-work order is paid only after its 5 km marker',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('bob');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/motor-lab');
  await page.getByLabel('Your chase order').selectOption('ignore');
  await page.getByLabel('Scenario seed').fill('front-work-4');
  await page.locator('summary').filter({hasText:'Other managers'}).click();
  await page.getByLabel('Default tactics for uncustomized managers')
    .selectOption('passive');
  await page.locator('summary').filter({hasText:'Timed team orders'}).click();
  await page.getByLabel('First order marker after').selectOption('10');
  await page.getByLabel('Effort after 10 km for you').selectOption('hard');
  await page.getByLabel('Bunch-front work after 10 km for your team')
    .selectOption('rotate');
  await page.getByLabel('Optional second order marker after')
    .selectOption('20');
  await page.getByLabel('Bunch-front work after 20 km for your team')
    .selectOption('sit_in');
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  await closeDefaultRaceScreen(page);
  expect(coasted.settings.managerTacticalOrdersV4).toEqual([
    {teamId:'you',atKm:10,effort:'hard',frontWork:'rotate'},
    {teamId:'you',atKm:20,frontWork:'sit_in'},
  ]);
  expect(coasted.kilometreFrames[9].paidBunchPaceTeamId).toBeNull();
  expect(coasted.kilometreFrames[10].paidBunchPaceTeamId).toBe('you');
  expect(coasted.kilometreFrames[19].paidBunchPaceTeamId).toBe('you');
  expect(coasted.kilometreFrames[20].paidBunchPaceTeamId).toBeNull();
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('km 11–20 (10 recorded km)');
  await expect(page.locator('.v91-stage-paid-front')).toHaveCount(10);
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-front-work-timeline.png'});
  await page.getByRole('slider',{name:/Recorded kilometre:/}).fill('11');
  const stage=page.getByLabel('Stage and orders at km 11');
  await expect(stage).toContainText('try bunch-front work');
  await expect(stage).toContainText('your team set the pace with you-');
  await expect(stage).toContainText(
    'It does not by itself prove that the bunch accelerated');
  const workers=coasted.kilometreFrames[10].paidBunchPaceRiderIds;
  expect(workers).toHaveLength(2);
  for(const riderId of workers)await expect(stage).toContainText(riderId);
  await stage.screenshot({path:'test-results/guided-front-work-marker.png'});
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
  await page.getByRole('button',{name:'Use 15 km as first order marker'}).click();
  await page.locator('summary').filter({hasText:'Timed team orders'}).click();
  await expect(page.getByLabel('First order marker after')).toHaveValue('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  const responsePromise=page.waitForResponse(response=>
    response.url().endsWith('/api/v91-playtest')&&
    response.request().method()==='POST');
  await page.getByRole('button',{name:'Run the race'}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const {coasted}=await response.json();
  await closeDefaultRaceScreen(page);
  expect(stagePlan.stageTrace).toEqual(coasted.stageTrace);
  expect(coasted.settings.managerTacticalOrdersV2)
    .toEqual([{teamId:'you',atKm:15,effort:'hard'}]);
  const startingEffort=coasted.managerOrders.find(row=>
    row.teamId==='you').effort;
  await page.getByRole('button',{name:'First km after order marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('order markers at km 15 · solid line: viewing km 16');
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
  await page.getByRole('button',{name:'Use 15 km as first order marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as second order marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as first order marker'}).click();
  await expect(page.getByLabel('Stage inputs before tactics'))
    .toContainText('Selected markers: 25 km.');
  await page.getByRole('button',{name:'Use 15 km as first order marker'}).click();
  await page.getByRole('button',{name:'Use 25 km as second order marker'}).click();
  await expect(page.getByLabel('Stage inputs before tactics'))
    .toContainText('Selected markers: 15 km, 25 km');
  await page.getByLabel('Stage inputs before tactics').screenshot({
    path:'test-results/guided-two-stage-markers.png'});
  await page.locator('summary').filter({hasText:'Timed team orders'}).click();
  await expect(page.getByLabel('First order marker after')).toHaveValue('15');
  await page.getByLabel('Effort after 15 km for you').selectOption('hard');
  await expect(page.getByLabel('Optional second order marker after'))
    .toHaveValue('25');
  await page.getByLabel('Effort after 25 km for you').selectOption('steady');
  await page.getByLabel('Bunch-front work after 25 km for your team')
    .selectOption('sit_in');
  await page.getByLabel('Optional second order marker after')
    .selectOption('');
  await page.getByLabel('Optional second order marker after')
    .selectOption('25');
  await expect(page.getByLabel('Effort after 25 km for you')).toHaveValue('');
  await expect(page.getByLabel('Bunch-front work after 25 km for your team'))
    .toHaveValue('');
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
  await closeDefaultRaceScreen(page);
  expect(coasted.settings.managerTacticalOrdersV3).toEqual([
    {teamId:'you',atKm:15,effort:'hard'},
    {teamId:'you',atKm:25,effort:'conserve'},
  ]);
  await expect(page.getByLabel('Recorded stage elevation profile'))
    .toContainText('order markers at km 15, 25');
  await page.getByLabel('Recorded stage elevation profile').screenshot({
    path:'test-results/guided-two-marker-profile.png'});
  await page.getByRole('button',{name:'First km after order marker 15'}).click();
  await expect(page.getByLabel('Stage and orders at km 16'))
    .toContainText('Your active order: hard effort');
  await page.getByRole('button',{name:'First km after order marker 25'}).click();
  await expect(page.getByLabel('Stage and orders at km 26'))
    .toContainText('Your active order: conserve effort');
  await page.getByRole('slider',{name:/Recorded kilometre/}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Stage and orders at km 25'))
    .toContainText('Your active order: hard effort');
  await expect(page.getByRole('region',{name:'Your v93 finish'}))
    .toContainText('Conditional place:');
});
