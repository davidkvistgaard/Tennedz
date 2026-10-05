// Disposable two-phase preview probe for 2 or 45 independent managers.
// Requires the allowlisted isolated Supabase config and the same number of
// p02-isolated-teams accounts. Clean the
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
const managerCount = Number(process.argv[2] ?? 2);
assert.ok([2, 45].includes(managerCount), "Use 2 or 45 managers.");
const revealMode = process.argv[3] ?? "manual";
assert.ok(["manual", "scheduler"].includes(revealMode), "Use manual or scheduler reveal mode.");
if (revealMode === "scheduler") assert.equal(managerCount, 2,
  "The timed scheduler probe uses two managers to limit disposable test data.");
assert.equal(teams.length, managerCount);
assert.equal(new Set(teams.map(team => team.userId)).size, managerCount);
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
const browserStates = [];
const pageErrors = [];
const activePages = new Set();
const newManagerPage = async index => {
  const context = await browser.newContext({ baseURL: preview.origin,
    viewport: { width: 1280, height: 900 }, storageState: browserStates[index] });
  const page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));
  activePages.add(page);
  return page;
};
const closeManagerPage = async page => {
  activePages.delete(page);
  await page.context().close();
};
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
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));
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
    browserStates.push(await context.storageState());
    await context.close();
    console.log(`Manager ${index + 1} registered through the preview calendar.`);
  }

  assert.equal((await ok(db.from("event_teams").select("team_id").eq("event_id", eventId))).length, managerCount);
  if (revealMode === "scheduler") {
    const scanLimit = Date.now() + 180000;
    let complete = false;
    while (Date.now() < scanLimit) {
      const job = await ok(db.from("recovery_autopilot_jobs").select("status,processed_count")
        .eq("event_id", eventId).maybeSingle());
      if (job?.status === "COMPLETE") {
        assert.ok(job.processed_count >= managerCount);
        complete = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert.ok(complete, "The timed scheduler did not complete the entry scan before registration closed.");
    console.log("Scheduled entry scan completed while registration was open.");
  }
  const closed = new Date(Date.now() - 60000).toISOString();
  await ok(db.from("events").update({ deadline: closed, registration_deadline: closed })
    .eq("id", eventId));
  if (revealMode === "manual") {
    await ok(db.from("recovery_autopilot_jobs").insert({ event_id: eventId, status: "COMPLETE" }));
  } else {
    const revealLimit = Date.now() + 180000;
    let committed = false;
    while (Date.now() < revealLimit) {
      const record = await ok(db.from("recovery_division_reveals").select("event_id")
        .eq("event_id", eventId).maybeSingle());
      if (record) {
        committed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert.ok(committed, "The timed scheduler did not reveal divisions after registration closed.");
    console.log("Scheduled division reveal committed after registration closed.");
  }
  const reveal = await ok(db.rpc("recovery_commit_division_reveal", { p_event: eventId }));
  assert.equal(reveal.assignments.length, managerCount);
  const divisions = new Map();
  for (const assignment of reveal.assignments) {
    divisions.set(assignment.divisionIndex, (divisions.get(assignment.divisionIndex) ?? 0) + 1);
  }
  assert.deepEqual([...divisions.values()].sort((a, b) => a - b),
    managerCount === 45 ? [15, 15, 15] : [2]);
  for (const [index, team] of teams.entries()) {
    const page = await newManagerPage(index);
    await page.goto(`/team/run?event_id=${eventId}`);
    await expect(page.getByRole("heading", { name: "Your division is ready" }))
      .toBeVisible({ timeout: 20000 });
    const division = reveal.assignments.find(row => row.teamId === team.teamId)?.divisionIndex;
    assert.ok(division);
    await expect(page.getByText(`Division ${division} of ${divisions.size}`, { exact: false })).toBeVisible();
    await page.getByLabel("Team plan").selectOption(index % 2 === 0 ? "breakaway" : "conserve");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your updated lineup and orders are saved until tactics close.")).toBeVisible();
    browserStates[index] = await page.context().storageState();
    await closeManagerPage(page);
  }
  const entries = await ok(db.from("event_teams").select("team_id,orders").eq("event_id", eventId));
  assert.equal(entries.find(entry => entry.team_id === teams[0].teamId).orders.plan, "breakaway");
  assert.equal(entries.find(entry => entry.team_id === teams[1].teamId).orders.plan, "conserve");

  const tacticsClosed = new Date(Date.now() - 30000).toISOString();
  await ok(db.from("events").update({ tactics_deadline: tacticsClosed }).eq("id", eventId));
  await ok(db.rpc("recovery_commit_tactics_lock", { p_event: eventId }));
  await ok(db.from("events").update({ scheduled_at: new Date(Date.now() - 10000).toISOString() })
    .eq("id", eventId));
  // Representatives of every division may arrive before either prepares the
  // race. The database must still commit one set of replays and awards.
  const starterIndices = managerCount === 2 ? [0, 1] :
    [...divisions.keys()].map(division => teams.findIndex(team =>
      reveal.assignments.some(row => row.teamId === team.teamId && row.divisionIndex === division)));
  assert.equal(new Set(starterIndices).size, divisions.size === 1 ? 2 : divisions.size);
  const starterPages = await Promise.all(starterIndices.map(newManagerPage));
  await Promise.all(starterPages.map(page => page.goto(`/team/view/${eventId}`)));
  await Promise.all(starterPages.map(page => expect(page.locator(".replay-layout"))
    .toBeVisible({ timeout: 60000 })));
  async function checkManagerResult(page, index) {
    const division = reveal.assignments.find(row => row.teamId === teams[index].teamId)?.divisionIndex;
    assert.ok(division);
    const response = await page.request.get(
      `/api/event/results?event_id=${eventId}&division_index=${division}`);
    assert.equal(response.status(), 200, await response.text());
    const result = await response.json();
    assert.equal(result.teams.length, divisions.get(division));
    assert.equal(result.riders.length, divisions.get(division) * 8);
    assert.ok(result.teams.some(row => row.team_id === teams[index].teamId));
  }
  for (const [position, page] of starterPages.entries()) {
    await checkManagerResult(page, starterIndices[position]);
  }
  for (const page of starterPages) await closeManagerPage(page);
  for (let index = 0; index < managerCount; index++) {
    if (starterIndices.includes(index)) continue;
    const page = await newManagerPage(index);
    await page.goto(`/team/view/${eventId}`);
    await expect(page.locator(".replay-layout")).toBeVisible({ timeout: 60000 });
    await checkManagerResult(page, index);
    await closeManagerPage(page);
  }
  assert.equal((await ok(db.from("event_team_results").select("team_id").eq("event_id", eventId))).length, managerCount);
  assert.equal((await ok(db.from("event_rider_results").select("rider_id").eq("event_id", eventId))).length, managerCount * 8);
  assert.equal((await ok(db.from("event_division_runs").select("division_index").eq("event_id", eventId))).length, divisions.size);
  const awards = await ok(db.from("recovery_ranking_awards").select("award_key")
    .eq("event_id", eventId));
  const expectedAwards = managerCount === 45 ? 60 : 16;
  assert.equal(awards.length, expectedAwards);
  assert.equal(new Set(awards.map(row => row.award_key)).size, expectedAwards);
  const beforeRepeat = await ok(db.from("teams").select("id,rating")
    .in("id", teams.map(team => team.teamId)));
  const repeatPage = await newManagerPage(1);
  const repeat = await repeatPage.request.post("/api/event/prepare", {
    headers: { Origin: preview.origin }, data: { event_id: eventId },
  });
  assert.equal(repeat.status(), 200, await repeat.text());
  assert.equal((await repeat.json()).already_finished, true);
  const afterRepeat = await ok(db.from("teams").select("id,rating")
    .in("id", teams.map(team => team.teamId)));
  assert.deepEqual(afterRepeat.sort((a, b) => a.id.localeCompare(b.id)),
    beforeRepeat.sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal((await ok(db.from("recovery_ranking_awards").select("award_key")
    .eq("event_id", eventId))).length, expectedAwards);
  await closeManagerPage(repeatPage);
  assert.deepEqual(pageErrors, []);
  console.log(`${managerCount} managers completed registration, reveal, tactics, replay, results and idempotent points.`);
} catch (error) {
  console.error("Browser probe failed:", error);
  for (const [index, page] of [...activePages].entries()) {
    const location = new URL(page.url());
    console.error(`Manager ${index + 1} page:`, `${location.origin}${location.pathname}`,
      (await page.locator('[aria-label="Your division"]').innerText().catch(() => "No division panel")),
      (await page.locator('[role="alert"]').allInnerTexts().catch(() => [])));
  }
  throw error;
} finally {
  await browser.close();
  console.log(`Clean disposable event ${eventId} and its ${managerCount * 8} riders with guarded management SQL.`);
}
