import {test,expect} from '@playwright/test';

const eventId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const endpoint='/api/event/v2-recording/prepare';
const headers={Origin:'http://localhost:3100'};

async function signIn(page,name){
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password').fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
}

test('two entrants share one private recorded v2 candidate without exposing results',
  async({browser})=>{
    test.skip(process.env.PELOTONIA_E2E_V2_RECORDING!=='true',
      'The isolated v2 recording fixture must be enabled explicitly.');
    const contexts=await Promise.all(Array.from({length:3},()=>browser.newContext()));
    try{
      const [manager,rival,outsider]=await Promise.all(contexts.map(context=>context.newPage()));
      await Promise.all([signIn(manager,'v2manager'),signIn(rival,'v2rival'),
        signIn(outsider,'v2outsider')]);
      const request=(page,data)=>page.request.post(endpoint,{
        headers,data:{event_id:eventId,...data}});
      const first=await request(manager,{});
      expect(first.status(),await first.text()).toBe(200);
      const saved=await first.json();
      expect(saved).toMatchObject({ok:true,event_id:eventId,
        division_index:1,already_recorded:false});
      expect(saved.recorded_at).toBeTruthy();
      expect(JSON.stringify(saved)).not.toMatch(/recording|resultContract|awards|riderResults/);
      const second=await request(rival,{});
      expect(second.status(),await second.text()).toBe(200);
      expect(await second.json()).toMatchObject({already_recorded:true,
        recorded_at:saved.recorded_at});
      expect((await request(outsider,{})).status()).toBe(403);
      expect((await request(manager,{team_id:'team-v2rival'})).status()).toBe(403);
      expect((await manager.request.post(endpoint,{
        headers:{Origin:'https://foreign.invalid'},
        data:{event_id:eventId}})).status()).toBe(403);
      const viewer=await manager.request.get(`${endpoint}?event_id=${eventId}`);
      expect(viewer.status(),await viewer.text()).toBe(200);
      const own=await viewer.json();
      expect(own).toMatchObject({eventId,divisionIndex:1,settled:false,
        focusTeamId:'team-v2manager',recordedAt:saved.recorded_at});
      expect(own.recording.committedInputs.teams.length).toBe(2);
      const rivalTeam=own.recording.committedInputs.teams
        .find(team=>team.id==='team-v2rival');
      expect(Object.keys(rivalTeam.orders)).toEqual(['captainId']);
      expect(Object.keys(rivalTeam.riders[0]).sort()).toEqual(['id','name']);
      expect(own.recording.frames[0].teamEnergy).toBeUndefined();
      expect(own.recording.frames[0].riderGroups
        .filter(rider=>rider.teamId==='team-v2rival')
        .every(rider=>rider.energy===undefined)).toBe(true);
      expect(own.recording.provisionalResults
        .filter(result=>result.teamId==='team-v2rival')
        .every(result=>result.energy===undefined&&result.finaleAbility===undefined))
        .toBe(true);
      const rivalViewer=await rival.request.get(`${endpoint}?event_id=${eventId}`);
      expect(rivalViewer.status(),await rivalViewer.text()).toBe(200);
      expect((await rivalViewer.json()).focusTeamId).toBe('team-v2rival');
      expect((await outsider.request.get(`${endpoint}?event_id=${eventId}`)).status())
        .toBe(403);
      expect((await manager.request.get(`${endpoint}?event_id=${eventId}&team_id=team-v2rival`))
        .status()).toBe(403);
      await manager.goto(`/team/v2-race/${eventId}`);
      await expect(manager.getByText(/PRIVATE V2 RECORDING CANDIDATE/)).toBeVisible();
      await expect(manager.getByRole('heading',{name:/Manager team riders/})).toBeVisible();
      await expect(manager.getByLabel('Watch team')).toHaveCount(0);
      await manager.getByRole('button',{name:'Skip 10 km'}).click();
      await manager.getByRole('button',{name:'Skip 10 km'}).click();
      await expect(manager.getByText(/Candidate only; no ranking points were awarded/))
        .toBeVisible();
      if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
        await manager.screenshot({path:'.recovery-local/v2-private-viewer.png',
          fullPage:true});
      const mobileContext=await browser.newContext({viewport:{width:390,height:844}});
      contexts.push(mobileContext);
      const mobile=await mobileContext.newPage();
      await signIn(mobile,'v2manager');
      await mobile.goto(`/team/v2-race/${eventId}`);
      await expect(mobile.getByText(/PRIVATE V2 RECORDING CANDIDATE/)).toBeVisible();
      expect(await mobile.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1')
        await mobile.screenshot({path:'.recovery-local/v2-private-viewer-390.png',
          fullPage:true});
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
