// Isolated database only. Apply claim-void-boundary-setup.sql first and always
// apply the teardown after. Credentials live in ignored .recovery-local/.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

const { url, serviceKey } = JSON.parse(readFileSync(
  new URL("../../.recovery-local/real-test-config.json", import.meta.url), "utf8"));
assert.equal(url, "https://nxhvaoonnvmvohqaxfdx.supabase.co");
assert.ok(serviceKey);
const db = createClient(url, serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } });
const eventId = randomUUID();
const adminId = randomUUID();
let created = false;

async function ok(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}

const existingJobs = await ok(db.from("recovery_autopilot_jobs")
  .select("event_id").limit(1));
const eligibleEvents = await ok(db.from("events").select("id")
  .eq("kind", "one_day").eq("status", "OPEN")
  .in("calendar_source", ["UCI", "PELOTONIA"])
  .not("scheduled_at", "is", null)
  .gt("deadline", new Date().toISOString())
  .lte("deadline", new Date(Date.now() + 48 * 3600000).toISOString())
  .limit(1));
assert.equal(existingJobs.length, 0, "test database contains another autopilot job");
assert.equal(eligibleEvents.length, 0, "test database contains another claimable race");

try {
  const stage = await ok(db.from("stage_profiles").select("id").limit(1).single());
  const now = Date.now();
  const scheduled = new Date(now + 9 * 86400000);
  scheduled.setUTCHours(12, 0, 0, 0);
  while (![0, 3].includes(scheduled.getUTCDay()))
    scheduled.setUTCDate(scheduled.getUTCDate() + 1);
  const initial = new Date(now + 60000).toISOString();
  await ok(db.from("events").insert({
    id: eventId, name: "Disposable claim-void boundary probe",
    kind: "one_day", gender: "M", country_code: "FR",
    stage_profile_id: stage.id, status: "OPEN", entry_fee: 0,
    deadline: initial, registration_deadline: initial,
    tactics_deadline: new Date(now + 3600000).toISOString(),
    scheduled_at: scheduled.toISOString(),
    calendar_source: "PELOTONIA", race_tier: 2,
  }));
  created = true;
  await ok(db.from("recovery_autopilot_jobs")
    .insert({ event_id: eventId, status: "PENDING" }));
  const deadline = Date.now() + 1800;
  await ok(db.from("events").update({
    deadline: new Date(deadline).toISOString(),
    registration_deadline: new Date(deadline).toISOString(),
  }).eq("id", eventId));

  const held = Promise.resolve(db.rpc("recovery_test_hold_boundary_20261005"));
  await delay(500);
  assert.ok(Date.now() < deadline, "claim must start before registration close");
  const claimStarted = Date.now();
  const claim = Promise.resolve(db.rpc("recovery_autopilot_claim_job",
    { p_token: randomUUID() }));
  await delay(Math.max(0, deadline - Date.now() + 150));
  const voidStarted = Date.now();
  assert.ok(voidStarted > deadline, "void must start after registration close");
  const voided = Promise.resolve(db.rpc("recovery_void_incomplete_two_phase_race",
    { p_event: eventId, p_user: adminId }));
  const [holdResult, claimResult, voidResult] = await Promise.all([held, claim, voided]);
  for (const result of [holdResult, claimResult, voidResult])
    if (result.error) throw result.error;
  const claimWaitMs = Date.now() - claimStarted;
  assert.ok(claimWaitMs >= 1000, "claim did not wait behind the test lock");
  assert.equal(claimResult.data, null, "expired race must not be claimed");
  assert.equal(voidResult.data.already_cancelled, false);
  const event = await ok(db.from("events").select("status").eq("id", eventId).single());
  const audit = await ok(db.from("recovery_two_phase_voids")
    .select("event_id,processed_teams").eq("event_id", eventId).single());
  const job = await ok(db.from("recovery_autopilot_jobs")
    .select("lease_token,status").eq("event_id", eventId).single());
  assert.equal(event.status, "CANCELLED");
  assert.equal(audit.processed_teams, 0);
  assert.equal(job.lease_token, null);
  console.log(JSON.stringify({ pass: true, claimWaitMs,
    voidStartedAfterDeadline: true, eventStatus: event.status,
    claim: claimResult.data, alreadyCancelled: voidResult.data.already_cancelled }));
} finally {
  if (created) {
    await ok(db.from("recovery_two_phase_voids").delete().eq("event_id", eventId));
    await ok(db.from("recovery_autopilot_jobs").delete().eq("event_id", eventId));
    await ok(db.from("events").delete().eq("id", eventId));
  }
}
