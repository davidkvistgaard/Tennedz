import { test, expect } from "@playwright/test";

const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const registrationDeadline = new Date(Date.now() - 60_000).toISOString();
const tacticsDeadline = new Date(Date.now() + 3_600_000).toISOString();
const scheduledAt = new Date(Date.now() + 7_200_000).toISOString();
const selectedRiders = Array.from({ length: 8 }, (_, index) => `fixture-M-${index}`);

test("a registered manager sees the saved division and can edit tactics without entering again", async ({ page }) => {
  const pageErrors = [];
  const tacticsPosts = [];
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
    ok: true, event_id: eventId, phase: "preparation", division: { index: 2, total: 3,
      teams: [
        { team_id: "team-alice", name: "ALICE Cycling", earned_points_at_lock: 120, seed_rank: 16 },
        { team_id: "team-bob", name: "BOB Cycling", earned_points_at_lock: 110, seed_rank: 17 },
      ],
    },
  } }));
  await page.route("**/api/event/tactics", async (route) => {
    tacticsPosts.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });

  await page.goto(`/team/run?event_id=${eventId}`);
  await expect(page.getByRole("heading", { name: "Your division is ready" })).toBeVisible();
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
  expect(pageErrors).toEqual([]);
});
