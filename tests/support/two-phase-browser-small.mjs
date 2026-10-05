// Disposable two-manager, two-phase preview probe. Requires the allowlisted
// isolated Supabase config and two p02-isolated-teams accounts. Clean the
// event/riders with two-phase-browser-small-cleanup.sql through the isolated
// project's management SQL tool, then clean accounts with the fixture CLI.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const config = JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG, "utf8"));
if (config.url !== "https://nxhvaoonnvmvohqaxfdx.supabase.co" ||
    !config.serviceKey || !config.anonKey) {
  throw Error("Refusing a project outside the isolated test allowlist.");
}
const preview = new URL(process.env.PELOTONIA_TWO_PHASE_PREVIEW_URL);
if (preview.protocol !== "https:" || !/^tennedz-[a-z0-9-]+\.vercel\.app$/.test(preview.hostname)) {
  throw Error("Use an isolated Vercel preview URL, never the production domain.");
}
const teams = JSON.parse(readFileSync(new URL("../../.recovery-local/p02-isolated-teams.json", import.meta.url), "utf8"));
assert.equal(teams.length, 2);
assert.notEqual(teams[0].userId, teams[1].userId);
const db = createClient(config.url, config.serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } });
const eventId = randomUUID();
const eventName = "Disposable two-phase browser probe";
const riders = teams.flatMap((team, teamIndex) => Array.from({ length: 8 }, (_, riderIndex) => ({
  id: randomUUID(), teamId: team.teamId,
  name: `Two-phase probe ${eventId.slice(0, 8)} ${teamIndex + 1}-${riderIndex + 1}`,
  gender: "M",
  sprint: 40, flat: 40, hills: 40, mountain: 40, cobbles: 40,
  timetrial: 40, leadership: 40, endurance: 40, moral: 40, luck: 40,
  wind: 40, form: 50, strength: 40,
})));
const browser = await chromium.launch({ headless: true,
  channel: process.platform === "win32" ? "msedge" : undefined });
