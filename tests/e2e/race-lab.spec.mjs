import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`Race Lab calculates, inspects and compares isolated races at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/race-lab");
    await expect(
      page.getByRole("heading", { name: "Race Lab", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Amber’s plan", { exact: true })
      .selectOption("break");
    await page
      .getByRole("button", { name: "Calculate one race", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Race inspection" }),
    ).toBeVisible();
    const slider = page.getByRole("slider", { name: "Recorded stage" });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(
      page.getByText("160 km ridden", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/wins with .* energy remaining/)).toBeVisible();
    await page.getByRole("button", { name: "Run kilometre prototype" }).click();
    await expect(page.getByRole("heading", { name: "Kilometre engine · tactical trace" })).toBeVisible();
    const kilometreSlider=page.getByRole("slider", { name: "Recorded kilometre" });
    await kilometreSlider.focus();
    await page.keyboard.press("End");
    await expect(page.getByText("160 / 160 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/attacks? attempted · \d+ joined the break/)).toBeVisible();
    await kilometreSlider.focus();
    await page.keyboard.press("Home");
    for(let kilometre=1;kilometre<7;kilometre++)await page.keyboard.press("ArrowRight");
    await expect(page.getByText("7 / 160 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/Waiting to chase: .* let a manageable gap stand/)).toBeVisible();
    await expect(page.getByText(/Riding pace alone: the break (gained|lost)/)).toBeVisible();
    for(let kilometre=7;kilometre<15;kilometre++)await page.keyboard.press("ArrowRight");
    await expect(page.getByText("15 / 160 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/Break caught: \d+ riders? brought back/)).toBeVisible();
    for(let kilometre=15;kilometre<25;kilometre++)await page.keyboard.press("ArrowRight");
    await expect(page.getByText("25 / 160 km", { exact: true })).toBeVisible();
    await expect(page.getByText(/Repeated efforts: \d+ attacks? lost sharpness/)).toBeVisible();
    await expect(page.getByRole("table", { name: "Team state after this kilometre" })).toBeVisible();
    const provisionalResults=page.getByRole("table", { name: "Provisional rider results" });
    await expect(provisionalResults).toBeVisible();
    await expect(provisionalResults.locator("tbody tr")).toHaveCount(32);
    await expect(provisionalResults.locator("tbody tr").first()).toContainText("1");
    await page.getByLabel("Paired seeds", { exact: true }).selectOption("20");
    await page
      .getByRole("button", { name: "Compare all four plans", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Strategy comparison" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Completed 80 races");
    await page.getByLabel("Chase strength", { exact: true }).fill("9");
    await page
      .getByRole("button", { name: "Calculate one race", exact: true })
      .click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid configuration" })).toContainText(
      "Invalid configuration",
    );
    await page.getByRole("button", { name: "Reset balance" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/race-lab-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

test('Race Lab records Amber’s precommitted road-captain chase',async ({page})=>{
  await page.goto('/race-lab');
  await page.getByLabel('Amber’s plan',{exact:true}).selectOption('conserve');
  await page.getByLabel('Amber’s break response',{exact:true}).selectOption('chase_if_threatened');
  await page.getByRole('button',{name:'Run kilometre prototype'}).click();
  const slider=page.getByRole('slider',{name:'Recorded kilometre'});
  await slider.focus();
  await page.keyboard.press('Home');
  for(let kilometre=1;kilometre<23;kilometre++)await page.keyboard.press('ArrowRight');
  await expect(page.getByText('23 / 160 km',{exact:true})).toBeVisible();
  await expect(page.getByText(/Precommitted decisions: Amber chase break/)).toBeVisible();
  await expect(page.getByText(/Precommitted break chase active: Amber/)).toBeVisible();
});

test('Race Lab exposes a precommitted sit-on choice in the recorded race',async ({page})=>{
  await page.goto('/race-lab');
  await page.getByLabel('Amber’s plan',{exact:true}).selectOption('break');
  await page.getByLabel('Amber’s break work',{exact:true}).selectOption('sit_on');
  await page.getByRole('button',{name:'Run kilometre prototype'}).click();
  const slider=page.getByRole('slider',{name:'Recorded kilometre'});
  await slider.focus();
  await page.keyboard.press('Home');
  for(let kilometre=1;kilometre<5;kilometre++)await page.keyboard.press('ArrowRight');
  await expect(page.getByText('5 / 160 km',{exact:true})).toBeVisible();
  await expect(page.getByText('Recorded break work: 0 riders took pulls this kilometre.')).toBeVisible();
  await page.getByText('Inspect road groups and riders').click();
  await expect(page.getByText(/Not pulling this km/).first()).toBeVisible();
});

test('Race Lab replays a planned attack from an existing break',async ({page})=>{
  await page.goto('/race-lab');
  await page.getByLabel('Amber’s plan',{exact:true}).selectOption('break');
  await page.getByLabel('Amber’s break attack',{exact:true}).selectOption('40');
  await page.getByRole('button',{name:'Run kilometre prototype'}).click();
  const slider=page.getByRole('slider',{name:'Recorded kilometre'});
  await slider.focus();
  await page.keyboard.press('Home');
  for(let kilometre=1;kilometre<41;kilometre++)await page.keyboard.press('ArrowRight');
  await expect(page.getByText('41 / 160 km',{exact:true})).toBeVisible();
  await expect(page.getByText(/Planned attack from the break: .* · split/)).toBeVisible();
  await expect(page.getByText(/Road groups: .* ahead of the peloton/)).toBeVisible();
});

test('Race Lab accepts a precommitted fallback for a fading rider ahead',async ({page})=>{
  await page.goto('/race-lab');
  const fallback=page.getByRole('combobox',{name:/rider-ahead fallback/});
  await fallback.selectOption('chase_if_fading');
  await page.getByRole('button',{name:'Run kilometre prototype'}).click();
  await expect(page.getByRole('heading',{name:/Kilometre engine/})).toBeVisible();
  await expect(fallback).toHaveValue('chase_if_fading');
});

test('Race Lab previews a scheduled order change after its marker',async ({page})=>{
  await page.goto('/race-lab');
  await page.getByLabel('Amber’s plan',{exact:true}).selectOption('conserve');
  await page.getByLabel("Amber's order-change marker").selectOption('40');
  await page.getByLabel("Amber's later effort").selectOption('hard');
  await page.getByLabel("Amber's later chase").selectOption('all');
  await page.getByRole('button',{name:'Run kilometre prototype'}).click();
  const slider=page.getByRole('slider',{name:'Recorded kilometre'});
  await slider.focus();
  await page.keyboard.press('Home');
  for(let kilometre=1;kilometre<40;kilometre++)await page.keyboard.press('ArrowRight');
  await expect(page.getByText('40 / 160 km',{exact:true})).toBeVisible();
  await expect(page.getByText(/Scheduled Amber orders: conserve effort · ignore chase/)).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('41 / 160 km',{exact:true})).toBeVisible();
  await expect(page.getByText(/Scheduled Amber orders: hard effort · all chase/)).toBeVisible();
});
