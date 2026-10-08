// Run only after real-schema.sql has been applied to the disposable project.
// Uses the supported Auth Admin API, never direct inserts into auth.users.
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { readTestConfig } from "./real-project.mjs";

const config = readTestConfig();
const fixturePath = new URL("../../.recovery-local/real-test-fixtures.json", import.meta.url);
if (existsSync(fixturePath)) throw new Error("Fixtures already exist; inspect before creating more accounts");
const db = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const fixtures = {};
const persist = () => writeFileSync(fixturePath, JSON.stringify(fixtures, null, 2));
for (const name of ["alice", "bob", "missing", "duplicate"]) {
  const password = randomBytes(24).toString("base64url");
  const email = `recovery-${name}@example.com`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  fixtures[name] = { id: data.user.id, email, password, teamIds: [] };
  persist();
  if (name === "missing") continue;
  for (let index = 0; index < (name === "duplicate" ? 2 : 1); index++) {
    const result = await db.from("teams").insert({ user_id: data.user.id, name: `${name.toUpperCase()} Cycling${index ? " duplicate" : ""}` }).select("id").single();
    if (result.error) throw result.error;
    fixtures[name].teamIds.push(result.data.id);
    persist();
    if (index || name === "duplicate") continue;
    const skills = Object.fromEntries(["sprint", "flat", "hills", "mountain", "cobbles", "leadership", "endurance", "moral", "luck", "wind", "form", "timetrial"].map(key => [key, 40]));
    const rider = await db.from("riders").insert({ name: `${name.toUpperCase()} Test Rider`, gender: "M", ...skills }).select("id").single();
    if (rider.error) throw rider.error;
    const membership = await db.from("team_riders").insert({ team_id: result.data.id, rider_id: rider.data.id });
    if (membership.error) throw membership.error;
  }
}
const date = await db.from("game_state").insert({ id: 1, game_date: "2026-01-01" });
if (date.error) throw date.error;
console.log("Created four synthetic users, four teams and two riders in the disposable test project.");
