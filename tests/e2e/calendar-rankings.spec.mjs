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
  await expect(page.getByRole("link", { name: /Set up/ })).toHaveAttribute("href", "/team/run?event_id=women-race&gender=F&return_filter=Women");
  await page.getByRole("link", { name: /Set up/ }).click();
  await expect(page.getByRole("link", { name: /Back to race calendar/ })).toHaveAttribute("href","/team/calendar?filter=Women");
  await page.getByRole("link", { name: /Back to race calendar/ }).click();
  await expect(page.getByRole("button", { name: "Women", exact: true })).toHaveAttribute("aria-pressed","true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("finished calendar races link entrants back to their recorded replay", async ({ page }) => {
  const scheduledAt=new Date(Date.now()-86400000).toISOString();
  await page.route("**/api/events?*",route=>route.fulfill({json:{
    ok:true,server_time:new Date().toISOString(),events:[
      {id:"entered-finish",name:"My finished race",kind:"one_day",gender:"M",
        status:"FINISHED",deadline:scheduledAt,scheduled_at:scheduledAt,
        calendar_source:"PELOTONIA",race_tier:2,team_count:8,team_size:8,
        orders_ready:true,readiness:"FINISHED",winner_points:150},
      {id:"other-finish",name:"Other finished race",kind:"one_day",gender:"M",
        status:"FINISHED",deadline:scheduledAt,scheduled_at:scheduledAt,
        calendar_source:"PELOTONIA",race_tier:2,team_count:0,team_size:8,
        orders_ready:false,readiness:"FINISHED",winner_points:150},
    ],
  }}));
  await login(page);
  await page.goto("/team/calendar");
  await expect(page.getByRole("link",{name:/Watch again/})).toHaveAttribute(
    "href","/team/view/entered-finish");
  await expect(page.getByRole("heading",{name:"Other finished race"})).toBeVisible();
  await expect(page.getByRole("link",{name:/Watch again/})).toHaveCount(1);
});

