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

test('entrants in separate divisions read only their private v2 recording',
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
        recorded_at:saved.recorded_at,division_index:2});
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
      expect(own.recording.committedInputs.teams.length).toBe(11);
      expect(own.recording.committedInputs.teams.some(team=>
        team.id==='team-v2rival')).toBe(false);
      const ownDivisionTeams=new Set(own.recording.committedInputs.teams
        .map(team=>team.id));
      for(const rows of [own.teamResults,own.riderResults,own.projectedAwards])
        expect(rows.every(row=>ownDivisionTeams.has(row.teamId))).toBe(true);
      const botTeam=own.recording.committedInputs.teams
        .find(team=>team.id.startsWith('team-v2bot-'));
      expect(Object.keys(botTeam.orders)).toEqual(['captainId']);
      expect(Object.keys(botTeam.riders[0]).sort()).toEqual(['id','name']);
      expect(own.recording.frames[0].teamEnergy).toBeUndefined();
      expect(own.recording.frames[0].riderGroups
        .filter(rider=>rider.teamId===botTeam.id)
        .every(rider=>rider.energy===undefined)).toBe(true);
      expect(own.recording.provisionalResults
        .filter(result=>result.teamId===botTeam.id)
        .every(result=>result.energy===undefined&&result.finaleAbility===undefined))
        .toBe(true);
      const rivalViewer=await rival.request.get(`${endpoint}?event_id=${eventId}`);
      expect(rivalViewer.status(),await rivalViewer.text()).toBe(200);
      const rivalView=await rivalViewer.json();
      expect(rivalView).toMatchObject({divisionIndex:2,focusTeamId:'team-v2rival',
        settled:false});
      expect(rivalView.recording.committedInputs.teams.length).toBe(11);
      expect(rivalView.recording.committedInputs.teams.some(team=>
        team.id==='team-v2manager')).toBe(false);
      const rivalDivisionTeams=new Set(rivalView.recording.committedInputs.teams
        .map(team=>team.id));
      for(const rows of [rivalView.teamResults,rivalView.riderResults,
        rivalView.projectedAwards])
        expect(rows.every(row=>rivalDivisionTeams.has(row.teamId))).toBe(true);
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
      await expect(manager.locator('.tactical-own-results li').first().locator('small'))
        .toContainText(/projected pts/);
      await rival.goto(`/team/v2-race/${eventId}`);
      await expect(rival.getByRole('heading',{name:/Rival team riders/})).toBeVisible();
      await rival.getByRole('button',{name:'Skip 10 km'}).click();
      await rival.getByRole('button',{name:'Skip 10 km'}).click();
      await expect(rival.getByText(/Candidate only; no ranking points were awarded/))
        .toBeVisible();
      await expect(rival.locator('.tactical-own-results li').first().locator('small'))
        .toContainText(/projected pts/);
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
      if(process.env.PELOTONIA_E2E_V2_SETTLEMENT==='true'){
        await expect(manager.getByRole('button',
          {name:'Finish race and award points'})).toBeVisible();
        await manager.getByRole('button',
          {name:'Finish race and award points'}).click();
        await expect(manager.getByText(/PRIVATE V2 FINAL RESULT/)).toBeVisible();
        await expect(manager.getByText(/Ranking points have been awarded/))
          .toBeVisible();
        await manager.getByRole('button',{name:'See final result'}).click();
        await expect(manager.getByText(/The points are included in the ranking ledger/))
          .toBeVisible();
        await expect(manager.locator('.tactical-own-results li').first().locator('small'))
          .toContainText(/ranking pts/);
        const finalView=await manager.request.get(`${endpoint}?event_id=${eventId}`);
        expect(finalView.status(),await finalView.text()).toBe(200);
        expect(await finalView.json()).toMatchObject({settled:true,pointsFinal:true,
          canSettle:false});
        const retry=await manager.request.post('/api/event/v2-recording/settle',{
          headers,data:{event_id:eventId}});
        expect(retry.status(),await retry.text()).toBe(200);
        expect(await retry.json()).toMatchObject({ok:true,already_settled:true});
        expect((await outsider.request.post('/api/event/v2-recording/settle',{
          headers,data:{event_id:eventId}})).status()).toBe(403);
        await rival.reload();
        await expect(rival.getByText(/PRIVATE V2 FINAL RESULT/)).toBeVisible();
        await mobile.reload();
        await expect(mobile.getByText(/PRIVATE V2 FINAL RESULT/)).toBeVisible();
        await mobile.getByRole('button',{name:'See final result'}).click();
        expect(await mobile.evaluate(()=>document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(390);
        if(process.env.PELOTONIA_VIEWER_SCREENSHOT==='1'){
          await manager.screenshot({path:'.recovery-local/v2-final-viewer.png',
            fullPage:true});
          await mobile.screenshot({path:'.recovery-local/v2-final-viewer-390.png',
            fullPage:true});
        }
      }
    }finally{
      await Promise.all(contexts.map(context=>context.close()));
    }
  });
