import { test, expect } from "@playwright/test";
for (const width of [390, 1440])
  test(`Race Lab calculates, inspects and compares isolated races at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/race-lab");
    await expect(
      page.getByRole("heading", { name: "Race Lab", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("Amber’s plan", { exact: true })
      .selectOption("break");
    await page
      .getByRole("button", { name: "Calculate one race", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Race inspection" }),
    ).toBeVisible();
    const slider = page.getByRole("slider", { name: "Recorded stage" });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(
      page.getByText("160 km ridden", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/wins with .* energy remaining/)).toBeVisible();
    await page.getByLabel("Paired seeds", { exact: true }).selectOption("20");
    await page
      .getByRole("button", { name: "Compare all four plans", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Strategy comparison" }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Completed 80 races");
    await page.getByLabel("Chase strength", { exact: true }).fill("9");
    await page
      .getByRole("button", { name: "Calculate one race", exact: true })
      .click();
    await expect(page.getByRole("alert").filter({ hasText: "Invalid configuration" })).toContainText(
      "Invalid configuration",
    );
    await page.getByRole("button", { name: "Reset balance" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/race-lab-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
