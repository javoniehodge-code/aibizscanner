import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN } from "./users";
import { signIn } from "./helpers";

const cronSecret = () => {
  const s = process.env.CRON_SECRET;
  if (!s) throw new Error("e2e needs CRON_SECRET");
  return s;
};

test("worker endpoint rejects requests without the cron secret", async ({ request }) => {
  expect((await request.post("/api/worker/tick")).status()).toBe(401);
  const wrong = await request.post("/api/worker/tick", { headers: { Authorization: "Bearer wrong" } });
  expect(wrong.status()).toBe(401);
  // GET is not an entry point.
  expect((await request.get("/api/worker/tick", { headers: { Authorization: `Bearer ${cronSecret()}` } })).status()).toBe(405);
});

test("dummy stage runs through the queue and worker, records cost, and reruns mark downstream stale", async ({ page, request }) => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const name = `E2E Runner ${Date.now()}`;
  const { error } = await db.from("business").insert({ name, category: "Test", location: "Nowhere" });
  expect(error).toBeNull();

  await signIn(page, ADMIN.email, ADMIN.password, "/login?next=/reports");
  await page.getByLabel("New test report for").selectOption({ label: name });
  await page.getByRole("button", { name: "Create report" }).click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]+\/runs$/);
  await expect(page.getByRole("heading", { name: `Run monitor — ${name} v1` })).toBeVisible();

  const priced = page.getByTestId("stage-dummy_priced_call");
  const summary = page.getByTestId("stage-dummy_summary");

  // Downstream stage cannot run before its input exists.
  await summary.getByRole("button", { name: "Run" }).click();
  await expect(summary.getByRole("status")).toHaveText(/Run "dummy_priced_call" first/);

  await priced.getByRole("button", { name: "Run" }).click();
  // Once queued, the row shows the queued run instead of the button.
  await expect(priced).toContainText("queued v1");
  await expect(priced).toContainText("in queue");

  // The worker endpoint, exactly as pg_cron calls it.
  const tick = await request.post("/api/worker/tick", { headers: { Authorization: `Bearer ${cronSecret()}` } });
  expect(tick.status()).toBe(200);
  const body = await tick.json();
  expect(body.runs).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "dummy_priced_call", outcome: "done", costUsd: 0.0118 })]));

  await page.reload();
  await expect(priced).toContainText("done");
  await expect(page.getByTestId("cost-dummy_priced_call")).toHaveText("$0.0118");
  await expect(priced).toContainText("1,200 / 300");
  await expect(page.getByTestId("report-totals")).toContainText("Total estimated cost $0.0118 of $5.0000 cap");

  // Downstream stage via the "Process queue now" button (same tick code).
  await summary.getByRole("button", { name: "Run" }).click();
  await expect(summary).toContainText("queued v1");
  await page.getByRole("button", { name: "Process queue now" }).click();
  await expect(page.getByText("Processed dummy_summary: done.")).toBeVisible();
  await page.reload();
  await expect(summary).toContainText("done");
  await expect(summary).not.toContainText("stale");

  // Rerun the upstream stage: new version, old one kept, downstream marked stale.
  await priced.getByRole("button", { name: "Rerun this stage" }).click();
  await expect(priced).toContainText("queued v2");
  await page.getByRole("button", { name: "Process queue now" }).click();
  await expect(page.getByText("Processed dummy_priced_call: done.")).toBeVisible();
  await page.reload();
  await expect(priced).toContainText("done v2");
  await expect(summary).toContainText("stale");
  await expect(page.getByTestId("run-history-row").filter({ hasText: "dummy_priced_call" })).toHaveCount(2);
  await expect(page.getByTestId("report-totals")).toContainText("Total estimated cost $0.0236");
});
