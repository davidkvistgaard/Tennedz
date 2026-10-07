import {test,expect} from "@playwright/test";

test("2027 season outline remains readable on mobile and cannot enter a race",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.getByRole("link",{name:"2027 calendar plan"}).click();
  await expect(page.getByRole("heading",{name:"Pelotonia Year 1"})).toBeVisible();
  await expect(page.getByText("This is the season structure, not a published race schedule.",{exact:false})).toBeVisible();
  await page.getByRole("button",{name:/YEAR 2/}).click();
  await expect(page.getByRole("heading",{name:"Pelotonia Year 2"})).toBeVisible();
  await page.getByRole("button",{name:/June/}).click();
  await expect(page.getByRole("heading",{name:/June Planning outline/})).toBeVisible();
  await expect(page.getByRole("heading",{name:"One-day race rhythm"})).toBeVisible();
  await expect(page.getByRole("link",{name:/Set up|Register/})).toHaveCount(0);
  await expect(page.getByText("Milano-Sanremo")).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.setViewportSize({width:1280,height:800});
  await page.getByRole("button",{name:/YEAR 1/}).click();
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:"test-results/calendar-year-outline-desktop.png",fullPage:true});
});
