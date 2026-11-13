import { expect, test } from "@playwright/test";
import { ADMIN } from "./users";
import { signIn } from "./helpers";

test("admin loads the example reports and views them inside the app, rendered from JSON", async ({ page }) => {
  await signIn(page, ADMIN.email, ADMIN.password, "/login?next=/reports");
  await page.getByRole("button", { name: "Load example reports" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  // Loading twice changes nothing.
  await page.getByRole("button", { name: "Load example reports" }).click();
  for (const name of ["Brownstone Movers", "MVP Miami"]) {
    await expect(page.getByTestId("report-row").filter({ hasText: name })).toHaveCount(1);
  }

  await page.getByTestId("report-row").filter({ hasText: "Brownstone Movers" }).getByRole("link", { name: "View report" }).click();
  await expect(page.getByTestId("report-source")).toContainText("Example report (fixture: brownstone)");
  const frame = page.frameLocator('[data-testid="report-frame"]');
  await expect(frame.locator("#dc-root")).toContainText("AI Business Diagnostics Report", { timeout: 30_000 });
  await expect(frame.locator("#dc-root")).toContainText("Brownstone Movers");

  await page.goto("/reports");
  await page.getByTestId("report-row").filter({ hasText: "MVP Miami" }).getByRole("link", { name: "View report" }).click();
  const mvp = page.frameLocator('[data-testid="report-frame"]');
  await expect(mvp.locator("#dc-root")).toContainText("MVP Miami", { timeout: 30_000 });
  await expect(mvp.locator("#dc-root")).not.toContainText("Brownstone");
});

test("the report document is not served without a session", async ({ page }) => {
  await page.goto("/reports/00000000-0000-0000-0000-000000000000/document");
  await expect(page).toHaveURL(/\/login/);
});
