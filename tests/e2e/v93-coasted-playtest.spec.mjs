import {test,expect} from '@playwright/test';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The isolated v93 workbench is disabled.');

test('dissolved front shows a paid conditional finish and replay',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const teamIds=['you','rival-1','rival-2','rival-3'];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
        mode:'v93-coasted',settings:{distanceKm:260,teamCount:4,
          gender:'M',terrain:'rolling',fatigue:30,
          seed:'v93-expanded-61-a',defaultRivalPlan:'passive',
          effort:'hard',attack:'repeated',chase:'selective',
          profileHeightsM:[900,700,300,500,200,100],
          managerTactics:[
            {effort:'steady',attack:'none',chase:'selective'},
            {effort:'hard',attack:'selective',chase:'all'},
            {effort:'hard',attack:'repeated',chase:'ignore'}]},
        plans:teamIds.map(teamId=>({teamId,
          finisherId:`${teamId}-7`,leadOutRiderId:null})),
        pointContext:{tier:3,divisionIndex:2,divisionCount:4}}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    const {coasted}=body;
    expect(coasted.version).toBe('v93-dissolved-front-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.bandReplays).toHaveLength(7);
    expect(coasted.provisionalLineOrder).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    expect(coasted.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('button',{name:'Set up sample race'}).click();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    await expect(page.getByRole('note',{name:'Paid front dissolution'}))
      .toContainText('3 exhausted riders left road-2');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'})).toBeVisible();
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('Read-only points:');
    await page.getByLabel('Road band').selectOption('isolated:you-5');
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText('you-5');
  });

test('sample race opens the playable setup and links the recorded result',
  async({page})=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    const sampleButton=page.getByRole('button',{name:'Set up sample race'});
    await expect(sampleButton).toBeInViewport();
    const sampleButtonBox=await sampleButton.boundingBox();
    expect(sampleButtonBox.y+sampleButtonBox.height).toBeLessThanOrEqual(844);
    await sampleButton.click();
    await expect(page.getByRole('checkbox',
      {name:'Continue to a conditional finish'})).toBeChecked();
    await expect(page.getByRole('checkbox',
      {name:'Try v93 road-to-line preview'})).toBeChecked();
    await expect(page.getByLabel('Distance')).toHaveValue('40');
    await expect(page.getByLabel('Route profile')).toHaveValue('flat');
    await expect(page.getByLabel('Your attack')).toHaveValue('none');
    await expect(page.getByLabel('Scenario seed'))
      .toHaveValue('sample-flat-finish');
    await expect(page.getByRole('checkbox',
      {name:'Show read-only point illustration'})).toBeChecked();
    const briefing=page.getByRole('region',
      {name:'Race plan before running'});
    await expect(briefing).toContainText('40 km Flat · Men · 4 teams');
    await expect(briefing).toContainText('you-7 nominated · no lead-out helper');
    await expect(briefing).toContainText('Read-only illustration, tier 2');
    await expect(page.getByRole('button',
      {name:'Run v93 race preview'})).toBeInViewport();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.lineTimes).toHaveLength(32);
    const ownPlace=coasted.provisionalLineOrder.find(row=>
      row.riderId==='you-7').position;
    const ownPreview=coasted.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    expect(ownPreview.previewPoints).toBe(pointsForDivisionResult({
      tier:coasted.pointPreview.tier,resultType:'ONE_DAY',
      placing:ownPlace,multiplier:coasted.pointPreview.multiplier}));
    expect(coasted.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText(`Conditional place: ${ownPlace} · Read-only points: ${
        ownPreview.previewPoints}`);
    const results=page.getByRole('table',
      {name:'V93 individual conditional results'});
    await page.getByLabel('Results team').selectOption('you');
    await expect(results.getByRole('row')).toHaveCount(9);
    await results.getByRole('button',{name:'Replay you-7'}).click();
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText('you-7:');
    await page.getByLabel('Results team').selectOption('all');
    await expect(results.getByRole('row')).toHaveCount(33);
    const navigation=page.getByRole('navigation',{name:'Explore this race'});
    for(const [name,id] of [
      ['Your finish','v93-your-finish'],
      ['Recorded road','v93-recorded-road'],
      ['Individual results','v93-conditional-results'],
      ['Rider replay','v93-paid-finale-replay']]){
      await navigation.getByRole('link',{name}).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await page.getByLabel('Your effort').selectOption('hard');
    await expect(briefing).toContainText('Hard effort');
    const raceResult=page.getByRole('region',
      {name:'V93 coasted race preview'});
    await expect(raceResult.getByRole('status')).toContainText(
      'The road, finish and replay below still show the previous run.');
    const rerunPromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const rerun=await rerunPromise;
    expect(rerun.status()).toBe(200);
    expect((await rerun.json()).coasted.settings.effort).toBe('hard');
    await expect(raceResult.getByRole('status')).toHaveCount(0);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('switching previews shows only tactics used by the selected race',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',
      {name:'Continue to a conditional finish'}).check();
    await page.getByLabel('Named attack manager').selectOption('you');
    await page.getByLabel('Second attack manager').selectOption('rival-2');
    await page.getByLabel('you last-kilometre front work')
      .selectOption('rotate');
    await page.getByRole('checkbox',
      {name:'Try v93 road-to-line preview'}).check();
    await expect(page.getByLabel('Named attack manager')).toHaveCount(0);
    await expect(page.getByLabel('you last-kilometre front work'))
      .toHaveCount(0);
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Your attack').selectOption('none');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.settings).toMatchObject({distanceKm:40,terrain:'flat'});
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.managerOrders.find(row=>row.teamId==='you')
      .phaseOrders).toEqual([]);
    await page.getByRole('checkbox',
      {name:'Try v93 road-to-line preview'}).uncheck();
    await expect(page.getByLabel('you last-kilometre front work'))
      .toHaveValue('rotate');
  });

