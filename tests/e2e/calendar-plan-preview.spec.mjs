import {test,expect} from "@playwright/test";
import {readFileSync} from "node:fs";

const plan=JSON.parse(readFileSync(new URL("../../data/calendar/2027-plan.json",import.meta.url),"utf8"));

test("three-season draft is navigable and distinct from published races on mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/calendar-plan",route=>route.fulfill({json:{ok:true,plan}}));
  await page.route("**/api/events?*",route=>route.fulfill({json:{ok:true,
    server_time:new Date().toISOString(),events:[]}}));
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.goto("/team/calendar");
  await page.getByRole("button",{name:/2027 season plan/}).click();
  await expect(page.getByText("These races are not open for registration.")).toBeVisible();
  await expect(page.getByRole("heading",{name:"Pelotonia Year 1"})).toBeVisible();
  await page.getByRole("button",{name:/February/}).click();
  await expect(page.getByRole("heading",{name:"February"})).toBeVisible();
  await page.getByRole("button",{name:/YEAR 2/}).click();
  await expect(page.getByRole("heading",{name:"Pelotonia Year 2"})).toBeVisible();
  await page.getByLabel("Category").selectOption("F");
  await page.getByLabel("Format").selectOption("stage_race");
  await page.getByRole("button",{name:/June/}).click();
  await expect(page.getByText(/selected races in this view/)).toBeVisible();
  await expect(page.locator(".plan-race-tags span").first()).toHaveText("Women");
  await expect(page.locator(".plan-race-name span").first()).toContainText("Stage race");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole("button",{name:"Published races"}).click();
  await expect(page.getByRole("heading",{name:"Every race begins here."})).toBeVisible();
  expect(errors).toEqual([]);
});
