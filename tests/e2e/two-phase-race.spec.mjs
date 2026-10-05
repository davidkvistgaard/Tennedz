import { test, expect } from "@playwright/test";

const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const registrationDeadline = new Date(Date.now() - 60_000).toISOString();
const tacticsDeadline = new Date(Date.now() + 3_600_000).toISOString();
const scheduledAt = new Date(Date.now() + 7_200_000).toISOString();
const selectedRiders = Array.from({ length: 8 }, (_, index) => `fixture-M-${index}`);

test("an open calendar changes from registration to tactics when the deadline passes", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);

  const start = new Date();
  await page.clock.install({ time: start });
  await page.route("**/api/events?*", route => route.fulfill({ json: {
    ok: true, server_time: start.toISOString(), events: [{
      id: eventId, name: "Registration boundary fixture", kind: "one_day", gender: "M",
      status: "OPEN", deadline: new Date(start.getTime() + 10_000).toISOString(),
      registration_deadline: new Date(start.getTime() + 10_000).toISOString(),
      tactics_deadline: new Date(start.getTime() + 3_600_000).toISOString(),
      scheduled_at: new Date(start.getTime() + 7_200_000).toISOString(),
      entry_fee: 0, calendar_source: "PELOTONIA", race_tier: 3,
      team_count: 8, team_size: 8, orders_ready: true,
      readiness: "REGISTERED", winner_points: 250,
    }],
  } }));
  await page.goto("/team/calendar");
  await expect(page.getByRole("link", { name: /Set up/ })).toBeVisible();
  await page.clock.runFor(15_000);
  await expect(page.getByRole("link", { name: /Review tactics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Set up/ })).toHaveCount(0);
});

test("separately signed-in managers receive only their own division from the reveal API", async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    for (const [index, name] of ["alice", "bob", "settings"].entries()) {
      const page = pages[index];
      await page.goto("http://localhost:3100/login");
      await page.getByLabel("Email or username").fill(name);
      await page.getByLabel("Password").fill("fixture-password");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/team$/);
    }

    const responses = await Promise.all(pages.slice(0, 2).map(page =>
      page.request.get(`http://localhost:3100/api/event/reveal?event_id=${eventId}`)));
    for (const response of responses) expect(response.status()).toBe(200);
    const [alice, bob] = await Promise.all(responses.map(response => response.json()));
    expect(alice.phase).toBe("preparation");
    expect(bob.phase).toBe("preparation");
    expect(alice.division.index).toBe(1);
    expect(bob.division.index).toBe(2);
    expect(alice.division.total).toBe(3);
    expect(bob.division.total).toBe(3);
    expect(alice.division.teams.map(team => team.team_id)).toEqual(["team-alice", "team-a2"]);
    expect(bob.division.teams.map(team => team.team_id)).toEqual(["team-bob", "team-b2"]);
    const unregistered = await pages[2].request.get(
      `http://localhost:3100/api/event/reveal?event_id=${eventId}`);
    expect(unregistered.status()).toBe(403);
    expect(JSON.stringify(await unregistered.json())).not.toContain("division_index");
    for (const view of [alice, bob]) {
      expect(JSON.stringify(view)).not.toMatch(/selected_riders|captain_id|orders|rider_id/);
    }
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