test('two managers play one selected race from orders to road, line and replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('button',{name:'Set up two-manager race'}).click();
    await expect(page.getByLabel('Distance')).toHaveValue('120');
    await expect(page.getByLabel('Route profile')).toHaveValue('rolling');
    await expect(page.getByLabel('Category')).toHaveValue('F');
    await expect(page.getByLabel('Field size')).toHaveValue('15');
    await expect(page.getByLabel('Starting fatigue')).toHaveValue('15');
    await expect(page.getByLabel('Your attack')).toHaveValue('none');
    await expect(page.getByLabel('rival-14 effort')).toHaveValue('hard');
    await expect(page.getByLabel('5 km to go effort for rival-14'))
      .toHaveValue('conserve');
    await expect(page.getByLabel('you lead-out helper'))
      .toHaveValue('you-6');
    await expect(page.getByLabel('rival-14 finisher'))
      .toHaveValue('rival-14-3');
    await expect(page.getByRole('region',
      {name:'Race plan before running'}))
      .toContainText('1 with your own tactics · 13 use mixed defaults');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.settings).toMatchObject({distanceKm:120,terrain:'rolling',
      gender:'F',teamCount:15,fatigue:15,seed:'late-phase-6'});
    expect(coasted.managerOrders).toHaveLength(15);
    expect(coasted.managerOrders.find(row=>row.teamId==='you')
      .phaseOrders).toEqual([{atKm:115,effort:'hard'}]);
    expect(coasted.managerOrders.find(row=>row.teamId==='rival-14'))
      .toMatchObject({effort:'hard',attack:'none',chase:'all',
        phaseOrders:[{atKm:115,effort:'conserve'}]});
    expect(coasted.managerDecisions.find(row=>row.teamId==='you'))
      .toMatchObject({finisherId:'you-7',leadOutRiderId:'you-6'});
    expect(coasted.managerDecisions.find(row=>row.teamId==='rival-14'))
      .toMatchObject({finisherId:'rival-14-3',
        leadOutRiderId:'rival-14-5'});
    expect(coasted.kilometreFrames).toHaveLength(119);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(120000);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.leadOutWork.filter(row=>row.riderId==='you-6'))
      .toHaveLength(2);
    expect(coasted.leadOutWork.filter(row=>row.riderId==='rival-14-5'))
      .toHaveLength(2);
    expect(coasted.leadOutWork.every(row=>row.energySpent>0)).toBe(true);
    expect(coasted.pointsStatus).toBe('withheld');
    expect(coasted.pointPreview.awardRows).toEqual([]);
    expect(coasted.pointPreview.riders).toHaveLength(120);
    const ownLine=coasted.lineTimes.find(row=>row.riderId==='you-7');
    const ownPreview=coasted.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    const ownPlace=coasted.provisionalLineOrder.find(row=>
      row.riderId==='you-7').position;
    expect(ownPreview.provisionalPlace).toBe(ownPlace);
    expect(ownPreview.previewPoints).toBe(pointsForDivisionResult({
      tier:coasted.pointPreview.tier,resultType:'ONE_DAY',
      placing:ownPlace,multiplier:coasted.pointPreview.multiplier}));
    await expect(page.getByRole('heading',
      {name:'V93 race preview · 120 km rolling'})).toBeVisible();
    const locked=page.getByLabel('Locked v93 manager orders');
    await locked.locator('summary').click();
    await expect(locked).toContainText('you: steady effort · none attack');
    await expect(locked).toContainText('finisher you-7 · lead-out you-6');
    await expect(locked).toContainText('At 115 km: effort: hard');
    await expect(locked).toContainText('rival-14: hard effort · none attack · all chase');
    await expect(locked).toContainText(
      'finisher rival-14-3 · lead-out rival-14-5');
    await expect(locked).toContainText('At 115 km: effort: conserve');
    const firstFrame=coasted.kilometreFrames[0];
    const changes=page.getByLabel('Recorded road changes');
    await changes.locator('summary').click();
    await expect(changes).toContainText(
      'No road-group or isolation changes before the final kilometre.');
    const road=page.getByRole('slider',{name:/Recorded kilometre/});
    await road.fill('1');
    await expect(page.getByText(`Road groups: ${firstFrame.roadGroups.map(
      group=>`${group.id} (${group.riderIds.length} riders, ${
        group.gapSeconds.toFixed(1)} s ahead)`).join(' · ')||'none'}`))
      .toBeVisible();
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText(`Conditional place: ${ownPlace} · Read-only points: ${
        ownPreview.previewPoints}`);
    await expect(page.getByRole('table',
      {name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    for(const riderId of ['you-7','rival-14-3']){
      const line=coasted.lineTimes.find(row=>row.riderId===riderId);
      await page.getByRole('button',{name:`Replay ${riderId}`}).click();
      const interval=page.getByRole('slider',{name:/Band interval/});
      await interval.fill(await interval.getAttribute('max'));
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(`Crossed at ${
          line.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${
          line.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${
          line.energyAtLine.toFixed(1)} energy.`);
    }
    await expect(page.getByText(
      'Official points: withheld · Awards saved: 0')).toBeVisible();
    expect(errors).toEqual([]);
  });

test('a five-kilometre effort change reaches the paid line and points',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('late-phase-6');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const run=async()=>{
      const responsePromise=page.waitForResponse(response=>
        response.url().endsWith('/api/v91-playtest')&&
        response.request().method()==='POST');
      await page.getByRole('button',{name:'Run v93 race preview'}).click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      return (await response.json()).coasted;
    };
    await page.getByLabel('5 km to go effort for you')
      .selectOption('conserve');
    const before=await run();
    await page.getByLabel('5 km to go effort for you')
      .selectOption('hard');
    const after=await run();
    for(const [summary,effort] of [[before,'conserve'],[after,'hard']]){
      expect(summary.managerOrders.find(row=>row.teamId==='you')
        .phaseOrders).toEqual([{atKm:115,effort}]);
      expect(summary.lineTimes).toHaveLength(120);
      expect(summary.lastKmRoad.at(-1).distanceM).toBe(120000);
      expect(summary.pointPreview.awardRows).toEqual([]);
      expect(summary.pointsStatus).toBe('withheld');
    }
    const own=summary=>summary.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    expect(own(before).provisionalPlace).toBe(12);
    expect(own(after).provisionalPlace).toBe(13);
    expect(own(before).previewPoints).toBe(18);
    expect(own(after).previewPoints).toBe(15);
    expect(own(before).energyAtLine)
      .toBeGreaterThan(own(after).energyAtLine);
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'}))
      .toContainText('Conditional place: 12 → 13');
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'}))
      .toContainText('Read-only points: 18 (place 12) → 15 (place 13)');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    const rider=after.lineTimes.find(row=>row.riderId==='you-7');
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${rider.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${rider.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${rider.energyAtLine.toFixed(1)} energy.`);
    expect(errors).toEqual([]);
  });
test('a mobile manager plays a medium women race with a distant rival',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.setViewportSize({width:390,height:844});
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('mobile-rolling');
    await page.getByLabel('Choose another rival manager')
      .selectOption('rival-14');
    await page.getByRole('button',{name:'Add rival manager'}).click();
    await page.getByLabel('rival-14 effort').selectOption('hard');
    await page.getByLabel('rival-14 attack').selectOption('none');
    await page.getByLabel('rival-14 chase').selectOption('all');
    await page.getByLabel('rival-14 finisher').selectOption('rival-14-3');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const setupWidth=await page.evaluate(()=>({width:
      document.documentElement.scrollWidth,
      offenders:[...document.querySelectorAll('body *')].filter(element=>
        element.getBoundingClientRect().right>window.innerWidth+1)
        .slice(0,15).map(element=>({tag:element.tagName,
          className:element.className,
          label:element.closest('label')?.textContent,
          width:element.getBoundingClientRect().width,
          right:element.getBoundingClientRect().right}))}));
    expect(setupWidth.width,JSON.stringify(setupWidth.offenders))
      .toBeLessThanOrEqual(390);
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(120000);
    expect(coasted.managerOrders).toHaveLength(15);
    expect(coasted.managerOrders.find(row=>row.teamId==='rival-14'))
      .toMatchObject({effort:'hard',attack:'none',chase:'all'});
    expect(coasted.managerDecisions.find(row=>row.teamId==='rival-14'))
      .toMatchObject({finisherId:'rival-14-3'});
    expect(coasted.pointPreview.riders).toHaveLength(120);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 120 km rolling'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    const rider=coasted.lineTimes.find(row=>row.riderId==='rival-14-3');
    await page.getByRole('button',{name:'Replay rival-14-3'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${rider.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${rider.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${rider.energyAtLine.toFixed(1)} energy.`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });

test('a named distant rival keeps its tactics and finisher through the road replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Managers with your own tactics').selectOption('1');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Choose another rival manager')
      .selectOption('rival-3');
    await page.getByRole('button',{name:'Add rival manager'}).click();
    await page.getByLabel('rival-3 effort').selectOption('conserve');
    await page.getByLabel('rival-3 chase').selectOption('ignore');
    await page.getByLabel('rival-3 finisher').selectOption('rival-3-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.settings.managerTactics).toHaveLength(1);
    expect(coasted.settings.managerTactics[0].effort).toBe('hard');
    expect(coasted.settings.managerTacticOverrides).toHaveLength(1);
    expect(coasted.settings.managerTacticOverrides[0])
      .toMatchObject({teamId:'rival-3',effort:'conserve',chase:'ignore'});
    expect(coasted.managerOrders.find(row=>row.teamId==='rival-3'))
      .toMatchObject({effort:'conserve',chase:'ignore'});
    expect(coasted.managerDecisions.find(row=>row.teamId==='rival-3'))
      .toMatchObject({finisherId:'rival-3-4'});
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(40000);
    expect(coasted.pointsStatus).toBe('withheld');
    expect(coasted.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 40 km flat'})).toBeVisible();
    await expect(page.getByText('2 custom rival managers',{
      exact:false})).toBeVisible();
    const finisher=coasted.lineTimes.find(row=>
      row.riderId==='rival-3-4');
    await page.getByRole('button',{name:'Replay rival-3-4'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${finisher.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${finisher.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${finisher.energyAtLine.toFixed(1)} energy.`);
    await page.getByLabel('rival-3 effort').selectOption('hard');
    const afterResponsePromise=page.waitForResponse(result=>
      result.url().endsWith('/api/v91-playtest')&&
      result.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const afterResponse=await afterResponsePromise;
    expect(afterResponse.status()).toBe(200);
    const after=(await afterResponse.json()).coasted;
    const afterFinisher=after.lineTimes.find(row=>
      row.riderId==='rival-3-4');
    expect(after.managerOrders.find(row=>row.teamId==='rival-3'))
      .toMatchObject({effort:'hard',chase:'ignore'});
    expect(after.lineTimes).toHaveLength(32);
    expect(after.pointsStatus).toBe('withheld');
    expect(after.pointPreview?.awardRows??[]).toEqual([]);
    const changedRivals=page.getByLabel('Changed rival manager outcomes');
    await changedRivals.locator('summary').click();
    await expect(changedRivals).toContainText(
      'rival-3 · Effort: conserve → hard');
    await expect(changedRivals).toContainText(
      `Road band: ${finisher.roadBandId} → ${afterFinisher.roadBandId}`);
    await expect(changedRivals).toContainText(
      `Crossing: ${finisher.elapsedSecondsFromLastKmStart.toFixed(3)} s → ${afterFinisher.elapsedSecondsFromLastKmStart.toFixed(3)} s`);
    await expect(changedRivals).toContainText(
      `Energy at line: ${finisher.energyAtLine.toFixed(1)} → ${afterFinisher.energyAtLine.toFixed(1)}`);
    await expect(changedRivals).toContainText('Conditional place:');
    const previewPoints=race=>race.pointPreview?.riders?.find(row=>
      row.riderId==='rival-3-4')?.previewPoints??'unavailable';
    await expect(changedRivals).toContainText(
      `Read-only points: ${previewPoints(coasted)} → ${previewPoints(after)}`);
    await page.getByLabel('Managers with your own tactics').selectOption('3');
    await expect(page.getByLabel('Rival 3 effort')).toHaveValue('hard');
    await expect(page.getByLabel('Rival 3 chase')).toHaveValue('ignore');
    await expect(page.getByLabel('rival-3 effort',{exact:true}))
      .toHaveCount(0);
    expect(errors).toEqual([]);
  });

test('exhausted v93 road pays two manager lead-outs and shows conditional line',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('cross-route-1');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByLabel('you lead-out helper').selectOption('you-6');
    await page.getByLabel('rival-2 lead-out helper')
      .selectOption('rival-2-5');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.tuningVersion).toBe('v2-prototype-93-candidate');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.leadOutWork.some(row=>row.riderId==='you-6'))
      .toBe(true);
    expect(coasted.leadOutWork.some(row=>row.riderId==='rival-2-5'))
      .toBe(true);
    expect(coasted.pointsStatus).toBe('withheld');
    expect(coasted.managerOrders).toHaveLength(4);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km flat'})).toBeVisible();
    const lockedOrders=page.getByLabel('Locked v93 manager orders');
    await lockedOrders.locator('summary').click();
    const ownOrder=coasted.managerOrders.find(row=>row.teamId==='you');
    await expect(lockedOrders).toContainText(
      `you: ${ownOrder.effort} effort · ${ownOrder.attack} attack · ${ownOrder.chase} chase · finisher you-4 · lead-out you-6`);
    const defaultOrder=coasted.managerOrders.find(row=>
      row.teamId==='rival-3');
    await expect(lockedOrders).toContainText(
      `rival-3: ${defaultOrder.effort} effort · ${defaultOrder.attack} attack · ${defaultOrder.chase} chase`);
    await page.getByLabel('Your effort').selectOption('hard');
    await expect(lockedOrders).toContainText(
      `you: ${ownOrder.effort} effort`);
    await page.getByLabel('Your effort').selectOption(ownOrder.effort);
    const ownFinish=page.getByRole('region',{name:'Your v93 finish'});
    const ownLine=coasted.lineTimes.find(row=>row.riderId==='you-4');
    const helperWork=coasted.leadOutWork.filter(row=>
      row.riderId==='you-6').reduce((sum,row)=>sum+row.energySpent,0);
    await expect(ownFinish).toContainText(
      `Nominated finisher: you-4 · ${ownLine.roadBandId}`);
    await expect(ownFinish).toContainText(
      `${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s`);
    await expect(ownFinish).toContainText('Read-only points: unavailable');
    await expect(ownFinish).toContainText(
      `Lead-out helper: you-6 · ${helperWork.toFixed(2)} energy`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(/Lead-out work:.*you-6/))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    const road=page.getByRole('slider',{name:/Road boundary/});
    await road.fill(await road.getAttribute('max'));
    await expect(page.getByText(/260\.000 km · bunch passage/))
      .toBeVisible();
    await page.getByLabel('you lead-out helper').selectOption('');
    await page.getByLabel('rival-2 lead-out helper').selectOption('');
    const noHelpers=page.waitForResponse(result=>
      result.url().endsWith('/api/v91-playtest')&&
      result.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const unassisted=(await (await noHelpers).json()).coasted;
    expect(unassisted.pointPreview.riders).toHaveLength(32);
    expect(unassisted.pointPreview.awardRows).toEqual([]);
    expect(unassisted.pointPreview.riders.every(row=>
      Number.isFinite(row.previewPoints))).toBe(true);
    const unassistedPoints=unassisted.pointPreview.riders.find(row=>
      row.riderId==='you-4');
    const unassistedPlace=unassisted.provisionalLineOrder.find(row=>
      row.riderId==='you-4').position;
    await expect(ownFinish).toContainText(
      `Conditional place: ${unassistedPlace} ·`);
    await expect(ownFinish).toContainText(
      `Read-only points: ${unassistedPoints.previewPoints}`);
    await expect(ownFinish).toContainText(
      'Lead-out helper: none · 0.00 energy of recorded work.');
    const comparison=page.getByRole('region',{
      name:'Paired v93 race comparison'});
    await expect(comparison).toContainText(
      'Previous preview on the same conditions');
    await expect(comparison).toContainText(
      `Lead-out: you-6 (${helperWork.toFixed(2)} energy paid) → none (0.00 energy paid)`);
    await expect(comparison).toContainText(
      `Nominated finisher crossing: you-4 ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s → you-4 ${unassisted.lineTimes.find(row=>row.riderId==='you-4').elapsedSecondsFromLastKmStart.toFixed(3)} s`);
    await expect(comparison).toContainText(
      `Read-only points: unavailable (`);
    await expect(comparison).toContainText(
      `${unassistedPoints.previewPoints} (place ${unassistedPlace})`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row',{
      name:new RegExp(`^${unassistedPlace} you-4 `)}))
      .toBeVisible();
    const displayedOrder=await page.getByRole('table',{
      name:'V93 individual conditional results'})
      .locator('tbody tr').evaluateAll(rows=>rows.map(row=>({
        position:Number(row.cells[0].textContent),
        riderId:row.cells[1].textContent})));
    expect(displayedOrder).toEqual(unassisted.provisionalLineOrder
      .map(row=>({position:row.position,riderId:row.riderId})));
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('a changed v93 route does not compare unrelated races',async({page})=>{
  await page.goto('/login');
  await page.getByLabel('Email or username').fill('v2manager');
  await page.getByLabel('Password',{exact:true}).fill('fixture-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/v91-playtest');
  await page.getByRole('checkbox',{
    name:'Continue to a conditional finish'}).check();
  await page.getByRole('checkbox',{
    name:'Try v93 road-to-line preview'}).check();
  await page.getByLabel('Distance').selectOption('40');
  await page.getByLabel('Scenario seed').fill('playtest-1');
  await page.getByRole('button',{name:'Run v93 race preview'}).click();
  await expect(page.getByRole('heading',{
    name:'V93 race preview · 40 km flat'})).toBeVisible();
  await page.getByLabel('Distance').selectOption('120');
  await page.getByRole('button',{name:'Run v93 race preview'}).click();
  await expect(page.getByRole('heading',{
    name:'V93 race preview · 120 km flat'})).toBeVisible();
  await expect(page.getByRole('region',{
    name:'Paired v93 race comparison'})).toHaveCount(0);
});

test('edited custom elevation reaches the v93 road, line and replay',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Scenario seed').fill('custom-elevation-v93');
    for(const point of ['Start','20%','40%','60%','80%','Finish'])
      await page.getByLabel(`${point} (m)`).fill('100');
    const run=async()=>{
      const responsePromise=page.waitForResponse(response=>
        response.url().endsWith('/api/v91-playtest')&&
        response.request().method()==='POST');
      await page.getByRole('button',{name:'Run v93 race preview'}).click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      return (await response.json()).coasted;
    };
    const level=await run();
    expect(level.settings.profileHeightsM).toEqual([100,100,100,100,100,100]);
    await page.getByLabel('20% (m)').fill('300');
    const climb=await run();
    expect(climb.settings.profileHeightsM).toEqual([100,300,100,100,100,100]);
    expect(climb.kilometreFrames).toHaveLength(39);
    expect(climb.lineTimes).toHaveLength(32);
    expect(climb.kilometreFrames[0].ownRiders).not.toEqual(
      level.kilometreFrames[0].ownRiders);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 40 km custom'})).toBeVisible();
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'})).toHaveCount(0);
    const line=climb.lineTimes.find(row=>row.riderId==='you-7');
    expect(line).toBeDefined();
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${line.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('one rival chase changes the recorded v93 road, line and replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2manager');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('1');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const run=async()=>{
      const responsePromise=page.waitForResponse(response=>
        response.url().endsWith('/api/v91-playtest')&&
        response.request().method()==='POST');
      await page.getByRole('button',{name:'Run v93 race preview'}).click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      return (await response.json()).coasted;
    };
    const before=await run();
    expect(before.version).toBe('v93-separated-playtest-1');
    expect(before.lineTimes).toHaveLength(32);
    expect(before.kilometreFrames.at(-1).roadGroups).toHaveLength(2);
    expect(before.kilometreFrames.at(-1).droppedRiders).toHaveLength(0);
    const beforeLine=before.lineTimes.find(row=>row.riderId==='you-7');
    expect(beforeLine.roadBandId).toBe('road-2');
    expect(before.provisionalLineOrder.find(row=>row.riderId==='you-7')
      .position).toBe(3);

    await page.getByLabel('Rival 1 chase').selectOption('all');
    const after=await run();
    expect(after.version).toBe('v93-separated-playtest-1');
    expect(after.kilometreFrames.at(-1).roadGroups).toHaveLength(2);
    expect(after.kilometreFrames.at(-1).droppedRiders).toHaveLength(0);
    expect(after.kilometreFrames.at(-1).roadGroups[0].id)
      .not.toBe(before.kilometreFrames.at(-1).roadGroups[0].id);
    expect(after.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(after.lastKmRoad.at(-1).droppedPassages).toHaveLength(0);
    expect(after.lineTimes).toHaveLength(32);
    const afterLine=after.lineTimes.find(row=>row.riderId==='you-7');
    expect(afterLine.roadBandId).toBe('peloton');
    expect(afterLine.elapsedSecondsFromLastKmStart)
      .toBeGreaterThan(beforeLine.elapsedSecondsFromLastKmStart);
    expect(after.provisionalLineOrder.find(row=>row.riderId==='you-7')
      .position).toBe(9);
    expect(after.pointsStatus).toBe('withheld');
    expect(after.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'})).toContainText(
      'Conditional place: 3 → 9');
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('Conditional place: 9');
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${afterLine.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${afterLine.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${afterLine.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('one player attack changes the recorded front, result and paid replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2manager');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const run=async()=>{
      const responsePromise=page.waitForResponse(response=>
        response.url().endsWith('/api/v91-playtest')&&
        response.request().method()==='POST');
      await page.getByRole('button',{name:'Run v93 race preview'}).click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      return (await response.json()).coasted;
    };
    const before=await run();
    expect(before.version).toBe('v93-separated-playtest-1');
    expect(before.lineTimes).toHaveLength(32);
    expect(before.kilometreFrames.at(-1).roadGroups).toHaveLength(2);
    const beforeLine=before.lineTimes.find(row=>row.riderId==='you-7');
    expect(beforeLine.roadBandId).toBe('peloton');
    expect(before.provisionalLineOrder.find(row=>row.riderId==='you-7')
      .position).toBe(7);
    const beforePoints=before.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    expect(beforePoints.previewPoints).toBe(pointsForDivisionResult({
      tier:before.pointPreview.tier,resultType:'ONE_DAY',placing:7,
      multiplier:before.pointPreview.multiplier}));

    await page.getByLabel('Your attack').selectOption('repeated');
    const after=await run();
    expect(after.version).toBe('v93-separated-playtest-1');
    expect(after.kilometreFrames.at(-1).roadGroups).toHaveLength(2);
    expect(after.kilometreFrames.at(-1).roadGroups[0].riderIds)
      .toContain('you-7');
    expect(after.lineTimes).toHaveLength(32);
    const afterLine=after.lineTimes.find(row=>row.riderId==='you-7');
    expect(afterLine.roadBandId).toBe('road-2');
    expect(afterLine.elapsedSecondsFromLastKmStart)
      .toBeLessThan(beforeLine.elapsedSecondsFromLastKmStart);
    expect(afterLine.energyAtLine).toBeLessThan(beforeLine.energyAtLine);
    expect(after.provisionalLineOrder.find(row=>row.riderId==='you-7')
      .position).toBe(3);
    const afterPoints=after.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    expect(afterPoints.previewPoints).toBe(pointsForDivisionResult({
      tier:after.pointPreview.tier,resultType:'ONE_DAY',placing:3,
      multiplier:after.pointPreview.multiplier}));
    expect(afterPoints.previewPoints).toBeGreaterThan(
      beforePoints.previewPoints);
    expect(after.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'})).toContainText(
      'Conditional place: 7 → 3');
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText(`Read-only points: ${afterPoints.previewPoints}`);
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${afterLine.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${afterLine.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${afterLine.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('one rival effort changes a women race place and read-only points',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('tactic-points-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Managers with your own tactics').selectOption('1');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const run=async()=>{
      const responsePromise=page.waitForResponse(response=>
        response.url().endsWith('/api/v91-playtest')&&
        response.request().method()==='POST');
      await page.getByRole('button',{name:'Run v93 race preview'}).click();
      const response=await responsePromise;
      expect(response.status()).toBe(200);
      return (await response.json()).coasted;
    };
    const before=await run();
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    const after=await run();
    for(const [race,place,points] of [[before,3,75],[after,2,94]]){
      expect(race.version).toBe('v93-bunch-only-playtest-1');
      expect(race.kilometreFrames.at(-1).roadGroups).toHaveLength(0);
      expect(race.lastKmRoad.at(-1).distanceM).toBe(260000);
      expect(race.lineTimes).toHaveLength(32);
      expect(race.provisionalLineOrder.find(row=>row.riderId==='you-7')
        .position).toBe(place);
      const preview=race.pointPreview.riders.find(row=>
        row.riderId==='you-7');
      expect(preview.provisionalPlace).toBe(place);
      expect(preview.previewPoints).toBe(points);
      expect(preview.previewPoints).toBe(pointsForDivisionResult({
        tier:2,resultType:'ONE_DAY',placing:place,
        multiplier:race.pointPreview.multiplier}));
      expect(race.pointPreview.awardRows).toEqual([]);
      expect(race.pointsStatus).toBe('withheld');
    }
    const ownLine=after.lineTimes.find(row=>row.riderId==='you-7');
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'})).toContainText(
      'Conditional place: 3 → 2');
    await expect(page.getByRole('region',{
      name:'Paired v93 race comparison'})).toContainText(
      'Read-only points: 75 (place 3) → 94 (place 2)');
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('Conditional place: 2 · Read-only points: 94');
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${ownLine.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
    expect(errors).toEqual([]);
  });

test('attacking v93 road keeps separated front groups in the browser replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-separated-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups.length)
      .toBeGreaterThanOrEqual(2);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toEqual([]);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointsStatus).toBe('withheld');
    const changeIndex=coasted.kilometreFrames.findIndex((frame,index)=>
      index>0&&frame.roadGroups.length!==
        coasted.kilometreFrames[index-1].roadGroups.length);
    expect(changeIndex).toBeGreaterThan(0);
    const changedFrame=coasted.kilometreFrames[changeIndex];
    const changes=page.getByLabel('Recorded road changes');
    await changes.locator('summary').click();
    const jump=changes.getByRole('button',
      {name:`Jump to recorded km ${changedFrame.km}`});
    await expect(jump).toBeVisible();
    await jump.click();
    await expect(jump).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('slider',
      {name:/Recorded kilometre/})).toHaveValue(String(changeIndex+1));
    await expect(page.getByText(`Road groups: ${
      changedFrame.roadGroups.map(group=>
        `${group.id} (${group.riderIds.length} riders, ${
          group.gapSeconds.toFixed(1)} s ahead)`).join(' · ')}`))
      .toBeVisible();
    const tacticalFrame=coasted.kilometreFrames.find(frame=>
      frame.attackAttempts.length>0);
    expect(tacticalFrame).toBeDefined();
    const tactics=page.getByLabel('Recorded tactical moments');
    await tactics.locator('summary').click();
    const tacticalJump=tactics.getByRole('button',{
      name:`Jump to tactical km ${tacticalFrame.km}`});
    await tacticalJump.click();
    await expect(tacticalJump).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('slider',
      {name:/Recorded kilometre/})).toHaveValue(String(tacticalFrame.km));
    const recordedTactics=page.getByLabel('Recorded kilometre tactics');
    await expect(recordedTactics).toContainText(
      `Attack attempts: ${tacticalFrame.attackAttempts.join(', ')}`);
    await expect(recordedTactics).toContainText(
      `Joined road group: ${tacticalFrame.joinedRiderIds.join(', ')||'none'}`);
    await expect(recordedTactics).toContainText(
      `Caught riders: ${tacticalFrame.caughtRiderIds.join(', ')||'none'}`);
    await expect(recordedTactics).toContainText(
      `Engaged chase: ${tacticalFrame.engagedChaseTeamIds.join(', ')||'none'}`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    expect(errors).toEqual([]);
  });

test('short v93 road pays one front group into the individual line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('settings');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-single-group-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(39);
    expect(coasted.lastKmRoad.at(-1).groups).toHaveLength(1);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(40000);
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });

test('default short v93 road pays the full bunch without a front group',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('40');
    await page.getByLabel('Scenario seed').fill('playtest-1');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(40000);
    expect(coasted.bandReplays).toHaveLength(1);
    expect(coasted.bandReplays[0].id).toBe('peloton');
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });

test('default long field pays a chosen lead-out, replay and policy points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Starting fatigue').selectOption('0');
    await page.getByLabel('Scenario seed').fill('long-default-M-flat-0');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('you lead-out helper').selectOption('you-6');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    await page.getByLabel('Race tier').selectOption('3');
    await page.getByLabel('Division count').selectOption('4');
    await page.getByLabel('Fictional division').selectOption('2');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.settings).toMatchObject({distanceKm:260,teamCount:20,
      gender:'M',terrain:'flat',fatigue:0});
    expect(coasted.managerOrders).toHaveLength(20);
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.managerDecisions.find(row=>row.teamId==='you'))
      .toMatchObject({finisherId:'you-7',leadOutRiderId:'you-6'});
    expect(coasted.leadOutWork.some(row=>
      row.riderId==='you-6'&&row.energySpent>0)).toBe(true);
    expect(coasted.pointPreview.riders).toHaveLength(160);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    const own=coasted.lineTimes.find(row=>row.riderId==='you-7');
    const ownPoints=coasted.pointPreview.riders.find(row=>
      row.riderId==='you-7');
    expect(ownPoints.previewPoints).toBe(pointsForDivisionResult({
      tier:3,resultType:'ONE_DAY',placing:ownPoints.provisionalPlace,
      multiplier:coasted.pointPreview.multiplier}));
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km flat'})).toBeVisible();
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('you-7');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${
        own.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${
        own.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${
        own.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText(
      'Official points: withheld · Awards saved: 0')).toBeVisible();
  });

test('a late catch leaves a playable 260 km bunch in the browser',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2outsider');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('0');
    await page.getByLabel('Scenario seed').fill('coast-matrix');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('mixed');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('selective');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-2).roadGroups.length)
      .toBeGreaterThan(0);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(coasted.lineTimes).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
  });

test('a tired no-front road keeps its isolated rider through the browser line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(1);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(1);
    expect(coasted.bandReplays.map(row=>row.id))
      .toEqual(['peloton','isolated:rival-2-0']);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('an unavailable v93 lead-out explains the road and can be removed',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('Managers with your own tactics')
      .selectOption('2');
    await page.getByLabel('rival-2 lead-out helper')
      .selectOption('rival-2-0');
    const refusalPromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const refusal=await refusalPromise;
    expect(refusal.status()).toBe(422);
    await expect(page.locator('.v91-error')).toContainText(
      'rival-2-0 is in a different road group at 500 m and cannot lead out.');
    await expect(page.locator('.v91-error')).toContainText(
      'No race preview was recorded. Choose another helper or none and run again.');
    await expect(page.getByRole('heading',{
      name:/V93 race preview/})).toHaveCount(0);
    await page.getByLabel('rival-2 lead-out helper').selectOption('');
    const acceptedPromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const accepted=await acceptedPromise;
    expect(accepted.status()).toBe(200);
    const {coasted}=await accepted.json();
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.leadOutWork).toEqual([]);
    expect(coasted.bandReplays.map(band=>band.id))
      .toEqual(['peloton','isolated:rival-2-0']);
    expect(coasted.bandReplays[0].riderIds).toHaveLength(31);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.locator('.v91-error')).toHaveCount(0);
  });

test('late bunch exits reach the line with paid replay and withheld points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const teams=['you',...Array.from({length:19},(_row,index)=>
      `rival-${index+1}`)];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
      mode:'v93-coasted',settings:{distanceKm:260,teamCount:20,
        gender:'F',terrain:'rolling',fatigue:15,
        seed:'v93-tactic-pair-11',effort:'steady',attack:'repeated',
        chase:'selective',defaultRivalPlan:'passive',
        managerTactics:Array.from({length:19},(_row,index)=>[
          {effort:'hard',attack:'none',chase:'all'},
          {effort:'steady',attack:'selective',chase:'ignore'},
          {effort:'conserve',attack:'none',chase:'selective'}]
          [index%3])},
      plans:teams.map(teamId=>({teamId,
        finisherId:`${teamId}-7`,leadOutRiderId:null})),
      pointContext:{tier:2,divisionCount:2,divisionIndex:1}}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    const race=body.coasted;
    expect(race.version).toBe('v93-late-bunch-exit-shoulder-playtest-1');
    expect(race.kilometreFrames).toHaveLength(259);
    expect(race.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(race.lineTimes).toHaveLength(160);
    expect(race.bandReplays).toHaveLength(17);
    expect(race.lateExitShoulder.assignments.map(row=>row.outsideLane))
      .toEqual([8,9]);
    expect(race.lateExitShoulder.unresolvedEqualClocks)
      .toEqual([['rival-1-5','rival-13-5']]);
    expect(race.unresolvedBunchExits).toEqual([
      {atDistanceM:259250,riderIds:[
        'rival-16-5','rival-19-5','rival-4-5','rival-7-5'],
      distinctLineTimes:1},
      {atDistanceM:259700,riderIds:['rival-1-5','rival-13-5'],
        distinctLineTimes:1}]);
    expect(race.pointPreview.status).toBe('unavailable');
    expect(race.canCommitAwards).toBe(false);
    for(const id of ['rival-1-5','rival-13-5']){
      const replay=race.bandReplays.find(band=>band.id===`isolated:${id}`);
      expect(replay.frames.map(frame=>frame.riders[0].role)).toEqual([
        'sheltered','sheltered','dropped','dropped','dropped']);
      expect(race.lineTimes.find(row=>row.riderId===id).energyAtLine).toBe(0);
    }
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByRole('note',{
      name:'Unresolved bunch exits'})).toContainText('259.700 km');
    await expect(page.getByRole('note',{
      name:'Paid late bunch exits'})).toContainText('separate outside lanes');
    await page.getByRole('button',{
      name:'Inspect late exit rider rival-1-5 finale replay'}).click();
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText('Crossed at 100.625 s');
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('early front catch reaches the browser line and replay with points withheld',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const tactics=[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'selective',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'},
      {effort:'steady',attack:'repeated',chase:'selective'}];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
        mode:'v93-coasted',pointContext:{tier:3,
          divisionCount:4,divisionIndex:2},
        settings:{distanceKm:260,teamCount:20,
          gender:'M',terrain:'flat',fatigue:15,
          seed:'v93-long-stress-M-flat-15-0',
          defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
          chase:'selective',managerTactics:Array.from({length:19},
            (_,index)=>tactics[index%4])},
        plans:['you',...Array.from({length:19},(_,index)=>
          `rival-${index+1}`)].map(teamId=>({teamId,
          finisherId:`${teamId}-7`,leadOutRiderId:null}))}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    expect(body.coasted.version).toBe(
      'v93-early-front-catch-isolated-lanes-playtest-2');
    expect(body.coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(body.coasted.lineTimes).toHaveLength(160);
    expect(body.coasted.bandReplays).toHaveLength(31);
    expect(body.coasted.provisionalLineOrder).toHaveLength(160);
    expect(body.coasted.frontCatch.isolatedContactResolved).toBe(true);
    expect(body.coasted.frontCatch.atDistanceM).toBeGreaterThan(259000);
    expect(body.coasted.frontCatch.atDistanceM).toBeLessThan(259500);
    expect(body.coasted.frontCatch.caughtRiderIds.length).toBeGreaterThan(0);
    expect(body.coasted.pointPreview.status).toBe('unavailable');
    expect(body.coasted.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    await expect(page.getByRole('note',{name:'Paid front catch'}))
      .toContainText(`${(body.coasted.frontCatch.atDistanceM/1000).toFixed(3)} km`);
    await expect(page.getByRole('note',{name:'Paid front catch'}))
      .toContainText('policy points are withheld');
    await expect(page.getByRole('note',{name:'Paid front catch'}))
      .toContainText('Inferred lanes keep the front and bunch wheels apart');
    await expect(page.getByRole('note',{name:'Paid front catch'}))
      .toContainText('Isolated riders continue in separate outside lanes');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    const own=body.coasted.lineTimes.find(row=>row.riderId==='you-7');
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`result ${
        own.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${
        own.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('exhausted final metres retain the whole-road line and rider replay',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const tactics=[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'selective',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'},
      {effort:'steady',attack:'repeated',chase:'selective'}];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
        mode:'v93-coasted',pointContext:{tier:3,
          divisionCount:4,divisionIndex:2},
        settings:{distanceKm:260,teamCount:20,gender:'M',
          terrain:'exposed',fatigue:0,seed:'v93-broader-probe-83',
          defaultRivalPlan:'passive',effort:'hard',attack:'repeated',
          chase:'ignore',managerTactics:Array.from({length:19},
            (_,index)=>tactics[(index+83)%4])},
        plans:['you',...Array.from({length:19},(_,index)=>
          `rival-${index+1}`)].map(teamId=>({teamId,
          finisherId:`${teamId}-7`,leadOutRiderId:null}))}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    expect(body.coasted.version).toBe('v93-coast-tail-playtest-1');
    expect(body.coasted.lineTimes).toHaveLength(160);
    expect(body.coasted.exhaustedTail.map(row=>row.riderId))
      .toEqual(['you-7']);
    expect(body.coasted.pointPreview.status).toBe('unavailable');
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    await expect(page.getByRole('note',{name:'Exhausted tail finish'}))
      .toContainText('you-7');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    const own=body.coasted.lineTimes.find(row=>row.riderId==='you-7');
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`${own.elapsedSecondsFromLastKmStart.toFixed(3)} s, `+
        `${own.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('late group catch pays an earlier wheel contact through line and replay',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const tactics=[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'selective',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'},
      {effort:'steady',attack:'repeated',chase:'selective'}];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
      mode:'v93-coasted',pointContext:{tier:3,divisionCount:4,
        divisionIndex:2},settings:{distanceKm:260,teamCount:20,
        gender:'M',terrain:'exposed',fatigue:0,
        seed:'v93-long-stress-M-exposed-0-2',
        defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
        chase:'selective',managerTactics:Array.from({length:19},
          (_,index)=>tactics[index%4])},
      plans:['you',...Array.from({length:19},(_,index)=>
        `rival-${index+1}`)].map(teamId=>({teamId,
        finisherId:`${teamId}-7`,
        leadOutRiderId:teamId==='you'?'you-0':null}))}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    expect(body.coasted.version).toBe('v93-wheel-contact-playtest-1');
    expect(body.coasted.kilometreFrames).toHaveLength(259);
    expect(body.coasted.lastKmRoad).toHaveLength(8);
    expect(body.coasted.lastKmRoad.at(-1).distanceM).toBe(260000);
    expect(body.coasted.sharedWheelContact.roadGroupId).toBe('road-13');
    expect(body.coasted.sharedWheelContact.atDistanceM)
      .toBeGreaterThan(259400);
    expect(body.coasted.sharedWheelContact.atDistanceM)
      .toBeLessThan(259500);
    expect(body.coasted.sharedWheelContact.wheelPairs).toHaveLength(5);
    expect(body.coasted.lineTimes).toHaveLength(160);
    expect(body.coasted.bandReplays).toHaveLength(31);
    expect(body.coasted.leadOutWork.filter(row=>
      row.riderId==='you-0'&&row.energySpent>0).length)
      .toBeGreaterThan(0);
    expect(body.coasted.pointPreview.status).toBe('unavailable');
    expect(body.coasted.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const preview=page.getByRole('region',{
      name:'V93 coasted race preview'});
    await expect(preview.getByRole('note',{
      name:'Paid shared wheel contact'})).toContainText(
      '5 same-lane wheel pairs met');
    await expect(preview.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(preview.getByText('Point illustration unavailable: Photo finishes leave tied provisional places.'))
      .toBeVisible();
    const unresolved=body.coasted.roadPlaceBounds.riders.filter(row=>
      row.position===null);
    expect(unresolved.length).toBeGreaterThan(1);
    const firstTie=unresolved[0];
    await expect(preview.getByRole('note',{
      name:'Unresolved photo finishes'})).toContainText(
      `Places ${firstTie.firstPossiblePlace}–${firstTie.lastPossiblePlace}`);
    await page.getByRole('button',{
      name:`Inspect photo finish rider ${firstTie.riderId}`}).click();
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(firstTie.riderId);
    await expect(preview.getByText(/Lead-out work: you-0/))
      .toBeVisible();
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    const own=body.coasted.lineTimes.find(row=>row.riderId==='you-7');
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`${own.elapsedSecondsFromLastKmStart.toFixed(3)} s, `+
        `${own.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'})).toHaveCount(1);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('extreme front leavers finish with or without older dropped riders',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const plans=['you',...Array.from({length:19},(_,index)=>
      `rival-${index+1}`)].map(teamId=>({teamId,
      finisherId:`${teamId}-7`,leadOutRiderId:null}));
    let tiredBody;
    for(const fatigue of [0,30]){
      const response=await page.request.post('/api/v91-playtest',{
        headers:{origin:'http://localhost:3100'},data:{
          mode:'v93-coasted',settings:{distanceKm:260,teamCount:20,
            gender:'M',terrain:'custom',fatigue,
            profileHeightsM:[100,600,1200,1800,2300,2500],
            seed:`v93-custom-extreme-M-${fatigue}-climb`,
            defaultRivalPlan:'attack',effort:'hard',attack:'repeated',
            chase:'ignore'},plans,
          pointContext:{tier:2,divisionCount:2,divisionIndex:1}}});
      expect(response.status()).toBe(200);
      const body=await response.json();
      expect(body.coasted.roadStatus).toBe(
        'conditional_front_leavers_ahead_of_bunch');
      expect(body.coasted.lineTimes).toHaveLength(160);
      expect(body.coasted.pointPreview.status).toBe('unavailable');
      expect(body.coasted.canCommitAwards).toBe(false);
      for(const riderId of ['you-6','you-7']){
        const crossing=body.coasted.lineTimes.find(row=>
          row.riderId===riderId);
        const replay=body.coasted.bandReplays.find(row=>
          row.id===`isolated:${riderId}`);
        const final=replay.frames.at(-1).riders.find(row=>
          row.riderId===riderId);
        expect(crossing.elapsedSecondsFromLastKmStart)
          .toBe(final.elapsedToLineSeconds);
        expect(crossing.energyAtLine).toBe(final.energyAfter);
      }
      if(fatigue===30){
        expect(body.coasted.lastKmRoad.at(-1).droppedPassages)
          .toHaveLength(4);
        tiredBody=body;
      }
    }
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify(tiredBody)}));
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByText(
      'Point illustration unavailable: Front leavers and their former groups have no recorded wheel order.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('selected extreme climb replays a tired front leaver end to end',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed')
      .fill('v93-custom-extreme-F-30-climb');
    for(const [point,height] of Object.entries({Start:100,'20%':600,
      '40%':1200,'60%':1800,'80%':2300,Finish:2500}))
      await page.getByLabel(`${point} (m)`).fill(String(height));
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.settings).toMatchObject({distanceKm:260,
      terrain:'custom',gender:'F',teamCount:20,fatigue:30,
      seed:'v93-custom-extreme-F-30-climb',defaultRivalPlan:'attack',
      effort:'hard',attack:'repeated',chase:'ignore'});
    expect(coasted.settings.profileHeightsM)
      .toEqual([100,600,1200,1800,2300,2500]);
    expect(coasted.roadStatus).toBe(
      'conditional_front_leavers_ahead_of_bunch');
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(4);
    expect(coasted.pointPreview.status).toBe('unavailable');
    const crossing=coasted.lineTimes.find(row=>row.riderId==='you-7');
    expect(crossing).toBeDefined();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`result ${crossing.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${crossing.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });
test('paid front leavers keep a conditional result in a mixed-rival race',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('v2rival');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
      mode:'v93-coasted',settings:{distanceKm:260,teamCount:20,
        gender:'M',terrain:'exposed',fatigue:15,
        seed:'v93-mixed-probe-8',effort:'hard',attack:'repeated',
        chase:'all',defaultRivalPlan:'passive',
        managerTactics:Array.from({length:19},(_row,index)=>[
          {effort:'hard',attack:'none',chase:'all'},
          {effort:'steady',attack:'selective',chase:'ignore'},
          {effort:'conserve',attack:'repeated',chase:'selective'}]
          [(index+8)%3])},pointContext:{tier:3,divisionIndex:2,
        divisionCount:4},
      plans:['you',...Array.from({length:19},(_row,index)=>
        `rival-${index+1}`)].map(teamId=>({teamId,
        finisherId:`${teamId}-7`,leadOutRiderId:null}))}});
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.roadStatus).toBe(
      'conditional_front_leavers_ahead_of_bunch');
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.pointPreview.status).toBe('unavailable');
    expect(coasted.pointPreview.reason).toContain('no recorded wheel order');
    expect(coasted.canCommitAwards).toBe(false);
    for(const riderId of ['you-4','you-7']){
      const crossing=coasted.lineTimes.find(row=>row.riderId===riderId);
      const replay=coasted.bandReplays.find(row=>
        row.id===`isolated:${riderId}`);
      const final=replay.frames.at(-1).riders.find(row=>
        row.riderId===riderId);
      expect(crossing.elapsedSecondsFromLastKmStart)
        .toBe(final.elapsedToLineSeconds);
      expect(crossing.energyAtLine).toBe(final.energyAfter);
    }
    expect(coasted.pointsStatus).toBe('withheld');
  });

test('three isolated riders include a paid parallel start and read-only points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('steady');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-isolated-parallel-playtest-1');
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toHaveLength(3);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(3);
    expect(coasted.bandReplays).toHaveLength(4);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.isolatedParallelStarts).toEqual([{
      riderIds:['rival-1-5','rival-1-7'],distanceM:259000,
      elapsedSecondsFromLastKmStart:48.484,
      laneRule:'isolated_parallel_lanes_no_draft'}]);
    expect(coasted.provisionalLineOrder).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByRole('note',{
      name:'Recorded parallel isolated lanes'}))
      .toContainText('rival-1-5 and rival-1-7');
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('custom 260 km road carries 15 teams and an isolated nominee to the line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coasted-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toHaveLength(1);
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toHaveLength(6);
    expect(coasted.bandReplays).toHaveLength(8);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.managerDecisions.find(row=>row.teamId==='you'))
      .toMatchObject({finisherId:'you-4',
        roadGroupId:'isolated:you-4'});
    expect(coasted.lineTimes.find(row=>row.riderId==='you-4'))
      .toMatchObject({energyAtLine:0,roadBandId:'isolated:you-4'});
    expect(coasted.pointPreview.riders).toHaveLength(120);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km custom'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('tired 20-team women field finishes an exposed 260 km road',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('exposed');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('test-drive-acceptance-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-bunch-only-playtest-1');
    expect(coasted.kilometreFrames).toHaveLength(259);
    expect(coasted.kilometreFrames.at(-1).roadGroups).toEqual([]);
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toEqual([]);
    expect(coasted.bandReplays).toHaveLength(1);
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.pointPreview.riders).toHaveLength(160);
    await expect(page.getByRole('heading',{
      name:'V93 race preview · 260 km exposed'})).toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('newly exhausted rider has a solo road replay and withheld points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(3);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(4);
    expect(coasted.bandReplays).toHaveLength(5);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    expect(coasted.unresolvedBunchExits).toHaveLength(1);
    const exit=coasted.unresolvedBunchExits[0];
    expect(exit).toMatchObject({atDistanceM:259000,
      distinctLineTimes:1});
    expect(exit.riderIds).toHaveLength(1);
    const exits=page.getByRole('note',{name:'Unresolved bunch exits'});
    await expect(exits).toContainText(
      '1 rider left the bunch in 1 recorded wave');
    await expect(exits).toContainText(
      '259.000 km: 1 rider · one recorded crossing time');
    const unorderedIds=await page.getByRole('table',{
      name:'V93 individual conditional results'})
      .locator('tbody th[scope="row"]').allTextContents();
    expect(unorderedIds).toEqual(coasted.lineTimes.map(row=>row.riderId)
      .sort());
    await expect(page.getByText(
      /row order is not a classified finish/)).toBeVisible();
    await expect(page.getByText(
      'Point illustration unavailable: Newly isolated riders have unresolved pre-500 m road contact.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('front leavers pass the bunch while a nominated helper works',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Field size').selectOption('4');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('multi-manager-audit-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('neutral');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('Managers with your own tactics').selectOption('2');
    await page.getByLabel('Rival 1 effort').selectOption('hard');
    await page.getByLabel('Rival 1 attack').selectOption('repeated');
    await page.getByLabel('Rival 1 chase').selectOption('ignore');
    await page.getByLabel('Rival 2 effort').selectOption('conserve');
    await page.getByLabel('Rival 2 attack').selectOption('none');
    await page.getByLabel('Rival 2 chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByLabel('you lead-out helper').selectOption('you-5');
    await page.getByLabel('rival-1 finisher').selectOption('rival-1-7');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups[0].riderIds)
      .toHaveLength(4);
    expect(coasted.lastKmRoad[0].groups[0].riderIds).toHaveLength(2);
    expect(coasted.lastKmRoad[0].droppedPassages.filter(row=>
      row.contactDistanceM!==null)).toHaveLength(2);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(3);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.leadOutWork.some(row=>row.riderId==='you-5'))
      .toBe(true);
    expect(coasted.roadPlaceBounds.bands.map(row=>[
      row.firstPossiblePlace,row.lastPossiblePlace]))
      .toEqual([[1,2],[3,32]]);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row',{
      name:/^1–2 you-5 /})).toBeVisible();
    expect(coasted.lineTimes.find(row=>row.riderId==='rival-1-7'))
      .toMatchObject({roadBandId:'isolated:rival-1-7',energyAtLine:0});
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByText(
      /bunch passed at 259\.032 km/).first()).toBeVisible();
    const passed=coasted.lastKmRoad[0].droppedPassages.find(row=>
      row.contactDistanceM!==null);
    const crossing=coasted.lineTimes.find(row=>
      row.riderId===passed.riderId);
    await page.getByRole('button',{
      name:`Inspect passage rider ${passed.riderId} finale replay`}).click();
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${crossing.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${crossing.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${crossing.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('15-team custom road replays newly isolated bunch riders beneath two fronts',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-seed-audit-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-active-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups)
      .toHaveLength(2);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(12);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(22);
    expect(coasted.bandReplays).toHaveLength(25);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText(
      'Point illustration unavailable: Newly isolated bunch riders have unresolved pre-500 m road contact.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('one paid front retains a conditional range above new bunch drops',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('custom');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-dynamic-active-playtest-1');
    expect(coasted.roadPlaceBounds.bands.map(row=>[
      row.firstPossiblePlace,row.lastPossiblePlace]))
      .toEqual([[1,2],[3,120]]);
    expect(coasted.pointPreview.status).toBe('unavailable');
    const frontId=coasted.roadPlaceBounds.bands[0].riderIds[0];
    const table=page.getByRole('table',{
      name:'V93 individual conditional results'});
    await expect(table.getByRole('row',{
      name:new RegExp(`^1–2 ${frontId} `)})).toBeVisible();
    await expect(page.getByText(
      /The paid front stays separate through the finale/)).toBeVisible();
    const exits=page.getByRole('note',{
      name:'Unresolved bunch exits'});
    expect(coasted.unresolvedBunchExits.map(wave=>[
      wave.atDistanceM,wave.riderIds.length,
      wave.distinctLineTimes])).toEqual([
      [259000,6,1],[259250,4,1]]);
    await expect(exits).toContainText('10 riders left the bunch in 2 recorded waves');
    await expect(exits).toContainText('259.000 km: 6 riders · one shared crossing time');
    await expect(exits).toContainText('259.250 km: 4 riders · one shared crossing time');
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('flat 15-team road keeps two nominated singleton fronts on the line',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('flat');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-seed-audit-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('chase');
    await page.getByLabel('Your effort').selectOption('conserve');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-singleton-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups)
      .toHaveLength(2);
    expect(coasted.kilometreFrames.at(-1).droppedRiders)
      .toHaveLength(14);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(14);
    expect(coasted.bandReplays).toHaveLength(17);
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.managerDecisions.find(row=>row.teamId==='you')
      .finisherId).toBe('you-4');
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(121);
    await expect(page.getByText(
      'Point illustration unavailable: Singleton fronts and isolated riders have unresolved road contact.'))
      .toBeVisible();
  });

test('20-team rolling front exits reach replayed solo lines and preview points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-2');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('attack');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack').selectOption('repeated');
    await page.getByLabel('Your chase').selectOption('ignore');
    await page.getByLabel('you finisher').selectOption('you-6');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-front-exit-playtest-1');
    expect(coasted.kilometreFrames.at(-1).roadGroups[0].riderIds)
      .toHaveLength(40);
    expect(coasted.lastKmRoad[0].groups[0].riderIds)
      .toHaveLength(38);
    expect(coasted.lastKmRoad.at(-1).droppedPassages)
      .toHaveLength(2);
    expect(coasted.bandReplays).toHaveLength(4);
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.lineTimes.find(row=>row.riderId==='you-6'))
      .toMatchObject({roadBandId:'isolated:you-6',energyAtLine:0});
    expect(coasted.managerDecisions.find(row=>row.teamId==='you')
      .finisherId).toBe('you-6');
    expect(coasted.frontExit.exitRiderIds).toEqual(['you-6','you-7']);
    expect(coasted.frontExit.frontRiderCount).toBe(38);
    expect(coasted.frontExit.clearance.every(row=>
      row.frontClearanceSecondsAt250>0)).toBe(true);
    expect(coasted.roadPlaceBounds).toBeUndefined();
    expect(coasted.provisionalLineOrder).toHaveLength(160);
    expect(coasted.pointPreview.riders).toHaveLength(160);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    const note=page.getByRole('note',{name:'Recorded front exit'});
    await expect(note).toContainText('259.000 km');
    await expect(note).toContainText('last front wheel was clear by 250 m');
    await note.getByRole('button',{
      name:'Inspect front exit rider you-6 finish replay'}).click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue('you-6');
    const ownPlace=coasted.provisionalLineOrder.find(row=>
      row.riderId==='you-6').position;
    const ownPoints=coasted.pointPreview.riders.find(row=>
      row.riderId==='you-6').previewPoints;
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText(`Conditional place: ${ownPlace} · Read-only points: ${ownPoints}`);
    await expect(page.getByText(/Isolated passages:.*you-6.*ahead of bunch/))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row')
      .filter({hasText:'you-6'}).getByRole('cell').first())
      .toHaveText(String(ownPlace));
    const ownLine=coasted.lineTimes.find(row=>row.riderId==='you-6');
    await page.getByRole('button',{name:'Replay you-6'}).click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue('you-6');
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`Crossed at ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${ownLine.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${ownLine.energyAtLine.toFixed(1)} energy.`);
    const bunchRider=coasted.lineTimes.find(row=>
      row.roadBandId==='peloton');
    await page.getByRole('button',{
      name:`Replay ${bunchRider.riderId}`}).click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue(bunchRider.riderId);
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(bunchRider.riderId);
    const preview=coasted.pointPreview.riders.find(row=>
      row.riderId==='you-6');
    expect(preview.previewPoints).toBe(pointsForDivisionResult({
      tier:coasted.pointPreview.tier,resultType:'ONE_DAY',
      placing:preview.provisionalPlace,
      multiplier:coasted.pointPreview.multiplier}));
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('four paid isolated passes reach line, replay and preview points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('v93-diversity-1');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('mixed');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-isolated-pass-playtest-1');
    expect(coasted.potentialRoadContact).toBeUndefined();
    expect(coasted.isolatedPassEvents).toHaveLength(4);
    expect(coasted.provisionalLineOrder).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    const note=page.getByRole('note',{name:'Recorded isolated passes'});
    await expect(note).toContainText('259.020 km');
    await expect(note).toContainText('rival-1-3 passed rival-1-4');
    for(const id of ['rival-1-3','rival-1-4']){
      await note.getByRole('button',{
        name:`Inspect pass rider ${id} finish replay`}).first().click();
      await expect(page.getByRole('combobox',{name:'Rider'}))
        .toHaveValue(id);
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(id);
      const line=coasted.lineTimes.find(row=>row.riderId===id);
      const interval=page.getByRole('slider',{name:/Band interval/});
      await interval.fill(await interval.getAttribute('max'));
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(`Crossed at ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${line.energyAtLine.toFixed(1)} energy.`);
    }
    const preview=coasted.pointPreview.riders.find(row=>
      row.riderId==='rival-1-3');
    expect(preview.previewPoints).toBe(pointsForDivisionResult({
      tier:coasted.pointPreview.tier,resultType:'ONE_DAY',
      placing:preview.provisionalPlace,
      multiplier:coasted.pointPreview.multiplier}));
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('parallel isolated lanes carry a 260 km race into replay and points',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('mountain');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('v93-matrix-62');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('all');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Managers with your own tactics')
      .selectOption('3');
    for(const [index,effort,attack,chase] of [
      [1,'conserve','none','selective'],
      [2,'steady','repeated','selective'],
      [3,'hard','none','all']]){
      await page.getByLabel(`Rival ${index} effort`).selectOption(effort);
      await page.getByLabel(`Rival ${index} attack`).selectOption(attack);
      await page.getByLabel(`Rival ${index} chase`).selectOption(chase);
    }
    for(const id of ['you','rival-1','rival-2','rival-3'])
      await page.getByLabel(`${id} finisher`).selectOption(`${id}-4`);
    await page.getByLabel('rival-1 lead-out helper')
      .selectOption('rival-1-6');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version).toBe('v93-coast-isolated-parallel-playtest-1');
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.provisionalLineOrder).toHaveLength(32);
    expect(coasted.pointPreview.riders).toHaveLength(32);
    expect(coasted.pointPreview.awardRows).toEqual([]);
    const note=page.getByRole('note',{
      name:'Recorded parallel isolated lanes'});
    await expect(note).toContainText('259.000 km');
    await expect(note).toContainText('you-1 and you-7');
    for(const id of ['you-1','you-7']){
      await note.getByRole('button',{
        name:`Inspect parallel rider ${id} finish replay`}).click();
      await expect(page.getByRole('combobox',{name:'Rider'}))
        .toHaveValue(id);
      const line=coasted.lineTimes.find(row=>row.riderId===id);
      const interval=page.getByRole('slider',{name:/Band interval/});
      await interval.fill(await interval.getAttribute('max'));
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(`Crossed at ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s; result ${line.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${line.energyAtLine.toFixed(1)} energy.`);
    }
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('full-kilometre isolated lanes show tied places without point awards',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('20');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('v93-matrix-86');
    await page.getByLabel('Your effort').selectOption('hard');
    await page.getByLabel('Your attack').selectOption('selective');
    await page.getByLabel('Your chase').selectOption('selective');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Managers with your own tactics')
      .selectOption('19');
    const tactics=[['hard','none','all'],
      ['steady','selective','ignore'],
      ['conserve','none','selective'],
      ['steady','repeated','selective']];
    for(let index=1;index<=19;index++){
      const [effort,attack,chase]=tactics[(index-1+86)%4];
      await page.getByLabel(`Rival ${index} effort`).selectOption(effort);
      await page.getByLabel(`Rival ${index} attack`).selectOption(attack);
      await page.getByLabel(`Rival ${index} chase`).selectOption(chase);
      await page.getByLabel(`rival-${index} finisher`)
        .selectOption(`rival-${index}-4`);
    }
    await page.getByLabel('you finisher').selectOption('you-4');
    await page.getByRole('checkbox',{
      name:'Show read-only point illustration'}).check();
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.version)
      .toBe('v93-coast-full-km-isolated-lanes-playtest-1');
    expect(coasted.lineTimes).toHaveLength(160);
    expect(coasted.provisionalLineOrder).toHaveLength(160);
    expect(coasted.pointPreview.status).toBe('unavailable');
    const note=page.getByRole('note',{
      name:'Full-kilometre isolated lanes'});
    await expect(note).toContainText('no draft or free energy');
    await expect(note).toContainText('possible place ranges');
    const first=coasted.isolatedLaneEncounters[0].riderIds[0];
    await note.getByRole('button',{
      name:`Inspect isolated lane rider ${first} finish replay`}).first()
      .click();
    await expect(page.getByRole('combobox',{name:'Rider'}))
      .toHaveValue(first);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('late occupied-lane contact merges the paid sprint and both replays',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    const tactics=[
      {effort:'hard',attack:'none',chase:'all'},
      {effort:'steady',attack:'selective',chase:'ignore'},
      {effort:'conserve',attack:'none',chase:'selective'},
      {effort:'steady',attack:'repeated',chase:'selective'}];
    const response=await page.request.post('/api/v91-playtest',{
      headers:{origin:'http://localhost:3100'},data:{
        mode:'v93-coasted',
        pointContext:{tier:3,divisionCount:4,divisionIndex:2},
        settings:{distanceKm:260,teamCount:15,gender:'F',
          terrain:'mountain',fatigue:30,seed:'v93-matrix-77',
          defaultRivalPlan:'passive',effort:'hard',
          attack:'repeated',chase:'selective',
          profileHeightsM:[500,350,200,400,250,100],
          managerTactics:Array.from({length:14},(_,index)=>
            tactics[(index+77)%4])},
        plans:['you',...Array.from({length:14},(_,index)=>
          `rival-${index+1}`)].map(teamId=>({
          teamId,finisherId:`${teamId}-7`,
          leadOutRiderId:teamId==='rival-1'?
            'rival-1-6':null}))}});
    expect(response.status()).toBe(200);
    const body=await response.json();
    const coasted=body.coasted;
    expect(coasted.version)
      .toBe('v93-late-active-contact-playtest-1');
    expect(coasted.lineTimes).toHaveLength(120);
    expect(coasted.bandReplays.reduce((sum,band)=>
      sum+band.riderIds.length,0)).toBe(120);
    expect(coasted.lastKmRoad).toHaveLength(8);
    expect(coasted.lastKmRoad[4].contact.kind)
      .toBe('shared_active_wheel_contact');
    expect(coasted.lastKmRoad.slice(4).every(row=>
      row.groups.length===0)).toBe(true);
    expect(coasted.sharedWheelContact.wheelPairs).toHaveLength(3);
    expect(coasted.pointPreview.status).toBe('unavailable');
    expect(coasted.canCommitAwards).toBe(false);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.route('**/api/v91-playtest',route=>route.fulfill({
      status:200,contentType:'application/json',
      body:JSON.stringify(body)}));
    await page.getByRole('button',{
      name:'Run v93 race preview'}).click();
    const preview=page.getByRole('region',{
      name:'V93 coasted race preview'});
    await expect(preview.getByRole('note',{
      name:'Paid shared wheel contact'})).toContainText(
      '3 same-lane wheel pairs met');
    await expect(preview.getByRole('note',{
      name:'Paid shared wheel contact'})).toContainText(
      'separate sprint paths are paid to that contact');
    await expect(preview.getByRole('table',{
      name:'V93 individual conditional results'})
      .getByRole('row')).toHaveCount(121);
    for(const [bandId,riderId] of [
      ['road-10','rival-3-3'],
      ['peloton','rival-1-7']]){
      await page.getByRole('combobox',{name:'Road band'})
        .selectOption(bandId);
      await page.getByRole('combobox',{name:'Rider'})
        .selectOption(riderId);
      const interval=page.getByRole('slider',{
        name:/Band interval/});
      await interval.fill(await interval.getAttribute('max'));
      const line=coasted.lineTimes.find(row=>
        row.riderId===riderId);
      await expect(page.getByLabel(
        'Selected rider finale replay')).toContainText(
        `${line.elapsedSecondsFromLastKmStart.toFixed(3)} s, `+
        `${line.energyAtLine.toFixed(1)} energy.`);
    }
    await expect(page.getByText(
      'Official points: withheld · Awards saved: 0')).toBeVisible();
  });

test('an exhausted solo finisher reaches the paid line without a sprint',
  async({page})=>{
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('alice');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',{
      name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',{
      name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('260');
    await page.getByLabel('Starting fatigue').selectOption('30');
    await page.getByLabel('Scenario seed').fill('v93-tactic-pair-8');
    await page.getByLabel('Default tactics for uncustomized managers')
      .selectOption('passive');
    await page.getByLabel('Your attack order').selectOption('repeated');
    await page.getByLabel('Your chase order').selectOption('ignore');
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.unlaunchedSoloSprints).toContainEqual({
      riderId:'you-7',roadBandId:expect.any(String),
      reason:'insufficient_energy'});
    const finish=page.getByRole('region',{name:'Your v93 finish'});
    await expect(finish).toContainText(
      'The nominated rider lacked energy for the full solo sprint');
    const crossing=coasted.lineTimes.find(row=>row.riderId==='you-7');
    await page.getByRole('button',{name:'Replay you-7'}).click();
    const interval=page.getByRole('slider',{name:/Band interval/});
    await interval.fill(await interval.getAttribute('max'));
    await expect(page.getByLabel('Selected rider finale replay'))
      .toContainText(`result ${crossing.elapsedSecondsFromLastKmStart.toFixed(3)} s, ${crossing.energyAtLine.toFixed(1)} energy.`);
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });
