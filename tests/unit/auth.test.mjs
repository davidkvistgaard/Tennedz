import test from "node:test";
import assert from "node:assert/strict";
import { loginEmail, passwordChangeInput, selectOwnedTeam, assertTeamId, assertSameOrigin, assertAdmin } from "../../lib/auth/policy.mjs";

test("password change requires the old secret, a distinct strong new secret and matching confirmation", () => {
  const valid = { current_password: "old-password", new_password: "fresh-password-2026", confirm_password: "fresh-password-2026" };
  assert.deepEqual(passwordChangeInput(valid), { current: valid.current_password, next: valid.new_password });
  for (const bad of [null, {}, { ...valid, confirm_password: "different" }, { ...valid, new_password: "short", confirm_password: "short" }, { ...valid, new_password: valid.current_password, confirm_password: valid.current_password }, { ...valid, extra: true }]) {
    assert.throws(() => passwordChangeInput(bad), { status: 400 });
  }
});

test("historical usernames resolve to Supabase email accounts", () => {
  assert.equal(loginEmail(" Tennedz "), "tennedz@tennedz.local");
  assert.equal(loginEmail("Owner@Example.com"), "owner@example.com");
  for (const bad of [null, "", "user name", "a@b", "x".repeat(255)]) assert.throws(() => loginEmail(bad));
});
test("team ownership fails closed instead of creating or guessing", () => {
  const team = { id: "team-a", user_id: "user-a" };
  assert.equal(selectOwnedTeam([team], "user-a"), team);
  assert.throws(() => selectOwnedTeam([], "user-a"), { code: "TEAM_NOT_LINKED" });
  assert.throws(() => selectOwnedTeam([team, team], "user-a"), { code: "TEAM_LINK_CONFLICT" });
  assert.throws(() => selectOwnedTeam([team], "user-b"), { code: "TEAM_LINK_CONFLICT" });
  assert.throws(() => assertTeamId("team-b", "team-a"), { status: 403 });
});
test("cross-site and origin-less mutations are rejected", () => {
  const request = (origin, site) => new Request("https://game.example/api/auth/login", { headers: { ...(origin ? { origin } : {}), ...(site ? { "sec-fetch-site": site } : {}) } });
  assert.doesNotThrow(() => assertSameOrigin(request("https://game.example")));
  for (const req of [request(), request("https://evil.example"), request("https://game.example", "cross-site")]) assert.throws(() => assertSameOrigin(req), { status: 403 });
});
test("administrator access requires exact server allowlist membership", () => {
  assert.doesNotThrow(() => assertAdmin("admin-a", " admin-a,admin-b "));
  for (const value of ["admin", "admin-c", "", undefined]) assert.throws(() => assertAdmin(value, "admin-a"), { status: 403 });
});