test("a registered manager sees the saved division and can edit tactics without entering again", async ({ page }) => {
  const pageErrors = [];
  const tacticsPosts = [];
  const revealPosts = [];
  let revealCommitted = false;
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);

  await page.route("**/api/events?*", (route) => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [{
      id: eventId, name: "Two-phase fixture", kind: "one_day", gender: "M",
      status: "OPEN", deadline: registrationDeadline, registration_deadline: registrationDeadline,
      tactics_deadline: tacticsDeadline, scheduled_at: scheduledAt, entry_fee: 0,
      calendar_source: "PELOTONIA", race_tier: 3, race_team_size: 8,
      team_count: 8, team_size: 8, orders_ready: true, readiness: "TACTICS_WINDOW",
      winner_points: 250,
    }],
  } }));
  await page.route("**/api/game-date", (route) => route.fulfill({ json: { game_date: "2026-01-01" } }));
  await page.route("**/api/stage-profile?*", (route) => route.fulfill({ json: {
    stage: { name: "Two-phase fixture route", distance_km: 100, profile_points: [[0, 0], [100, 0]] },
  } }));
  await page.route("**/api/event/join?*", (route) => route.fulfill({ json: {
    entry: { selected_riders: selectedRiders, captain_id: selectedRiders[0], orders: null },
  } }));
  await page.route("**/api/event/reveal?*", (route) => route.fulfill({ json: {
    ok: true, event_id: eventId,
    phase: revealCommitted ? "preparation" : "reveal_pending",
    division: revealCommitted ? { index: 2, total: 3,
      teams: [
        { team_id: "team-alice", name: "ALICE Cycling", earned_points_at_lock: 120, seed_rank: 16 },
        { team_id: "team-bob", name: "BOB Cycling", earned_points_at_lock: 110, seed_rank: 17 },
      ],
    } : null,
  } }));
  await page.route("**/api/event/reveal/prepare", async (route) => {
    revealPosts.push(route.request().postDataJSON());
    revealCommitted = true;
    await route.fulfill({ json: { ok: true, already_revealed: false } });
  });
  await page.route("**/api/event/tactics", async (route) => {
    tacticsPosts.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto("/team/calendar");
  const deadlines = page.getByRole("list", { name: "Race deadlines" });
  await expect(deadlines.getByRole("listitem")).toHaveCount(3);
  await expect(deadlines.getByText("Register", { exact: true })).toBeVisible();
  await expect(deadlines.getByText("Final tactics", { exact: true })).toBeVisible();
  await expect(deadlines.getByText("Race", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/two-phase-calendar.png", fullPage: true });
  await expect(page.getByRole("link", { name: /Review tactics/ })).toHaveAttribute(
    "href", new RegExp(`/team/run\\?event_id=${eventId}`),
  );
  await page.goto(`/team/run?event_id=${eventId}`);
  await expect(page.getByRole("heading", { name: "Your division is ready" })).toBeVisible();
  expect(revealPosts).toEqual([{ event_id: eventId }]);
  await expect(page.getByText("Division 2 of 3", { exact: false })).toBeVisible();
  await expect(page.getByText("BOB Cycling", { exact: false })).toBeVisible();
  await expect(page.getByText("ALICE Cycling (your team)", { exact: false })).toBeVisible();
  await expect(page.getByText("Tactics close in", { exact: false })).toBeVisible();
  await expect(page.getByText("Saved with your lineup and locked when tactics close.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: /Watch the race/ })).toHaveCount(0);
  await page.getByLabel("Team plan").selectOption("breakaway");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your updated lineup and orders are saved until tactics close.")).toBeVisible();
  expect(tacticsPosts).toHaveLength(1);
  expect(tacticsPosts[0].event_id).toBe(eventId);
  expect(tacticsPosts[0].orders.plan).toBe("breakaway");

  // Once the server reports a persisted tactics lock and the race is due,
  // the same registered manager can enter the recorded viewer.
  await page.unroute("**/api/events?*");
  await page.route("**/api/events?*", (route) => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [{
      id: eventId, name: "Two-phase fixture", kind: "one_day", gender: "M",
      status: "OPEN", deadline: registrationDeadline, registration_deadline: registrationDeadline,
      tactics_deadline: new Date(Date.now() - 120_000).toISOString(),
      scheduled_at: new Date(Date.now() - 60_000).toISOString(), entry_fee: 0,
      calendar_source: "PELOTONIA", race_tier: 3, race_team_size: 8,
      team_count: 8, team_size: 8, orders_ready: true, readiness: "LOCKED",
      winner_points: 250,
    }],
  } }));
  await page.unroute("**/api/event/reveal?*");
  await page.route("**/api/event/reveal?*", (route) => route.fulfill({ json: {
    ok: true, event_id: eventId, phase: "race_due", division: { index: 2, total: 3,
      teams: [
        { team_id: "team-alice", name: "ALICE Cycling", earned_points_at_lock: 120, seed_rank: 16 },
        { team_id: "team-bob", name: "BOB Cycling", earned_points_at_lock: 110, seed_rank: 17 },
      ],
    },
  } }));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Race day is here" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Watch the race/ })).toHaveAttribute(
    "href", `/team/view/${eventId}`,
  );
  await page.goto("/team/calendar");
  await expect(page.getByRole("link", { name: /Check race status/ })).toHaveAttribute(
    "href", new RegExp(`/team/run\\?event_id=${eventId}`),
  );
  expect(pageErrors).toEqual([]);
});

