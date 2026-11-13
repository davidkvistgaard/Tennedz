import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { request } from "@playwright/test";
import { readTestConfig } from "./real-project.mjs";
import { calendarRequest } from "../../lib/race/templates.mjs";
const config = readTestConfig(),
  db = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false },
  });
const accounts = JSON.parse(
  readFileSync(
    new URL("../../.recovery-local/real-test-fixtures.json", import.meta.url),
    "utf8",
  ),
);
const clients = [];
async function client(role) {
  const c = await request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Origin: "http://localhost:3100" },
  });
  clients.push(c);
  assert.equal(
    (
      await c.post("/api/auth/login", {
        data: {
          login_name: accounts[role].email,
          password: accounts[role].password,
        },
      })
    ).status(),
    200,
  );
  return c;
}
async function query(q) {
  const { data, error } = await q;
  if (error) throw error;
  return data;
}
try {
  const alice = await client("alice"),
    bob = await client("bob");
  const input = {
    request_id: randomUUID(),
    name: "Calendar integration",
    gender: "BOTH",
    template_id: "hills",
    deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
  };
  assert.equal((await bob.get("/api/admin/race-calendar")).status(), 403);
  assert.equal(
    (await bob.post("/api/admin/race-calendar", { data: input })).status(),
    403,
  );
  assert.equal(
    (
      await alice.post("/api/admin/race-calendar", {
        data: { ...input, template_id: "forged" },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await alice.post("/api/admin/race-calendar", {
        data: { ...input, deadline: new Date().toISOString() },
      })
    ).status(),
    400,
  );
  console.log("PASS admin-only calendar and invalid route/deadline rejection");
  const responses = await Promise.all([
    alice.post("/api/admin/race-calendar", { data: input }),
    alice.post("/api/admin/race-calendar", { data: input }),
  ]);
  for (const response of responses)
    assert.equal(response.status(), 200, await response.text());
  const [a, b] = await Promise.all(responses.map((r) => r.json()));
  assert.deepEqual(a.event_ids, b.event_ids);
  assert.equal([a, b].filter((r) => r.already_created).length, 1);
  const events = await query(
    db
      .from("events")
      .select("id,gender,entry_fee,stage_profile_id,seed,status")
      .in("id", a.event_ids),
  );
  assert.deepEqual(events.map((e) => e.gender).sort(), ["F", "M"]);
  assert.ok(
    events.every((e) => e.entry_fee === 0 && e.status === "OPEN" && e.seed),
  );
  assert.notEqual(events[0].seed, events[1].seed);
  assert.equal(events[0].stage_profile_id, events[1].stage_profile_id);
  assert.equal(
    (
      await alice.post("/api/admin/race-calendar", {
        data: { ...input, name: "Changed same request" },
      })
    ).status(),
    409,
  );
  console.log(
    "PASS simultaneous retries create one route and exactly one independent race per gender",
  );
  const calendar = await (await alice.get("/api/events?limit=100")).json();
  for (const id of a.event_ids) {
    const e = calendar.events.find((e) => e.id === id);
    assert.ok(e);
    assert.equal(e.seed, undefined);
    assert.equal(e.weather_locked, undefined);
  }
  assert.equal((await alice.get("/api/events?limit=NaN")).status(), 400);
  assert.equal(
    (await alice.get("/api/event/results?event_id=bad")).status(),
    400,
  );
  console.log(
    "PASS new races appear in public calendar without private seeds; invalid queries rejected",
  );
  const beforeStages = await query(db.from("stage_profiles").select("id")),
    beforeEvents = await query(db.from("events").select("id"));
  const broken = await db.rpc("recovery_create_race_day", {
    p_request: randomUUID(),
    p_user: randomUUID(),
    p_definition: calendarRequest(input),
  });
  assert.ok(broken.error);
  assert.equal(
    (await query(db.from("stage_profiles").select("id"))).length,
    beforeStages.length,
  );
  assert.equal(
    (await query(db.from("events").select("id"))).length,
    beforeEvents.length,
  );
  const anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false },
  });
  assert.ok(
    (
      await anon.rpc("recovery_create_race_day", {
        p_request: randomUUID(),
        p_user: accounts.alice.id,
        p_definition: calendarRequest(input),
      })
    ).error,
  );
  console.log(
    "PASS late failure rolls back route and both events; anonymous RPC blocked",
  );
  writeFileSync(
    new URL("../../.recovery-local/calendar-fixtures.json", import.meta.url),
    JSON.stringify({ request_id: input.request_id, events }, null, 2),
  );
} finally {
  await Promise.all(clients.map((c) => c.dispose()));
}
