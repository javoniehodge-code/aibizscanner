# Report engine

The engine turns stored inputs into report data, one **stage** at a time. Code decides the order: each stage declares
the stages it reads, and the queue runs it once they are done. There are no autonomous agents; an LLM is only asked
narrow, single questions inside a stage.

The engine imports nothing from the worker, Next.js or Supabase (ESLint enforces this). It talks to storage through the
`RunStore` port (`types.ts`) and to models through the `LlmClient` port (`llm.ts`).

## Modules

Each report area is a folder under `modules/`, registered in `modules/index.ts`:

```
modules/<module>/
  index.ts          the module: id, label, stages
  stages.ts         stage definitions: wire logic and LLM calls together (StageDefinition)
  schemas.ts        zod schemas for stage params and outputs, and LLM task outputs
  logic/            deterministic code: counting, parsing, matching, URL checks, metrics. No AI, no I/O.
  instructions/     LLM instructions, one file each (defineInstruction), versioned in Git
  evals/            tests (see below)
```

A small module can keep everything in `stages.ts` until it grows; the folders are a convention, not a framework.
Planned modules (brief §4): `prompt-analysis` (stages 2–4), `website-audit` (5–7), `web-presence` (8–9),
`competitors` (10), `recommendations` (11), `report` (12), plus a small `business-identity` step (1).
Built so far: `dummy` (pipeline test) and `prompt-analysis`:

| Stage | What it does | Paid? |
| --- | --- | --- |
| `pa_prompt_set` | Freezes the approved prompt set and target business into the pipeline (queued from the prompt set screen). | no |
| `pa_answers_chatgpt` / `_claude` / `_gemini` | Asks every question to one engine with web search on (`ctx.answerEngine`), 6 at a time. Every answer, including failures, is stored in `engine_answer` with the provider's response. | yes |
| `pa_extract` | Reads each usable answer with `ctx.llm` (instruction `prompt-analysis/extract-answer`), then checks every quote against the answer in plain code; one retry, then the answer is marked unreadable. | yes (small) |
| `pa_assemble` | Builds the report's `promptAnalysis` section in plain code (`logic/section.ts`), validated against the report schema. | no |

Stages with `autoRun: true` are queued by the worker as soon as all their inputs have fresh finished runs.
Answer engines (`answers.ts`) are a port like `LlmClient`: the provider adapters (official OpenAI, Anthropic and
Google SDKs) live in `worker/providers/`, so the engine never sees keys. Models and prices: `modules/prompt-analysis/models.ts`
and the `pricing` table; setup: `docs/build/milestone-2-setup.md`.

**Plain code vs LLM.** Use plain code for anything with a definite answer: counting mentions, positions, parsing
structured data, comparing fetched facts, checking URLs, computing report metrics. Use an LLM only for interpretation:
classifying, extracting meaning from free text, comparing, wording an explanation. Keep each LLM task small enough to
evaluate on its own.

## Typed inputs and outputs

Every stage declares `output` (a zod schema). The executor:

- rejects a stage's output that doesn't match: the run fails with the schema errors in its `error`, and nothing
  invalid is stored as `done`, so it can never reach a downstream stage;
- re-checks each stored upstream output against the upstream stage's schema before a downstream stage starts, so
  outputs stored under an older schema are refused instead of silently misread.

These failures are not retried (the same code would produce the same result). Params are validated by `parseParams`
when a run is queued.

## LLM instructions and their versions

- An instruction is a TypeScript file in `modules/<module>/instructions/` created with
  `defineInstruction({ id: "module/task", version, text })`. The stage lists it in `instructions`.
- **Change the text → bump the version.** `instructions.lock.json` holds the SHA-256 of every version ever locked; a
  unit test fails if a version's text changes, or a new version isn't locked yet. Run `npm run instructions:lock` after
  adding a version. It never rewrites an existing entry.
- When a run is queued, the exact versions (id, version, sha256) are recorded on `stage_run.instruction_refs` and
  included in its inputs hash. A run refuses to start if the code's instructions changed since it was queued.
- On first use the worker stores each version's full text in `llm_instruction`, so a past report can be inspected
  after the code moves on (also in Git history).

## The LLM helper (`ctx.llm`)

`ctx.llm({ instruction, model, input, output })` makes one call and returns validated output.

- **Models differ.** `ModelSpec.capabilities` says whether a model accepts a temperature and whether it supports
  native JSON-schema output, JSON mode, or neither. Temperature 0 is sent by default only where supported; other
  provider settings (e.g. reasoning effort) pass through and are recorded.
- **Output is never trusted.** Temperature 0 doesn't make answers repeatable or correct. Output is parsed and
  validated against the zod schema every time. Invalid output fails the attempt (retried up to the stage's
  `maxAttempts`) and is recorded.
- **Everything is recorded.** Each call, valid or not, goes to `llm_call`: instruction version, model requested and
  model served, settings, input, raw response, parsed output, error and duration. Costs go through the existing
  spending cap and `usage_event`, like any paid call. Inspecting a past result means reading this record, not asking a
  model again.
- **Input is data.** The material to interpret is sent as JSON labeled untrusted; text inside it is never followed as
  instructions (brief §7).
- Provider adapters implement `LlmClient` in the worker layer, which holds the API keys. Until they are configured,
  stages that call `ctx.llm` fail with "No LLM client is configured".

## Tests: two different questions

1. **Does the processing code work?** (CI, free, deterministic)
   - Unit tests for `logic/` functions.
   - Stage tests that replay recorded model responses through `testing/FakeLlmClient`: they check parsing, validation,
     error handling and how results are assembled. They say nothing about whether a model's interpretation is right.
   - Put them in `modules/<module>/evals/*.test.ts` (or next to the code).
2. **Is the AI interpretation correct?** (run on demand, costs money, needs human-verified answers)
   - Expected results are verified by a person and stored in Supabase as `eval_case` rows: the task (instruction id),
     the exact input, links to the stored evidence it came from, and the expected output. A correction adds a new case
     that supersedes the old one.
   - A run of a model + instruction version against those cases stores one `eval_result` per case (actual output,
     pass/fail, score detail, the `llm_call`). Comparing versions means comparing their results on the same cases.
   - Scoring is plain code per task (e.g. which businesses were missed, extra, or given the wrong status), unit-tested
     like any other logic. The runner script arrives with the first real interpretation task (Milestone 2); it is
     deliberately not a general evaluation platform.

Real scan data and evidence live in Supabase only. Files committed here are code, instructions and small synthetic or
recorded test inputs.
