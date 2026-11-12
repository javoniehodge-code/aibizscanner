import { expect, test } from "@playwright/test";
import { ADMIN, NON_ADMIN } from "./users";
import { signIn } from "./helpers";

test("signed-out visitors are sent to /login, which has no sign-up", async ({ page }) => {
  await page.goto("/health");
  await expect(page).toHaveURL(/\/login\?next=%2Fhealth$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText(/sign up|create account|register/i)).toHaveCount(0);
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Email or password is incorrect.");
});

test("admin signs in, returns to the requested page, and /health shows a live DB connection", async ({ page }) => {
  await page.goto("/health");
  await signIn(page, ADMIN.email, ADMIN.password, page.url());
  await expect(page).toHaveURL(/\/health$/);
  await expect(page.getByTestId("db-status")).toHaveText("Connected");
  await expect(page.getByTestId("git-commit")).not.toHaveText("");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/health");
  await expect(page).toHaveURL(/\/login/);
});

test("a signed-in user who is not in admin_user gets the no-access page", async ({ page }) => {
  await signIn(page, NON_ADMIN.email, NON_ADMIN.password);
  await expect(page).toHaveURL(/\/no-access$/);
  await expect(page.getByRole("heading", { name: "No access" })).toBeVisible();
  await page.goto("/health");
  await expect(page).toHaveURL(/\/no-access$/);
});

test("Supabase Auth refuses sign-up (enable_signup = false)", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.signUp({ email: "should-not-exist@example.test", password: "x-password-123" });
  expect(error?.message ?? "").toMatch(/signups? not allowed/i);
  expect(data.user).toBeNull();
});
