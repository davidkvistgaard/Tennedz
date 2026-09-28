import { test, expect } from "@playwright/test";

test("manager can change a Supabase password without losing the team", async ({ page, context }) => {
  const endpoint = "http://localhost:3100/api/auth/password";
  const payload = { current_password: "fixture-password", new_password: "new-secure-password-2026", confirm_password: "new-secure-password-2026" };
  expect((await context.request.post(endpoint, { headers: { Origin: "http://localhost:3100" }, data: payload })).status()).toBe(401);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Email or username").fill("settings");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Manager profile" })).toContainText("settings@tennedz.local");

  expect((await context.request.post(endpoint, { headers: { Origin: "https://another.example" }, data: payload })).status()).toBe(403);
  await page.getByLabel("Current password").fill("wrong-password");
  await page.getByLabel("New password", { exact: true }).fill(payload.new_password);
  await page.getByLabel("Confirm new password").fill(payload.confirm_password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator(".account-settings-error")).toContainText("current password is incorrect");

  await page.getByLabel("Current password").fill(payload.current_password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator(".account-settings-success")).toContainText("Password changed");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Account settings" })).toBeVisible();
  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "SETTINGS Cycling", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email or username").fill("settings");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email/username or password" })).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(payload.new_password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole("heading", { name: "SETTINGS Cycling", exact: true })).toBeVisible();
});
