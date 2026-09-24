// Isolated protocol fixture, NOT a real Supabase instance. No external service is contacted.
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const sessions = new Map();
const ids = { alice: "11111111-1111-4111-8111-111111111111", bob: "22222222-2222-4222-8222-222222222222", missing: "33333333-3333-4333-8333-333333333333", duplicate: "44444444-4444-4444-8444-444444444444" };
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
    if (!ids[name] || body.password !== "fixture-password") return send(400, { code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(200, token(name));
  }
  if (url.pathname === "/auth/v1/user") return session ? send(200, session.user) : send(401, { code: "bad_jwt", msg: "Invalid JWT" });
  if (url.pathname === "/auth/v1/logout") {
    sessions.delete(req.headers.authorization?.replace("Bearer ", ""));
    return send(200, {});
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    if (req.headers.apikey !== "fixture-service-role") return send(403, { message: "Bad fixture key" });
    if (req.method !== "GET" && req.method !== "HEAD") return send(500, { message: "Unexpected database mutation in recovery" });
    const table = url.pathname.split("/").at(-1);
    if (table === "teams") {
      const uid = url.searchParams.get("user_id")?.replace("eq.", "");
      const name = Object.keys(ids).find(n => ids[n] === uid);
      const teams = !name || name === "missing" ? [] : [{ id: `team-${name}`, user_id: uid, name: `${name.toUpperCase()} Cycling`, budget: 100000, rating: 0 }];
      if (name === "duplicate") teams.push({ ...teams[0], id: "second-team" });
      return send(200, teams);
    }
    if (table === "team_riders") return send(200, ["M","F"].flatMap((gender,g) => Array.from({length:8},(_,i)=>({rider:{id:`fixture-${gender}-${i}`,name: ["Emil Berg","Louis Morel","Mateo Rojas","Dawit Tesfay","Luca Rossi","Noah Vermeer","Adam Nowak","Elias Holm","Freja Møller","Elin Lind","Femke Visser","Zofia Kowalska","Haruka Mori","Lina Moreau","Sara Costa","Amina Diallo"][g*8+i],gender,country_code:["DK","FR","CO","ER","IT","NL","PL","SE"][i],age:20+i*2,rating:i*11,sprint:40+i*3,flat:52,hills:45+i,mountain:65-i*3,cobbles:40,timetrial:43,endurance:60,strength:45,wind:47,form:85,fatigue:i*2}}))));
    if (table === "game_state") return send(200, { game_date: "2026-01-01" });
    return send(200, []);
  }
  send(404, { message: "Unknown fixture path" });
});
server.listen(54329, "127.0.0.1");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3100"], { stdio: "inherit", env: {
  ...process.env, SUPABASE_URL: "http://127.0.0.1:54329", SUPABASE_ANON_KEY: "fixture-anon", SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
  NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", APP_ORIGIN: "http://localhost:3100", ADMIN_USER_IDS: ids.alice, RECOVERY_ALLOW_GAME_WRITES: "false",
} });
const stop = () => { child.kill(); server.closeAllConnections(); server.close(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
child.on("exit", code => { server.close(); process.exitCode = code || 0; });
