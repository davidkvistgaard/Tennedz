import { test, expect } from "@playwright/test";

async function login(page) {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
}

test("calendar shows separate races, readiness, filters and direct setup on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  const date = new Date(Date.now() + 7 * 86400000).toISOString();
  await page.route("**/api/events?*", route => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [
      { id: "women-race", name: "Coastal Women", kind: "one_day", gender: "F", status: "OPEN",
        deadline: date, scheduled_at: date, calendar_source: "PELOTONIA", race_tier: 3,
        team_count: 0, team_size: 8, orders_ready: false, readiness: "TEAM_INCOMPLETE", winner_points: 250 },
      { id: "men-race", name: "Coastal Men", kind: "one_day", gender: "M", status: "OPEN",
        deadline: date, scheduled_at: date, calendar_source: "UCI", race_tier: 5,
        team_count: 8, team_size: 8, orders_ready: true, readiness: "READY", winner_points: 650 },
    ],
  } }));
  await login(page);
  await page.goto("/team/calendar");
  await expect(page.getByRole("heading", { name: "Coastal Women" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coastal Men" })).toBeVisible();
  await page.screenshot({ path: "test-results/calendar-agenda-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Women", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coastal Men" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Set up/ })).toHaveAttribute("href", "/team/run?event_id=women-race&gender=F");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("ranking dimensions come from the same points view", async ({ page }) => {
  await page.route("**/api/leaderboards?*", route => {
    const url = new URL(route.request().url());
    const women = url.searchParams.get("gender") === "F";
    return route.fulfill({ json: { ok: true, current_season: 2026, seasons: [2026, 2025],
      season: url.searchParams.get("season"), rows: women ? [{ id: "a", name: "Freja Møller", rank: 1, points: 250 }] : [],
    } });
  });
  await login(page);
  await page.goto("/team/leaderboards");
  await page.getByLabel("Category").selectOption("F");
  await expect(page.getByText("Freja Møller")).toBeVisible();
  await expect(page.getByText("250 pts")).toBeVisible();
  await page.screenshot({ path: "test-results/rankings-desktop.png", fullPage: true });
  await page.getByLabel("Calendar").selectOption("UCI");
  await expect(page.getByText("Freja Møller")).toBeVisible();
  await page.getByLabel("Ranking").selectOption("team");
  await expect(page.getByLabel("Category").locator("option[value=combined]")).toHaveCount(1);
});

test("automatic entries remain administrator-only", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("bob");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  const denied = await page.request.post("/api/admin/autopilot", {
    headers: { Origin: "http://localhost:3100" }, data: {},
  });
  expect(denied.status()).toBe(403);
  expect((await page.request.post("/api/admin/autopilot/batch", {
    headers: { Origin: "http://localhost:3100" }, data: {},
  })).status()).toBe(403);
});

test("automatic entries remain behind the game-write gate", async ({ page }) => {
  await login(page);
  const gated = await page.request.post("/api/admin/autopilot", {
    headers: { Origin: "http://localhost:3100" }, data: {},
  });
  expect(gated.status()).toBe(503);
  expect((await gated.json()).code).toBe("GAME_READ_ONLY");
  const batch = await page.request.post("/api/admin/autopilot/batch", {
    headers: { Origin: "http://localhost:3100" }, data: {},
  });
  expect(batch.status()).toBe(503);
  expect((await batch.json()).code).toBe("GAME_READ_ONLY");
});
