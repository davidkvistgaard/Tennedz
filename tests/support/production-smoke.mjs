// No credentials, writes to game data, or access to authenticated user data.
import assert from "node:assert/strict";
const origin = "https://tennedz.eu";
const checks = [
  ["GET", "/login", undefined, 200],
  ["GET", "/api/auth/me", undefined, 401],
  ["GET", "/api/events", undefined, 401],
  ["GET", "/api/admin/stats", undefined, 401],
  ["GET", "/api/leaderboards", undefined, 401],
  ["POST", "/api/event/join", {}, 401],
  ["POST", "/api/admin/run-event", {}, 401],
  ["POST", "/api/my-history", {}, 401],
  ["POST", "/api/auth/login", {}, 400],
];
for (const [method, path, body, expected] of checks) {
  const response = await fetch(origin + path, {
    method, headers: { Origin: origin, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, expected, `${method} ${path}`);
  if (path.startsWith("/api/")) assert.match(response.headers.get("cache-control") || "", /no-store/);
  console.log(`PASS ${method} ${path}: ${response.status}`);
}
const crossSite = await fetch(origin + "/api/auth/login", {
  method: "POST", headers: { Origin: "https://example.invalid", "Content-Type": "application/json" },
  body: "{}", signal: AbortSignal.timeout(20000),
});
assert.equal(crossSite.status, 403);
console.log("PASS foreign-origin login rejected: 403");
