import { test, expect } from "@playwright/test";

const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const registrationDeadline = new Date(Date.now() - 60_000).toISOString();
const tacticsDeadline = new Date(Date.now() + 3_600_000).toISOString();
const scheduledAt = new Date(Date.now() + 7_200_000).toISOString();
const selectedRiders = Array.from({ length: 8 }, (_, index) => `fixture-M-${index}`);

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
  await expect(page.getByRole("link", { name: /Watch race/ })).toHaveAttribute(
    "href", `/team/view/${eventId}`,
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
