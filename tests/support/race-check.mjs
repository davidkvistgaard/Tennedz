import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { readTestConfig } from "./real-project.mjs";
import { buildRace } from "../../lib/race/cycle.mjs";
const cfg = readTestConfig(),
  db = createClient(cfg.url, cfg.serviceKey, {
    auth: { persistSession: false },
  });
const fixtures = JSON.parse(
  readFileSync(
    new URL("../../.recovery-local/real-test-fixtures.json", import.meta.url),
    "utf8",
  ),
);
const f = JSON.parse(
  readFileSync(
    new URL("../../.recovery-local/race-fixtures.json", import.meta.url),
    "utf8",
  ),
);
const origin = "http://localhost:3100";
const clients = [];
async function ok(query) {
  const r = await query;
  if (r.error) throw r.error;
  return r.data;
}
async function client(name) {
  const c = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  clients.push(c);
  const account = fixtures[name];
  assert.equal(
    (
      await c.post("/api/auth/login", {
        data: { login_name: account.email, password: account.password },
      })
    ).status(),
    200,
  );
  return c;
}
function entry(name, event = f.event) {
  const t = f.teams[name];
  return {
    event_id: event,
    team_id: t.id,
    selected_riders: t.riders,
    captain_id: t.riders[0],
  };
}
async function teamState() {
  return await ok(
    db
      .from("teams")
      .select("id,coins,rating")
      .in(
        "id",
        Object.values(f.teams).map((t) => t.id),
      )
      .order("id"),
  );
}
async function riderState() {
  return await ok(
    db
      .from("riders")
      .select("id,rating,form,fatigue,last_raced_on,injury_until")
      .in(
        "id",
        Object.values(f.teams).flatMap((t) => t.riders),
      )
      .order("id"),
  );
}
try {
  // Each run keeps its own evidence and can be repeated without resetting prior data.
  const template = await ok(
    db
      .from("events")
      .select("kind,gender,country_code,stage_profile_id,entry_fee")
      .eq("id", f.event)
      .single(),
  );
  f.event = randomUUID();
  await ok(
    db
      .from("events")
      .insert({
        ...template,
        id: f.event,
        name: "Recovery atomic verification",
        status: "OPEN",
        deadline: new Date(Date.now() + 86400000).toISOString(),
      }),
  );
  // Preserve earlier test evidence while giving each run healthy independent riders.
  for (const t of Object.values(f.teams)) {
    const originals = await ok(
      db.from("riders").select("*").in("id", t.riders),
    );
    const fresh = originals.map((r, i) => ({
      ...r,
      id: randomUUID(),
      name: `Replay verification ${i + 1}`,
      appearance: null,
      portrait_path: null,
      identity_version: null,
      injury_until: null,
      fatigue: 0,
      form: 40,
      rating: 0,
      last_raced_on: null,
    }));
    await ok(db.from("riders").insert(fresh));
    await ok(
      db
        .from("team_riders")
        .insert(fresh.map((r) => ({ team_id: t.id, rider_id: r.id }))),
    );
    t.riders = fresh.map((r) => r.id);
  }
  const alice = await client("alice"),
    bob = await client("bob");
  const before = await teamState();
  assert.equal(
    (await alice.post("/api/event/join", { data: entry("bob") })).status(),
    403,
  );
  const dup = entry("alice");
  dup.selected_riders = [...dup.selected_riders];
  dup.selected_riders[1] = dup.selected_riders[0];
  assert.equal(
    (await alice.post("/api/event/join", { data: dup })).status(),
    400,
  );
  assert.equal(
    (
      await bob.post("/api/admin/run-event", { data: { event_id: f.event } })
    ).status(),
    403,
  );
  assert.equal(
    (
      await alice.post("/api/admin/run-event", { data: { event_id: f.event } })
    ).status(),
    409,
  );
  assert.equal(
    (
      await bob.post("/api/event/prepare", { data: { event_id: f.event } })
    ).status(),
    403,
  );
  console.log(
    "PASS forged ownership, duplicate lineup, non-admin and early execution rejected",
  );
  const joined = await Promise.all([
    alice.post("/api/event/join", { data: entry("alice") }),
    alice.post("/api/event/join", { data: entry("alice") }),
    bob.post("/api/event/join", { data: entry("bob") }),
  ]);
  assert.ok(joined.every((r) => r.status() === 200));
  const after = await teamState();
  assert.ok(after.every((t, i) => t.coins === before[i].coins - 25));
  const saved = await alice.get(`/api/event/join?event_id=${f.event}`);
  assert.deepEqual(
    (await saved.json()).entry.selected_riders,
    f.teams.alice.riders,
  );
  console.log("PASS concurrent joins charge once and restore saved lineup");
  assert.equal(
    (
      await bob.post("/api/event/prepare", { data: { event_id: f.event } })
    ).status(),
    409,
  );
  await ok(
    db
      .from("events")
      .update({ deadline: new Date(Date.now() - 5000).toISOString() })
      .eq("id", f.event),
  );
  assert.equal(
    (await alice.post("/api/event/join", { data: entry("alice") })).status(),
    409,
  );
  const snapshot = await ok(
      db.rpc("recovery_race_snapshot", { p_event: f.event }),
    ),
    output = buildRace(snapshot);
  const bad = structuredClone(output);
  bad.divisions[0].results.at(-1).rider_id =
    "11111111-1111-4111-8111-111111111111";
  const oldRiders = await riderState();
  const rejected = await db.rpc("recovery_finish_race", {
    p_event: f.event,
    p_snapshot: snapshot,
    p_output: bad,
  });
  assert.equal(rejected.error?.code, "PT400");
  assert.deepEqual(await teamState(), after);
  assert.deepEqual(await riderState(), oldRiders);
  assert.equal(
    (
      await ok(
        db
          .from("event_division_runs")
          .select("event_id")
          .eq("event_id", f.event),
      )
    ).length,
    0,
  );
  console.log(
    "PASS late transaction failure rolls back runs, results, points and rider updates",
  );
  const stale = structuredClone(snapshot);
  stale.game_date = "1900-01-01";
  assert.ok(
    (
      await db.rpc("recovery_finish_race", {
        p_event: f.event,
        p_snapshot: stale,
        p_output: output,
      })
    ).error,
  );
  const responses = await Promise.all([
    alice.post("/api/admin/run-event", { data: { event_id: f.event } }),
    bob.post("/api/event/prepare", { data: { event_id: f.event } }),
  ]);
  for (const r of responses) {
    assert.equal(r.status(), 200, await r.text());
  }
  const summaries = await Promise.all(responses.map((r) => r.json()));
  assert.equal(summaries.filter((r) => !r.already_finished).length, 1);
  const finalTeams = await teamState(),
    finalRiders = await riderState();
  assert.equal(
    finalTeams.reduce((s, t, i) => s + t.rating - after[i].rating, 0),
    185,
  );
  assert.ok(
    finalRiders.every(
      (r, i) =>
        r.fatigue === Math.min(100, oldRiders[i].fatigue + 20) &&
        r.last_raced_on === snapshot.game_date,
    ),
  );
  assert.equal(
    (
      await alice.post("/api/admin/run-event", { data: { event_id: f.event } })
    ).status(),
    200,
  );
  assert.equal(
    (
      await bob.post("/api/event/prepare", { data: { event_id: f.event } })
    ).status(),
    200,
  );
  assert.deepEqual(await teamState(), finalTeams);
  assert.deepEqual(await riderState(), finalRiders);
  console.log(
    "PASS stale snapshot rejected; parallel execution and retry award points and fatigue once",
  );
  const history = await (
    await alice.post("/api/my-history", { data: {} })
  ).json();
  assert.ok(history.rows.some((r) => r.event_id === f.event));
  const result = await (
    await alice.get(`/api/event/results?event_id=${f.event}`)
  ).json();
  assert.equal(result.riders.length, 16);
  assert.equal(result.teams.length, 2);
  const run = await (
    await alice.get(`/api/event-run?event_id=${f.event}`)
  ).json();
  assert.equal(run.run.stage_snapshot.distance_km, 130);
  assert.ok(run.run.feed.length > 0);
  assert.equal(run.run.replay.version, 1);
  assert.equal(run.run.replay.roster.length, 16);
  assert.deepEqual(run.run.replay, output.divisions[0].replay);
  assert.equal(run.team_id, f.teams.alice.id);
  assert.equal(run.run.seed, undefined);
  const reloaded = await (
    await alice.get(`/api/event-run?event_id=${f.event}`)
  ).json();
  assert.deepEqual(reloaded.run.replay, run.run.replay);
  console.log(
    `PASS persisted replay survives reload without exposing seed; viewer /team/view/${f.event}`,
  );
  assert.equal((await alice.get("/api/leaderboards")).status(), 200);
  const anon = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false },
  });
  assert.ok(
    (await anon.rpc("recovery_race_snapshot", { p_event: f.event })).error,
  );
  console.log(
    "PASS history, results, replay, rankings and blocked anonymous RPC access",
  );
} finally {
  await Promise.all(clients.map((c) => c.dispose()));
}
