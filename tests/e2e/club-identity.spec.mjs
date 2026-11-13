import { test, expect } from "@playwright/test";
import { teamKitOptions, CLUB_PALETTES } from "../../lib/riders/club-kit.mjs";
async function login(page, name="alice") {
  await page.goto('/login');
  await page.getByLabel('Email or username').fill(name);
  await page.getByLabel('Password', {exact:true}).fill('fixture-password');
  await page.getByRole('button', {name:'Sign in',exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto('/team/identity');
  await expect(page.getByRole('button',{name:'Save club design',exact:true})).toBeEnabled();
}
test('club design is account-saved across devices, handles failures and enforces ownership', async ({ browser, page }) => {
  await login(page);
  const original=await (await page.request.get('/api/team/identity')).json();
  const choices=teamKitOptions('team-alice');
  const selected={palette:choices.palettes.find(p=>p!==original.kit.palette),pattern:choices.patterns[1]};
  await page.getByRole('button',{name:CLUB_PALETTES[selected.palette].name,exact:true}).click();
  await page.getByLabel('Jersey pattern').selectOption(selected.pattern);
  await page.route('**/api/team/identity',route=>route.request().method()==='PUT'?route.fulfill({status:503,json:{ok:false,error:'Temporary save failure'}}):route.continue());
  await page.getByRole('button',{name:'Save club design',exact:true}).click();
  await expect(page.locator('.studio-panel').getByRole('alert')).toContainText('Temporary save failure');
  expect((await (await page.request.get('/api/team/identity')).json()).kit).toEqual(original.kit);
  await page.unroute('**/api/team/identity');
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.getByRole('button',{name:'Save club design',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Club design saved to your account');
  const other=await browser.newContext();
  try {
    const second=await other.newPage(); await login(second);
    await expect(second.getByRole('button',{name:CLUB_PALETTES[selected.palette].name,exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(second.getByLabel('Jersey pattern')).toHaveValue(selected.pattern);
    // No shared browser storage or copied cookies: a genuinely separate context.
    const revised={palette:choices.palettes[0],pattern:choices.patterns[2]};
    expect((await second.request.put('/api/team/identity',{headers:{Origin:'http://localhost:3100'},data:{team_id:'team-alice',kit:revised}})).status()).toBe(200);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('button',{name:'Discard changes',exact:true}).click();
    await expect(page.getByLabel('Jersey pattern')).toHaveValue(revised.pattern);
    await page.reload(); await expect(page.getByLabel('Jersey pattern')).toHaveValue(revised.pattern);
    const unallocated=Object.keys(CLUB_PALETTES).find(p=>!choices.palettes.includes(p));
    expect((await page.request.put('/api/team/identity',{headers:{Origin:'http://localhost:3100'},data:{team_id:'team-alice',kit:{...revised,palette:unallocated}}})).status()).toBe(400);
    expect((await page.request.put('/api/team/identity',{headers:{Origin:'http://localhost:3100'},data:{team_id:'team-bob',kit:revised}})).status()).toBe(403);
    expect((await page.request.put('/api/team/identity',{headers:{Origin:'https://foreign.example'},data:{team_id:'team-alice',kit:revised}})).status()).toBe(403);
    expect((await page.request.get('/api/team/identity?team_id=team-bob')).status()).toBe(403);
    expect((await (await page.request.get('/api/team/identity')).json()).kit).toEqual(revised);
  } finally { await other.close(); }
});
test('club design fails closed when anonymous or its storage is unavailable', async ({page}) => {
  expect((await page.request.get('/api/team/identity')).status()).toBe(401);
  expect((await page.request.put('/api/team/identity',{headers:{Origin:'http://localhost:3100'},data:{}})).status()).toBe(401);
  await login(page);
  await page.route('**/api/team/identity?*',route=>route.fulfill({status:503,json:{ok:false,error:'Design store unavailable'}}));
  await page.reload(); await expect(page.locator('.studio-panel').getByRole('alert')).toContainText('Design store unavailable');
  await expect(page.getByRole('button',{name:'Save club design',exact:true})).toBeDisabled();
  await page.unroute('**/api/team/identity?*');
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save club design',exact:true})).toBeEnabled();
});
