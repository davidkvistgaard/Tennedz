import { test, expect } from "@playwright/test";
async function login(page, name = "alice") {
  await page.goto("/login");
  await page.getByLabel("Login-navn").fill(name);
  await page.getByLabel("Kodeord").fill("fixture-password");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
}

test("login, reload, navigation, second tab and logout share one secure session", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await login(page);
  await expect(page.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/team-smoke.png", fullPage: true });
  const cookies = await context.cookies();
  expect(cookies.some(c => c.name.includes("auth-token"))).toBe(true);
  expect(cookies.filter(c => c.name.includes("auth-token")).every(c => c.httpOnly && c.secure)).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("auth-token");
  await page.reload();
  await expect(page.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  await page.goto("/team/run");
  await expect(page.getByText("Klar ✅", { exact: false }).first()).toBeVisible();
  await page.goto("/team/history");
  await expect(page.getByText("Ingen løb fundet endnu.", { exact: false })).toBeVisible();
  await page.goto("/team");
  const second = await context.newPage();
  await second.goto("/team");
  await expect(second.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log ud", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(second.getByText("ALICE Cycling", { exact: true })).toHaveCount(0);
  await expect(second.getByRole("heading", { name: "Log ind for at se dit hold" })).toBeVisible();
  expect((await context.request.get("/api/auth/me")).status()).toBe(401);
  expect(errors).toEqual([]);
  await second.close();
});

test("an expired stored session refreshes through Supabase before team access", async ({ page, context }) => {
  await login(page);
  await expect(page.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  const cookies = (await context.cookies()).filter(c => c.name.includes("auth-token"));
  expect(cookies).toHaveLength(1);
  const cookie = cookies[0];
  const stored = JSON.parse(Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString());
  const oldToken = stored.access_token;
  stored.expires_at = 1;
  await context.addCookies([{ ...cookie, value: "base64-" + Buffer.from(JSON.stringify(stored)).toString("base64url") }]);
  await page.reload();
  await expect(page.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  const refreshed = (await context.cookies()).find(c => c.name.includes("auth-token"));
  expect(JSON.parse(Buffer.from(refreshed.value.replace(/^base64-/, ""), "base64url").toString()).access_token).not.toBe(oldToken);
});

test("revoked session cannot read cached team data after reload", async ({ page, context }) => {
  await login(page);
  await expect(page.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find(c => c.name.includes("auth-token"));
  const stored = JSON.parse(Buffer.from(cookie.value.replace(/^base64-/, ""), "base64url").toString());
  await context.request.post("http://127.0.0.1:54329/auth/v1/logout", { headers: { Authorization: `Bearer ${stored.access_token}` } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Log ind for at se dit hold" })).toBeVisible();
  await expect(page.getByText("ALICE Cycling", { exact: true })).toHaveCount(0);
});

test("invalid password is rejected without custom-auth fallback", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Login-navn").fill("alice");
  await page.getByLabel("Kodeord").fill("wrong");
  await page.getByRole("button", { name: "Log ind", exact: true }).click();
  await expect(page.getByText("Forkert e-mail/brugernavn eller kodeord.", { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

for (const name of ["missing", "duplicate"]) test(`${name} team link fails closed`, async ({ page }) => {
  await login(page, name);
  await expect(page.getByRole("heading", { name: "Dit hold kunne ikke åbnes" })).toBeVisible();
  await expect(page.getByText("Kontakt administratoren.", { exact: false }).or(page.getByText("Ingen data er ændret.", { exact: false }))).toBeVisible();
});

test("ownership, origin and retired mutation endpoints are enforced server-side", async ({ page, context }) => {
  expect((await context.request.get("/api/events")).status()).toBe(401);
  expect((await context.request.post("/api/auth/login", { data: { login_name: "alice", password: "fixture-password" }, headers: { Origin: "https://evil.example" } })).status()).toBe(403);
  await login(page);
  expect((await context.request.post("/api/my-history", { headers: { Origin: "http://localhost:3100" }, data: { team_id: "team-bob" } })).status()).toBe(403);
  for (const path of ["run-event", "run-race", "run-stage", "game-tick", "admin/reset", "event/join"]) {
    expect((await context.request.post(`/api/${path}`, { headers: { Origin: "http://localhost:3100" }, data: {} })).status()).toBe(503);
  }
  expect((await context.request.post("/api/admin/create-login", { data: {} })).status()).toBe(410);
});

test("account switch clears old team in an already open tab", async ({ page, context }) => {
  await login(page);
  const second = await context.newPage();
  await second.goto("/team");
  await expect(second.getByText("ALICE Cycling", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log ud", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "bob");
  await expect(second.getByText("BOB Cycling", { exact: true })).toBeVisible();
  await expect(second.getByText("ALICE Cycling", { exact: true })).toHaveCount(0);
  await second.close();
});
