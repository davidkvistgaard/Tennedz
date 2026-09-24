// Real HTTP checks; no browser automation, no production credentials or data.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { request } from "@playwright/test";
import { readTestConfig } from "./real-project.mjs";

const config = readTestConfig();
const fixtures = JSON.parse(readFileSync(new URL("../../.recovery-local/real-test-fixtures.json", import.meta.url), "utf8"));
const origin = "http://localhost:3100";
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.message }); console.log(`FAIL ${name}: ${error.message}`); }
}
const contexts = [];
async function client(storageState) {
  const value = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin }, storageState });
  contexts.push(value);
  return value;
}
async function login(c, name) {
  const f = fixtures[name];
  const res = await c.post("/api/auth/login", { data: { login_name: f.email, password: f.password } });
  assert.equal(res.status(), 200, "login HTTP status");
  assert.deepEqual(await res.json(), { ok: true }, "login response must not expose tokens");
}
try {
  const alice = await client();
  await check("unauthenticated requests are rejected", async () => {
    assert.equal((await alice.get("/api/auth/me")).status(), 401);
    assert.equal((await alice.get("/api/events")).status(), 401);
  });
  await check("login and owned team/rider lookup", async () => {
    await login(alice, "alice");
    const res = await alice.get("/api/auth/me");
    assert.equal(res.status(), 200);
    const body = await res.json();
    assert.equal(body.user.id, fixtures.alice.id);
    assert.equal(body.team.id, fixtures.alice.teamIds[0]);
    assert.ok(body.riders.length >= 1);
    assert.ok(body.riders.every(r => r.name.startsWith("ALICE ")));
    assert.match(res.headers()["cache-control"], /no-store/);
  });
  await check("secure HttpOnly cookies and navigation APIs", async () => {
    const cookies = (await alice.storageState()).cookies.filter(c => c.name.includes("auth-token"));
    assert.ok(cookies.length > 0);
    assert.ok(cookies.every(c => c.httpOnly && c.secure && c.sameSite === "Lax"));
    for (const path of ["/api/events", "/api/game-date", "/api/auth/me"]) assert.equal((await alice.get(path)).status(), 200, path);
    const history = await alice.post("/api/my-history", { data: {} });
    assert.equal(history.status(), 200);
    assert.ok((await history.json()).rows.every(r => r.team_id === fixtures.alice.teamIds[0]));
  });
  await check("forged team ownership and origin rejected", async () => {
    assert.equal((await alice.post("/api/my-history", { data: { team_id: fixtures.bob.teamIds[0] } })).status(), 403);
    assert.equal((await alice.post("/api/auth/logout", { headers: { Origin: "https://evil.example" } })).status(), 403);
    const wrong = await client();
    assert.equal((await wrong.post("/api/auth/login", { data: { login_name: fixtures.alice.email, password: "incorrect" } })).status(), 401);
  });
  for (const name of ["missing", "duplicate"]) await check(`${name} team fails closed`, async () => {
    const c = await client();
    await login(c, name);
    assert.equal((await c.get("/api/auth/me")).status(), 409);
  });
  await check("second account only receives its own team", async () => {
    const bob = await client();
    await login(bob, "bob");
    const res = await bob.get("/api/auth/me");
    assert.equal(res.status(), 200);
    const body = await res.json();
    assert.equal(body.team.id, fixtures.bob.teamIds[0]);
    assert.ok(body.riders.length >= 1 && body.riders.every(r => r.name.startsWith("BOB ")));
  });
  await check("authenticated direct database access is blocked", async () => {
    const state = await alice.storageState();
    const combined = state.cookies.filter(c => c.name.includes("auth-token")).sort((a,b) => a.name.localeCompare(b.name)).map(c => c.value).join("");
    const stored = JSON.parse(Buffer.from(combined.replace(/^base64-/, ""), "base64url").toString());
    const res = await fetch(`${config.url}/rest/v1/teams?select=id`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${stored.access_token}` } });
    assert.equal(res.status, 403);
  });
  await check("expired stored session refreshes against real Supabase", async () => {
    const state = await alice.storageState();
    const chunks = state.cookies.filter(c => c.name.includes("auth-token")).sort((a,b) => a.name.localeCompare(b.name));
    const combined = chunks.map(c => c.value).join("");
    const stored = JSON.parse(Buffer.from(combined.replace(/^base64-/, ""), "base64url").toString());
    const oldRefresh = stored.refresh_token;
    stored.expires_at = 1;
    const baseName = chunks[0].name.replace(/\.\d+$/, "");
    state.cookies = state.cookies.filter(c => !c.name.includes("auth-token"));
    state.cookies.push({ ...chunks[0], name: baseName, value: "base64-" + Buffer.from(JSON.stringify(stored)).toString("base64url") });
    const c = await client(state);
    assert.equal((await c.get("/api/auth/me")).status(), 200);
    const updated = (await c.storageState()).cookies.filter(c => c.name.includes("auth-token")).sort((a,b) => a.name.localeCompare(b.name)).map(c => c.value).join("");
    assert.notEqual(JSON.parse(Buffer.from(updated.replace(/^base64-/, ""), "base64url").toString()).refresh_token, oldRefresh);
  });
  await check("logout clears session cookies and denies subsequent access", async () => {
    await login(alice, "alice");
    assert.equal((await alice.post("/api/auth/logout")).status(), 200);
    assert.equal((await alice.get("/api/auth/me")).status(), 401);
    assert.equal((await alice.storageState()).cookies.filter(c => c.name.includes("auth-token")).length, 0);
  });
  await check("replaying a logged-out session is rejected", async () => {
    await login(alice, "alice");
    const saved = await alice.storageState();
    assert.equal((await alice.post("/api/auth/logout")).status(), 200);
    const replay = await client(saved);
    assert.equal((await replay.get("/api/auth/me")).status(), 401, "logged-out cookie must not reopen team data");
  });
  await check("anonymous direct database access is blocked", async () => {
    const res = await fetch(`${config.url}/rest/v1/teams?select=id`, { headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` } });
    assert.ok([401,403].includes(res.status));
  });
} finally {
  await Promise.all(contexts.map(c => c.dispose()));
  writeFileSync(new URL("../../.recovery-local/real-api-results.json", import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
}
if (results.some(r => !r.passed)) process.exitCode = 1;
