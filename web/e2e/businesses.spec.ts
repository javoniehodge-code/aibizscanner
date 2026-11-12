import { expect, test } from "@playwright/test";
import { ADMIN } from "./users";
import { signIn } from "./helpers";

test("admin adds a business, sees validation errors, then edits it", async ({ page }) => {
  const name = `E2E Movers ${Date.now()}`;
  await signIn(page, ADMIN.email, ADMIN.password, "/login?next=/businesses/new");
  await expect(page.getByRole("heading", { name: "Add business" })).toBeVisible();
  await expect(page.getByTestId("identity-check-placeholder")).toContainText("Milestone 2");

  // Server-side validation: required fields and a bad website; entered values are kept.
  await page.getByLabel("Business name *").fill(name);
  await page.getByLabel("Website").fill("ftp://bad.example");
  await page.getByRole("button", { name: "Add business" }).click();
  await expect(page.getByText("Category is required")).toBeVisible();
  await expect(page.getByText("Location (city) is required")).toBeVisible();
  await expect(page.getByText("Website must use http or https")).toBeVisible();
  await expect(page.getByLabel("Business name *")).toHaveValue(name);

  await page.getByLabel("Website").fill("e2e-movers.example.com");
  await page.getByLabel("Category *").fill("Moving company");
  await page.getByLabel("Location (city) *").fill("Brooklyn, NY");
  await page.getByLabel("Relevant services").fill("Local moves\nPacking, Storage");
  await page.getByLabel("Other domains").fill("www.e2e-storage.example.com");
  await page.getByRole("button", { name: "Add business" }).click();

  await expect(page).toHaveURL(/\/businesses\?saved=/);
  const row = page.getByTestId("business-row").filter({ hasText: name });
  await expect(row).toContainText("Moving company");
  await expect(row).toContainText("Local moves, Packing, Storage");
  await expect(row).toContainText("e2e-movers.example.com");

  await row.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByLabel("Other domains")).toHaveValue("e2e-movers.example.com\ne2e-storage.example.com");
  await page.getByLabel("Service area").fill("New York City");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/businesses\?saved=/);
  await expect(page.getByTestId("business-row").filter({ hasText: name })).toContainText("New York City");
});