test("stage-race points preview separates GC, stages and classifications", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/events?*", route => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [{
      id: "stage-event", name: "Highland Tour", kind: "stage_race", gender: "F",
      status: "OPEN", deadline: new Date(Date.now()+3*86400000).toISOString(),
      scheduled_at: new Date(Date.now()+7*86400000).toISOString(),
      calendar_source: "PELOTONIA", race_tier: 6, team_count: 0,
      team_size: 8, orders_ready: false, readiness: "TEAM_INCOMPLETE",
      winner_points: 1000,
    }],
  } }));
  await login(page);
  await page.goto("/team/calendar");
  await page.getByText("Points table").click();
  for (const section of ["Final GC", "Each stage", "Points classification", "Mountains classification"])
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  await expect(page.getByText("Stage setup is in development")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("ranking dimensions come from the same points view", async ({ page }) => {
  await page.route("**/api/leaderboards?*", route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") === "ability")
      return route.fulfill({ json: { ok: true,
        teams: [{ id: "team-a", name: "Amber", rating: 780 }],
        riders: [{ id: "a", name: "Freja Møller", rating: 88 }],
      } });
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
  await page.getByRole("button", { name: "Ability ratings" }).click();
  await expect(page.getByText("780 rating")).toBeVisible();
  await expect(page.getByText("88 rating")).toBeVisible();
  await expect(page.getByLabel("Calendar")).toHaveCount(0);
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
  expect((await page.request.post("/api/admin/autopilot/void", {
    headers: { Origin: "http://localhost:3100" }, data: { event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
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
  const cancellation = await page.request.post("/api/admin/autopilot/void", {
    headers: { Origin: "http://localhost:3100" },
    data: { event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  });
  expect(cancellation.status()).toBe(503);
  expect((await cancellation.json()).code).toBe("GAME_READ_ONLY");
});

test("the scheduled autopilot endpoint rejects ordinary visitors", async ({ page }) => {
  const response = await page.request.get("/api/cron/autopilot");
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe("UNAUTHORIZED");
});

test("administrator editor exposes a scheduled Pelotonia race day and tier", async ({ page }) => {
  await login(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Create a race day" })).toBeVisible();
  await expect(page.getByLabel(/Race day · Wednesday or Sunday/)).toBeVisible();
  await expect(page.getByLabel("Race tier")).toBeVisible();
  await expect(page.getByLabel("Race tier").locator("option")).toHaveCount(6);
});

test("administrator can opt in to a separate registration and tactics deadline", async ({ page }) => {
  await login(page);
  await page.route("**/api/admin/stats", route => route.fulfill({ json: {
    ok:true,teams:1,riders:8,race_results:0,game_writes_enabled:true,
  } }));
  let saved;
  await page.route("**/api/admin/race-calendar", async route => {
    if(route.request().method()==="POST"){
      saved=route.request().postDataJSON();
      return route.fulfill({ json:{ok:true,event_ids:["men","women"],already_created:false} });
    }
    const response=await route.fetch();
    const data=await response.json();
    return route.fulfill({ json:{...data,two_phase_available:true} });
  });
  await page.goto("/admin");
  await page.getByLabel(/Two-phase race/).check();
  await expect(page.getByLabel(/Tactics deadline/)).toBeVisible();
  await page.getByLabel("Race name").fill("Preview phase race");
  await page.getByRole("button",{name:"Create free race day"}).click();
  await expect(page.getByRole("status").filter({hasText:"Registration is open"})).toBeVisible();
  expect(Date.parse(saved.deadline)).toBeLessThan(Date.parse(saved.tactics_deadline));
  expect(Date.parse(saved.tactics_deadline)).toBeLessThan(Date.parse(saved.scheduled_at));
});

test("administrator sees a blocked registration scan without unsafe retry or reveal", async ({ page }) => {
  await login(page);
  await page.route("**/api/admin/stats", route => route.fulfill({ json: {
    ok: true, teams: 1, riders: 8, race_results: 0,
    game_writes_enabled: true, two_phase_available: true,
  } }));
  await page.route("**/api/admin/autopilot/health", route => route.fulfill({ json: {
    ok: true, enabled: true, races: [{
      event_id: "preview-race", name: "Preview phase race",
      registration_deadline: "2026-10-05T12:00:00Z",
      tactics_deadline: "2026-10-05T15:00:00Z",
      state: "BLOCKED", processed: 12, entered: 3, scan_updated_at: null,
    }],
  } }));
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Two-phase race health" });
  await expect(panel.getByText("Registration closed; entry scan incomplete", { exact: false })).toBeVisible();
  await expect(panel.getByText("Entry scan: 12 teams checked, 3 entered", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Refresh race health" })).toBeVisible();
  await expect(panel.getByRole("button", { name: /retry|force|reveal/i })).toHaveCount(0);
});

test("completed scans awaiting reveal do not offer no-contest cancellation", async ({ page }) => {
  await login(page);
  await page.route("**/api/admin/stats", route => route.fulfill({ json: {
    ok: true, teams: 1, riders: 8, race_results: 0,
    game_writes_enabled: true, two_phase_available: true,
  } }));
  await page.route("**/api/admin/autopilot/health", route => route.fulfill({ json: {
    ok: true, enabled: true, decisions: [], races: [{
      event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Awaiting reveal race",
      registration_deadline: "2026-10-05T12:00:00Z",
      tactics_deadline: "2026-10-05T15:00:00Z",
      state: "OVERDUE", processed: 20, entered: 8, scan_updated_at: null,
    }],
  } }));
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Two-phase race health" });
  await expect(panel.getByText("Division reveal overdue", { exact: false })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Cancel as no contest" })).toHaveCount(0);
});

test("administrator confirms a no-contest decision and sees the saved outcome", async ({ page }) => {
  await login(page);
  await page.route("**/api/admin/stats", route => route.fulfill({ json: {
    ok: true, teams: 1, riders: 8, race_results: 0,
    game_writes_enabled: true, two_phase_available: true,
  } }));
  let cancelled = false;
  await page.route("**/api/admin/autopilot/health", route => route.fulfill({ json: {
    ok: true, enabled: true, decisions: cancelled ? [{
      event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Preview phase race",
      status: "CANCELLED", reason: "INCOMPLETE_ENTRY_SCAN",
      decided_by: "admin-id", voided_at: "2026-10-05T15:01:00Z",
      registered_teams: 7, processed_teams: 12, automatic_entries: 3,
    }] : [], races: cancelled ? [] : [{
      event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Preview phase race",
      registration_deadline: "2026-10-05T12:00:00Z",
      tactics_deadline: "2026-10-05T15:00:00Z",
      state: "BLOCKED", processed: 12, entered: 3, scan_updated_at: null,
    }],
  } }));
  await page.route("**/api/admin/autopilot/void", route => {
    expect(route.request().postDataJSON().event_id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    cancelled = true;
    return route.fulfill({ json: { ok: true, already_cancelled: false } });
  });
  await page.goto("/admin");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Cancel as no contest" }).click();
  await expect(page.getByText("Preview phase race was cancelled as no contest", { exact: false })).toBeVisible();
  expect((await page.evaluate(() => fetch("/api/admin/autopilot/health").then(response => response.json()))).decisions).toHaveLength(1);
  await expect(page.getByRole("heading", { name: "Recent no-contest decisions" })).toBeVisible();
  await expect(page.getByText("7 registered teams", { exact: false })).toBeVisible();
  expect(cancelled).toBe(true);
});

test("administrator no-contest action reaches the real route and saved fixture", async ({ page }) => {
  test.skip(process.env.PELOTONIA_E2E_NO_CONTEST !== "true", "Run with the isolated no-contest server fixture");
  await login(page);
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Two-phase race health" });
  await expect(panel.getByText("Disposable no-contest fixture")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await panel.getByRole("button", { name: "Cancel as no contest" }).click();
  await expect(panel.getByRole("heading", { name: "Recent no-contest decisions" })).toBeVisible();
  await expect(panel.getByText("2 registered teams", { exact: false })).toBeVisible();
  const response = await page.request.get("/api/admin/autopilot/health");
  expect(response.status()).toBe(200);
  const saved = await response.json();
  expect(saved.races).toHaveLength(0);
  expect(saved.decisions).toMatchObject([{
    event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "CANCELLED", registered_teams: 2, processed_teams: 1,
  }]);
});

test("a cancelled race remains visible on the calendar without a race action", async ({ page }) => {
  const now = new Date();
  const scheduled = new Date(now.getTime() + 86400000).toISOString();
  await page.route("**/api/events?*", route => route.fulfill({ json: {
    ok: true, server_time: now.toISOString(), events: [{
      id: "cancelled-race", name: "Cancelled preview race", kind: "one_day",
      gender: "M", status: "CANCELLED", readiness: "CANCELLED",
      deadline: new Date(now.getTime() - 86400000).toISOString(),
      registration_deadline: new Date(now.getTime() - 86400000).toISOString(),
      tactics_deadline: new Date(now.getTime() + 3600000).toISOString(),
      scheduled_at: scheduled, calendar_source: "PELOTONIA", race_tier: 2,
      team_count: 8, team_size: 8, orders_ready: true, winner_points: 200,
    }],
  } }));
  await login(page);
  await page.goto("/team/calendar");
  const card = page.getByRole("article").filter({ hasText: "Cancelled preview race" });
  await expect(card.getByText("Cancelled · no results or points")).toBeVisible();
  await expect(card.getByRole("link", { name: /Watch race|Review tactics|Set up/ })).toHaveCount(0);
});
