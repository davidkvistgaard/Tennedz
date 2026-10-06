// Isolated protocol fixture, NOT a real Supabase instance. No external service is contacted.
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const sessions = new Map();
const clubKits = new Map();
const v2Drafts = new Map();
const ids = { alice: "11111111-1111-4111-8111-111111111111", bob: "22222222-2222-4222-8222-222222222222", missing: "33333333-3333-4333-8333-333333333333", duplicate: "44444444-4444-4444-8444-444444444444", settings: "55555555-5555-4555-8555-555555555555", v2manager:"66666666-6666-4666-8666-666666666666", v2outsider:"77777777-7777-4777-8777-777777777777", unregistered:"88888888-8888-4888-8888-888888888888" };
const passwords = new Map(Object.keys(ids).map(name => [name, "fixture-password"]));
const twoPhaseEventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const twoPhaseStageId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const v2PreviewEventId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const noContestFixture = process.env.PELOTONIA_E2E_NO_CONTEST === "true";
const v2SaveFixture = process.env.PELOTONIA_E2E_V2_SAVE === "true";
const v2LockFixture = process.env.PELOTONIA_E2E_V2_LOCK === "true";
let v2LockedAt = null;
let noContestCancelled = false;
const divisionTeams = [
  ["team-alice", "ALICE Cycling", 1], ["team-a2", "ALICE Rival", 1],
  ["team-bob", "BOB Cycling", 2], ["team-b2", "BOB Rival", 2],
  ["team-c1", "Third Division One", 3], ["team-c2", "Third Division Two", 3],
];
const user = name => ({ id: ids[name], email: `${name}@tennedz.local`, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" });
function token(name) {
  const sid = randomUUID();
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: ids[name], exp: Math.floor(Date.now()/1000)+3600, session_id: sid })}.fixture`;
  const data = { access_token, refresh_token: sid, token_type: "bearer", expires_in: 3600, user: user(name) };
  sessions.set(access_token, data);
  return data;
}
const server = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let body; try { body = JSON.parse(raw || "{}"); } catch { body = {}; }
  const url = new URL(req.url, "http://localhost");
  const session = sessions.get(req.headers.authorization?.replace("Bearer ", ""));
  const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json", "x-supabase-api-version": "2024-01-01" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/__test_shutdown" && req.method === "POST") {
    send(200, { ok: true });
    setTimeout(stop, 100);
    return;
  }
  if (url.pathname === "/auth/v1/token") {
    if (url.searchParams.get("grant_type") === "refresh_token") {
      const old = [...sessions.values()].find(s => s.refresh_token === body.refresh_token);
      if (!old) return send(400, { code: "refresh_token_not_found", msg: "Invalid token" });
      return send(200, token(old.user.email.split("@")[0]));
    }
    const name = body.email?.split("@")[0];
    if (name === "unavailable") return send(503, { msg: "Fixture unavailable" });
    if (!ids[name] || body.password !== passwords.get(name)) return send(400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(200, token(name));
  }
  if (url.pathname === "/auth/v1/user") {
    if (!session) return send(401, { code: "bad_jwt", msg: "Invalid JWT" });
    if (req.method === "PUT") {
      const name = session.user.email.split("@")[0];
      if (body.current_password !== passwords.get(name)) return send(400, { code: "invalid_credentials", msg: "Invalid current password" });
      if (typeof body.password !== "string" || body.password.length < 12) return send(400, { code: "weak_password", msg: "Password is too short" });
      passwords.set(name, body.password);
    }
    return send(200, session.user);
  }
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(req.headers.authorization?.replace("Bearer ", ""));
    return send(200, {});
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    if (req.headers.apikey !== "fixture-service-role") return send(403, { message: "Bad fixture key" });
    if (v2LockFixture && url.pathname === "/rest/v1/rpc/recovery_race_snapshot") {
      if (body.p_event !== v2PreviewEventId)
        return send(404, { code: "PT404", message: "The race was not found." });
      return send(200, { event: { id: v2PreviewEventId, kind: "one_day",
        deadline: "2026-10-05T12:00:00Z", country_code: "DK",
        weather_locked: null }, game_date: "2026-10-05" });
    }
    if (v2LockFixture && url.pathname === "/rest/v1/rpc/recovery_commit_v2_tactics_lock") {
      if (body.p_event !== v2PreviewEventId || body.p_weather?.source !== "LOCKED_SIM" ||
          !Number.isFinite(body.p_weather?.temp_c))
        return send(400, { code: "PT400", message: "Valid locked v2 weather is required." });
      const alreadyLocked = v2LockedAt !== null;
      v2LockedAt ??= new Date().toISOString();
      return send(200, { eventId: v2PreviewEventId, lockedAt: v2LockedAt,
        inputSnapshot: { v2_orders_by_team_id: { private: true } }, alreadyLocked });
    }
    if (v2SaveFixture && url.pathname === "/rest/v1/rpc/recovery_save_v2_tactics_draft") {
      if (req.method !== "POST" || body.p_event !== v2PreviewEventId ||
          body.p_user !== ids.v2manager || body.p_orders?.captainId !== "fixture-M-0")
        return send(403, { code: "PT403", message: "This team is not in the revealed race." });
      v2Drafts.set(body.p_user, body.p_orders);
      return send(200, { ok: true, event_id: body.p_event,
        team_id: "team-v2manager", saved_at: new Date().toISOString(),
        orders_version: 2, draft_count: v2Drafts.size });
    }
    if (noContestFixture && url.pathname === "/rest/v1/rpc/recovery_void_incomplete_two_phase_race") {
      if (req.method !== "POST" || body.p_event !== twoPhaseEventId || body.p_user !== ids.alice)
        return send(409, { code: "PT409", message: "This race cannot be cancelled under the missed-scan rule." });
      const already_cancelled = noContestCancelled;
      noContestCancelled = true;
      return send(200, { ok: true, event_id: twoPhaseEventId, already_cancelled, registered_teams: 2 });
    }
    if (url.pathname === "/rest/v1/club_identities") {
      if (req.method === "POST") { clubKits.set(body.team_id, { palette: body.palette, pattern: body.pattern }); return send(200, clubKits.get(body.team_id)); }
      const saved = clubKits.get(url.searchParams.get("team_id")?.replace("eq.", ""));
      return send(200, saved ? [saved] : []);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(500, { message: "Unexpected database mutation in recovery" });
    const table = url.pathname.split("/").at(-1);
    if (noContestFixture && table === "recovery_two_phase_voids")
      return send(200, noContestCancelled ? [{
        event_id: twoPhaseEventId, reason: "INCOMPLETE_ENTRY_SCAN", decided_by: ids.alice,
        voided_at: "2026-10-05T15:01:00Z", registered_teams: 2,
        processed_teams: 1, automatic_entries: 1,
      }] : []);
    if (noContestFixture && table === "events" && url.searchParams.get("status") === "eq.OPEN")
      return send(200, noContestCancelled ? [] : [{
        id: twoPhaseEventId, name: "Disposable no-contest fixture",
        registration_deadline: "2026-10-05T12:00:00Z",
        tactics_deadline: "2026-10-05T15:00:00Z",
      }]);
    if (noContestFixture && table === "events" && url.searchParams.get("id")?.startsWith("in."))
      return send(200, [{ id: twoPhaseEventId, name: "Disposable no-contest fixture",
        status: noContestCancelled ? "CANCELLED" : "OPEN" }]);
    if (noContestFixture && table === "recovery_autopilot_jobs")
      return send(200, [{ event_id: twoPhaseEventId, status: "PENDING",
        processed_count: 1, entered_count: 1, updated_at: "2026-10-05T11:59:00Z" }]);
    if (noContestFixture && table === "recovery_division_reveals") return send(200, []);
    if (table === "teams") {
      if (url.searchParams.get("id")?.startsWith("in."))
        return send(200, divisionTeams.map(([id, name]) => ({ id, name })));
      const uid = url.searchParams.get("user_id")?.replace("eq.", "");
      const name = Object.keys(ids).find(n => ids[n] === uid);
      const teams = !name || name === "missing" ? [] : [{ id: `team-${name}`, user_id: uid, name: `${name.toUpperCase()} Cycling`, budget: 100000, rating: 0 }];
      if (name === "duplicate") teams.push({ ...teams[0], id: "second-team" });
      return send(200, teams);
    }
    if (table === "event_teams" &&
      url.searchParams.get("event_id") === `eq.${v2PreviewEventId}`) {
      const teamId=url.searchParams.get("team_id")?.replace("eq.", "");
      return send(200,teamId==="team-v2manager"?{
        team_id:teamId,selected_riders:Array.from({length:8},(_,i)=>`fixture-M-${i}`),
        captain_id:"fixture-M-0",
      }:null);
    }
    if (table === "event_teams" &&
      url.searchParams.get("event_id") === `eq.${twoPhaseEventId}`) {
      const teamId = url.searchParams.get("team_id")?.replace("eq.", "");
      return send(200, ["team-alice", "team-bob"].includes(teamId)
        ? { team_id: teamId } : null);
    }
    if (table === "events" && url.searchParams.get("id") === `eq.${twoPhaseEventId}`) {
      return send(200, { id: twoPhaseEventId,
        status: noContestCancelled ? "CANCELLED" : "OPEN",
        registration_deadline: new Date(Date.now() - 60000).toISOString(),
        tactics_deadline: new Date(Date.now() + 3600000).toISOString(),
        scheduled_at: new Date(Date.now() + 7200000).toISOString() });
    }
    if (table === "events" && url.searchParams.get("id") === `eq.${v2PreviewEventId}`)
      return send(200,{id:v2PreviewEventId,kind:"one_day",gender:"M",status:"OPEN",
        stage_profile_id:twoPhaseStageId,
        registration_deadline:new Date(Date.now()-60000).toISOString(),
        tactics_deadline:new Date(Date.now()+3600000).toISOString()});
    if (table === "stage_profiles" &&
      url.searchParams.get("id") === `eq.${twoPhaseStageId}`)
      return send(200, {distance_km:20,keypoints:[{km:10}]});
    if (table === "recovery_division_reveal_entries" &&
      url.searchParams.get("event_id") === `eq.${v2PreviewEventId}`)
      return send(200,url.searchParams.get("team_id")==="eq.team-v2manager"
        ?{team_id:"team-v2manager",division_index:1}:null);
    if (table === "recovery_division_reveal_entries" &&
      url.searchParams.get("event_id") === `eq.${twoPhaseEventId}`) {
      return send(200, divisionTeams.map(([team_id, , division_index], index) => ({
        team_id, division_index, seed_rank: index + 1,
        earned_points_at_lock: 120 - index * 10,
      })));
    }
    if (table === "recovery_tactics_commits" &&
      url.searchParams.get("event_id") === `eq.${twoPhaseEventId}`)
      return send(200, null);
    if (table === "team_riders") return send(200, ["M","F"].flatMap((gender,g) => Array.from({length:8},(_,i)=>({rider:{id:`fixture-${gender}-${i}`,name: ["Emil Berg","Louis Morel","Mateo Rojas","Dawit Tesfay","Luca Rossi","Noah Vermeer","Adam Nowak","Elias Holm","Freja Møller","Elin Lind","Femke Visser","Zofia Kowalska","Haruka Mori","Lina Moreau","Sara Costa","Amina Diallo"][g*8+i],gender,country_code:["DK","FR","CO","ER","IT","NL","PL","SE"][i],age:20+i*2,rating:i*11,sprint:40+i*3,flat:52,hills:45+i,mountain:65-i*3,cobbles:40,timetrial:43,endurance:60,strength:45,wind:47,form:85,fatigue:i*2}}))));
    if (table === "game_state") return send(200, { game_date: "2026-01-01" });
    return send(200, []);
  }
  send(404, { message: "Unknown fixture path" });
});
server.listen(54329, "127.0.0.1");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100"], { stdio: "inherit", env: {
  ...process.env, RACE_LAB_ENABLED: "true", PELOTONIA_V2_TACTICS_PREVIEW_ENABLED: "true",
  PELOTONIA_V2_TACTICS_SAVE_ENABLED: v2SaveFixture ? "true" : "false",
  PELOTONIA_V2_TACTICS_LOCK_ENABLED: v2LockFixture ? "true" : "false",
  SUPABASE_URL: "http://127.0.0.1:54329", SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", APP_ORIGIN: "http://localhost:3100", ADMIN_USER_IDS: ids.alice,
  RECOVERY_ALLOW_GAME_WRITES: noContestFixture || v2SaveFixture || v2LockFixture ? "true" : "false",
  PELOTONIA_AUTOPILOT_ENABLED: noContestFixture ? "true" : "false",
} });
const stop = () => { child.kill(); server.closeAllConnections(); server.close(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
child.on("exit", code => { server.close(); process.exitCode = code || 0; });
