import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { ADMIN } from "./users";
import { signIn } from "./helpers";

// No AI provider keys are set in e2e, so every engine is "not configured": this checks the whole chain (approval,
// queue, automatic next steps, evidence rows, assembly, results page) without calling any paid API.
test("approving a prompt set runs the prompt analysis chain to an assembled result", async ({ page, request }) => {
  test.setTimeout(120_000);
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const name = `E2E Prompts ${Date.now()}`;
  const biz = await db.from("business").insert({ name, category: "Luxury rentals", location: "Miami, FL", domains: ["example-e2e.com"] }).select("id").single();
  expect(biz.error).toBeNull();
  const rep = await db.from("report").insert({ business_id: biz.data!.id }).select("id").single();
  expect(rep.error).toBeNull();
  const id = rep.data!.id;

  await signIn(page, ADMIN.email, ADMIN.password, `/login?next=/reports/${id}/prompts`);
  await expect(page.getByRole("heading", { name: `Prompt set — ${name} v1` })).toBeVisible();
  // Starts from the MVP Miami example questions.
  await expect(page.getByTestId("prompts")).toHaveValue(/Best exotic car rental companies in Miami/);

  await page.getByTestId("prompts").fill("1 | Observed demand | Best exotic car rental in Miami\n9 | Observed demand | Yachts?");
  await page.getByTestId("approve-and-run").click();
  await expect(page.getByRole("alert").filter({ hasText: "Question line 2" })).toContainText("group must be a number from 1 to 3.");

  await page.getByTestId("prompts").fill("1 | Observed demand | Best exotic car rental in Miami\n2 | Observed demand | Where can I rent a yacht in Miami?");
  await page.getByTestId("approve-and-run").click();
  await expect(page).toHaveURL(new RegExp(`/reports/${id}/prompt-analysis$`));
  await expect(page.getByTestId("pa-progress")).toContainText("Prompt set: queued");

  const tick = await request.post("/api/worker/tick", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` }, timeout: 100_000 });
  expect(tick.status()).toBe(200);
  const stages = ((await tick.json()) as { runs: { stage: string }[] }).runs.map((r) => r.stage);
  for (const s of ["pa_prompt_set", "pa_answers_chatgpt", "pa_answers_claude", "pa_answers_gemini", "pa_extract", "pa_assemble"]) expect(stages).toContain(s);

  await page.reload();
  await expect(page.getByTestId("pa-summary")).toContainText("0 of 6 answers usable (2 questions × 3 engines)");
  await expect(page.getByTestId("pa-questions")).toContainText("Unavailable: ChatGPT is not configured (its API key is not set)");

  const answers = await db.from("engine_answer").select("engine, prompt_id, status").eq("report_id", id);
  expect(answers.data).toHaveLength(6);
  expect(new Set(answers.data!.map((a) => a.status))).toEqual(new Set(["unavailable"]));
  const sets = await db.from("prompt_set").select("version, approved_at").eq("report_id", id);
  expect(sets.data).toEqual([expect.objectContaining({ version: 1 })]);
});
