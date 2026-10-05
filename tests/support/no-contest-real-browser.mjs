// Browser -> real local API -> allowlisted isolated Supabase database.
// The fixture is disposable and never uses a production URL or account.
// Build the app first. Supply url, anonKey and serviceKey in the ignored
// .recovery-local/real-test-config.json; remove that file after the run.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

const config = JSON.parse(readFileSync(
  new URL("../../.recovery-local/real-test-config.json", import.meta.url), "utf8"));
assert.equal(config.url, "https://nxhvaoonnvmvohqaxfdx.supabase.co");
assert.ok(config.anonKey && config.serviceKey);
const db = createClient(config.url, config.serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } });
const eventId = randomUUID();
const email = `p03-void-${randomUUID()}@example.com`;
const password = randomBytes(24).toString("base64url");
const origin = "http://localhost:31311";
let userId;
let teamId;
let eventCreated = false;
let child;
let browser;

async function ok(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw Error("Local server stopped before it was ready.");
    try {
      const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Keep waiting for the local process. */ }
    await delay(500);
  }
  throw Error("Local server did not become ready.");
}

async function cleanup() {
  const failures = [];
  const remove = async (table, column, id) => {
    if (!id) return;
    const { error } = await db.from(table).delete().eq(column, id);
    if (error) failures.push(`${table}: ${error.message}`);
  };
  await remove("recovery_two_phase_voids", "event_id", eventCreated ? eventId : null);
  await remove("event_teams", "event_id", eventCreated ? eventId : null);
  await remove("recovery_autopilot_jobs", "event_id", eventCreated ? eventId : null);
  await remove("events", "id", eventCreated ? eventId : null);
  await remove("teams", "id", teamId);
  if (userId) {
    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) failures.push(`auth user: ${error.message}`);
  }
  if (failures.length) throw Error(`Fixture cleanup failed: ${failures.join("; ")}`);
}

try {
  const account = await ok(db.auth.admin.createUser({
    email, password, email_confirm: true,
  }));
  userId = account.user.id;
  teamId = (await ok(db.from("teams").insert({
    user_id: userId, name: "P03 disposable no-contest admin",
  }).select("id").single())).id;
  const stage = await ok(db.from("stage_profiles").select("id")
    .eq("name", "Recovery Flat 130").limit(1).single());
  const now = Date.now();
  const scheduledAt = new Date(now + 3 * 86400000);
  scheduledAt.setUTCHours(12, 0, 0, 0);
  while (![0, 3].includes(scheduledAt.getUTCDay()))
    scheduledAt.setUTCDate(scheduledAt.getUTCDate() + 1);
  await ok(db.from("events").insert({
    id: eventId, name: "P03 disposable no-contest race", kind: "one_day",
    gender: "M", country_code: "FR", stage_profile_id: stage.id,
    status: "OPEN", entry_fee: 0, calendar_source: "PELOTONIA", race_tier: 2,
    deadline: new Date(now - 3600000).toISOString(),
    registration_deadline: new Date(now - 3600000).toISOString(),
    tactics_deadline: new Date(now + 3600000).toISOString(),
    scheduled_at: scheduledAt.toISOString(),
  }));
  eventCreated = true;
  await ok(db.from("event_teams").insert({ event_id: eventId, team_id: teamId }));
  await ok(db.from("recovery_autopilot_jobs").insert({
    event_id: eventId, status: "PENDING", processed_count: 1,
  }));
  child = spawn(process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "31311"],
    { stdio: "ignore", env: {
      ...process.env, SUPABASE_URL: config.url, SUPABASE_ANON_KEY: config.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: config.serviceKey,
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      APP_ORIGIN: origin, ADMIN_USER_IDS: userId,
      RECOVERY_ALLOW_GAME_WRITES: "true", PELOTONIA_AUTOPILOT_ENABLED: "true",
    } });
  await waitForServer();
  browser = await chromium.launch({ headless: true,
    channel: process.platform === "win32" ? "msedge" : undefined });
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email or username").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/(onboarding|team)(?:\?|$)/);
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Two-phase race health" });
  await expect(panel.getByText("P03 disposable no-contest race")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await panel.getByRole("button", { name: "Cancel as no contest" }).click();
  await expect(panel.getByRole("heading", { name: "Recent no-contest decisions" })).toBeVisible();
  const event = await ok(db.from("events").select("status").eq("id", eventId).single());
  assert.equal(event.status, "CANCELLED");
  const decision = await ok(db.from("recovery_two_phase_voids")
    .select("reason,decided_by,registered_teams,processed_teams")
    .eq("event_id", eventId).single());
  assert.deepEqual(decision, {
    reason: "INCOMPLETE_ENTRY_SCAN", decided_by: userId,
    registered_teams: 1, processed_teams: 1,
  });
  const repeated = await page.request.post("/api/admin/autopilot/void", {
    headers: { Origin: origin }, data: { event_id: eventId },
  });
  assert.equal(repeated.status(), 200);
  assert.equal((await repeated.json()).already_cancelled, true);
  assert.equal((await ok(db.from("recovery_two_phase_voids")
    .select("event_id").eq("event_id", eventId))).length, 1);
  for (const table of ["recovery_division_reveals", "event_team_results",
    "event_rider_results", "recovery_ranking_awards"]) {
    assert.equal((await ok(db.from(table).select("event_id")
      .eq("event_id", eventId))).length, 0, `${table} must stay empty`);
  }
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("PASS: real isolated database no-contest browser flow and idempotent retry.");
} finally {
  if (browser) await browser.close();
  if (child) { child.kill(); await delay(500); }
  await cleanup();
  console.log("Disposable no-contest event, team and user removed.");
}
