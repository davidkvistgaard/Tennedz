// Finish an isolated real-output fixture after two-phase-real-output-setup.sql.
// Use the printed event ID and clean it with the matching SQL before deleting
// disposable P02 owners. No production project is accepted.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildRace } from "../../lib/race/cycle.mjs";

const [eventId] = process.argv.slice(2);
assert.match(eventId || "", /^[0-9a-f-]{36}$/);
const config = JSON.parse(readFileSync(process.env.PELOTONIA_P03_TEST_CONFIG, "utf8"));
if (config.url !== "https://nxhvaoonnvmvohqaxfdx.supabase.co" || !config.serviceKey) {
  throw Error("Refusing a project outside the isolated test allowlist.");
}
const db = createClient(config.url, config.serviceKey,
  { auth: { persistSession: false, autoRefreshToken: false } });
async function ok(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}
const event = await ok(db.from("events").select("name,status").eq("id", eventId).single());
assert.equal(event.name, "Disposable two-phase real-output probe");
assert.equal(event.status, "OPEN");
const entrants = await ok(db.from("event_teams").select("team_id").eq("event_id", eventId));
assert.equal(entrants.length, 45);
const owners = await ok(db.from("teams").select("id,user_id")
  .in("id", entrants.map(row => row.team_id)));
assert.equal(new Set(owners.map(row => row.user_id)).size, 45);
const snapshot = await ok(db.rpc("recovery_race_snapshot", { p_event: eventId }));
assert.equal(snapshot.teams.length, 45);
const output = buildRace(snapshot);
assert.equal(output.divisions.length, 3);
assert.deepEqual(output.divisions.map(division => division.teams.length), [15, 15, 15]);
const first = await ok(db.rpc("recovery_finish_race", {
  p_event: eventId, p_snapshot: snapshot, p_output: output,
}));
assert.equal(first.already_finished, false);
const awards = await ok(db.from("recovery_ranking_awards").select("award_key")
  .eq("event_id", eventId));
assert.equal(awards.length, 60);
assert.equal(new Set(awards.map(row => row.award_key)).size, 60);
assert.equal((await ok(db.from("event_division_runs").select("division_index")
  .eq("event_id", eventId))).length, 3);
assert.equal((await ok(db.from("event_team_results").select("team_id")
  .eq("event_id", eventId))).length, 45);
assert.equal((await ok(db.from("event_rider_results").select("rider_id")
  .eq("event_id", eventId))).length, 360);
const beforeRepeat = await ok(db.from("teams").select("id,rating")
  .in("id", entrants.map(row => row.team_id)));
const repeat = await ok(db.rpc("recovery_finish_race", {
  p_event: eventId, p_snapshot: snapshot, p_output: output,
}));
assert.equal(repeat.already_finished, true);
const afterRepeat = await ok(db.from("teams").select("id,rating")
  .in("id", entrants.map(row => row.team_id)));
assert.deepEqual(afterRepeat.sort((a, b) => a.id.localeCompare(b.id)),
  beforeRepeat.sort((a, b) => a.id.localeCompare(b.id)));
assert.equal((await ok(db.from("recovery_ranking_awards").select("award_key")
  .eq("event_id", eventId))).length, 60);
console.log("45 distinct owners, three 15-team replays, 360 rider results and 60 idempotent awards.");
