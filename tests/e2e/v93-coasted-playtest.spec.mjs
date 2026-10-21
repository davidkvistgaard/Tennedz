import {test,expect} from '@playwright/test';
import {pointsForDivisionResult} from '../../lib/calendar/points.mjs';

test.skip(process.env.PELOTONIA_V91_PLAYTEST_ENABLED!=='true'||
  process.env.PELOTONIA_V93_COASTED_PLAYTEST_ENABLED!=='true',
'The isolated v93 workbench is disabled.');

test('two managers play one selected race from orders to road, line and replay',
  async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('/login');
    await page.getByLabel('Email or username').fill('bob');
    await page.getByLabel('Password',{exact:true}).fill('fixture-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await expect(page).toHaveURL(/\/team$/);
    await page.goto('/team/v91-playtest');
    await page.getByRole('checkbox',
      {name:'Continue to a conditional finish'}).check();
    await page.getByRole('checkbox',
      {name:'Try v93 road-to-line preview'}).check();
    await page.getByLabel('Distance').selectOption('120');
    await page.getByLabel('Route profile').selectOption('rolling');
    await page.getByLabel('Category').selectOption('F');
    await page.getByLabel('Field size').selectOption('15');
    await page.getByLabel('Starting fatigue').selectOption('15');
    await page.getByLabel('Scenario seed').fill('late-phase-6');
    await page.getByLabel('Your attack').selectOption('none');
    await page.getByLabel('Choose another rival manager')
      .selectOption('rival-14');
    await page.getByRole('button',{name:'Add rival manager'}).click();
    await page.getByLabel('rival-14 effort').selectOption('hard');
    await page.getByLabel('rival-14 attack').selectOption('none');
    await page.getByLabel('rival-14 chase').selectOption('all');
    await page.getByLabel('5 km to go effort for you').selectOption('hard');
    await page.getByLabel('5 km to go effort for rival-14')
      .selectOption('conserve');
    await page.getByLabel('you lead-out helper').selectOption('you-6');
    await page.getByLabel('rival-14 finisher').selectOption('rival-14-3');
    await page.getByLabel('rival-14 lead-out helper')
      .selectOption('rival-14-5');
    await page.getByRole('checkbox',
      {name:'Show read-only point illustration'}).check();
    await page.getByLabel('Race tier').selectOption('2');
    await page.getByLabel('Division count').selectOption('2');
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

test('three isolated riders finish while uncertain points stay withheld',
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
    expect(coasted.version).toBe('v93-coast-no-front-playtest-1');
    expect(coasted.kilometreFrames.at(-1).droppedRiders).toHaveLength(3);
    expect(coasted.lastKmRoad.at(-1).droppedPassages).toHaveLength(3);
    expect(coasted.bandReplays).toHaveLength(4);
    expect(coasted.lineTimes).toHaveLength(32);
    expect(coasted.pointPreview.status).toBe('unavailable');
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(33);
    await expect(page.getByText(
      'Point illustration unavailable: Potential road-band contact leaves no defensible point order.'))
      .toBeVisible();
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

test('20-team rolling front drops finish ahead as separate solo passages',
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
    expect(coasted.version).toBe('v93-dynamic-single-playtest-1');
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
    expect(coasted.pointPreview.status).toBe('unavailable');
    expect(coasted.roadPlaceBounds.bands.map(band=>[
      band.firstPossiblePlace,band.lastPossiblePlace]))
      .toEqual([[1,38],[39,40],[41,160]]);
    await expect(page.getByRole('region',{name:'Your v93 finish'}))
      .toContainText('Conditional place: 39–40 · Read-only points: unavailable');
    await expect(page.getByText(/Isolated passages:.*you-6.*ahead of bunch/))
      .toBeVisible();
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row'))
      .toHaveCount(161);
    await expect(page.getByRole('table',{
      name:'V93 individual conditional results'}).getByRole('row')
      .filter({hasText:'you-6'}).getByRole('cell').first())
      .toHaveText('39–40');
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
    await expect(page.getByText(
      'Point illustration unavailable: New front drops remain ahead without a resolved road contact order.'))
      .toBeVisible();
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });

test('possible isolated-rider contact links both paid replays',
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
    const responsePromise=page.waitForResponse(response=>
      response.url().endsWith('/api/v91-playtest')&&
      response.request().method()==='POST');
    await page.getByRole('button',{name:'Run v93 race preview'}).click();
    const response=await responsePromise;
    expect(response.status()).toBe(200);
    const {coasted}=await response.json();
    expect(coasted.pointPreview).toBeNull();
    expect(coasted.potentialRoadContact.riderIds)
      .toEqual(['rival-1-3','rival-1-4']);
    const note=page.getByRole('note',{name:'Potential road contact'});
    await expect(note).toContainText('Potential contact at 259.020 km');
    await expect(note).toContainText('contact and passing remain unresolved');
    for(const id of coasted.potentialRoadContact.riderIds){
      await note.getByRole('button',{
        name:`Inspect contact rider ${id}`}).click();
      await expect(page.getByRole('combobox',{name:'Rider'}))
        .toHaveValue(id);
      await expect(page.getByLabel('Selected rider finale replay'))
        .toContainText(id);
    }
    await expect(page.getByText('Official points: withheld · Awards saved: 0'))
      .toBeVisible();
  });
