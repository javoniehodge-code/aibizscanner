# AIBizScanner internal report testing app (`web/`)

Private, admin-only Next.js app for testing whether the Full Business Diagnostic
(`../design/reports/full-business-diagnostic.dc.html`) can be filled accurately and
automatically. See the build brief: [`../docs/build/internal-testing-app.md`](../docs/build/internal-testing-app.md).

Stack: Next.js (App Router, TypeScript strict) · Supabase (Postgres, Auth) via `@supabase/ssr` · zod · Vitest.

## Local development

Requirements: Node 22+, npm.

```bash
cd web
npm install
cp .env.example .env.local   # then fill in values (see below)
npm run dev                  # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run typecheck` | Generate Next route types, then `tsc --noEmit` |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript rules) |
| `npm test` | Unit tests (Vitest, `src/**/*.test.ts`) |
| `npm run build` | Production build (works without env vars; they are read at request time) |
| `npm run e2e` | Playwright end-to-end tests against a local Supabase stack (see below) |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from the local database (needs the Supabase CLI; CI fails if it is stale) |

CI (`.github/workflows/ci.yml`) runs on every pull request:

- **web**: install, typecheck, lint, unit tests, build.
- **database**: starts a local Supabase Postgres, applies every migration in `../supabase/migrations`, runs the pgTAP tests in `../supabase/tests` (RLS and append-only rules) and `supabase db lint`.
- **e2e**: starts local Supabase (database, auth, REST), builds the app and runs Playwright.

`.github/workflows/deploy-migrations.yml` applies migrations to the hosted Supabase project on pushes to `main` (skips with a notice if the repository secrets are not set).

## Database

Migrations live in `../supabase/migrations` (standard Supabase CLI layout). With the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker:

```bash
cd ..                     # repository root
supabase start            # local Postgres + Auth + REST; prints local URL and keys
supabase test db          # pgTAP tests
supabase db reset         # re-apply all migrations from scratch
```

Access model: every table has row level security; only users listed in `admin_user` can read or write.
`engine_answer`, `page_snapshot`, `listing_snapshot`, `usage_event`, `pricing`, `finding` and `finding_review`
are append-only (database triggers refuse UPDATE and DELETE). `stage_run` rows may only change status,
scheduling, error and usage fields until they finish; then they are frozen. Reruns insert new rows.

## Auth

- `/login` is the only route reachable without a session (`src/proxy.ts`). There is no sign-up UI, and sign-ups must be disabled in Supabase.
- Pages under `src/app/(admin)` call `requireAdmin()`: a signed-in user who is not in `admin_user` sees `/no-access`.
- `/health` (admin only) runs a live query and shows the deployed git commit.

## Screens

- `/businesses`: list of test businesses; `/businesses/new` and `/businesses/[id]/edit` share one form (brief §3.1).
  Validation runs on the server (`src/lib/business/schema.ts`, zod). The Google Places identity check is Milestone 2;
  the form shows a placeholder and never contacts Google.

## Stage runner (report engine + worker)

- **Engine** (`src/engine/`): stage registry (`index.ts`), stage definitions (`stages/`), the executor (`execute.ts`)
  and pure helpers (cost, backoff, inputs hash). Each stage declares `id`, `inputs` (upstream stages), timeout,
  max attempts, a params parser and `run(ctx)`. Stages spend money only through `ctx.paidCall`, which checks the
  report's spending cap first and logs tokens, search calls, estimated USD (with the `pricing` row) and duration.
  The engine imports nothing from the worker, Next.js or Supabase (ESLint enforces it); storage goes through the
  `RunStore` port.
- **Queue**: `stage_run` rows. `enqueue_stage_run` inserts the next version (reruns never overwrite) and marks the
  latest downstream runs stale. The worker claims due rows with `FOR UPDATE SKIP LOCKED`, increments `attempt`
  (used as a fencing token), sets a lease, and either finishes the run (`done`/`partial`/`failed`) or re-queues it
  with exponential backoff. Expired leases count as a failed attempt.
- **Worker** (`src/worker/`, `src/app/api/worker/tick/route.ts`): `POST /api/worker/tick` with
  `Authorization: Bearer $CRON_SECRET`. Each tick runs for at most ~50 s and only claims runs whose timeout fits.
- **Schedule**: Supabase `pg_cron` + `pg_net` call the endpoint every minute
  (`supabase/migrations/20261112000300_worker_cron.sql`). The URL and secret are read from Supabase Vault
  (`worker_tick_url`, `worker_cron_secret`); until both are set the job does nothing.
- **Run monitor**: `/reports/[id]/runs` shows each stage's latest status, attempts, time, tokens, search calls,
  cost and errors, every version, every paid call, report totals, "Rerun this stage", and "Process queue now"
  (runs one tick immediately, same code path).
- Milestone 1 registers two dummy stages: `dummy_priced_call` (a fake priced call against the `dummy/fake-model-1`
  price row; no AI API is called) and `dummy_summary` (reads its output, to show stale marking).

## End-to-end tests

```bash
cd .. && supabase start && cd web
# .env.local must point at the local stack: API_URL, PUBLISHABLE_KEY and SECRET_KEY from `supabase status`,
# plus any CRON_SECRET of 32+ characters
npm run build
npm run e2e
```

The global setup creates two local test users (one admin, one not). It refuses to run against anything but `127.0.0.1`/`localhost`.
To use an already-installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; otherwise run `npx playwright install chromium`.

## Environment variables

Copy `.env.example` to `.env.local`. Never commit real values.

| Name | Where to find it | Used by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → Data API → Project URL | browser + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → Project Settings → API Keys → publishable key (the legacy `anon` key also works) | browser + server |
| `SUPABASE_SECRET_KEY` | Supabase dashboard → Project Settings → API Keys → secret key (legacy `service_role` also works). Locally: `supabase status` | worker (server only), e2e setup |
| `CRON_SECRET` | You generate it: `openssl rand -hex 32` (at least 32 characters). Store the same value in Supabase Vault as `worker_cron_secret` | `/api/worker/tick` bearer auth |

The deployed git commit on `/health` comes from `VERCEL_GIT_COMMIT_SHA` (set automatically by Vercel) or `git rev-parse HEAD` at build time.

Later milestones add server-only variables; they are listed here as they are introduced.
