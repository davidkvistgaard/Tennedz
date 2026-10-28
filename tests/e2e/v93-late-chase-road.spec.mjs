import {test,expect} from '@playwright/test';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The isolated v93 workbench is disabled.');

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

test('a late paid chase catch shows recorded road and withholds awards',
  async({page})=>{
    test.setTimeout(60000);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const seed='guided-finish-coverage-19',terrain='mountain';
    const settings={distanceKm:260,terrain,teamCount:20,fatigue:0,
      attack:'none',chase:'ignore',seed,
      managerTactics:resolveRandomRivalTactics({teamCount:20,
        random:seededRandom(`${seed}:${terrain}:0`)})};
    const plans=prepareV91Playtest(settings).teams.map(team=>({
      teamId:team.id,finisherId:team.orders.captainId,
      leadOutRiderId:null}));
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{mode:'v93-coasted',
        plans,settings}});
    expect(response.status()).toBe(422);
    const body=await response.json();
    expect(body.roadPreview,JSON.stringify(body)).toBeDefined();
    expect(body.roadPreview.version).toBe(
      'v93-paid-late-chase-catch-road-preview-1');
    expect(body.roadPreview.lastKmRoad).toHaveLength(7);
    expect(body.roadPreview.lineTimes).toBeNull();
    expect(body.roadPreview.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:422,contentType:'application/json',
      body:JSON.stringify(body)}));
    await page.getByRole('button',{
      name:'Run v93 race preview'}).click();
    const preview=page.getByRole('region',{
      name:'Recorded road without individual finish'});
    await expect(preview).toContainText(
      'The group-level final-kilometre road is paid through the line.');
    await expect(preview).toContainText(
      'Individual finish, replay and points are withheld');
    await expect(preview.getByRole('slider',{
      name:/Recorded road boundary/})).toHaveValue('6');
  });

test('pre-500 m bunch drops show paid two-front road without a finish',
  async({page})=>{
    test.setTimeout(60000);
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const seed='guided-finish-coverage-39',terrain='mountain';
    const settings={distanceKm:260,terrain,teamCount:20,fatigue:0,
      attack:'none',chase:'ignore',seed,
      managerTactics:resolveRandomRivalTactics({teamCount:20,
        random:seededRandom(`${seed}:${terrain}:0`)})};
    const plans=prepareV91Playtest(settings).teams.map(team=>({
      teamId:team.id,finisherId:`${team.id}-7`,
      leadOutRiderId:null}));
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{mode:'v93-coasted',
        plans,settings}});
    expect(response.status()).toBe(422);
    const body=await response.json();
    expect(body.roadPreview?.version).toBe(
      'v93-paid-pre500-bunch-drop-road-preview-1');
    expect(body.roadPreview.lastKmRoad).toHaveLength(7);
    expect(body.roadPreview.lineBands.at(-1).lastPossiblePlace).toBe(160);
    expect(body.roadPreview.lineTimes).toBeNull();
    expect(body.roadPreview.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:422,contentType:'application/json',
      body:JSON.stringify(body)}));
    await page.getByRole('button',{
      name:'Run v93 race preview'}).click();
    const preview=page.getByRole('region',{
      name:'Recorded road without individual finish'});
    await expect(preview).toContainText(
      'The two-front group road is paid through the line.');
    await expect(preview).toContainText('The line bands are unordered');
    await expect(preview.getByRole('slider',{
      name:/Recorded road boundary/})).toHaveValue('6');
  });