const contexts = [];
const pages = [];
const pageErrors = [];
async function ok(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}
try {
  const preflight = await browser.newContext({ baseURL: preview.origin });
  try {
    const page = await preflight.newPage();
    if (preview.searchParams.has("_vercel_share")) await page.goto(preview.href);
    await page.goto("/login");
    await expect(page.getByLabel("Email or username")).toBeVisible();
  } finally {
    await preflight.close();
  }
  const stage = await ok(db.from("stage_profiles").select("id")
    .eq("name", "Recovery Flat 130").limit(1).single());
  await ok(db.from("riders").insert(riders.map(({ teamId, ...rider }) => rider)));
  await ok(db.from("team_riders").insert(riders.map(rider => ({
    team_id: rider.teamId, rider_id: rider.id,
  }))));
  const registration = new Date(Date.now() + 3600000).toISOString();
  await ok(db.from("events").insert({ id: eventId, name: eventName, kind: "one_day",
    gender: "M", country_code: "FR", stage_profile_id: stage.id, status: "OPEN",
    entry_fee: 0, deadline: registration, registration_deadline: registration,
    tactics_deadline: new Date(Date.now() + 7200000).toISOString(),
    scheduled_at: new Date(Date.now() + 10800000).toISOString(),
    calendar_source: "PELOTONIA", race_tier: 2 }));
  console.log(`Disposable browser event: ${eventId}`);

  for (const [index, team] of teams.entries()) {
    const account = await ok(db.auth.admin.getUserById(team.userId));
    assert.match(account.user.email, /^p02-cron-[a-f0-9-]+@example\.com$/);
    const password = randomBytes(24).toString("base64url");
    await ok(db.auth.admin.updateUserById(team.userId, { password }));
    const context = await browser.newContext({ baseURL: preview.origin,
      viewport: { width: 1280, height: 900 } });
    contexts.push(context);
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
    pages.push(page);
    if (preview.searchParams.has("_vercel_share")) await page.goto(preview.href);
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(account.user.email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
    await page.goto("/team/calendar");
    const card = page.locator("article.agenda-card").filter({ hasText: eventName });
    await expect(card).toHaveCount(1);
    await card.getByRole("link", { name: /Set up/ }).click();
    await expect(page.getByRole("heading", { name: "Your lineup" })).toBeVisible();
    await page.getByRole("button", { name: "Select the first eight" }).click();
    await page.getByRole("button", { name: "Choose captain", exact: true }).first().click();
    await page.getByRole("button", { name: "Enter team" }).click();
    await expect(page.locator(".form-message[role=status]")).toHaveText(
      "Your team is registered. Divisions will be revealed after registration closes.");
    const entry = await ok(db.from("event_teams").select("team_id")
      .eq("event_id", eventId).eq("team_id", team.teamId).single());
    assert.equal(entry.team_id, team.teamId);
    console.log(`Manager ${index + 1} registered through the preview calendar.`);
  }

  assert.equal((await ok(db.from("event_teams").select("team_id").eq("event_id", eventId))).length, 2);
  const closed = new Date(Date.now() - 60000).toISOString();
  await ok(db.from("events").update({ deadline: closed, registration_deadline: closed })
    .eq("id", eventId));
  await ok(db.from("recovery_autopilot_jobs").insert({ event_id: eventId, status: "COMPLETE" }));
  const reveal = await ok(db.rpc("recovery_commit_division_reveal", { p_event: eventId }));
  assert.equal(reveal.assignments.length, 2);
  for (const [index, page] of pages.entries()) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your division is ready" }))
      .toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Division 1 of 1", { exact: false })).toBeVisible();
    await page.getByLabel("Team plan").selectOption(index === 0 ? "breakaway" : "conserve");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your updated lineup and orders are saved until tactics close.")).toBeVisible();
  }
  const entries = await ok(db.from("event_teams").select("team_id,orders").eq("event_id", eventId));
  assert.equal(entries.find(entry => entry.team_id === teams[0].teamId).orders.plan, "breakaway");
  assert.equal(entries.find(entry => entry.team_id === teams[1].teamId).orders.plan, "conserve");

  const tacticsClosed = new Date(Date.now() - 30000).toISOString();
  await ok(db.from("events").update({ tactics_deadline: tacticsClosed }).eq("id", eventId));
  await ok(db.rpc("recovery_commit_tactics_lock", { p_event: eventId }));
  await ok(db.from("events").update({ scheduled_at: new Date(Date.now() - 10000).toISOString() })
    .eq("id", eventId));
  // Both viewers may arrive before either prepares the race. The database
  // must still commit one replay and one set of point awards.
  await Promise.all(pages.map(page => page.goto(`/team/view/${eventId}`)));
  await Promise.all(pages.map(page => expect(page.locator(".replay-layout"))
    .toBeVisible({ timeout: 60000 })));
  for (const page of pages) {
    const response = await page.request.get(`/api/event/results?event_id=${eventId}`);
    assert.equal(response.status(), 200, await response.text());
    const result = await response.json();
    assert.equal(result.teams.length, 2);
    assert.equal(result.riders.length, 16);
  }
  assert.equal((await ok(db.from("event_team_results").select("team_id").eq("event_id", eventId))).length, 2);
  assert.equal((await ok(db.from("event_rider_results").select("rider_id").eq("event_id", eventId))).length, 16);
  assert.equal((await ok(db.from("event_division_runs").select("division_index").eq("event_id", eventId))).length, 1);
  const awards = await ok(db.from("recovery_ranking_awards").select("award_key")
    .eq("event_id", eventId));
  assert.equal(awards.length, 16);
  assert.equal(new Set(awards.map(row => row.award_key)).size, 16);
  const beforeRepeat = await ok(db.from("teams").select("id,rating")
    .in("id", teams.map(team => team.teamId)));
  const repeat = await pages[1].request.post("/api/event/prepare", {
    headers: { Origin: preview.origin }, data: { event_id: eventId },
  });
  assert.equal(repeat.status(), 200, await repeat.text());
  assert.equal((await repeat.json()).already_finished, true);
  const afterRepeat = await ok(db.from("teams").select("id,rating")
    .in("id", teams.map(team => team.teamId)));
  assert.deepEqual(afterRepeat.sort((a, b) => a.id.localeCompare(b.id)),
    beforeRepeat.sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal((await ok(db.from("recovery_ranking_awards").select("award_key")
    .eq("event_id", eventId))).length, 16);
  assert.deepEqual(pageErrors, []);
  console.log("Two managers completed registration, reveal, tactics, replay, results and idempotent points.");
} catch (error) {
  console.error("Browser probe failed:", error);
  for (const [index, page] of pages.entries()) {
    const location = new URL(page.url());
    console.error(`Manager ${index + 1} page:`, `${location.origin}${location.pathname}`,
      (await page.locator('[aria-label="Your division"]').innerText().catch(() => "No division panel")),
      (await page.locator('[role="alert"]').allInnerTexts().catch(() => [])));
  }
  throw error;
} finally {
  await Promise.allSettled(contexts.map(context => context.close()));
  await browser.close();
  console.log(`Clean disposable event ${eventId} and its 16 riders with guarded management SQL.`);
}
