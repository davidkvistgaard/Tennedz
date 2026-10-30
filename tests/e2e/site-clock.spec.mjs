import { test, expect } from "@playwright/test";

test("site clock shows a ticking server-synced date across public and team pages", async ({ page }) => {
  const clockResponse = await page.request.get("/api/time");
  expect(clockResponse.status()).toBe(200);
  expect(clockResponse.headers()["cache-control"]).toContain("no-store");
  expect(Math.abs(Date.parse((await clockResponse.json()).server_time) - Date.now())).toBeLessThan(5000);
  const offset = 12 * 60 * 60 * 1000;
  await page.route("**/api/time", route => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "Cache-Control": "no-store" },
    body: JSON.stringify({ server_time: new Date(Date.now() + offset).toISOString() }),
  }));
  await page.goto("/login");
  const clock = page.getByTestId("site-clock");
  await expect(clock).toContainText("Server synced · local time zone");
  const before = Date.parse(await clock.locator("time").getAttribute("datetime"));
  expect(before - Date.now()).toBeGreaterThan(offset - 60000);
  expect(before - Date.now()).toBeLessThan(offset + 60000);
  await expect.poll(() => clock.locator("time").getAttribute("datetime"),
    { timeout: 3500 }).not.toBe(new Date(before).toISOString());

  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(clock).toContainText("Server synced · local time zone");
  await page.getByRole("link", { name: "Marketplace" }).click();
  await expect(clock.locator("time")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