test("a team that missed registration cannot enter during the tactics window", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.route("**/api/events?*", (route) => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [{
      id: eventId, name: "Closed registration fixture", kind: "one_day", gender: "M",
      status: "OPEN", deadline: registrationDeadline,
      registration_deadline: registrationDeadline, tactics_deadline: tacticsDeadline,
      scheduled_at: scheduledAt, entry_fee: 0, calendar_source: "PELOTONIA",
      race_tier: 3, race_team_size: 8, team_size: 8, team_count: 0,
      orders_ready: false, readiness: "REGISTRATION_CLOSED", winner_points: 250,
    }],
  } }));
  await page.goto("/team/calendar");
  const card = page.locator(".agenda-card").filter({ hasText: "Closed registration fixture" });
  await expect(card.getByText("Registration closed", { exact: true })).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("an overdue division reveal explains the delay and keeps tactics closed", async ({ page }) => {
  let prepareCalls = 0;
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("alice");
  await page.getByLabel("Password").fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.route("**/api/events?*", route => route.fulfill({ json: {
    ok: true, server_time: new Date().toISOString(), events: [{
      id: eventId, name: "Delayed division fixture", kind: "one_day", gender: "M",
      status: "OPEN", deadline: registrationDeadline,
      registration_deadline: registrationDeadline,
      tactics_deadline: new Date(Date.now() - 30_000).toISOString(),
      scheduled_at: scheduledAt, entry_fee: 0, calendar_source: "PELOTONIA",
      race_tier: 3, race_team_size: 8, team_size: 8, team_count: 8,
      orders_ready: true, readiness: "REVEAL_PENDING", winner_points: 250,
    }],
  } }));
  await page.route("**/api/game-date", route => route.fulfill({ json: { game_date: "2026-01-01" } }));
  await page.route("**/api/stage-profile?*", route => route.fulfill({ json: {
    stage: { name: "Delayed fixture route", distance_km: 100, profile_points: [[0, 0], [100, 0]] },
  } }));
  await page.route("**/api/event/join?*", route => route.fulfill({ json: {
    entry: { selected_riders: selectedRiders, captain_id: selectedRiders[0], orders: null },
  } }));
  await page.route("**/api/event/reveal?*", route => route.fulfill({ json: {
    ok: true, event_id: eventId, phase: "reveal_overdue", division: null,
  } }));
  await page.route("**/api/event/reveal/prepare", route => {
    prepareCalls++;
    return route.fulfill({ status: 409, json: { ok: false } });
  });
  await page.goto("/team/calendar");
  await expect(page.getByRole("link", { name: /Check race status/ })).toHaveAttribute(
    "href", new RegExp(`/team/run\\?event_id=${eventId}`),
  );
  await page.goto(`/team/run?event_id=${eventId}`);
  await expect(page.getByRole("heading", { name: "Race preparation is delayed" })).toBeVisible();
  await expect(page.getByText("This race cannot be recorded without it", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tactics unavailable" })).toBeDisabled();
  expect(prepareCalls).toBe(0);
});
